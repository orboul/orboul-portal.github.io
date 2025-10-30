const THEME_KEY = "orboul::theme";
const CREDENTIAL_KEY = "orboul::auth";
const DATA_KEY = "orboul::vault";

const DEFAULT_COMMANDS = [
  {
    id: "cmd-1",
    label: "List directory contents",
    command: "ls -alh",
    description: "Show detailed contents of the current directory, including hidden files.",
    category: "Filesystem",
    tags: ["files", "listing", "hidden"],
  },
  {
    id: "cmd-2",
    label: "Disk usage overview",
    command: "du -sh ./*",
    description: "Summarize the size of each item in the current directory.",
    category: "Filesystem",
    tags: ["storage", "size", "audit"],
  },
  {
    id: "cmd-3",
    label: "Find large files",
    command: "find . -type f -size +100M -print",
    description: "Discover files larger than 100 MB beneath the current path.",
    category: "Filesystem",
    tags: ["cleanup", "find", "storage"],
  },
  {
    id: "cmd-4",
    label: "Follow syslog",
    command: "sudo tail -f /var/log/syslog",
    description: "Stream live system log output for real-time monitoring.",
    category: "Monitoring",
    tags: ["logs", "tail", "system"],
  },
  {
    id: "cmd-5",
    label: "Service status",
    command: "systemctl status my-service.service",
    description: "Inspect the active state, recent logs, and metadata for a systemd unit.",
    category: "Services",
    tags: ["systemd", "status", "debug"],
  },
  {
    id: "cmd-6",
    label: "Follow service logs",
    command: "journalctl -u my-service.service -f",
    description: "Stream logs for a systemd service to watch behaviour in real-time.",
    category: "Services",
    tags: ["systemd", "logs", "journalctl"],
  },
  {
    id: "cmd-7",
    label: "Resource monitor",
    command: "htop",
    description: "Interactive CPU, memory, and process monitor.",
    category: "Monitoring",
    tags: ["cpu", "memory", "process"],
  },
  {
    id: "cmd-8",
    label: "Filesystem usage",
    command: "df -h",
    description: "Report available disk space across mounted filesystems.",
    category: "System",
    tags: ["disk", "storage"],
  },
  {
    id: "cmd-9",
    label: "Memory snapshot",
    command: "free -h",
    description: "Display RAM and swap utilisation in human-readable units.",
    category: "System",
    tags: ["memory", "swap"],
  },
  {
    id: "cmd-10",
    label: "Latency check",
    command: "ping -c 5 example.com",
    description: "Send five ICMP packets to verify connectivity and latency.",
    category: "Networking",
    tags: ["connectivity", "latency", "icmp"],
  },
  {
    id: "cmd-11",
    label: "HTTP headers",
    command: "curl -I https://example.com",
    description: "Fetch only the response headers from an HTTP endpoint.",
    category: "Networking",
    tags: ["curl", "debug", "http"],
  },
  {
    id: "cmd-12",
    label: "Running containers",
    command:
      'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    description: "Show active containers with names, status, and exposed ports.",
    category: "Containers",
    tags: ["docker", "status"],
  },
  {
    id: "cmd-13",
    label: "Container logs",
    command: "docker logs -f my-container",
    description: "Stream logs from a running Docker container.",
    category: "Containers",
    tags: ["docker", "logs"],
  },
];

const state = {
  session: {
    key: null,
    data: {
      commands: [],
      snippets: [],
      notes: "",
    },
  },
  filters: {
    query: "",
    categories: new Set(),
  },
};

const el = {
  authPanel: document.getElementById("auth-panel"),
  workspace: document.getElementById("workspace"),
  greeting: document.getElementById("greeting"),
  themeToggle: document.getElementById("theme-toggle"),
  lockPortal: document.getElementById("lock-portal"),
  scratchpad: document.getElementById("scratchpad"),
  commandList: document.getElementById("command-list"),
  snippetList: document.getElementById("snippet-list"),
  commandSearch: document.getElementById("command-search"),
  categoryFilter: document.getElementById("category-filter"),
  commandForm: document.getElementById("command-form"),
  snippetForm: document.getElementById("snippet-form"),
  commandFeedback: document.getElementById("command-feedback"),
  snippetFeedback: document.getElementById("snippet-feedback"),
  setupForm: document.getElementById("setup-form"),
  unlockForm: document.getElementById("unlock-form"),
  setupError: document.getElementById("setup-error"),
  unlockError: document.getElementById("unlock-error"),
  setupPassword: document.getElementById("setup-password"),
  setupConfirm: document.getElementById("setup-confirm"),
  unlockPassword: document.getElementById("unlock-password"),
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const bufferToBase64 = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const base64ToBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const randomValues = (size = 16) => {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  return array;
};

const deriveKeyMaterial = async (password, salt) => {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 150_000,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    derivedBits,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return {
    key: aesKey,
    hash: new Uint8Array(derivedBits),
  };
};

const encryptData = async (payload, key) => {
  const iv = randomValues(12);
  const data = textEncoder.encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return {
    iv: bufferToBase64(iv),
    cipher: bufferToBase64(cipher),
  };
};

const decryptData = async (sealed, key) => {
  const iv = base64ToBuffer(sealed.iv);
  const cipher = base64ToBuffer(sealed.cipher);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher
  );
  return JSON.parse(textDecoder.decode(decrypted));
};

const setGreeting = () => {
  const now = new Date();
  const hour = now.getHours();
  const slice = clamp(Math.floor(hour / 6), 0, 3);
  const phrases = ["night shift ready", "morning runbook", "prime uptime", "steady evening ops"];
  el.greeting.textContent = phrases[slice];
};

const getAllCommands = () => [
  ...DEFAULT_COMMANDS,
  ...(state.session.data.commands || []),
];

const normaliseString = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD");

const matchesQuery = (command, query) => {
  if (!query) return true;
  const haystack = normaliseString(
    `${command.label} ${command.command} ${command.description || ""} ${(
      command.tags || []
    ).join(" ")} ${command.category}`
  );
  return haystack.includes(query);
};

const matchesCategories = (command) => {
  if (!state.filters.categories.size) return true;
  return state.filters.categories.has(command.category);
};

const renderCommands = () => {
  el.commandList.innerHTML = "";
  const query = normaliseString(state.filters.query);

  const commands = getAllCommands()
    .filter((command) => matchesQuery(command, query))
    .filter(matchesCategories)
    .sort((a, b) => a.label.localeCompare(b.label));

  if (!commands.length) {
    const empty = document.createElement("li");
    empty.className = "tile tile--command";
    empty.textContent = "No commands found. Update your filters or add a custom entry.";
    el.commandList.append(empty);
    return;
  }

  commands.forEach((command) => {
    const li = document.createElement("li");
    li.className = "tile tile--command";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.flexDirection = "column";
    header.style.gap = "6px";

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.justifyContent = "space-between";
    titleRow.style.gap = "12px";

    const label = document.createElement("strong");
    label.textContent = command.label;
    label.style.fontSize = "1rem";

    const categoryTag = document.createElement("span");
    categoryTag.className = "tag";
    categoryTag.textContent = command.category;

    titleRow.append(label, categoryTag);

    const description = document.createElement("span");
    description.className = "tile__meta";
    description.textContent = command.description || "No description provided.";

    header.append(titleRow, description);

    const code = document.createElement("code");
    code.textContent = command.command;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "space-between";
    actions.style.alignItems = "center";

    const tagList =
      command.tags && command.tags.length
        ? command.tags.reduce((acc, tag) => {
            const span = document.createElement("span");
            span.className = "tag";
            span.textContent = tag;
            acc.append(span);
            return acc;
          }, document.createElement("div"))
        : null;

    if (tagList) {
      tagList.className = "tag-list";
    }

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "ghost-action";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => copyToClipboard(command.command, copyButton));

    actions.append(tagList || document.createElement("span"), copyButton);

    li.append(header, code, actions);
    el.commandList.append(li);
  });
};

const renderCategoryFilter = () => {
  const categories = new Set(
    DEFAULT_COMMANDS.map((command) => command.category)
  );
  (state.session.data.commands || []).forEach((command) => {
    categories.add(command.category);
  });

  const sorted = Array.from(categories).sort((a, b) => a.localeCompare(b));
  el.categoryFilter.innerHTML = "";

  const allButton = createFilterChip("All", state.filters.categories.size === 0);
  allButton.dataset.value = "__all__";
  el.categoryFilter.append(allButton);

  sorted.forEach((category) => {
    const button = createFilterChip(
      category,
      state.filters.categories.has(category)
    );
    button.dataset.value = category;
    el.categoryFilter.append(button);
  });
};

const createFilterChip = (label, active) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chip";
  button.textContent = label;
  button.setAttribute("aria-pressed", active ? "true" : "false");
  return button;
};

const renderSnippets = () => {
  el.snippetList.innerHTML = "";
  const snippets = state.session.data.snippets || [];

  if (!snippets.length) {
    const empty = document.createElement("li");
    empty.className = "tile tile--snippet";
    empty.textContent = "No snippets stored yet. Add one below.";
    el.snippetList.append(empty);
    return;
  }

  snippets.forEach((snippet) => {
    const li = document.createElement("li");
    li.className = "tile tile--snippet";

    const title = document.createElement("strong");
    title.textContent = snippet.title;

    const description = document.createElement("span");
    description.className = "tile__meta";
    description.textContent = snippet.description || "No notes.";

    const code = document.createElement("code");
    code.textContent = snippet.code;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "ghost-action";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () =>
      copyToClipboard(snippet.code, copyButton)
    );

    actions.append(copyButton);

    li.append(title, description, code, actions);
    el.snippetList.append(li);
  });
};

const hydrateScratchpad = () => {
  el.scratchpad.value = state.session.data.notes || "";
};

const persistData = async () => {
  if (!state.session.key) return;
  const sealed = await encryptData(state.session.data, state.session.key);
  localStorage.setItem(DATA_KEY, JSON.stringify(sealed));
};

const copyToClipboard = async (text, origin) => {
  try {
    await navigator.clipboard.writeText(text);
    flash(origin, "Copied");
  } catch (error) {
    console.error("Clipboard error:", error);
    flash(origin, "Use ⌘C/CTRL+C", true);
  }
};

const flash = (node, message, isError = false) => {
  if (!node) return;
  const previous = node.textContent;
  node.textContent = message;
  node.style.opacity = "0.7";
  if (isError) {
    node.style.color = "var(--danger)";
  }

  setTimeout(() => {
    node.textContent = previous;
    node.style.opacity = "";
    node.style.color = "";
  }, 1600);
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

const resetSession = () => {
  state.session.key = null;
  state.session.data = {
    commands: [],
    snippets: [],
    notes: "",
  };
};

const showSetupForm = () => {
  el.setupForm.classList.remove("hidden");
  el.unlockForm.classList.add("hidden");
};

const showUnlockForm = () => {
  el.setupForm.classList.add("hidden");
  el.unlockForm.classList.remove("hidden");
};

const enterWorkspace = () => {
  state.filters.query = "";
  state.filters.categories = new Set();
  el.commandSearch.value = "";
  setGreeting();
  renderCategoryFilter();
  renderCommands();
  renderSnippets();
  hydrateScratchpad();

  el.authPanel.classList.add("hidden");
  el.authPanel.setAttribute("aria-hidden", "true");
  el.workspace.classList.remove("hidden");
  el.workspace.setAttribute("aria-hidden", "false");
  el.commandSearch.focus();
};

const lockWorkspace = () => {
  state.filters.query = "";
  state.filters.categories = new Set();
  el.commandSearch.value = "";
  resetSession();
  el.workspace.classList.add("hidden");
  el.workspace.setAttribute("aria-hidden", "true");
  el.authPanel.classList.remove("hidden");
  el.authPanel.setAttribute("aria-hidden", "false");
  el.unlockPassword.value = "";
  el.unlockPassword.focus();
  showUnlockForm();
};

const handleSetupSubmit = async (event) => {
  event.preventDefault();
  el.setupError.textContent = "";
  const password = el.setupPassword.value;
  const confirm = el.setupConfirm.value;

  if (password.length < 6) {
    el.setupError.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirm) {
    el.setupError.textContent = "Passwords do not match.";
    return;
  }

  try {
    const salt = randomValues(16);
    const material = await deriveKeyMaterial(password, salt);
    state.session.key = material.key;
    state.session.data = {
      commands: [],
      snippets: [],
      notes: "",
    };

    const sealed = await encryptData(state.session.data, state.session.key);

    localStorage.setItem(
      CREDENTIAL_KEY,
      JSON.stringify({
        salt: bufferToBase64(salt),
        hash: bufferToBase64(material.hash),
      })
    );

    localStorage.setItem(DATA_KEY, JSON.stringify(sealed));

    el.setupPassword.value = "";
    el.setupConfirm.value = "";
    enterWorkspace();
  } catch (error) {
    console.error("Setup error:", error);
    el.setupError.textContent = "Unable to create password. Try again.";
    resetSession();
  }
};

const handleUnlockSubmit = async (event) => {
  event.preventDefault();
  el.unlockError.textContent = "";
  const password = el.unlockPassword.value;

  const stored = localStorage.getItem(CREDENTIAL_KEY);
  if (!stored) {
    showSetupForm();
    el.unlockError.textContent = "No password set yet. Create one first.";
    return;
  }

  try {
    const credentials = JSON.parse(stored);
    const salt = base64ToBuffer(credentials.salt);
    const material = await deriveKeyMaterial(password, salt);
    const candidateHash = bufferToBase64(material.hash);

    if (candidateHash !== credentials.hash) {
      el.unlockError.textContent = "Incorrect password.";
      el.unlockPassword.select();
      return;
    }

    const sealedRaw = localStorage.getItem(DATA_KEY);
    if (sealedRaw) {
      const sealed = JSON.parse(sealedRaw);
      const data = await decryptData(sealed, material.key);
      state.session.data = {
        commands: data.commands || [],
        snippets: data.snippets || [],
        notes: data.notes || "",
      };
    } else {
      state.session.data = {
        commands: [],
        snippets: [],
        notes: "",
      };
    }

    state.session.key = material.key;
    el.unlockPassword.value = "";
    enterWorkspace();
  } catch (error) {
    console.error("Unlock error:", error);
    el.unlockError.textContent = "Unable to unlock workspace. Try again.";
    resetSession();
  }
};

const handleCommandSearch = (event) => {
  state.filters.query = event.target.value;
  renderCommands();
};

const handleCategoryClick = (event) => {
  const button = event.target.closest("button");
  if (!button || !button.dataset.value) return;

  const value = button.dataset.value;
  if (value === "__all__") {
    state.filters.categories.clear();
  } else {
    if (state.filters.categories.has(value)) {
      state.filters.categories.delete(value);
    } else {
      state.filters.categories.add(value);
    }
  }

  renderCategoryFilter();
  renderCommands();
};

const safeId = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

const handleCommandSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    id: safeId(),
    label: form["command-name"].value.trim(),
    command: form["command-text"].value.trim(),
    category: form["command-category"].value.trim() || "General",
    description: form["command-description"].value.trim(),
    tags: [],
  };

  if (!payload.label || !payload.command) {
    flash(el.commandFeedback, "Label and command are required.", true);
    return;
  }

  state.session.data.commands.unshift(payload);
  await persistData();
  renderCategoryFilter();
  renderCommands();
  form.reset();
  flash(el.commandFeedback, "Command saved.");
};

const handleSnippetSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    id: safeId(),
    title: form["snippet-name"].value.trim(),
    description: form["snippet-description"].value.trim(),
    code: form["snippet-code"].value,
  };

  if (!payload.title || !payload.code.trim()) {
    flash(el.snippetFeedback, "Title and code are required.", true);
    return;
  }

  state.session.data.snippets.unshift(payload);
  await persistData();
  renderSnippets();
  form.reset();
  flash(el.snippetFeedback, "Snippet stored.");
};

const handleScratchpadInput = async () => {
  state.session.data.notes = el.scratchpad.value;
  await persistData();
};

const detectCredentials = () => {
  const stored = localStorage.getItem(CREDENTIAL_KEY);
  if (stored) {
    showUnlockForm();
    el.unlockPassword.focus();
  } else {
    showSetupForm();
    el.setupPassword.focus();
  }
};

const init = () => {
  hydrateTheme();
  el.themeToggle.addEventListener("click", toggleTheme);
  el.lockPortal.addEventListener("click", lockWorkspace);
  el.scratchpad.addEventListener("input", handleScratchpadInput);
  el.commandSearch.addEventListener("input", handleCommandSearch);
  el.categoryFilter.addEventListener("click", handleCategoryClick);
  el.commandForm.addEventListener("submit", handleCommandSubmit);
  el.snippetForm.addEventListener("submit", handleSnippetSubmit);
  el.setupForm.addEventListener("submit", handleSetupSubmit);
  el.unlockForm.addEventListener("submit", handleUnlockSubmit);

  detectCredentials();
};

document.addEventListener("DOMContentLoaded", init);
