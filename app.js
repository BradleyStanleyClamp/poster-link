// ====== CONFIG — set these after you deploy the Apps Script backend (see README.md) ======
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywfyg2WPJfLd9n7ZaL9xp_5jXb1i2lknC0uBjiZ93t-ZHzaiZa6zLzRmgb9cqKqhYtbA/exec";
const SHARED_SECRET = "glasto"; // must match SECRET in backend/Code.gs
// ===========================================================================================

const MAX_KNOWN = 8;

// ---------- gate ----------
const gateEl = document.getElementById("gate");
const appEl = document.getElementById("app");

function checkGate() {
  const saved = localStorage.getItem("glasto_secret");
  if (saved === SHARED_SECRET) {
    gateEl.style.display = "none";
    appEl.style.display = "block";
    return true;
  }
  return false;
}

document.getElementById("gate-submit").addEventListener("click", () => {
  const val = document.getElementById("gate-secret").value.trim();
  if (val === SHARED_SECRET) {
    localStorage.setItem("glasto_secret", val);
    checkGate();
  } else {
    document.getElementById("gate-error").style.display = "block";
  }
});

checkGate();

// ---------- tabs ----------
const tabSignup = document.getElementById("tab-signup");
const tabGroups = document.getElementById("tab-groups");
const viewSignup = document.getElementById("view-signup");
const viewGroups = document.getElementById("view-groups");

tabSignup.addEventListener("click", () => switchTab("signup"));
tabGroups.addEventListener("click", () => {
  switchTab("groups");
  loadAndRender();
});

function switchTab(name) {
  const isSignup = name === "signup";
  tabSignup.classList.toggle("active", isSignup);
  tabGroups.classList.toggle("active", !isSignup);
  viewSignup.classList.toggle("active", isSignup);
  viewGroups.classList.toggle("active", !isSignup);
}

// ---------- escaping ----------
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// ---------- action picker (solo / start / join) ----------
let currentAction = null; // 'solo' | 'start' | 'join'

document.querySelectorAll(".action-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    currentAction = btn.dataset.action;
    document.getElementById("action-picker").style.display = "none";
    document.getElementById("signup-form-card").style.display = "block";
    document.getElementById("group-name-field").style.display = currentAction === "start" ? "block" : "none";
    document.getElementById("group-join-field").style.display = currentAction === "join" ? "block" : "none";
    if (currentAction === "join") await populateGroupSelect();
  });
});

document.getElementById("back-to-picker").addEventListener("click", () => {
  currentAction = null;
  document.getElementById("action-picker").style.display = "block";
  document.getElementById("signup-form-card").style.display = "none";
});

document.getElementById("refresh-groups").addEventListener("click", populateGroupSelect);

async function populateGroupSelect() {
  const select = document.getElementById("groupSelect");
  select.innerHTML = `<option>Loading…</option>`;
  try {
    const responses = await fetchResponses();
    const { groups } = groupByCode(responses);
    const open = groups.filter((g) => g.members.length < 6);
    if (open.length === 0) {
      select.innerHTML = `<option value="">No open groups yet — pick "Start a group" instead</option>`;
      return;
    }
    select.innerHTML = open
      .map((g) => `<option value="${escapeHtml(g.displayName)}">${escapeHtml(g.displayName)} (${g.members.length}/6)</option>`)
      .join("");
  } catch (err) {
    select.innerHTML = `<option value="">Couldn't load groups (${err.message})</option>`;
  }
}

// ---------- dynamic "known" rows (capped) ----------
function addRow(containerId, placeholder, required) {
  const container = document.getElementById(containerId);
  if (containerId === "known-rows" && container.children.length >= MAX_KNOWN) return;
  const row = document.createElement("div");
  row.className = "multi-row";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  if (required) input.required = true;
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => row.remove());
  row.appendChild(input);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

addRow("known-rows", "Name in another group (optional)", false);

document.getElementById("add-known").addEventListener("click", () =>
  addRow("known-rows", "Name in another group (optional)", false)
);

function collectRowValues(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input`))
    .map((i) => i.value.trim())
    .filter((v) => v.length > 0);
}

// ---------- submit ----------
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("signup-status");
  statusEl.innerHTML = "";

  let groupCode = "";
  if (currentAction === "start") {
    groupCode = document.getElementById("groupName").value.trim();
    if (!groupCode) {
      statusEl.innerHTML = `<div class="notice danger">Give your group a name.</div>`;
      return;
    }
  } else if (currentAction === "join") {
    groupCode = document.getElementById("groupSelect").value;
    if (!groupCode) {
      statusEl.innerHTML = `<div class="notice danger">Choose a group to join.</div>`;
      return;
    }
  }

  const payload = {
    secret: SHARED_SECRET,
    fullName: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    regNumber: document.getElementById("regNumber").value.trim(),
    groupCode,
    known: collectRowValues("known-rows"),
  };

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight against Apps Script
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    statusEl.innerHTML = `<div class="notice ok">Thanks ${escapeHtml(payload.fullName)}, you're in. Check the "Groups & ring" tab to see your group form.</div>`;
    document.getElementById("signup-form").reset();
    document.getElementById("known-rows").innerHTML = "";
    addRow("known-rows", "Name in another group (optional)", false);
    document.getElementById("back-to-picker").click();
  } catch (err) {
    statusEl.innerHTML = `<div class="notice danger">Couldn't submit (${err.message}). Ask the organiser to check the backend is deployed.</div>`;
  }
});

// ---------- fetch responses (JSONP — sidesteps Apps Script CORS quirks) ----------
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "glastoCb" + Date.now() + Math.floor(Math.random() * 10000);
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Failed to reach the backend"));
    };
    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function fetchResponses() {
  const url = `${SCRIPT_URL}?action=list&secret=${encodeURIComponent(SHARED_SECRET)}`;
  const data = await jsonpFetch(url);
  if (data && data.error) throw new Error(data.error);
  return data || [];
}

// ---------- name matching helpers ----------
function normalize(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------- grouping: explicit GroupCode from start/join, no name-guessing ----------
function groupByCode(responses) {
  const map = new Map(); // normalized code -> { code, displayName, members }
  const unplaced = [];

  responses.forEach((r) => {
    const rawCode = String(r.GroupCode || r.groupCode || "").trim();
    const member = {
      fullName: r.FullName || r.fullName,
      regNumber: r.RegNumber || r.regNumber,
      email: r.Email || r.email,
      known: String(r.Known || "").split("|").map((s) => s.trim()).filter(Boolean),
    };
    if (!rawCode) {
      unplaced.push(member);
      return;
    }
    const key = normalize(rawCode);
    if (!map.has(key)) map.set(key, { code: key, displayName: rawCode, members: [] });
    map.get(key).members.push(member);
  });

  return { groups: Array.from(map.values()), unplaced };
}

// ---------- ring building: greedy nearest-neighbour on "known" links between groups ----------
function buildKnownWeights(groups) {
  const nameToGroup = new Map();
  groups.forEach((g) =>
    g.members.forEach((m) => nameToGroup.set(normalize(m.fullName), g.code))
  );

  const weight = {};
  groups.forEach((g) => {
    g.members.forEach((m) => {
      (m.known || []).forEach((k) => {
        const otherCode = nameToGroup.get(normalize(k));
        if (otherCode && otherCode !== g.code) {
          weight[g.code] = weight[g.code] || {};
          weight[g.code][otherCode] = (weight[g.code][otherCode] || 0) + 1;
          weight[otherCode] = weight[otherCode] || {};
          weight[otherCode][g.code] = (weight[otherCode][g.code] || 0) + 1;
        }
      });
    });
  });
  return weight;
}

function buildRing(groups, weight) {
  const codes = groups.map((g) => g.code);
  if (codes.length === 0) return [];
  const visited = new Set([codes[0]]);
  const order = [{ code: codes[0], bridge: false }];

  while (order.length < codes.length) {
    const current = order[order.length - 1].code;
    const neighbours = weight[current] || {};
    let best = null,
      bestW = -1;
    Object.entries(neighbours).forEach(([code, w]) => {
      if (!visited.has(code) && w > bestW) {
        best = code;
        bestW = w;
      }
    });
    const bridge = best === null;
    if (bridge) best = codes.find((code) => !visited.has(code));
    order.push({ code: best, bridge });
    visited.add(best);
  }
  return order;
}

// ---------- rendering ----------
function groupLabel(members) {
  return members.map((m) => escapeHtml(m.fullName)).join(", ");
}

function renderGroups(groups, unplaced) {
  const listEl = document.getElementById("groups-list");
  const summaryEl = document.getElementById("groups-summary");
  const complete = groups.filter((g) => g.members.length === 6);
  const forming = groups.filter((g) => g.members.length < 6);
  const oversized = groups.filter((g) => g.members.length > 6);

  const parts = [`${complete.length} complete group${complete.length === 1 ? "" : "s"} (${complete.length * 6} people ready)`];
  if (forming.length) parts.push(`${forming.length} still forming`);
  if (oversized.length) parts.push(`${oversized.length} oversized — needs checking`);
  if (unplaced.length) parts.push(`${unplaced.length} not yet in a group`);
  summaryEl.innerHTML = `<div class="notice ${oversized.length ? "danger" : forming.length || unplaced.length ? "warn" : "ok"}">${parts.join(", ")}.</div>`;

  listEl.innerHTML = "";
  groups.forEach((g) => {
    const block = document.createElement("div");
    block.className = "group-block";
    let tag = '<span class="tag pending">forming</span>';
    if (g.members.length === 6) tag = '<span class="tag">complete</span>';
    if (g.members.length > 6) tag = '<span class="tag pending" style="background:var(--danger-bg);color:var(--danger-text);">too many — check for a name clash</span>';
    block.innerHTML = `<h3>${escapeHtml(g.displayName)} ${tag}</h3>`;
    g.members.forEach((m) => {
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `<span>${escapeHtml(m.fullName)}</span><span>${escapeHtml(m.regNumber || "no reg #")}</span>`;
      block.appendChild(row);
    });
    if (g.members.length < 6) {
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `<span class="missing">${6 - g.members.length} spot${6 - g.members.length === 1 ? "" : "s"} left</span>`;
      block.appendChild(row);
    }
    listEl.appendChild(block);
  });

  const unplacedCard = document.getElementById("unplaced-card");
  const unplacedList = document.getElementById("unplaced-list");
  if (unplaced.length) {
    unplacedCard.style.display = "block";
    unplacedList.innerHTML = unplaced
      .map((m) => `<div class="member-row"><span>${escapeHtml(m.fullName)}</span><span>${escapeHtml(m.regNumber || "no reg #")}</span></div>`)
      .join("");
  } else {
    unplacedCard.style.display = "none";
  }
}

function renderRing(groups, ring) {
  const el = document.getElementById("ring-list");
  el.innerHTML = "";
  const byCode = new Map(groups.map((g) => [g.code, g]));
  ring.forEach((entry, idx) => {
    const g = byCode.get(entry.code);
    const li = document.createElement("li");
    li.innerHTML = `<span>${idx + 1}. ${groupLabel(g.members)}</span>${
      entry.bridge ? '<span class="bridge">no known link — forced bridge</span>' : ""
    }`;
    el.appendChild(li);
  });
}

let lastGroups = [];
let lastRing = [];

async function loadAndRender() {
  const summaryEl = document.getElementById("groups-summary");
  summaryEl.innerHTML = `<div class="notice">Loading…</div>`;
  try {
    const responses = await fetchResponses();
    const { groups, unplaced } = groupByCode(responses);
    const completeGroups = groups.filter((g) => g.members.length === 6);
    const weight = buildKnownWeights(completeGroups);
    const ring = buildRing(completeGroups, weight);
    lastGroups = completeGroups;
    lastRing = ring;
    renderGroups(groups, unplaced);
    renderRing(completeGroups, ring);
  } catch (err) {
    summaryEl.innerHTML = `<div class="notice danger">Couldn't load data (${err.message}).</div>`;
  }
}

document.getElementById("refresh-btn").addEventListener("click", loadAndRender);

// ---------- CSV export for the day-of tracker sheet ----------
function exportCSV() {
  const byCode = new Map(lastGroups.map((g) => [g.code, g]));
  const header = [
    "Group #",
    "Member 1", "Reg 1",
    "Member 2", "Reg 2",
    "Member 3", "Reg 3",
    "Member 4", "Reg 4",
    "Member 5", "Reg 5",
    "Member 6", "Reg 6",
    "Status", "Claimed by", "Last updated",
  ];
  const rows = [header];
  lastRing.forEach((entry, idx) => {
    const g = byCode.get(entry.code);
    const members = g.members.slice(0, 6);
    const row = [idx + 1];
    members.forEach((m) => {
      row.push(m.fullName || "");
      row.push(m.regNumber || "");
    });
    row.push("Needs", "", "");
    rows.push(row);
  });

  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "glasto-tracker.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById("export-btn").addEventListener("click", exportCSV);
