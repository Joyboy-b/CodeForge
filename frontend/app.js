const API_BASE = "http://127.0.0.1:8000";
const USER_ID = 1;

const state = {
  dashboard: null,
  quests: [],
  progress: [],
  coach: null,
  selectedExercise: 0,
  selectedLanguage: "python",
  pyodide: null,
};

const $ = (selector) => document.querySelector(selector);

const exercises = [
  {
    title: "Reverse a String",
    difficulty: "E-Rank",
    prompt: "Return a new string with the characters in reverse order.",
    functions: {
      python: "reverse_string",
      javascript: "reverseString",
    },
    starters: {
      python: `def reverse_string(value):\n    # Return the reversed string.\n    return value`,
      javascript: `function reverseString(value) {\n  // Return the reversed string.\n  return value;\n}`,
    },
    tests: [
      { input: ["gate"], expected: "etag" },
      { input: ["CodeForge"], expected: "egroFedoC" },
      { input: [""], expected: "" },
    ],
  },
  {
    title: "Count Vowels",
    difficulty: "D-Rank",
    prompt: "Return the number of vowels in the provided string. Treat uppercase and lowercase vowels the same.",
    functions: {
      python: "count_vowels",
      javascript: "countVowels",
    },
    starters: {
      python: `def count_vowels(value):\n    # Count a, e, i, o, u.\n    return 0`,
      javascript: `function countVowels(value) {\n  // Count a, e, i, o, u.\n  return 0;\n}`,
    },
    tests: [
      { input: ["shadow monarch"], expected: 4 },
      { input: ["RUST"], expected: 1 },
      { input: ["crypt"], expected: 0 },
    ],
  },
  {
    title: "Two Sum",
    difficulty: "C-Rank",
    prompt: "Return the indexes of two numbers that add up to the target. Return them in ascending order.",
    functions: {
      python: "two_sum",
      javascript: "twoSum",
    },
    starters: {
      python: `def two_sum(nums, target):\n    # Return [first_index, second_index].\n    return []`,
      javascript: `function twoSum(nums, target) {\n  // Return [firstIndex, secondIndex].\n  return [];\n}`,
    },
    tests: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { input: [[3, 2, 4], 6], expected: [1, 2] },
      { input: [[3, 3], 6], expected: [0, 1] },
    ],
  },
  {
    title: "Valid Parentheses",
    difficulty: "B-Rank",
    prompt: "Return true when every opening bracket is closed in the correct order.",
    functions: {
      python: "is_valid",
      javascript: "isValid",
    },
    starters: {
      python: `def is_valid(value):\n    # Supports (), [], and {}.\n    return False`,
      javascript: `function isValid(value) {\n  // Supports (), [], and {}.\n  return false;\n}`,
    },
    tests: [
      { input: ["()[]{}"], expected: true },
      { input: ["([{}])"], expected: true },
      { input: ["(]"], expected: false },
      { input: ["((())"], expected: false },
    ],
  },
];

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
    renderExercises();
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

function renderExercises() {
  const exercise = exercises[state.selectedExercise];
  const functionName = exercise.functions[state.selectedLanguage];
  $("#exerciseList").innerHTML = exercises
    .map(
      (item, index) => `
        <button class="exercise-choice ${index === state.selectedExercise ? "is-active" : ""}" data-exercise-index="${index}">
          <strong>${item.title}</strong>
          <span>${item.difficulty}</span>
        </button>
      `,
    )
    .join("");

  $("#exerciseDifficulty").textContent = exercise.difficulty;
  $("#exerciseTitle").textContent = exercise.title;
  $("#exercisePrompt").textContent = exercise.prompt;
  $("#editorLabel").textContent = `${title(state.selectedLanguage)} Solution`;
  $("#exerciseTests").innerHTML = exercise.tests
    .map((test) => `<span class="test-pill">${functionName}(${test.input.map(formatValue).join(", ")})</span>`)
    .join("");

  if (!$("#codeEditor").value.trim()) {
    $("#codeEditor").value = exercise.starters[state.selectedLanguage];
  }

  document.querySelectorAll("[data-exercise-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedExercise = Number(button.dataset.exerciseIndex);
      $("#codeEditor").value = exercises[state.selectedExercise].starters[state.selectedLanguage];
      $("#compilerOutput").textContent = "Run tests to see results.";
      renderExercises();
    });
  });
}

async function runExerciseTests() {
  const exercise = exercises[state.selectedExercise];
  const output = $("#compilerOutput");
  output.textContent = state.selectedLanguage === "python" && !state.pyodide ? "Loading Python runtime..." : `Running ${title(state.selectedLanguage)} tests...`;

  try {
    const result =
      state.selectedLanguage === "python"
        ? await runPythonTests(exercise, $("#codeEditor").value)
        : await runJavaScriptTests(exercise, $("#codeEditor").value);

    output.innerHTML = result.results
      .map((testResult, index) => {
        const status = testResult.pass ? "PASS" : "FAIL";
        const className = testResult.pass ? "pass" : "fail";
        return `
          <div class="result-line ${className}">
            <strong>${status}</strong>
            <span>Test ${index + 1}: expected ${formatValue(testResult.expected)}, received ${formatValue(testResult.actual)}</span>
          </div>
        `;
      })
      .join("");

    if (result.results.every((testResult) => testResult.pass)) {
      showToast(`${exercise.title} cleared.`);
    }
  } catch (error) {
    output.innerHTML = `<div class="result-line fail"><strong>ERROR</strong><span>${error.message}</span></div>`;
  }
}

async function runPythonTests(exercise, source) {
  const pyodide = await getPyodide();
  pyodide.globals.set("user_code", source);
  pyodide.globals.set("function_name", exercise.functions.python);
  pyodide.globals.set("tests_json", JSON.stringify(exercise.tests));

  const resultsJson = await withTimeout(
    pyodide.runPythonAsync(`
import json

namespace = {}
exec(user_code, namespace)
fn = namespace.get(function_name)
if not callable(fn):
    raise NameError(f"Function {function_name} was not found.")

tests = json.loads(tests_json)
results = []
for test in tests:
    actual = fn(*test["input"])
    expected = test["expected"]
    results.append({
        "actual": actual,
        "expected": expected,
        "pass": actual == expected,
    })

json.dumps(results)
`),
    2500,
  );

  return { results: JSON.parse(resultsJson) };
}

function runJavaScriptTests(exercise, source) {
  return new Promise((resolve, reject) => {
    const workerSource = `
      self.onmessage = (event) => {
        const { source, functionName, tests } = event.data;
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        try {
          const factory = new Function(source + "\\nreturn typeof " + functionName + " === 'function' ? " + functionName + " : null;");
          const fn = factory();
          if (!fn) throw new Error("Function " + functionName + " was not found.");
          const results = tests.map((test) => {
            const actual = fn(...test.input);
            return { actual, expected: test.expected, pass: same(actual, test.expected) };
          });
          self.postMessage({ ok: true, results });
        } catch (error) {
          self.postMessage({ ok: false, error: error.message });
        }
      };
    `;
    const worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Execution timed out. Check for infinite loops."));
    }, 1200);

    worker.onmessage = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok) {
        resolve(event.data);
      } else {
        reject(new Error(event.data.error));
      }
    };
    worker.postMessage({
      source,
      functionName: exercise.functions.javascript,
      tests: exercise.tests,
    });
  });
}

async function getPyodide() {
  if (state.pyodide) {
    return state.pyodide;
  }
  if (typeof loadPyodide !== "function") {
    throw new Error("Python runtime could not load. Check your internet connection and refresh.");
  }
  state.pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  });
  return state.pyodide;
}

function withTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Execution timed out. Check for infinite loops.")), milliseconds);
    }),
  ]);
}

function formatValue(value) {
  return JSON.stringify(value);
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

  $("#runCodeButton").addEventListener("click", runExerciseTests);
  $("#languageSelect").addEventListener("change", (event) => {
    state.selectedLanguage = event.target.value;
    $("#codeEditor").value = exercises[state.selectedExercise].starters[state.selectedLanguage];
    $("#compilerOutput").textContent = "Run tests to see results.";
    renderExercises();
  });
  $("#resetCodeButton").addEventListener("click", () => {
    $("#codeEditor").value = exercises[state.selectedExercise].starters[state.selectedLanguage];
    $("#compilerOutput").textContent = "Run tests to see results.";
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
renderExercises();
loadApp();
