from datetime import date, datetime, timedelta

from . import models


def award_xp(user: models.User, amount: int) -> None:
    user.xp += max(amount, 0)
    user.level = max(user.level, level_for_xp(user.xp))


def level_for_xp(xp: int) -> int:
    return max(1, (xp // 500) + 1)


def workout_xp(intensity: int, duration_minutes: int) -> int:
    return int((duration_minutes * intensity * 0.55) + 25)


def meal_xp(calories: int, protein: int, protein_goal: int) -> int:
    protein_fit = 1.0 - min(abs(protein - (protein_goal / 3)) / max(protein_goal / 3, 1), 1.0)
    return int(30 + min(calories / 100, 12) + (protein_fit * 35))


def update_streak(user: models.User, activity_at: datetime | None = None) -> None:
    today = (activity_at or datetime.utcnow()).date()
    if user.streak is None:
        user.streak = models.Streak(current_days=1, best_days=1, last_activity_on=today)
        return

    if user.streak.last_activity_on == today:
        return

    if user.streak.last_activity_on == today - timedelta(days=1):
        user.streak.current_days += 1
    else:
        user.streak.current_days = 1

    user.streak.best_days = max(user.streak.best_days, user.streak.current_days)
    user.streak.last_activity_on = today


def unlock_achievements(user: models.User) -> list[models.Achievement]:
    existing = {achievement.title for achievement in user.achievements}
    unlocked: list[models.Achievement] = []

    candidates = [
        ("First Commit", "Logged your first coding session.", len(user.workouts) >= 1),
        ("Shipped Slice", "Logged your first shipped task.", len(user.meals) >= 1),
        ("Streak Sentinel", "Built a seven day coding streak.", user.streak is not None and user.streak.current_days >= 7),
        ("Level 10 Engineer", "Reached level 10.", user.level >= 10),
        ("Progress Cartographer", "Logged three skill check-ins.", len(user.progress_logs) >= 3),
    ]

    for title, description, earned in candidates:
        if earned and title not in existing:
            achievement = models.Achievement(user_id=user.id, title=title, description=description)
            user.achievements.append(achievement)
            unlocked.append(achievement)

    return unlocked


def rpg_stats(user: models.User) -> dict[str, int]:
    strength = min(99, 10 + sum(workout.intensity for workout in user.workouts))
    endurance = min(99, 10 + sum(workout.duration_minutes for workout in user.workouts) // 20)
    discipline = min(99, 10 + ((user.streak.current_days if user.streak else 0) * 3))
    nutrition = min(99, 10 + sum(meal.protein for meal in user.meals) // 25)
    physique = min(99, 10 + len(user.progress_logs) * 8 + user.level)

    return {
        "architecture": strength,
        "focus": endurance,
        "discipline": discipline,
        "shipping": min(99, 10 + len(user.meals) * 8 + sum(meal.protein for meal in user.meals) * 6),
        "debugging": physique,
    }


def nutrition_totals(user: models.User, target_day: date) -> dict[str, int]:
    meals = [meal for meal in user.meals if meal.logged_at.date() == target_day]
    return {
        "calories": sum(meal.calories for meal in meals),
        "protein": sum(meal.protein for meal in meals),
        "carbs": sum(meal.carbs for meal in meals),
        "fat": sum(meal.fat for meal in meals),
    }
