from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class QuestStatus(str, Enum):
    active = "active"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    physique_goal: Mapped[str] = mapped_column(String(120), default="Lean athletic build")
    calorie_goal: Mapped[int] = mapped_column(Integer, default=2300)
    protein_goal: Mapped[int] = mapped_column(Integer, default=170)
    carbs_goal: Mapped[int] = mapped_column(Integer, default=230)
    fat_goal: Mapped[int] = mapped_column(Integer, default=70)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workouts: Mapped[list["WorkoutLog"]] = relationship(back_populates="user")
    meals: Mapped[list["MealLog"]] = relationship(back_populates="user")
    quests: Mapped[list["Quest"]] = relationship(back_populates="user")
    achievements: Mapped[list["Achievement"]] = relationship(back_populates="user")
    streak: Mapped["Streak"] = relationship(back_populates="user", uselist=False)
    progress_logs: Mapped[list["ProgressLog"]] = relationship(back_populates="user")


class WorkoutLog(Base):
    __tablename__ = "workout_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    muscle_group: Mapped[str] = mapped_column(String(80))
    intensity: Mapped[int] = mapped_column(Integer)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    xp_awarded: Mapped[int] = mapped_column(Integer)
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="workouts")


class MealLog(Base):
    __tablename__ = "meal_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    calories: Mapped[int] = mapped_column(Integer)
    protein: Mapped[int] = mapped_column(Integer)
    carbs: Mapped[int] = mapped_column(Integer)
    fat: Mapped[int] = mapped_column(Integer)
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="meals")


class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text)
    xp_reward: Mapped[int] = mapped_column(Integer)
    status: Mapped[QuestStatus] = mapped_column(SqlEnum(QuestStatus), default=QuestStatus.active)
    due_on: Mapped[date] = mapped_column(Date)

    user: Mapped[User] = relationship(back_populates="quests")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="achievements")


class Streak(Base):
    __tablename__ = "streaks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    current_days: Mapped[int] = mapped_column(Integer, default=0)
    best_days: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_on: Mapped[date] = mapped_column(Date, default=date.today)

    user: Mapped[User] = relationship(back_populates="streak")


class ProgressLog(Base):
    __tablename__ = "progress_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body_weight: Mapped[float] = mapped_column(Float)
    body_fat_percentage: Mapped[float] = mapped_column(Float)
    strength_score: Mapped[float] = mapped_column(Float)
    logged_on: Mapped[date] = mapped_column(Date, default=date.today)

    user: Mapped[User] = relationship(back_populates="progress_logs")
