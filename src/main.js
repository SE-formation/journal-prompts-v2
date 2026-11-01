// Journal de prompts — saisie, historique local, envoi vers un webhook, file hors ligne.
const APP_VERSION = "1.2.0";

const TOOLS = ["Claude", "ChatGPT", "Gemini", "Mistral (Le Chat)", "NotebookLM", "Copilot", "Midjourney", "Autre"];
// Models offered for each tool; "Autre modèle" opens a free text field.
const OTHER_MODEL = "Autre modèle";
const MODELS = {
  "Claude": ["Opus", "Sonnet", "Haiku"],
  "ChatGPT": ["GPT-5", "GPT-5 Thinking", "GPT-5 mini", "GPT-4o"],
  "Gemini": ["Pro", "Flash", "Flash-Lite"],
  "Mistral (Le Chat)": ["Mistral Large", "Mistral Medium", "Magistral"],
  "NotebookLM": ["Par défaut"],
  "Copilot": ["Réponse rapide", "Réflexion approfondie", "Smart"],
  "Midjourney": ["V7", "V6.1", "Niji 6"],
  "Autre": []
};
const PARTS = ["Introduction", "Partie I", "Partie II", "Partie III", "Conclusion", "Glossaire", "Annexes", "Mise en forme"];
const SHORT_PART = { "Introduction": "Intro", "Partie I": "I", "Partie II": "II", "Partie III": "III", "Conclusion": "Concl." };
const STEPS = {
  PPI: [
    "Cerner le sujet", "Problématiser", "Contextualiser (interne, PESTEL)", "Veille prospective, facteurs de rupture",
    "Analyser et interpréter les données", "Enquête, interviews", "Prototype ou preuve de concept",
    "Plan de gestion des risques", "Conduite du changement", "Structurer et rédiger", "Relecture, orthographe",
    "Mise en forme du dossier"
  ],
  PPC: [
    "Veille : existant et KPI", "Veille : marque, publics, concurrence, tendances",
    "Contours stratégiques : positionnement, objectifs, cibles", "Insight", "Conceptualiser : axe créa, promesse",
    "Explorer les voies et les formats", "Copy stratégie, brief créatif", "Production : maquettes, contenus",
    "Charte graphique", "Structurer et rédiger", "Relecture, orthographe", "Mise en forme du dossier"
  ]
};
const SCREEN_TITLES = { saisir: "Mes prompts", historique: "Historique", reglages: "Réglages" };
const HISTORY_LIMIT = 100;
const SEND_TIMEOUT_MS = 15000;

// ---------- Local storage (kept compatible with the original's keys) ----------
const STORAGE = {
  hook: "jp.hook", exam: "jp.epreuve", last: "jp.last",
  queue: "jp.queue", history: "jp.historique", draft: "jp.brouillon"
};
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const app = {
  hook: load(STORAGE.hook, ""),
  exam: load(STORAGE.exam, "PPI"),
  last: load(STORAGE.last, {}),
  queue: load(STORAGE.queue, []),
  history: load(STORAGE.history, []),
  tool: "",
  model: "",
  part: ""
};

const el = (id) => document.getElementById(id);
const plural = (n, word, suffix = "s") => `${n} ${word}${n > 1 ? suffix : ""}`;

// ---------- Toast ----------
let toastTimer;
function notify(message) {
  const box = el("toast");
  box.textContent = message;
  box.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("is-visible"), 2800);
}

// ---------- Choice chips ----------
function buildChips(container, values, initial, onPick, shortLabels = {}) {
  const chosen = values.includes(initial) ? initial : values[0];
  container.replaceChildren();
  for (const value of values) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = shortLabels[value] || value;
    if (shortLabels[value]) chip.setAttribute("aria-label", value);
    chip.setAttribute("aria-pressed", String(value === chosen));
    chip.addEventListener("click", () => {
      for (const c of container.children) c.setAttribute("aria-pressed", String(c === chip));
      onPick(value);
    });
    container.append(chip);
  }
  onPick(chosen);
}

function renderExam() {
  document.querySelectorAll("[data-exam]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.exam === app.exam));
  });
  const select = el("stepSelect");
  const remembered = app.last["etape_" + app.exam];
  select.replaceChildren(...STEPS[app.exam].map((step) => {
    const opt = new Option(step, step);
    opt.selected = step === remembered;
    return opt;
  }));
}

// ---------- Model of the chosen tool ----------
function renderModels() {
  const options = MODELS[app.tool] || [];
  const remembered = (app.last.modeles || {})[app.tool] || "";
  const otherBox = el("modelOther");
  el("modelLegend").textContent = `Modèle de l'IA (${app.tool})`;
  if (!options.length) {
    // Tool without a preset list: free text only.
    el("modelChips").replaceChildren();
    el("modelChips").hidden = true;
    app.model = OTHER_MODEL;
    otherBox.value = remembered;
    otherBox.hidden = false;
    return;
  }
  el("modelChips").hidden = false;
  const values = [...options, OTHER_MODEL];
  const initial = options.includes(remembered) ? remembered : (remembered ? OTHER_MODEL : options[0]);
  otherBox.value = initial === OTHER_MODEL ? remembered : "";
  buildChips(el("modelChips"), values, initial, (v) => {
    app.model = v;
    otherBox.hidden = v !== OTHER_MODEL;
    if (v === OTHER_MODEL && document.activeElement?.closest("#modelChips")) otherBox.focus();
  }, { [OTHER_MODEL]: "Autre" });
}
function currentModel() {
  return app.model === OTHER_MODEL ? el("modelOther").value.trim() : app.model;
}
function modelLabel(h) {
  if (!h.modele) return h.outil;
  return h.modele.toLowerCase().startsWith(h.outil.toLowerCase()) ? h.modele : `${h.outil} ${h.modele}`;
}

buildChips(el("toolChips"), TOOLS, app.last.outil, (v) => { app.tool = v; renderModels(); });
buildChips(el("partChips"), PARTS, app.last.partie, (v) => { app.part = v; }, SHORT_PART);
renderExam();

document.querySelectorAll("[data-exam]").forEach((b) => b.addEventListener("click", () => {
  app.exam = b.dataset.exam;
  save(STORAGE.exam, app.exam);
  renderExam();
}));

// ---------- Screens ----------
function goTo(screen) {
  document.querySelectorAll("[data-screen]").forEach((s) => { s.hidden = s.dataset.screen !== screen; });
  document.querySelectorAll("[data-go]").forEach((b) => {
    if (b.dataset.go === screen) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  el("title").textContent = SCREEN_TITLES[screen];
  if (screen === "historique") renderHistory();
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.go)));

// ---------- Prompt editor ----------
const promptBox = el("promptInput");
const goalBox = el("goalInput");
function refreshCount() {
  el("charCount").textContent = promptBox.value.length.toLocaleString("fr-FR") + " car.";
}
function setPrompt(text, goal) {
  promptBox.value = text;
  if (goal !== undefined) goalBox.value = goal;
  refreshCount();
  save(STORAGE.draft, promptBox.value);
}
promptBox.addEventListener("input", () => { refreshCount(); save(STORAGE.draft, promptBox.value); });
promptBox.value = load(STORAGE.draft, "");
refreshCount();

el("pasteBtn").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { notify("Le presse-papiers est vide"); return; }
    setPrompt(text);
    notify("Prompt collé");
  } catch {
    promptBox.focus();
    notify("Appui long dans la zone › Coller");
  }
});
el("clearBtn").addEventListener("click", () => setPrompt("", ""));

// ---------- Incoming text (share target, prefilled link) ----------
(function readLaunchParams() {
  const params = new URLSearchParams(location.search);
  if (![...params.keys()].length) return;
  const hook = params.get("hook");
  if (hook) { app.hook = hook.trim(); save(STORAGE.hook, app.hook); notify("Adresse d'envoi enregistrée"); }
  const exam = params.get("epreuve");
  if (exam && STEPS[exam]) { app.exam = exam; save(STORAGE.exam, exam); renderExam(); }
  const shared = [params.get("text"), params.get("title")].filter(Boolean).join("\n").trim();
  if (shared) { setPrompt(shared); notify("Texte reçu : complétez puis enregistrez"); }
  history.replaceState(null, "", location.pathname);
})();

// ---------- Sending ----------
async function sendEntry(entry) {
  const body = new URLSearchParams({
    epreuve: entry.epreuve, outil: entry.outil, modele: entry.modele || "", partie: entry.partie,
    etape: entry.etape, objectif: entry.objectif, prompt: entry.prompt
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(app.hook, { method: "POST", body, signal: controller.signal });
    const reply = (await response.text()).trim();
    if (!response.ok) throw new Error(`HTTP ${response.status}${reply ? " — " + reply : ""}`);
    return reply || "Prompt enregistré";
  } finally {
    clearTimeout(timeout);
  }
}

function remember(entry, status) {
  app.history = [{ ...entry, status }, ...app.history].slice(0, HISTORY_LIMIT);
  save(STORAGE.history, app.history);
}
function markSent(id) {
  const item = app.history.find((h) => h.id === id);
  if (item) item.status = "sent";
  save(STORAGE.history, app.history);
}

el("entryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!app.hook) {
    notify("Ajoutez d'abord votre adresse d'envoi");
    goTo("reglages");
    el("hookInput").focus();
    return;
  }
  const prompt = promptBox.value.trim();
  if (!prompt) { notify("Le prompt est vide"); promptBox.focus(); return; }
  const model = currentModel();

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    epreuve: app.exam,
    outil: app.tool,
    modele: model,
    partie: app.part,
    etape: el("stepSelect").value,
    objectif: goalBox.value.trim(),
    prompt
  };
  app.last = {
    ...app.last,
    outil: entry.outil,
    modeles: { ...(app.last.modeles || {}), [entry.outil]: entry.modele },
    partie: entry.partie,
    ["etape_" + app.exam]: entry.etape
  };
  save(STORAGE.last, app.last);

  const button = el("sendBtn");
  button.disabled = true;
  button.textContent = "Envoi…";
  try {
    const reply = await sendEntry(entry);
    remember(entry, "sent");
    if (/^accepted$/i.test(reply)) notify("📥 Reçu par Make. Scénario en pause : la ligne arrivera dans le Sheet à sa réactivation");
    else notify(reply.startsWith("✅") ? reply : "✅ " + reply);
  } catch (error) {
    app.queue.push(entry);
    save(STORAGE.queue, app.queue);
    remember(entry, "wait");
    notify(navigator.onLine ? "Envoi impossible, prompt mis en attente" : "Hors ligne : prompt mis en attente");
    console.warn(error);
  } finally {
    setPrompt("", "");
    button.disabled = false;
    button.textContent = "Enregistrer dans mon journal";
    renderNotices();
  }
});

// ---------- Offline queue ----------
function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
async function retryQueue() {
  if (!app.hook || !app.queue.length || !navigator.onLine) return;
  const remaining = [];
  let delivered = 0;
  for (const entry of app.queue) {
    // The webhook timestamps on arrival, so the real entry time travels in the goal.
    const stamped = { ...entry, objectif: `${entry.objectif ? entry.objectif + " " : ""}[saisi le ${formatDate(entry.date)}]` };
    try { await sendEntry(stamped); markSent(entry.id); delivered++; } catch { remaining.push(entry); }
  }
  app.queue = remaining;
  save(STORAGE.queue, remaining);
  renderNotices();
  if (delivered) notify(`✅ ${plural(delivered, "prompt")} en attente envoyé${delivered > 1 ? "s" : ""}`);
}
function renderNotices() {
  const n = app.queue.length;
  el("queueNotice").hidden = n === 0;
  el("queueText").textContent = `${plural(n, "prompt")} en attente d'envoi`;
  el("setupNotice").hidden = Boolean(app.hook);
}
function renderNetwork() { el("offline").hidden = navigator.onLine; }
el("retryBtn").addEventListener("click", retryQueue);
window.addEventListener("online", () => { renderNetwork(); retryQueue(); });
window.addEventListener("offline", renderNetwork);

// ---------- History ----------
function historyItem(h) {
  const li = document.createElement("li");
  li.className = "entry" + (h.status === "wait" ? " entry--waiting" : "");

  const meta = document.createElement("div");
  meta.className = "entry__meta";
  const badge = document.createElement("span");
  badge.className = "badge badge--" + (h.status === "wait" ? "wait" : "sent");
  badge.textContent = h.status === "wait" ? "En attente" : "Envoyé";
  const info = document.createElement("span");
  info.textContent = `${formatDate(h.date)} · ${modelLabel(h)} ·${SHORT_PART[h.partie] || h.partie}`;
  meta.append(badge, info);
  li.append(meta);

  if (h.objectif) {
    const goal = document.createElement("div");
    goal.className = "entry__goal";
    goal.textContent = h.objectif;
    li.append(goal);
  }
  const text = document.createElement("p");
  text.className = "entry__text";
  text.textContent = h.prompt;
  li.append(text);

  const actions = document.createElement("div");
  actions.className = "entry__actions";
  const copy = document.createElement("button");
  copy.type = "button"; copy.className = "pill-btn"; copy.textContent = "Copier";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(h.prompt); notify("Prompt copié"); } catch { notify("Copie impossible"); }
  });
  const reuse = document.createElement("button");
  reuse.type = "button"; reuse.className = "pill-btn"; reuse.textContent = "Réutiliser";
  reuse.addEventListener("click", () => {
    setPrompt(h.prompt, h.objectif || "");
    goTo("saisir");
    notify("Prompt rechargé : modifiez-le puis enregistrez la nouvelle version");
  });
  actions.append(copy, reuse);
  li.append(actions);
  return li;
}

function renderHistory() {
  const list = el("historyList");
  const query = el("searchInput").value.trim().toLowerCase();
  const rows = app.history.filter((h) =>
    !query || [h.prompt, h.objectif, h.etape, h.outil, h.modele || "", h.partie].join(" ").toLowerCase().includes(query));
  el("historyCount").textContent = query
    ? plural(rows.length, "résultat")
    : `${plural(app.history.length, "prompt")} sur ce téléphone`;
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = query ? "Aucun prompt ne contient ce mot." : "Aucun prompt pour l'instant. Le premier envoi apparaîtra ici.";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...rows.map(historyItem));
}
el("searchInput").addEventListener("input", renderHistory);

// ---------- Settings ----------
el("hookInput").value = app.hook;
el("defaultExam").value = app.exam;
el("prefillLink").textContent = location.origin + location.pathname + "?hook=ADRESSE";
el("versionText").textContent = "Version " + APP_VERSION;

el("saveSettingsBtn").addEventListener("click", () => {
  const value = el("hookInput").value.trim();
  if (value && !/^https:\/\/\S+$/.test(value)) { notify("L'adresse doit commencer par https://"); return; }
  app.hook = value;
  save(STORAGE.hook, value);
  app.exam = el("defaultExam").value;
  save(STORAGE.exam, app.exam);
  renderExam();
  renderNotices();
  notify("Réglages enregistrés");
  goTo("saisir");
  retryQueue();
});

const WIPE_LABEL = "Vider l'historique local";
let wipeArmed = null;
el("wipeBtn").addEventListener("click", () => {
  const button = el("wipeBtn");
  if (wipeArmed) {
    clearTimeout(wipeArmed);
    wipeArmed = null;
    app.history = [];
    save(STORAGE.history, []);
    button.textContent = WIPE_LABEL;
    notify("Historique vidé");
    return;
  }
  button.textContent = "Toucher encore pour confirmer";
  wipeArmed = setTimeout(() => { wipeArmed = null; button.textContent = WIPE_LABEL; }, 4000);
});

// ---------- Start ----------
renderNetwork();
renderNotices();
retryQueue();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
