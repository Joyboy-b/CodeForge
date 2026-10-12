from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import models


def seed_database(db: Session) -> None:
    existing = db.query(models.User).first()
    if existing:
        replacements = {
            "Protein Precision": ("Bug Hunt", "Fix one bug and write down the root cause."),
            "Push Day Trial": ("Feature Sprint", "Complete one focused feature without widening scope."),
            "Upper Hypertrophy": ("API Routes", "Backend"),
            "Lean Bulk Bowl": ("Auth Refactor", None),
            "Pull Strength": ("Parser Debugging", "Debugging"),
            "Greek Yogurt Oats": ("Frontend State Cleanup", None),
            "First Flame": ("First Commit", "Logged the first focused coding session."),
            "Macro Mage": ("Flow State", "Kept a coding streak alive for seven days."),
            "First Rep": ("First Commit", "Logged your first coding session."),
            "Meal Prep Initiate": ("Shipped Slice", "Logged your first shipped task."),
            "Streak Sentinel": ("Streak Sentinel", "Built a seven day coding streak."),
        }
        existing.display_name = "Demo Developer"
        existing.physique_goal = "Ship a polished full-stack portfolio project"
        existing.calorie_goal = 180
        existing.protein_goal = 3
        existing.carbs_goal = 2
        existing.fat_goal = 1
        for quest in existing.quests:
            if quest.title in replacements:
                quest.title, quest.description = replacements[quest.title]
        for workout in existing.workouts:
            if workout.name in replacements:
                workout.name, workout.muscle_group = replacements[workout.name]
        for meal in existing.meals:
            if meal.name in replacements:
                meal.name = replacements[meal.name][0]
                meal.calories = min(meal.calories, 90)
                meal.protein = max(1, min(meal.protein, 3))
                meal.carbs = max(1, min(meal.carbs, 3))
                meal.fat = min(meal.fat, 2)
        for achievement in existing.achievements:
            if achievement.title in replacements:
                achievement.title, achievement.description = replacements[achievement.title]
        db.commit()
        return

    user = models.User(
        email="demo@statforge.local",
        display_name="Demo Developer",
        level=8,
        xp=1840,
        physique_goal="Ship a polished full-stack portfolio project",
        calorie_goal=180,
        protein_goal=3,
        carbs_goal=2,
        fat_goal=1,
    )
    db.add(user)
    db.flush()

    db.add(models.Streak(user_id=user.id, current_days=12, best_days=21, last_activity_on=date.today()))
    db.add_all(
        [
            models.Quest(
                user_id=user.id,
                title="Bug Hunt",
                description="Fix one bug and write down the root cause.",
                xp_reward=120,
                due_on=date.today(),
            ),
            models.Quest(
                user_id=user.id,
                title="Feature Sprint",
                description="Complete one focused feature without widening scope.",
                xp_reward=160,
                due_on=date.today() + timedelta(days=1),
            ),
        ]
    )
    db.add_all(
        [
            models.Achievement(
                user_id=user.id,
                title="First Commit",
                description="Logged the first focused coding session.",
            ),
            models.Achievement(
                user_id=user.id,
                title="Flow State",
                description="Kept a coding streak alive for seven days.",
            ),
        ]
    )
    db.add_all(
        [
            models.WorkoutLog(
                user_id=user.id,
                name="API Routes",
                muscle_group="Backend",
                intensity=7,
                duration_minutes=58,
                xp_awarded=174,
            ),
            models.MealLog(
                user_id=user.id,
                name="Auth Refactor",
                calories=86,
                protein=1,
                carbs=2,
                fat=0,
            ),
            models.ProgressLog(
                user_id=user.id,
                body_weight=68,
                body_fat_percentage=41,
                strength_score=72.5,
            ),
        ]
    )
    db.commit()
