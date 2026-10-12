import json
import subprocess
import tempfile
from pathlib import Path

from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas
from .cache import cache
from .coach import build_coding_context, generate_coaching_note, generate_quest
from .database import Base, SessionLocal, engine, get_db
from .game import award_xp, meal_xp, nutrition_totals, rpg_stats, unlock_achievements, update_streak, workout_xp
from .seed import seed_database


app = FastAPI(title="CodeForge API", version="0.1.0")
OPTIMIZER_DIR = Path(__file__).resolve().parents[2] / "optimizer"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "cache": "redis-or-memory", "ai": "openai-or-fallback"}


@app.get("/dashboard/{user_id}", response_model=schemas.Dashboard)
def dashboard(user_id: int, db: Session = Depends(get_db)) -> schemas.Dashboard:
    user = get_user(db, user_id)
    today_nutrition = nutrition_totals(user, date.today())
    return schemas.Dashboard(
        user=user_summary(user),
        streak=user.streak,
        rpg_stats=schemas.RpgStats(**rpg_stats(user)),
        today_nutrition=schemas.MacroTargets(
            protein=today_nutrition["protein"],
            carbs=today_nutrition["carbs"],
            fat=today_nutrition["fat"],
        ),
        today_calories=today_nutrition["calories"],
        active_quests=[quest for quest in user.quests if quest.status == models.QuestStatus.active],
        achievements=user.achievements[-5:],
        recent_workouts=user.workouts[-5:],
        recent_meals=user.meals[-5:],
    )


@app.post("/users", response_model=schemas.UserSummary)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> schemas.UserSummary:
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = models.User(
        email=payload.email,
        display_name=payload.display_name,
        physique_goal=payload.physique_goal,
        calorie_goal=payload.calorie_goal,
        protein_goal=payload.macro_targets.protein,
        carbs_goal=payload.macro_targets.carbs,
        fat_goal=payload.macro_targets.fat,
    )
    db.add(user)
    db.flush()
    user.streak = models.Streak(user_id=user.id, current_days=0, best_days=0)
    db.commit()
    db.refresh(user)
    return user_summary(user)


@app.get("/users/{user_id}", response_model=schemas.UserSummary)
def get_profile(user_id: int, db: Session = Depends(get_db)) -> schemas.UserSummary:
    return user_summary(get_user(db, user_id))


@app.patch("/users/{user_id}", response_model=schemas.UserSummary)
def update_profile(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)) -> schemas.UserSummary:
    user = get_user(db, user_id)
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.physique_goal is not None:
        user.physique_goal = payload.physique_goal
    if payload.calorie_goal is not None:
        user.calorie_goal = payload.calorie_goal
    if payload.macro_targets is not None:
        user.protein_goal = payload.macro_targets.protein
        user.carbs_goal = payload.macro_targets.carbs
        user.fat_goal = payload.macro_targets.fat
    db.commit()
    db.refresh(user)
    return user_summary(user)


@app.post("/users/{user_id}/workouts", response_model=schemas.WorkoutOut)
def log_workout(user_id: int, payload: schemas.WorkoutCreate, db: Session = Depends(get_db)) -> models.WorkoutLog:
    user = get_user(db, user_id)
    xp = workout_xp(payload.intensity, payload.duration_minutes)
    workout = models.WorkoutLog(user_id=user.id, xp_awarded=xp, **payload.model_dump())
    award_xp(user, xp)
    update_streak(user)
    db.add(workout)
    unlock_achievements(user)
    db.commit()
    db.refresh(workout)
    return workout


@app.get("/users/{user_id}/workouts", response_model=list[schemas.WorkoutOut])
def list_workouts(user_id: int, db: Session = Depends(get_db)) -> list[models.WorkoutLog]:
    user = get_user(db, user_id)
    return sorted(user.workouts, key=lambda workout: workout.logged_at, reverse=True)


@app.post("/users/{user_id}/meals", response_model=schemas.MealOut)
def log_meal(user_id: int, payload: schemas.MealCreate, db: Session = Depends(get_db)) -> models.MealLog:
    user = get_user(db, user_id)
    meal = models.MealLog(user_id=user.id, **payload.model_dump())
    award_xp(user, meal_xp(payload.calories, payload.protein, user.protein_goal))
    update_streak(user)
    db.add(meal)
    unlock_achievements(user)
    db.commit()
    db.refresh(meal)
    return meal


@app.get("/users/{user_id}/meals", response_model=list[schemas.MealOut])
def list_meals(user_id: int, db: Session = Depends(get_db)) -> list[models.MealLog]:
    user = get_user(db, user_id)
    return sorted(user.meals, key=lambda meal: meal.logged_at, reverse=True)


@app.get("/users/{user_id}/nutrition", response_model=schemas.DailyNutrition)
def daily_nutrition(
    user_id: int,
    target_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db),
) -> schemas.DailyNutrition:
    user = get_user(db, user_id)
    totals = nutrition_totals(user, target_date)
    return schemas.DailyNutrition(
        date=target_date,
        calories=totals["calories"],
        calorie_goal=user.calorie_goal,
        macros=schemas.MacroTargets(protein=totals["protein"], carbs=totals["carbs"], fat=totals["fat"]),
        macro_targets=schemas.MacroTargets(protein=user.protein_goal, carbs=user.carbs_goal, fat=user.fat_goal),
    )


@app.post("/users/{user_id}/quests", response_model=schemas.QuestOut)
def create_quest(user_id: int, payload: schemas.QuestCreate, db: Session = Depends(get_db)) -> models.Quest:
    user = get_user(db, user_id)
    quest = models.Quest(user_id=user.id, **payload.model_dump())
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return quest


@app.post("/users/{user_id}/quests/generate", response_model=schemas.QuestOut)
def generate_ai_quest(user_id: int, db: Session = Depends(get_db)) -> models.Quest:
    user = get_user(db, user_id)
    payload = generate_quest(user)
    quest = models.Quest(user_id=user.id, **payload.model_dump())
    db.add(quest)
    db.commit()
    db.refresh(quest)
    return quest


@app.get("/users/{user_id}/quests", response_model=list[schemas.QuestOut])
def list_quests(user_id: int, db: Session = Depends(get_db)) -> list[models.Quest]:
    user = get_user(db, user_id)
    return sorted(user.quests, key=lambda quest: quest.due_on)


@app.post("/users/{user_id}/quests/{quest_id}/complete", response_model=schemas.QuestOut)
def complete_quest(user_id: int, quest_id: int, db: Session = Depends(get_db)) -> models.Quest:
    user = get_user(db, user_id)
    quest = db.get(models.Quest, quest_id)
    if quest is None or quest.user_id != user.id:
        raise HTTPException(status_code=404, detail="Quest not found")
    if quest.status != models.QuestStatus.completed:
        quest.status = models.QuestStatus.completed
        award_xp(user, quest.xp_reward)
        update_streak(user)
        unlock_achievements(user)
    db.commit()
    db.refresh(quest)
    return quest


@app.get("/users/{user_id}/achievements", response_model=list[schemas.AchievementOut])
def list_achievements(user_id: int, db: Session = Depends(get_db)) -> list[models.Achievement]:
    user = get_user(db, user_id)
    return sorted(user.achievements, key=lambda achievement: achievement.unlocked_at, reverse=True)


@app.post("/users/{user_id}/progress", response_model=schemas.ProgressOut)
def log_progress(user_id: int, payload: schemas.ProgressCreate, db: Session = Depends(get_db)) -> models.ProgressLog:
    user = get_user(db, user_id)
    progress = models.ProgressLog(
        user_id=user.id,
        body_weight=payload.body_weight,
        body_fat_percentage=payload.body_fat_percentage,
        strength_score=payload.strength_score,
        logged_on=payload.logged_on or date.today(),
    )
    db.add(progress)
    award_xp(user, 75)
    update_streak(user)
    unlock_achievements(user)
    db.commit()
    db.refresh(progress)
    return progress


@app.get("/users/{user_id}/progress", response_model=list[schemas.ProgressOut])
def list_progress(user_id: int, db: Session = Depends(get_db)) -> list[models.ProgressLog]:
    user = get_user(db, user_id)
    return sorted(user.progress_logs, key=lambda progress: progress.logged_on, reverse=True)


@app.get("/users/{user_id}/stats", response_model=schemas.RpgStats)
def stats(user_id: int, db: Session = Depends(get_db)) -> schemas.RpgStats:
    return schemas.RpgStats(**rpg_stats(get_user(db, user_id)))


@app.get("/users/{user_id}/coach", response_model=schemas.CoachResponse)
def coach(user_id: int, db: Session = Depends(get_db)) -> schemas.CoachResponse:
    user = get_user(db, user_id)
    cache_key = f"coach:{user.id}:{user.xp}:{len(user.workouts)}:{len(user.meals)}:{len(user.progress_logs)}"
    cached_note = cache.get_json(cache_key)
    if cached_note is not None:
        return schemas.CoachResponse(note=cached_note["note"], cached=True, context=build_coding_context(user))

    note = generate_coaching_note(user)
    cache.set_json(cache_key, {"note": note}, ttl_seconds=600)
    return schemas.CoachResponse(note=note, cached=False, context=build_coding_context(user))


@app.post("/users/{user_id}/recommendations", response_model=schemas.GeneratedPlan)
def recommendations(user_id: int, db: Session = Depends(get_db)) -> schemas.GeneratedPlan:
    user = get_user(db, user_id)
    latest_progress = sorted(user.progress_logs, key=lambda progress: progress.logged_on)[-1:]
    progress_score = latest_progress[0].strength_score / 100 if latest_progress else 0.5
    payload = schemas.OptimizationRequest(
        calorie_goal=user.calorie_goal,
        macro_targets=schemas.MacroTargets(protein=user.protein_goal, carbs=user.carbs_goal, fat=user.fat_goal),
        dietary_restrictions=[],
        available_groceries=["backend", "frontend", "tests", "docs", "refactor", "debugging"],
        recovery_time_hours=30,
        progress_score=progress_score,
        meal_plans=[
            schemas.MealPlan(
                name="Backend Feature Slice",
                calories=max(user.calorie_goal - 10, 30),
                protein=user.protein_goal,
                carbs=user.carbs_goal,
                fat=user.fat_goal,
                ingredients=["backend", "tests", "docs"],
            ),
            schemas.MealPlan(
                name="UI Polish Pass",
                calories=max(user.calorie_goal - 35, 25),
                protein=max(user.protein_goal - 1, 0),
                carbs=user.carbs_goal + 1,
                fat=user.fat_goal,
                ingredients=["frontend", "refactor", "docs"],
            ),
        ],
        workout_plans=[
            schemas.WorkoutPlan(
                name="Deep Work Block",
                intensity=7,
                duration_minutes=58,
                muscle_groups=["backend", "frontend", "tests"],
            ),
            schemas.WorkoutPlan(
                name="Debugging Sprint",
                intensity=6,
                duration_minutes=42,
                muscle_groups=["debugging", "tests", "refactor"],
            ),
        ],
    )
    return schemas.GeneratedPlan(ranked=optimize(payload), request=payload)


@app.post("/optimize", response_model=list[schemas.RankedPlan])
def optimize(payload: schemas.OptimizationRequest) -> list[schemas.RankedPlan]:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as request_file:
        json.dump(payload.model_dump(), request_file)
        request_path = request_file.name

    result = subprocess.run(
        ["cargo", "run", "--quiet", "--", request_path],
        cwd=OPTIMIZER_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    Path(request_path).unlink(missing_ok=True)

    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr.strip() or "Optimizer failed")

    return [schemas.RankedPlan(**item) for item in json.loads(result.stdout)]


def get_user(db: Session, user_id: int) -> models.User:
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def user_summary(user: models.User) -> schemas.UserSummary:
    return schemas.UserSummary(
        id=user.id,
        display_name=user.display_name,
        level=user.level,
        xp=user.xp,
        physique_goal=user.physique_goal,
        calorie_goal=user.calorie_goal,
        macro_targets=schemas.MacroTargets(
            protein=user.protein_goal,
            carbs=user.carbs_goal,
            fat=user.fat_goal,
        ),
    )
