from datetime import date, datetime

from pydantic import BaseModel, Field


class MacroTargets(BaseModel):
    protein: int
    carbs: int
    fat: int


class UserCreate(BaseModel):
    email: str
    display_name: str
    physique_goal: str = "Ship a polished full-stack portfolio project"
    calorie_goal: int = Field(gt=0, default=180)
    macro_targets: MacroTargets = MacroTargets(protein=3, carbs=2, fat=1)


class UserUpdate(BaseModel):
    display_name: str | None = None
    physique_goal: str | None = None
    calorie_goal: int | None = Field(default=None, gt=0)
    macro_targets: MacroTargets | None = None


class UserSummary(BaseModel):
    id: int
    display_name: str
    level: int
    xp: int
    physique_goal: str
    calorie_goal: int
    macro_targets: MacroTargets


class RpgStats(BaseModel):
    architecture: int
    focus: int
    discipline: int
    shipping: int
    debugging: int


class WorkoutCreate(BaseModel):
    name: str
    muscle_group: str
    intensity: int = Field(ge=1, le=10)
    duration_minutes: int = Field(gt=0, le=240)


class WorkoutOut(WorkoutCreate):
    id: int
    xp_awarded: int
    logged_at: datetime

    model_config = {"from_attributes": True}


class MealCreate(BaseModel):
    name: str
    calories: int = Field(gt=0)
    protein: int = Field(ge=0)
    carbs: int = Field(ge=0)
    fat: int = Field(ge=0)


class MealOut(MealCreate):
    id: int
    logged_at: datetime

    model_config = {"from_attributes": True}


class QuestOut(BaseModel):
    id: int
    title: str
    description: str
    xp_reward: int
    status: str
    due_on: date

    model_config = {"from_attributes": True}


class QuestCreate(BaseModel):
    title: str
    description: str
    xp_reward: int = Field(gt=0)
    due_on: date


class AchievementOut(BaseModel):
    id: int
    title: str
    description: str
    unlocked_at: datetime

    model_config = {"from_attributes": True}


class StreakOut(BaseModel):
    current_days: int
    best_days: int
    last_activity_on: date

    model_config = {"from_attributes": True}


class Dashboard(BaseModel):
    user: UserSummary
    streak: StreakOut
    rpg_stats: RpgStats
    today_nutrition: MacroTargets
    today_calories: int
    active_quests: list[QuestOut]
    achievements: list[AchievementOut]
    recent_workouts: list[WorkoutOut]
    recent_meals: list[MealOut]


class ProgressCreate(BaseModel):
    body_weight: float = Field(gt=0)
    body_fat_percentage: float = Field(ge=0, le=80)
    strength_score: float = Field(ge=0, le=100)
    logged_on: date | None = None


class ProgressOut(BaseModel):
    id: int
    body_weight: float
    body_fat_percentage: float
    strength_score: float
    logged_on: date

    model_config = {"from_attributes": True}


class DailyNutrition(BaseModel):
    date: date
    calories: int
    calorie_goal: int
    macros: MacroTargets
    macro_targets: MacroTargets


class MealPlan(BaseModel):
    name: str
    calories: int
    protein: int
    carbs: int
    fat: int
    ingredients: list[str]


class WorkoutPlan(BaseModel):
    name: str
    intensity: int = Field(ge=1, le=10)
    duration_minutes: int
    muscle_groups: list[str]


class OptimizationRequest(BaseModel):
    calorie_goal: int
    macro_targets: MacroTargets
    dietary_restrictions: list[str] = []
    available_groceries: list[str] = []
    recovery_time_hours: int
    progress_score: float = Field(ge=0, le=1)
    meal_plans: list[MealPlan]
    workout_plans: list[WorkoutPlan]


class RankedPlan(BaseModel):
    name: str
    type: str
    score: float
    reason: str


class GeneratedPlan(BaseModel):
    ranked: list[RankedPlan]
    request: OptimizationRequest


class CoachResponse(BaseModel):
    note: str
    cached: bool
    context: dict
