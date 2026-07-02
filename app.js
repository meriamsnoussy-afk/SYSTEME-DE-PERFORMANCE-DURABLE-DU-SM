const DATA_KEY = "spdsm_data_v3";
const RESPONSES_KEY = "spdsm_responses_v3";
const LIMITS_KEY = "spdsm_limits_v3";
const DOCS_KEY = "spdsm_docs_v3";

const statusOptions = ["C", "NC min", "NC maj"];
const priorityOptions = ["A definir", "Priorite elevee", "Priorite moyenne", "Priorite faible"];
const viewTitles = {
  questionnaire: "Questionnaire employé",
  reception: "Reception reponses",
  dashboard: "Tableau de bord",
  limits: "Limites du SM",
  swot: "SWOT intelligent",
  actions: "Plan d'action",
  report: "Rapport global",
  sources: "Sources / MAJ",
};

const state = {
  data: null,
  responses: JSON.parse(localStorage.getItem(RESPONSES_KEY) || "[]"),
  limitAnswers: JSON.parse(localStorage.getItem(LIMITS_KEY) || "{}"),
  documents: JSON.parse(localStorage.getItem(DOCS_KEY) || "[]"),
  employee: localStorage.getItem("spdsm_employee") || "",
  role: localStorage.getItem("spdsm_role") || "Tous",
  access: localStorage.getItem("spdsm_access") || "employee",
  online: false,
  view: "questionnaire",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

init().catch((error) => {
  console.error(error);
  showToast("Erreur de chargement.");
});

async function init() {
  await loadCentralState();
  bindEvents();
  hydrateProfile();
  applyAccessMode();
  renderAll();
}

async function loadCentralState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    const central = await response.json();
    state.online = true;
    state.data = central.data;
    state.responses = central.responses || [];
    state.limitAnswers = central.limitAnswers || {};
    localStorage.setItem(DATA_KEY, JSON.stringify(state.data));
    localStorage.setItem(RESPONSES_KEY, JSON.stringify(state.responses));
    localStorage.setItem(LIMITS_KEY, JSON.stringify(state.limitAnswers));
  } catch {
    state.online = false;
    const cached = localStorage.getItem(DATA_KEY);
    state.data = cached ? JSON.parse(cached) : await (await fetch("assets/seed-data.json")).json();
  }
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#accessMode").addEventListener("change", (event) => {
    state.access = event.target.value;
    localStorage.setItem("spdsm_access", state.access);
    applyAccessMode();
    renderAll();
  });
  $("#employeeName").addEventListener("input", (event) => {
    state.employee = event.target.value.trim();
    localStorage.setItem("spdsm_employee", state.employee);
  });
  $("#roleSelect").addEventListener("change", (event) => {
    state.role = event.target.value;
    localStorage.setItem("spdsm_role", state.role);
    renderAll();
  });
  $("#questionSearch").addEventListener("input", renderQuestionnaire);
  $("#standardFilter").addEventListener("change", renderQuestionnaire);
  $("#questionStatusFilter").addEventListener("change", renderQuestionnaire);
  $("#excelInput").addEventListener("change", handleExcelImport);
  $("#pdfInput").addEventListener("change", handlePdfImport);
  $("#responsesInput").addEventListener("change", importResponses);
  $("#backupInput").addEventListener("change", importBackup);
  $("#exportResponses").addEventListener("click", exportResponses);
  $("#exportBackup").addEventListener("click", exportBackup);
  $("#printReport").addEventListener("click", () => {
    setView("report");
    setTimeout(() => window.print(), 150);
  });
}

function hydrateProfile() {
  $("#accessMode").value = state.access;
  $("#employeeName").value = state.employee;
  const roles = ["Tous", ...(state.data.participants || [])];
  if (!roles.includes(state.role)) state.role = "Tous";
  $("#roleSelect").innerHTML = roles.map((role) => `<option value="${escapeAttr(role)}" ${role === state.role ? "selected" : ""}>${escapeHtml(role)}</option>`).join("");
  renderFilters();
}

function applyAccessMode() {
  const isAdmin = state.access === "admin";
  document.body.classList.toggle("is-admin", isAdmin);
  document.body.classList.toggle("is-employee", !isAdmin);
  $$(".admin-view").forEach((node) => node.style.display = isAdmin ? "" : "none");
  $$(".employee-view").forEach((node) => node.style.display = isAdmin ? "none" : "");
  if (isAdmin && ["questionnaire", "limits", "myresponses"].includes(state.view)) setView("reception");
  if (!isAdmin && !["questionnaire", "limits", "myresponses"].includes(state.view)) setView("questionnaire");
  $("#sourceSummary").textContent = state.online
    ? "Serveur reseau actif: reponses centralisees."
    : "Mode local: lancer server.js pour le reseau.";
}

function renderAll() {
  hydrateProfile();
  renderQuestionnaire();
  renderReception();
  renderMyResponses();
  renderDashboard();
  renderLimits();
  renderSwot();
  renderActions();
  renderReport();
  renderSources();
}

function setView(view) {
  state.view = view;
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === view));
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#viewTitle").textContent = viewTitles[view];
  if (view === "report") renderReport();
}

function renderFilters() {
  const standards = ["all", ...new Set(state.data.audits.map((item) => item.standard).filter(Boolean))];
  $("#standardFilter").innerHTML = standards.map((standard) => `<option value="${escapeAttr(standard)}">${standard === "all" ? "Tous les referentiels" : escapeHtml(standard)}</option>`).join("");
}

function questionsForRole() {
  const role = state.role;
  if (role === "Tous") return state.data.audits;
  return state.data.audits.filter((item) => roleMatches(item, role));
}

function roleMatches(item, role) {
  const text = `${item.responsable || ""} ${(item.participants || []).join(" ")}`.toLowerCase();
  return text.includes(role.toLowerCase());
}

function latestResponses() {
  const map = new Map();
  state.responses.forEach((response) => {
    const previous = map.get(response.auditId);
    if (!previous || new Date(response.updatedAt) >= new Date(previous.updatedAt)) map.set(response.auditId, response);
  });
  return map;
}

function responseFor(auditId) {
  return latestResponses().get(auditId) || null;
}

function renderQuestionnaire() {
  const query = ($("#questionSearch")?.value || "").toLowerCase();
  const standard = $("#standardFilter")?.value || "all";
  const status = $("#questionStatusFilter")?.value || "all";
  const latest = latestResponses();
  let questions = questionsForRole();
  questions = questions.filter((item) => {
    const response = latest.get(item.id);
    const actualStatus = response?.status || "A evaluer";
    const haystack = `${item.standard} ${item.clause} ${item.question} ${item.responsable}`.toLowerCase();
    return (!query || haystack.includes(query)) &&
      (standard === "all" || item.standard === standard) &&
      (status === "all" || normalizeStatus(actualStatus) === normalizeStatus(status));
  });
  $("#questionCards").innerHTML = questions.map((item) => questionCard(item, latest.get(item.id))).join("") || emptyState("Aucune question pour cette fonction.");
  $$("#questionCards [data-answer]").forEach((field) => field.addEventListener("input", updateDraft));
  $$("#questionCards [data-save]").forEach((button) => button.addEventListener("click", () => saveQuestionResponse(button.dataset.save)));
}

function questionCard(item, response) {
  const answer = response?.answer || "";
  const status = response?.status || "A evaluer";
  const observation = response?.observation || "";
  const action = response?.action || "";
  return `<article class="question-card" data-card="${item.id}">
    <div class="question-head">
      <strong>${escapeHtml(item.standard)}</strong>
      <span>${escapeHtml(item.responsable || "Tous")}</span>
    </div>
    <h3>${escapeHtml(item.question)}</h3>
    <p class="hint">${escapeHtml(item.clause || item.chapter || "")}</p>
    <div class="form-grid">
      <label>Reponse
        <select data-answer="${item.id}" data-field="answer">
          ${["", "Oui", "Partiel", "Non", "Non applicable"].map((value) => `<option value="${value}" ${answer === value ? "selected" : ""}>${value || "Choisir"}</option>`).join("")}
        </select>
      </label>
      <label>Test NC
        <select data-answer="${item.id}" data-field="status">
          ${statusOptions.map((value) => `<option value="${value}" ${normalizeStatus(status) === normalizeStatus(value) ? "selected" : ""}>${value}</option>`).join("")}
        </select>
      </label>
    </div>
    <label>Observation proposee / saisie
      <textarea data-answer="${item.id}" data-field="observation" placeholder="${escapeAttr(item.suggestedObservation || item.nonconformity || "Observation automatique")}">${escapeHtml(observation || autoObservation(item, status))}</textarea>
    </label>
    <label>Action corrective proposee
      <textarea data-answer="${item.id}" data-field="action" placeholder="${escapeAttr(item.suggestedAction || "Action automatique")}">${escapeHtml(action || autoAction(item, status))}</textarea>
    </label>
    <div class="form-grid">
      <label>Responsable action <input data-answer="${item.id}" data-field="owner" value="${escapeAttr(response?.owner || item.suggestedOwner || item.responsable || "")}"></label>
      <label>Delai <input data-answer="${item.id}" data-field="delay" value="${escapeAttr(response?.delay || autoDelay(item, status))}"></label>
      <label>Statut suivi
        <select data-answer="${item.id}" data-field="workflow">
          ${["A evaluer", "Ouvert", "En cours", "Clos"].map((value) => `<option value="${value}" ${normalizeStatus(response?.workflow || "A evaluer") === normalizeStatus(value) ? "selected" : ""}>${value}</option>`).join("")}
        </select>
      </label>
    </div>
    <button class="primary-button" data-save="${item.id}">Enregistrer la reponse</button>
  </article>`;
}

function updateDraft(event) {
  const card = event.target.closest(".question-card");
  const item = findAudit(card.dataset.card);
  const statusField = card.querySelector('[data-field="status"]');
  const answerField = card.querySelector('[data-field="answer"]');
  if (event.target.dataset.field === "answer" && normalizeStatus(statusField.value) === "a evaluer") {
    statusField.value = statusFromAnswer(answerField.value);
  }
  const currentStatus = statusField.value;
  const observation = card.querySelector('[data-field="observation"]');
  const action = card.querySelector('[data-field="action"]');
  const delay = card.querySelector('[data-field="delay"]');
  if (!observation.value.trim()) observation.value = autoObservation(item, currentStatus);
  if (!action.value.trim()) action.value = autoAction(item, currentStatus);
  if (!delay.value.trim() || delay.value === "A definir") delay.value = autoDelay(item, currentStatus);
}

function saveQuestionResponse(auditId) {
  const item = findAudit(auditId);
  const card = document.querySelector(`[data-card="${CSS.escape(auditId)}"]`);
  const read = (field) => card.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
  const response = {
    id: makeId(`${auditId}-${state.employee || "Employe"}-${Date.now()}`),
    auditId,
    employee: state.employee || "Employe non renseigne",
    role: state.role,
    standard: item.standard,
    question: item.question,
    answer: read("answer"),
    status: read("status") || statusFromAnswer(read("answer")),
    observation: read("observation") || autoObservation(item, read("status")),
    action: read("action") || autoAction(item, read("status")),
    owner: read("owner") || item.suggestedOwner || item.responsable,
    delay: read("delay") || autoDelay(item, read("status")),
    workflow: read("workflow") || "Ouvert",
    updatedAt: new Date().toISOString(),
  };
  state.responses.push(response);
  persistResponses();
  syncResponse(response);
  renderAll();
  showToast("Reponse enregistree et recue par l'administration.");
}

async function syncResponse(response) {
  if (!state.online) return;
  try {
    const api = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });
    if (api.ok) {
      const central = await api.json();
      state.responses = central.responses || state.responses;
      localStorage.setItem(RESPONSES_KEY, JSON.stringify(state.responses));
      renderAll();
    }
  } catch {
    state.online = false;
  }
}

function renderReception() {
  if (state.access !== "admin") return;
  const employees = new Set(state.responses.map((item) => item.employee));
  const coverage = state.data.audits.length ? Math.round((latestResponses().size / state.data.audits.length) * 100) : 0;
  $("#kpiResponses").textContent = state.responses.length;
  $("#kpiEmployees").textContent = employees.size;
  $("#kpiCoverage").textContent = `${coverage}%`;
  $("#kpiUpdated").textContent = state.responses.length ? new Date(state.responses[state.responses.length - 1].updatedAt).toLocaleDateString("fr-FR") : "-";
  const rows = [...state.responses].reverse();
  $("#responsesTable").innerHTML = `<table>
    <thead><tr><th>Date</th><th>Employe</th><th>Fonction</th><th>Referentiel</th><th>Question</th><th>Reponse</th><th>NC</th><th>Action</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${new Date(r.updatedAt).toLocaleString("fr-FR")}</td><td>${escapeHtml(r.employee)}</td><td>${escapeHtml(r.role)}</td><td>${escapeHtml(r.standard)}</td><td>${escapeHtml(r.question)}</td><td>${escapeHtml(r.answer)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.action)}</td></tr>`).join("")}</tbody>
  </table>`;
}

function renderMyResponses() {
  const mine = state.responses.filter((item) => item.employee === (state.employee || "Employe non renseigne"));
  $("#myResponsesTable").innerHTML = `<table>
    <thead><tr><th>Date</th><th>Referentiel</th><th>Question</th><th>Reponse</th><th>NC</th><th>Action</th></tr></thead>
    <tbody>${mine.slice().reverse().map((r) => `<tr><td>${new Date(r.updatedAt).toLocaleString("fr-FR")}</td><td>${escapeHtml(r.standard)}</td><td>${escapeHtml(r.question)}</td><td>${escapeHtml(r.answer)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.action)}</td></tr>`).join("")}</tbody>
  </table>`;
}

function renderDashboard() {
  if (state.access !== "admin") return;
  const latest = latestResponses();
  const answered = [...latest.values()].filter((r) => normalizeStatus(r.status) !== "a evaluer");
  const nc = answered.filter((r) => isNc(r.status));
  const actions = generatedActions();
  const conformity = answered.length ? Math.round((answered.filter((r) => normalizeStatus(r.status) === "c").length / answered.length) * 100) : 0;
  const durable = Math.round((conformity * 0.7) + (computeLimitScore() * 0.3));
  $("#kpiQuestions").textContent = state.data.audits.length;
  $("#kpiNc").textContent = nc.length;
  $("#kpiActions").textContent = actions.length;
  $("#kpiScore").textContent = `${durable}%`;
  $("#sourceSummary").textContent = `${state.data.source?.excel || "Questionnaire"} - ${state.data.audits.length} questions - ${state.responses.length} reponses recues`;

  const byStandard = groupBy(state.data.audits, "standard");
  $("#standardBars").innerHTML = Object.entries(byStandard).map(([standard, questions]) => {
    const ids = new Set(questions.map((q) => q.id));
    const standardResponses = answered.filter((r) => ids.has(r.auditId));
    const score = standardResponses.length ? Math.round((standardResponses.filter((r) => normalizeStatus(r.status) === "c").length / standardResponses.length) * 100) : 0;
    return `<div class="bar-row"><div class="bar-label"><strong>${escapeHtml(standard)}</strong><span>${score}% - ${standardResponses.length}/${questions.length} reponses</span></div><div class="bar-track"><div class="bar-fill" style="width:${score}%"></div></div></div>`;
  }).join("");

  const byRole = groupBy(state.responses, "role");
  $("#roleParticipation").innerHTML = Object.entries(byRole).map(([role, items]) => `<article class="mini-item"><strong>${escapeHtml(role)}</strong><span>${items.length} reponses recues</span></article>`).join("") || emptyState("Aucune reponse recue.");
  $("#priorityList").innerHTML = actions.slice(0, 8).map((a) => `<article class="priority-item"><strong>${escapeHtml(a.status)} - ${escapeHtml(a.owner)}</strong><span>${escapeHtml(a.action)}</span></article>`).join("") || emptyState("Aucune priorite.");
}

function renderLimits() {
  $("#limitsGrid").innerHTML = state.data.limits.map((item) => {
    const saved = state.limitAnswers[item.id] || {};
    return `<article class="limit-card" data-limit="${item.id}">
      <h4>${escapeHtml(item.axis || "Axe SM")}</h4>
      <p>${escapeHtml(item.question)}</p>
      <label>Score
        <select data-limit-field="score">${["", "1", "2", "3", "4"].map((v) => `<option value="${v}" ${String(saved.score || "") === v ? "selected" : ""}>${v || "A evaluer"}</option>`).join("")}</select>
      </label>
      <label>Priorite
        <select data-limit-field="priority">${priorityOptions.map((v) => `<option value="${v}" ${(saved.priority || item.priority || "A definir") === v ? "selected" : ""}>${v}</option>`).join("")}</select>
      </label>
      <textarea data-limit-field="answer" placeholder="Commentaire / cause / proposition">${escapeHtml(saved.answer || "")}</textarea>
      <p><strong>Innovation:</strong> ${escapeHtml(item.innovation || "A definir")}</p>
    </article>`;
  }).join("");
  $$("#limitsGrid [data-limit-field]").forEach((field) => field.addEventListener("input", saveLimitAnswer));
  $$("#limitsGrid [data-limit-field]").forEach((field) => field.addEventListener("change", saveLimitAnswer));
}

function saveLimitAnswer(event) {
  const card = event.target.closest("[data-limit]");
  const id = card.dataset.limit;
  state.limitAnswers[id] = state.limitAnswers[id] || {};
  card.querySelectorAll("[data-limit-field]").forEach((field) => {
    state.limitAnswers[id][field.dataset.limitField] = field.value;
  });
  localStorage.setItem(LIMITS_KEY, JSON.stringify(state.limitAnswers));
  syncLimits();
  renderDashboard();
  renderSwot();
  renderReport();
}

async function syncLimits() {
  if (!state.online) return;
  try {
    await fetch("/api/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.limitAnswers),
    });
  } catch {
    state.online = false;
  }
}

function renderSwot() {
  if (state.access !== "admin") return;
  const swot = buildSwot();
  $("#swotStrengths").innerHTML = listItems(swot.strengths);
  $("#swotWeaknesses").innerHTML = listItems(swot.weaknesses);
  $("#swotOpportunities").innerHTML = listItems(swot.opportunities);
  $("#swotThreats").innerHTML = listItems(swot.threats);
}

function renderActions() {
  if (state.access !== "admin") return;
  const actions = generatedActions();
  const columns = {
    "Urgent": actions.filter((a) => normalizeStatus(a.status) === "nc maj"),
    "Planifie": actions.filter((a) => normalizeStatus(a.status) === "nc min"),
    "En cours / suivi": actions.filter((a) => !["nc maj", "nc min"].includes(normalizeStatus(a.status))),
  };
  $("#actionBoard").innerHTML = Object.entries(columns).map(([title, rows]) => `<section class="action-column"><h3>${title} (${rows.length})</h3>${rows.map((a) => `<article class="action-card"><p>${escapeHtml(a.action)}</p><div class="action-meta"><span>${escapeHtml(a.owner)}</span><span>${escapeHtml(a.delay)}</span><span>${escapeHtml(a.employee)}</span></div></article>`).join("") || emptyState("Aucune action.")}</section>`).join("");
}

function renderReport() {
  if (state.access !== "admin") return;
  const latest = [...latestResponses().values()];
  const actions = generatedActions();
  const swot = buildSwot();
  $("#reportContent").innerHTML = `<h1>SYSTEME DE PERFORMANCE DURABLE DU SM</h1>
    <p class="report-meta">Rapport genere depuis ${state.responses.length} reponses employees - source ${escapeHtml(state.data.source?.excel || "")}</p>
    <section><h2>Synthese</h2><div class="report-kpis">
      <div><strong>${state.data.audits.length}</strong><span>questions</span></div>
      <div><strong>${latest.length}</strong><span>questions couvertes</span></div>
      <div><strong>${latest.filter((r) => isNc(r.status)).length}</strong><span>NC</span></div>
      <div><strong>${actions.length}</strong><span>actions</span></div>
    </div></section>
    <section><h2>SWOT automatique</h2><div class="report-swot"><div><h3>Forces</h3>${listItems(swot.strengths)}</div><div><h3>Faiblesses</h3>${listItems(swot.weaknesses)}</div><div><h3>Opportunites</h3>${listItems(swot.opportunities)}</div><div><h3>Menaces</h3>${listItems(swot.threats)}</div></div></section>
    <section><h2>Actions recommandees</h2>${actions.slice(0, 40).map((a) => `<article class="report-action"><strong>${escapeHtml(a.status)} - ${escapeHtml(a.owner)}</strong><p>${escapeHtml(a.action)}</p><small>${escapeHtml(a.delay)} - ${escapeHtml(a.employee)}</small></article>`).join("") || "<p>Aucune action generee.</p>"}</section>`;
}

function renderSources() {
  if (state.access !== "admin") return;
  $("#sourceDetails").innerHTML = `<dt>Questionnaire</dt><dd>${escapeHtml(state.data.source?.excel || "")}</dd><dt>Questions</dt><dd>${state.data.audits.length}</dd><dt>Limites SM</dt><dd>${state.data.limits.length}</dd><dt>Roles</dt><dd>${(state.data.participants || []).length}</dd><dt>Reponses</dt><dd>${state.responses.length}</dd>`;
  $("#standardCards").innerHTML = (state.data.standards || []).map((s) => `<article class="standard-card"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.file || "")}</span></article>`).join("");
}

function generatedActions() {
  return [...latestResponses().values()].filter((r) => isNc(r.status)).map((r) => ({
    ...r,
    action: r.action || autoAction(findAudit(r.auditId), r.status),
    owner: r.owner || findAudit(r.auditId)?.suggestedOwner || findAudit(r.auditId)?.responsable || "Responsable a definir",
    delay: r.delay || autoDelay(findAudit(r.auditId), r.status),
  }));
}

function buildSwot() {
  const latest = [...latestResponses().values()];
  const strengths = latest.filter((r) => normalizeStatus(r.status) === "c").slice(0, 10).map((r) => expressionFromResponse(r, "force"));
  const weaknesses = latest.filter((r) => isNc(r.status)).slice(0, 10).map((r) => expressionFromResponse(r, "weakness"));
  const limits = Object.entries(state.limitAnswers).map(([id, answer]) => ({ ...findLimit(id), ...answer }));
  const opportunities = limits.filter((l) => l.innovation || normalizePriority(l.priority).includes("moyenne")).slice(0, 10).map((l) => expressionFromLimit(l, "opportunity"));
  const threats = limits.filter((l) => normalizePriority(l.priority).includes("elevee") || Number(l.score) <= 2 && l.score).slice(0, 10).map((l) => expressionFromLimit(l, "threat"));
  return {
    strengths: strengths.length ? strengths : ["Aucune force consolidee: saisir des reponses conformes."],
    weaknesses: weaknesses.length ? weaknesses : ["Aucune faiblesse consolidee: saisir les NC."],
    opportunities: opportunities.length ? opportunities : ["Opportunites generees apres evaluation des limites du SM."],
    threats: threats.length ? threats : ["Menaces generees apres priorisation elevee ou score faible."],
  };
}

function expressionFromResponse(response, type) {
  const audit = findAudit(response.auditId) || {};
  const domain = cleanQuestion(audit.clause || audit.chapter || response.standard || "systeme de management");
  if (type === "force") return `Maitrise constatee du domaine ${domain}`;
  const issue = cleanQuestion(response.observation || audit.nonconformity || "ecart de maitrise du processus");
  return `Fragilite identifiee: ${issue}`;
}

function expressionFromLimit(limit, type) {
  const scope = cleanQuestion(limit.object || limit.axis || "systeme de management");
  if (type === "opportunity") return cleanQuestion(limit.innovation || `Potentiel d'innovation sur ${scope}`);
  return cleanQuestion(limit.impact || `Risque prioritaire sur ${scope}`);
}

function cleanQuestion(text = "") {
  return String(text)
    .replace(/^\d+\.\s*/, "")
    .replace(/[?؟]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeLimitScore() {
  const values = Object.values(state.limitAnswers).filter((a) => a.score);
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, a) => sum + Number(a.score || 0), 0) / (values.length * 4) * 100);
}

function statusFromAnswer(answer) {
  if (answer === "Oui") return "C";
  if (answer === "Partiel") return "NC min";
  if (answer === "Non") return "NC maj";
  return "A evaluer";
}

function autoObservation(item, status) {
  if (!item) return "";
  if (!isNc(status)) return normalizeStatus(status) === "c" ? "Conforme, pratique a maintenir." : "";
  return item.suggestedObservation || item.nonconformity || `Ecart detecte: ${item.question}`;
}

function autoAction(item, status) {
  if (!item) return "";
  if (!isNc(status)) return normalizeStatus(status) === "c" ? "Maintenir et surveiller." : "";
  return item.suggestedAction || `Analyser la cause et mettre en place une action corrective: ${item.question}`;
}

function autoDelay(item, status) {
  if (normalizeStatus(status) === "nc maj") return item?.suggestedDelay || "30 jours";
  if (normalizeStatus(status) === "nc min") return item?.suggestedDelay || "60 jours";
  return "A definir";
}

async function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file || !window.JSZip) return showToast("Import Excel impossible.");
  const workbook = await readXlsxWorkbook(await file.arrayBuffer());
  state.data = parseWorkbook(workbook, file.name);
  localStorage.setItem(DATA_KEY, JSON.stringify(state.data));
  if (state.online) {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.data),
    });
  }
  hydrateProfile();
  renderAll();
  showToast("Questionnaire actualise. Les anciennes reponses compatibles restent dans la reception.");
}

async function handlePdfImport(event) {
  const files = [...event.target.files];
  state.data.standards = state.data.standards || [];
  files.forEach((file) => {
    const name = file.name.includes("9001") ? "ISO 9001:2015" : file.name.includes("56001") ? "ISO 56001:2024" : "Referentiel ISO";
    const found = state.data.standards.find((s) => s.name === name);
    const payload = { name, file: file.name, size: file.size, updatedAt: new Date(file.lastModified).toISOString() };
    if (found) Object.assign(found, payload);
    else state.data.standards.push(payload);
  });
  localStorage.setItem(DATA_KEY, JSON.stringify(state.data));
  renderSources();
  showToast("Referentiels PDF actualises.");
}

async function importResponses(event) {
  const file = event.target.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  const incoming = Array.isArray(imported) ? imported : imported.responses || [];
  mergeResponses(incoming);
  showToast(`${incoming.length} reponses importees.`);
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const backup = JSON.parse(await file.text());
  if (backup.data) state.data = backup.data;
  if (backup.responses) state.responses = backup.responses;
  if (backup.limitAnswers) state.limitAnswers = backup.limitAnswers;
  persistAll();
  renderAll();
  showToast("Sauvegarde restauree.");
}

function exportResponses() {
  downloadFile("reponses-employes-sm.json", JSON.stringify({ exportedAt: new Date().toISOString(), responses: state.responses }, null, 2), "application/json");
}

function exportBackup() {
  downloadFile("sauvegarde-complete-sm.json", JSON.stringify({ exportedAt: new Date().toISOString(), data: state.data, responses: state.responses, limitAnswers: state.limitAnswers }, null, 2), "application/json");
}

function mergeResponses(incoming) {
  const existing = new Set(state.responses.map((r) => r.id));
  incoming.forEach((r) => {
    if (!existing.has(r.id)) state.responses.push(r);
  });
  persistResponses();
  renderAll();
}

function persistResponses() {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(state.responses));
}

function persistAll() {
  localStorage.setItem(DATA_KEY, JSON.stringify(state.data));
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(state.responses));
  localStorage.setItem(LIMITS_KEY, JSON.stringify(state.limitAnswers));
}

function parseWorkbook(workbook, fileName) {
  const audits = [];
  const limits = [];
  const participants = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = workbook.Sheets[sheetName] || [];
    rows.forEach((row) => {
      const cells = row.map((cell) => String(cell || "").trim());
      if ((cells[1] || "").toLowerCase() === "participants") participants.push(...String(cells[2] || "").split(/\n|;/).map((x) => x.trim()).filter(Boolean));
    });
    if (sheetName.toLowerCase().includes("audit") || rows.some((r) => r.join(" ").toLowerCase().includes("question d"))) parseAuditRows(rows, sheetName, inferStandard(sheetName, rows), audits);
    if (sheetName.toLowerCase().includes("limites")) parseLimitRows(rows, limits);
  });
  return { source: { excel: fileName, extractedAt: new Date().toISOString() }, participants: [...new Set(participants)], audits, limits, standards: state.data?.standards || [] };
}

function parseAuditRows(rows, sheetName, standard, target) {
  let chapter = "";
  let clause = "";
  let map = null;
  rows.forEach((row, rowIndex) => {
    const cells = row.map((value) => String(value || "").trim());
    const firstText = cells.find(Boolean) || "";
    if (firstText.toUpperCase().startsWith("CHAPITRE")) chapter = firstText;
    if (firstText.toLowerCase().startsWith("clause")) clause = firstText;
    if (/question d.?audit/i.test(cells.join(" ")) && /responsable/i.test(cells.join(" "))) {
      map = detectHeaderMap(cells);
      return;
    }
    if (!map) return;
    const question = cells[map.question] || "";
    if (question.length < 20 || question.toLowerCase().startsWith("nc typiques")) return;
    target.push({
      id: makeId(`${standard}-${question}`),
      standard,
      sheet: sheetName,
      chapter,
      clause,
      question,
      responsable: cells[map.responsable] || "",
      participants: String(cells[map.responsable] || "").split(/\n|\/|;/).map((x) => x.trim()).filter(Boolean),
      expected: cells[map.expected] || "",
      nonconformity: cells[map.nonconformity] || "",
      suggestedStatus: cells[map.status] || "A evaluer",
      suggestedObservation: cells[map.observation] || "",
      suggestedAction: cells[map.action] || "",
      suggestedOwner: cells[map.owner] || "",
      suggestedDelay: cells[map.delay] || "",
    });
  });
}

function parseLimitRows(rows, target) {
  let header = null;
  let axis = "";
  rows.forEach((row, rowIndex) => {
    const cells = row.map((value) => String(value || "").trim());
    if (cells.join(" ").includes("Innovation envisageable")) {
      header = detectLimitMap(cells);
      return;
    }
    if (!header) return;
    const question = cells[header.question] || "";
    if (!question) return;
    axis = cells[header.axis] || axis;
    target.push({ id: makeId(`limit-${question}`), axis, isoLink: cells[header.isoLink] || "", object: cells[header.object] || "", question, impact: cells[header.impact] || "", cause: cells[header.cause] || "", innovation: cells[header.innovation] || "", priority: cells[header.priority] || "A definir" });
  });
}

async function readXlsxWorkbook(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file("xl/workbook.xml").async("text");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("text");
  const sharedXml = zip.file("xl/sharedStrings.xml") ? await zip.file("xl/sharedStrings.xml").async("text") : "";
  const shared = parseSharedStrings(sharedXml);
  const rels = parseWorkbookRels(relsXml);
  const sheets = [...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((match) => ({ name: decodeXml(match[1]), path: `xl/${rels[match[2]]}`.replace("xl//", "xl/") }));
  const result = { SheetNames: [], Sheets: {} };
  for (const sheet of sheets) {
    const file = zip.file(sheet.path);
    if (!file) continue;
    const xml = await file.async("text");
    result.SheetNames.push(sheet.name);
    result.Sheets[sheet.name] = parseSheetRows(xml, shared);
  }
  return result;
}

function parseWorkbookRels(xml) {
  const rels = {};
  [...xml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].forEach((match) => {
    rels[match[1]] = match[2].replace(/^\/?xl\//, "");
  });
  return rels;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => decodeXml(text[1])).join(""));
}

function parseSheetRows(xml, shared) {
  const rows = [];
  [...xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].forEach((rowMatch) => {
    const rowIndex = Number(rowMatch[1]) - 1;
    rows[rowIndex] = rows[rowIndex] || [];
    [...rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].forEach((cellMatch) => {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1] || "A";
      const type = attrs.match(/t="([^"]+)"/)?.[1] || "";
      const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);
      const inlineMatch = body.match(/<is>([\s\S]*?)<\/is>/);
      let value = "";
      if (type === "s" && valueMatch) value = shared[Number(valueMatch[1])] || "";
      else if (type === "inlineStr" && inlineMatch) value = [...inlineMatch[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
      else if (valueMatch) value = decodeXml(valueMatch[1]);
      rows[rowIndex][columnToIndex(ref)] = value;
    });
  });
  return rows.map((row) => row || []);
}

function detectHeaderMap(cells) {
  const find = (terms, fallback) => {
    const index = cells.findIndex((cell) => terms.some((term) => cell.toLowerCase().includes(term)));
    return index >= 0 ? index : fallback;
  };
  return { question: find(["question"], 1), responsable: find(["responsable"], 2), expected: find(["conform"], 3), nonconformity: find(["non conform", "non-conform"], 4), status: find(["test", "niveau"], 5), observation: find(["observation"], 6), action: find(["action corrective", "action"], 7), owner: find(["responsable action"], 8), delay: find(["delai", "délai"], 9) };
}

function detectLimitMap(cells) {
  const find = (term, fallback) => {
    const index = cells.findIndex((cell) => cell.toLowerCase().includes(term));
    return index >= 0 ? index : fallback;
  };
  return { axis: find("axe", 1), isoLink: find("normes", 2), object: find("objet", 3), question: find("question", 4), score: find("score", 5), impact: find("impact", 7), cause: find("cause", 8), innovation: find("innovation", 9), priority: find("priorit", 10) };
}

function findAudit(id) {
  return state.data.audits.find((item) => item.id === id);
}

function findLimit(id) {
  return state.data.limits.find((item) => item.id === id) || {};
}

function inferStandard(sheetName, rows) {
  const text = `${sheetName} ${rows.slice(0, 8).flat().join(" ")}`.toLowerCase();
  if (text.includes("56001")) return "ISO 56001:2024";
  if (text.includes("9001")) return "ISO 9001:2015";
  return sheetName;
}

function normalizeStatus(value) {
  return String(value || "A evaluer").trim().toLowerCase();
}

function normalizePriority(value) {
  return String(value || "").toLowerCase();
}

function isNc(value) {
  return normalizeStatus(value).includes("nc");
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const group = item[key] || "Non classe";
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});
}

function listItems(items) {
  return `<ul>${items.slice(0, 10).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function columnToIndex(column) {
  return column.split("").reduce((sum, char) => (sum * 26) + char.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value = "") {
  return String(value).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function makeId(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) - hash) + input.charCodeAt(i) | 0;
  return `id_${Math.abs(hash)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/\n/g, " ");
}

function csvCell(value = "") {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function emptyState(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
