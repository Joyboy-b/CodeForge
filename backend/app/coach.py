import os
from datetime import date

from . import models, schemas
from .game import rpg_stats


def build_coding_context(user: models.User) -> dict:
    return {
        "name": user.display_name,
        "level": user.level,
        "xp": user.xp,
        "project_goal": user.physique_goal,
        "daily_focus_minutes": user.calorie_goal,
        "task_goal": user.protein_goal,
        "commit_goal": user.carbs_goal,
        "bug_goal": user.fat_goal,
        "streak": user.streak.current_days if user.streak else 0,
        "stats": rpg_stats(user),
        "recent_sessions": [session.name for session in user.workouts[-3:]],
        "recent_shipments": [shipment.name for shipment in user.meals[-3:]],
    }


def generate_coaching_note(user: models.User) -> str:
    context = build_coding_context(user)
    prompt = (
        "Give one concise coding productivity coaching note for this developer. "
        "Focus on the next practical action, not motivation fluff. "
        f"Context: {context}"
    )
    ai_text = ask_openai(prompt)
    if ai_text:
        return ai_text

    weakest = min(context["stats"], key=context["stats"].get)
    return (
        f"Next action: run a 45 minute block on {weakest}, then log one small shipped slice. "
        f"Keep it tied to: {user.physique_goal}."
    )


def generate_quest(user: models.User) -> schemas.QuestCreate:
    prompt = (
        "Create one coding RPG quest as JSON with title, description, xp_reward, and due_on. "
        "Use today's date or tomorrow for due_on. "
        f"Developer context: {build_coding_context(user)}"
    )
    ai_text = ask_openai(prompt)
    if ai_text:
        parsed = parse_quest(ai_text)
        if parsed:
            return parsed

    return schemas.QuestCreate(
        title="Test the Critical Path",
        description="Write or manually verify one end-to-end flow and record what broke.",
        xp_reward=140,
        due_on=date.today(),
    )


def ask_openai(prompt: str) -> str | None:
    if not os.getenv("OPENAI_API_KEY"):
        return None

    try:
        from openai import OpenAI

        client = OpenAI()
        response = client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            input=prompt,
        )
        return response.output_text.strip()
    except Exception:
        return None


def parse_quest(raw: str) -> schemas.QuestCreate | None:
    import json

    try:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            return None
        payload = json.loads(raw[start : end + 1])
        return schemas.QuestCreate(**payload)
    except Exception:
        return None
