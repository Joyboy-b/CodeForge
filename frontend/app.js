const API_BASE = "http://127.0.0.1:8000";
const USER_ID = 1;

const state = {
  dashboard: null,
  quests: [],
  progress: [],
  coach: null,
};

const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
}

function formPayload(form) {
  const data = new FormData(form);
  return Object.fromEntries(
    [...data.entries()].map(([key, value]) => {
      const input = form.elements[key];
      return [key, input.type === "number" ? Number(value) : value];
    }),
  );
}

async function loadApp() {
  try {
    state.dashboard = await api(`/dashboard/${USER_ID}`);
    state.quests = await api(`/users/${USER_ID}/quests`);
    state.progress = await api(`/users/${USER_ID}/progress`);
    state.coach = await api(`/users/${USER_ID}/coach`);
    $("#apiStatus").textContent = "API connected";
    renderDashboard();
    renderQuests();
    renderProgress();
    renderProfile();
  } catch (error) {
    $("#apiStatus").textContent = "API offline";
    showToast(`Could not reach API: ${error.message}`);
  }
}

function renderDashboard() {
  const data = state.dashboard;
  if (!data) return;

  $("#heroName").textContent = data.user.display_name;
  $("#heroGoal").textContent = data.user.physique_goal;
  $("#heroLevel").textContent = data.user.level;
  $("#xpValue").textContent = data.user.xp.toLocaleString();
  $("#streakValue").textContent = `${data.streak.current_days} days`;
  $("#calorieValue").textContent = `${data.today_calories} / ${data.user.calorie_goal}`;
  $("#proteinValue").textContent = `${data.today_nutrition.protein} / ${data.user.macro_targets.protein}`;
  $("#coachNote").textContent = state.coach?.note || "No coaching note yet.";

  $("#statBars").innerHTML = Object.entries(data.rpg_stats)
    .map(
      ([label, value]) => `
        <div class="stat-row">
          <strong>${title(label)}</strong>
          <div class="bar"><span style="width:${value}%"></span></div>
          <span>${value}</span>
        </div>
      `,
    )
    .join("");

  $("#activeQuests").innerHTML = data.active_quests.length
    ? data.active_quests.map(renderQuestItem).join("")
    : `<p class="empty">No active quests.</p>`;

  $("#recentWorkouts").innerHTML = data.recent_workouts.length
    ? data.recent_workouts.map((workout) => renderLogItem(workout.name, `${workout.muscle_group} - ${workout.duration_minutes} min`, `${workout.xp_awarded} XP`)).join("")
    : `<p class="empty">No coding sessions yet.</p>`;

  $("#recentMeals").innerHTML = data.recent_meals.length
    ? data.recent_meals.map((meal) => renderLogItem(meal.name, `${meal.calories} min - ${meal.protein} tasks/${meal.carbs} commits/${meal.fat} bugs`, "shipped")).join("")
    : `<p class="empty">No shipped work yet.</p>`;
}

function renderProfile() {
  const user = state.dashboard?.user;
  if (!user) return;
  const form = $("#profileForm");
  form.display_name.value = user.display_name;
  form.physique_goal.value = user.physique_goal;
  form.calorie_goal.value = user.calorie_goal;
  form.protein.value = user.macro_targets.protein;
  form.carbs.value = user.macro_targets.carbs;
  form.fat.value = user.macro_targets.fat;
}

function renderQuests() {
  $("#questList").innerHTML = state.quests.length
    ? state.quests.map(renderQuestItem).join("")
    : `<p class="empty">No quests yet.</p>`;

  document.querySelectorAll("[data-complete-quest]").forEach((button) => {
    button.addEventListener("click", async () => {
      await completeQuest(button.dataset.completeQuest);
    });
  });
}

function renderProgress() {
  $("#progressList").innerHTML = state.progress.length
    ? state.progress
        .map((entry) => renderLogItem(entry.logged_on, `${entry.body_weight} quality - ${entry.body_fat_percentage}% complete`, `${entry.strength_score} confidence`))
        .join("")
    : `<p class="empty">No check-ins yet.</p>`;
}

function renderQuestItem(quest) {
  const action =
    quest.status === "active"
      ? `<button data-complete-quest="${quest.id}">Complete</button>`
      : `<span class="pill gold">Complete</span>`;
  return `
    <article class="item">
      <div class="item-header">
        <strong>${quest.title}</strong>
        <span class="pill">${quest.xp_reward} XP</span>
      </div>
      <p>${quest.description}</p>
      <div class="item-header">
        <p>Due ${quest.due_on}</p>
        ${action}
      </div>
    </article>
  `;
}

function renderLogItem(titleText, detail, badge) {
  return `
    <article class="item">
      <div class="item-header">
        <strong>${titleText}</strong>
        <span class="pill">${badge}</span>
      </div>
      <p>${detail}</p>
    </article>
  `;
}

function renderRecommendations(plans) {
  $("#recommendations").innerHTML = plans
    .map(
      (plan) => `
        <article class="plan-card">
          <div class="item-header">
            <strong>${plan.name}</strong>
            <span class="pill">${Math.round(plan.score * 100)}%</span>
          </div>
          <p>${planType(plan.type)} - ${codingReason(plan.reason)}</p>
        </article>
      `,
    )
    .join("");
}

function planType(type) {
  return type === "meal" ? "Shipping Plan" : "Focus Block";
}

function codingReason(reason) {
  return reason
    .replace("calorie fit", "focus fit")
    .replace("macro fit", "target fit")
    .replace("grocery coverage", "available work match")
    .replace("recovery fit", "energy fit")
    .replace("duration fit", "time fit");
}

async function completeQuest(questId) {
  await api(`/users/${USER_ID}/quests/${questId}/complete`, { method: "POST" });
  showToast("Quest completed. XP awarded.");
  await loadApp();
}

function title(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}View`));
  $("#pageTitle").textContent = title(viewName);
}

function wireEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  $("#refreshButton").addEventListener("click", loadApp);
  $("#coachButton").addEventListener("click", async () => {
    state.coach = await api(`/users/${USER_ID}/coach`);
    $("#coachNote").textContent = state.coach.note;
    showToast(state.coach.cached ? "Coach note loaded from cache." : "Coach note refreshed.");
  });

  $("#workoutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/users/${USER_ID}/workouts`, { method: "POST", body: JSON.stringify(formPayload(event.currentTarget)) });
    event.currentTarget.reset();
    showToast("Coding session logged. XP gained.");
    await loadApp();
  });

  $("#mealForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/users/${USER_ID}/meals`, { method: "POST", body: JSON.stringify(formPayload(event.currentTarget)) });
    event.currentTarget.reset();
    showToast("Shipped work logged.");
    await loadApp();
  });

  $("#questForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/users/${USER_ID}/quests`, { method: "POST", body: JSON.stringify(formPayload(event.currentTarget)) });
    event.currentTarget.reset();
    setToday();
    showToast("Quest created.");
    await loadApp();
  });

  $("#generateQuestButton").addEventListener("click", async () => {
    await api(`/users/${USER_ID}/quests/generate`, { method: "POST" });
    showToast("AI quest generated.");
    await loadApp();
  });

  $("#progressForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/users/${USER_ID}/progress`, { method: "POST", body: JSON.stringify(formPayload(event.currentTarget)) });
    showToast("Progress saved.");
    await loadApp();
  });

  $("#profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);
    await api(`/users/${USER_ID}`, {
      method: "PATCH",
      body: JSON.stringify({
        display_name: payload.display_name,
        physique_goal: payload.physique_goal,
        calorie_goal: payload.calorie_goal,
        macro_targets: {
          protein: payload.protein,
          carbs: payload.carbs,
          fat: payload.fat,
        },
      }),
    });
    showToast("Goals saved.");
    await loadApp();
  });

  $("#recommendButton").addEventListener("click", async () => {
    $("#recommendations").innerHTML = `<p class="empty">Ranking plans...</p>`;
    const result = await api(`/users/${USER_ID}/recommendations`, { method: "POST" });
    renderRecommendations(result.ranked);
  });
}

function setToday() {
  const dueInput = $("#questForm").due_on;
  dueInput.value = new Date().toISOString().slice(0, 10);
}

setToday();
wireEvents();
loadApp();
