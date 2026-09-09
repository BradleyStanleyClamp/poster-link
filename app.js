// ====== CONFIG — set these after you deploy the Apps Script backend (see README.md) ======
const SCRIPT_URL = "REPLACE_WITH_YOUR_APPS_SCRIPT_WEB_APP_URL";
const SHARED_SECRET = "REPLACE_WITH_A_CODEWORD"; // must match SECRET in backend/Code.gs
// ===========================================================================================

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

// ---------- dynamic name rows ----------
function addRow(containerId, placeholder, required) {
  const container = document.getElementById(containerId);
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

for (let i = 0; i < 5; i++) addRow("groupmates-rows", "Groupmate full name", true);
addRow("known-rows", "Name in another group (optional)", false);

document.getElementById("add-groupmate").addEventListener("click", () =>
  addRow("groupmates-rows", "Groupmate full name", true)
);
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

  const payload = {
    secret: SHARED_SECRET,
    fullName: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    regNumber: document.getElementById("regNumber").value.trim(),
    groupmates: collectRowValues("groupmates-rows"),
    known: collectRowValues("known-rows"),
  };

  if (payload.groupmates.length !== 5) {
    statusEl.innerHTML = `<div class="notice danger">Please list exactly 5 other group members.</div>`;
    return;
  }

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight against Apps Script
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    statusEl.innerHTML = `<div class="notice ok">Thanks ${payload.fullName}, you're in. Check the "Groups & ring" tab to see your group form.</div>`;
    document.getElementById("signup-form").reset();
    document.getElementById("groupmates-rows").innerHTML = "";
    document.getElementById("known-rows").innerHTML = "";
    for (let i = 0; i < 5; i++) addRow("groupmates-rows", "Groupmate full name", true);
    addRow("known-rows", "Name in another group (optional)", false);
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

// ---------- clustering: group people into pods of 6 via union-find on "groupmates" claims ----------
function buildGroups(responses) {
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) x = parent.get(x);
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const byName = new Map(); // normalized name -> response
  responses.forEach((r) => byName.set(normalize(r.FullName || r.fullName), r));

  responses.forEach((r) => {
    const self = normalize(r.FullName || r.fullName);
    find(self);
    const mates = String(r.Groupmates || "").split("|").map((s) => normalize(s)).filter(Boolean);
    mates.forEach((m) => union(self, m));
  });

  const clusters = new Map(); // root -> Set of normalized names
  Array.from(parent.keys()).forEach((name) => {
    const root = find(name);
    if (!clusters.has(root)) clusters.set(root, new Set());
    clusters.get(root).add(name);
  });

  const groups = [];
  let gid = 1;
  clusters.forEach((nameSet) => {
    const members = Array.from(nameSet).map((n) => {
      const resp = byName.get(n);
      return resp
        ? {
            fullName: resp.FullName || resp.fullName,
            regNumber: resp.RegNumber || resp.regNumber,
            email: resp.Email || resp.email,
            known: String(resp.Known || "").split("|").map((s) => s.trim()).filter(Boolean),
            matched: true,
          }
        : { fullName: n, matched: false };
    });
    groups.push({ id: "g" + gid++, members });
  });

  // stable-ish order: bigger/more-complete groups first
  groups.sort((a, b) => b.members.filter((m) => m.matched).length - a.members.filter((m) => m.matched).length);
  return groups;
}

// ---------- ring building: greedy nearest-neighbour on "known" links between groups ----------
function buildKnownWeights(groups) {
  const nameToGroup = new Map();
  groups.forEach((g) =>
    g.members.forEach((m) => {
      if (m.matched) nameToGroup.set(normalize(m.fullName), g.id);
    })
  );

  const weight = {};
  groups.forEach((g) => {
    g.members.forEach((m) => {
      (m.known || []).forEach((k) => {
        const otherGid = nameToGroup.get(normalize(k));
        if (otherGid && otherGid !== g.id) {
          weight[g.id] = weight[g.id] || {};
          weight[g.id][otherGid] = (weight[g.id][otherGid] || 0) + 1;
          weight[otherGid] = weight[otherGid] || {};
          weight[otherGid][g.id] = (weight[otherGid][g.id] || 0) + 1;
        }
      });
    });
  });
  return weight;
}

function buildRing(groups, weight) {
  const ids = groups.map((g) => g.id);
  if (ids.length === 0) return [];
  const visited = new Set([ids[0]]);
  const order = [{ id: ids[0], bridge: false }];

  while (order.length < ids.length) {
    const current = order[order.length - 1].id;
    const neighbours = weight[current] || {};
    let best = null,
      bestW = -1;
    Object.entries(neighbours).forEach(([nid, w]) => {
      if (!visited.has(nid) && w > bestW) {
        best = nid;
        bestW = w;
      }
    });
    const bridge = best === null;
    if (bridge) best = ids.find((id) => !visited.has(id));
    order.push({ id: best, bridge });
    visited.add(best);
  }
  return order;
}

// ---------- rendering ----------
function groupLabel(members) {
  return members.map((m) => m.fullName).join(", ");
}

function renderGroups(groups) {
  const listEl = document.getElementById("groups-list");
  const summaryEl = document.getElementById("groups-summary");
  const complete = groups.filter((g) => g.members.length === 6 && g.members.every((m) => m.matched));
  const partial = groups.filter((g) => !(g.members.length === 6 && g.members.every((m) => m.matched)));

  summaryEl.innerHTML = `<div class="notice ${partial.length ? "warn" : "ok"}">
    ${complete.length} complete group${complete.length === 1 ? "" : "s"} (${complete.length * 6} people ready),
    ${partial.length} still forming.
  </div>`;

  listEl.innerHTML = "";
  groups.forEach((g, idx) => {
    const block = document.createElement("div");
    block.className = "group-block";
    const isComplete = g.members.length === 6 && g.members.every((m) => m.matched);
    block.innerHTML = `<h3>Group ${idx + 1} ${isComplete ? '<span class="tag">complete</span>' : '<span class="tag pending">forming</span>'}</h3>`;
    g.members.forEach((m) => {
      const row = document.createElement("div");
      row.className = "member-row";
      if (m.matched) {
        row.innerHTML = `<span>${m.fullName}</span><span>${m.regNumber || "no reg #"}</span>`;
      } else {
        row.innerHTML = `<span class="missing">${m.fullName} — hasn't signed up yet</span>`;
      }
      block.appendChild(row);
    });
    listEl.appendChild(block);
  });
}

function renderRing(groups, ring) {
  const el = document.getElementById("ring-list");
  el.innerHTML = "";
  const byId = new Map(groups.map((g) => [g.id, g]));
  ring.forEach((entry, idx) => {
    const g = byId.get(entry.id);
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
    const groups = buildGroups(responses);
    const weight = buildKnownWeights(groups);
    const ring = buildRing(groups, weight);
    lastGroups = groups;
    lastRing = ring;
    renderGroups(groups);
    renderRing(groups, ring);
  } catch (err) {
    summaryEl.innerHTML = `<div class="notice danger">Couldn't load data (${err.message}).</div>`;
  }
}

document.getElementById("refresh-btn").addEventListener("click", loadAndRender);

// ---------- CSV export for the day-of tracker sheet ----------
function exportCSV() {
  const byId = new Map(lastGroups.map((g) => [g.id, g]));
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
    const g = byId.get(entry.id);
    const members = g.members.slice(0, 6);
    while (members.length < 6) members.push({ fullName: "", regNumber: "" });
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
