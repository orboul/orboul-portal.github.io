const ACCESS_CODE = "orboul.dev"; // Update this value to change the access key.
const SESSION_KEY = "orboul::session";
const THEME_KEY = "orboul::theme";
const NOTE_KEY = "orboul::scratchpad";

const state = {
  launchpad: [
    {
      label: "Orboul GitHub",
      href: "https://github.com/Orboul",
      meta: "Repos, issues, automation",
    },
    {
      label: "Linear",
      href: "https://linear.app",
      meta: "Product planning",
    },
    {
      label: "Vercel Dashboard",
      href: "https://vercel.com/dashboard",
      meta: "Hosting + CI checks",
    },
    {
      label: "AWS Console",
      href: "https://console.aws.amazon.com/",
      meta: "Infra and services",
    },
  ],
  snippets: [
    {
      label: "Deploy Orboul API",
      code: "pnpm deploy --filter @orboul/api",
      meta: "Push fresh build to staging",
    },
    {
      label: "Tail logs",
      code: "pnpm logs --filter @orboul/api --since=10m",
      meta: "Recent production noise",
    },
    {
      label: "DB snapshot",
      code: "aws rds create-db-snapshot --db-instance-identifier orboul-prod",
      meta: "Ad-hoc backup",
    },
    {
      label: "Turbo prune",
      code: "pnpm turbo prune --scope=orboul-app --out-dir=.turbo",
      meta: "Prep repo for deploy",
    },
  ],
  signals: [
    {
      name: "API latency",
      status: "Nominal",
      state: "online",
      meta: "Last 5m avg < 120ms",
    },
    {
      name: "Next focus",
      status: "Ship self-serve billing",
      state: "attention",
      meta: "Block: pricing toggles gating",
    },
    {
      name: "Infra budget",
      status: "62% this month",
      state: "online",
      meta: "Budget resets Jul 1",
    },
    {
      name: "On-call",
      status: "User",
      state: "online",
      meta: "Rotation flips Mondays",
    },
  ],
};

const el = {
  accessForm: document.getElementById("access-form"),
  accessCode: document.getElementById("access-code"),
  authError: document.getElementById("auth-error"),
  authPanel: document.getElementById("auth-panel"),
  dashboard: document.getElementById("dashboard"),
  greeting: document.getElementById("greeting"),
  launchpad: document.getElementById("launchpad"),
  snippets: document.getElementById("snippets"),
  scratchpad: document.getElementById("scratchpad"),
  signals: document.getElementById("signals"),
  signOut: document.getElementById("sign-out"),
  themeToggle: document.getElementById("theme-toggle"),
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const setGreeting = () => {
  const now = new Date();
  const hour = now.getHours();
  const slice = clamp(Math.floor(hour / 6), 0, 3);
  const phrases = ["night ops", "morning brief", "uptime window", "evening shift"];
  const prefix = ["Quiet", "Fresh", "Prime", "Steady"][slice];
  el.greeting.textContent = `${prefix} ${phrases[slice]}`;
};

const renderLaunchpad = () => {
  el.launchpad.innerHTML = "";
  state.launchpad.forEach((item) => {
    const li = document.createElement("li");
    li.className = "tile";

    const title = document.createElement("strong");
    title.textContent = item.label;

    const meta = document.createElement("span");
    meta.className = "tile__meta";
    meta.textContent = item.meta;

    li.append(title, meta);
    li.addEventListener("click", () => window.open(item.href, "_blank"));
    li.addEventListener("keypress", (evt) => {
      if (evt.key === "Enter") {
        window.open(item.href, "_blank");
      }
    });
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");

    el.launchpad.append(li);
  });
};

const renderSnippets = () => {
  el.snippets.innerHTML = "";
  state.snippets.forEach((snippet) => {
    const li = document.createElement("li");
    li.className = "tile";

    const title = document.createElement("strong");
    title.textContent = snippet.label;

    const code = document.createElement("code");
    code.textContent = snippet.code;

    const meta = document.createElement("span");
    meta.className = "tile__meta";
    meta.textContent = snippet.meta;

    li.append(title, code, meta);
    li.addEventListener("click", () => copySnippet(snippet.code, title));

    el.snippets.append(li);
  });
};

const renderSignals = () => {
  el.signals.innerHTML = "";
  state.signals.forEach((signal) => {
    const li = document.createElement("li");
    li.className = "signal";
    li.dataset.state = signal.state;

    const status = document.createElement("span");
    status.className = "signal__status";
    status.textContent = signal.status;

    const meta = document.createElement("div");
    meta.className = "signal__meta";
    meta.textContent = signal.meta;

    const label = document.createElement("strong");
    label.textContent = signal.name;

    const stack = document.createElement("div");
    stack.style.display = "flex";
    stack.style.flexDirection = "column";
    stack.style.gap = "6px";
    stack.append(label, meta);

    li.append(stack, status);
    el.signals.append(li);
  });
};

const copySnippet = async (snippet, origin) => {
  try {
    await navigator.clipboard.writeText(snippet);
    flash(origin, "Copied");
  } catch (error) {
    console.error("Clipboard error:", error);
    flash(origin, "Press ⌘C manually", true);
  }
};

const flash = (node, message, isError = false) => {
  if (!node) return;
  const previous = node.textContent;
  node.textContent = message;
  node.style.opacity = "0.7";
  if (isError) node.style.color = "var(--danger)";

  setTimeout(() => {
    node.textContent = previous;
    node.style.opacity = "";
    node.style.color = "";
  }, 1500);
};

const hydrateScratchpad = () => {
  const existing = localStorage.getItem(NOTE_KEY);
  if (existing) {
    el.scratchpad.value = existing;
  }
};

const handleScratchpadInput = () => {
  localStorage.setItem(NOTE_KEY, el.scratchpad.value);
};

const enterPortal = () => {
  setGreeting();
  renderLaunchpad();
  renderSnippets();
  renderSignals();
  hydrateScratchpad();

  el.authPanel.classList.add("hidden");
  el.authPanel.setAttribute("aria-hidden", "true");
  el.dashboard.classList.remove("hidden");
  el.dashboard.setAttribute("aria-hidden", "false");
  localStorage.setItem(SESSION_KEY, "active");
  el.authError.textContent = "";
  el.accessForm.reset();
};

const exitPortal = () => {
  el.dashboard.classList.add("hidden");
  el.dashboard.setAttribute("aria-hidden", "true");
  el.authPanel.classList.remove("hidden");
  el.authPanel.setAttribute("aria-hidden", "false");
  localStorage.removeItem(SESSION_KEY);
  el.accessCode.focus();
};

const validateAccessKey = (input) =>
  String(input || "").trim().toLowerCase() === ACCESS_CODE.toLowerCase();

const handleAuthSubmit = (event) => {
  event.preventDefault();
  const value = el.accessCode.value;
  if (!validateAccessKey(value)) {
    el.authError.textContent = "Access key rejected.";
    el.accessCode.focus();
    el.accessCode.select();
    return;
  }
  enterPortal();
};

const hydrateTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light") {
    document.body.classList.add("light");
  }
};

const toggleTheme = () => {
  const nextIsLight = !document.body.classList.contains("light");
  document.body.classList.toggle("light", nextIsLight);
  localStorage.setItem(THEME_KEY, nextIsLight ? "light" : "dark");
};

const init = () => {
  hydrateTheme();

  if (localStorage.getItem(SESSION_KEY) === "active") {
    enterPortal();
  } else {
    el.authPanel.classList.remove("hidden");
    el.authPanel.setAttribute("aria-hidden", "false");
  }

  el.accessForm.addEventListener("submit", handleAuthSubmit);
  el.signOut.addEventListener("click", exitPortal);
  el.themeToggle.addEventListener("click", toggleTheme);
  el.scratchpad.addEventListener("input", handleScratchpadInput);
};

document.addEventListener("DOMContentLoaded", init);
