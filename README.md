# CodeForge

CodeForge is a gamified coding app that turns focus sessions, shipped tasks, commits, bug fixes, streaks, and project goals into RPG-style progression.

## What is included

- FastAPI backend with SQLAlchemy models for users, coding sessions, shipped work, quests, achievements, streaks, and skill check-ins.
- A Rust optimization engine that ranks coding plans using daily focus goals, task/commit/bug targets, available work types, recovery/focus time, and user progress.
- A browser app for logging sessions, tracking goals, completing quests, saving progress, and generating recommendations.

## Project layout

```text
backend/          FastAPI app
frontend/         Browser app
mobile/           React Native app
optimizer/        Rust CLI scoring engine
```

## Run the full app

Start the API:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Start the frontend from another terminal:

```powershell
cd frontend
python -m http.server 5173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:5173`.

API docs are at `http://127.0.0.1:8000/docs`.

## Optional services

CodeForge runs without Redis or OpenAI credentials by falling back to in-memory caching and deterministic coaching. To enable the production-style integrations:

```powershell
$env:REDIS_URL="redis://localhost:6379/0"
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-4.1-mini"
```

## Run the React Native app

```powershell
cd mobile
npm install
npm run start
```

When running on a physical phone, set `API_BASE` in `mobile/App.tsx` to your computer's LAN IP instead of `127.0.0.1`.

## Main App Features

- RPG dashboard with level, XP, streaks, coding stats, active quests, and recent logs.
- Coding session logging with difficulty, focus area, minutes, and XP.
- Shipped work logging with focus minutes, tasks, commits, and bugs fixed.
- Quest creation and completion with XP rewards.
- Skill check-ins for code quality, project completion, and confidence.
- Profile goals for daily focus minutes, task targets, commit targets, and bug-fix targets.
- Recommendation planner powered by the Rust optimizer.
- AI coaching and quest generation with OpenAI API fallback behavior.
- Redis-backed coach-note caching when `REDIS_URL` is configured.
- React Native mobile client for dashboard, coaching, sessions, quests, and stats.
- Browser-based JavaScript coding exercises with a worker-backed test runner and timeout protection.

## Main API Routes

- `GET /dashboard/1` - Dashboard state for the demo developer.
- `PATCH /users/{user_id}` - Update coding goals.
- `POST /users/{user_id}/workouts` - Log a coding session.
- `POST /users/{user_id}/meals` - Log shipped work.
- `GET /users/{user_id}/nutrition` - Daily coding totals against goals.
- `POST /users/{user_id}/quests` - Create a coding quest.
- `POST /users/{user_id}/quests/generate` - Generate a coding quest with OpenAI API or deterministic fallback.
- `POST /users/{user_id}/quests/{quest_id}/complete` - Complete a quest and award XP.
- `POST /users/{user_id}/progress` - Log a skill check-in.
- `GET /users/{user_id}/stats` - Derived RPG stats: architecture, focus, discipline, shipping, and debugging.
- `GET /users/{user_id}/coach` - Return a cached coaching note.
- `POST /users/{user_id}/recommendations` - Generate coding plan recommendations and rank them with Rust.
- `POST /optimize` - Rank custom plan options with the Rust engine.
