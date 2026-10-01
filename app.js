// ====== CONFIG — set these after you deploy the Apps Script backend (see README.md) ======
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywfyg2WPJfLd9n7ZaL9xp_5jXb1i2lknC0uBjiZ93t-ZHzaiZa6zLzRmgb9cqKqhYtbA/exec";
const SHARED_SECRET = "glasto"; // must match SECRET in backend/Code.gs
// ===========================================================================================

const MAX_KNOWN = 8;

// ---------- maths proof chart (public info section, no gate needed) ----------
(function initProofChart() {
  const svg = document.getElementById("proof-chart");
  if (!svg) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const TICKETS = 130000;
  const GROUP_SIZE = 6;
  const APPLICANTS = 2500000;
  const P = (TICKETS / GROUP_SIZE) / APPLICANTS; // ~0.87% chance any one queuer is a successful transaction
  const N_MAX = 300;
  const WIDTH = 320;
  const HEIGHT = 176;
  const margin = { left: 34, right: 12, top: 14, bottom: 26 };
  const plotW = WIDTH - margin.left - margin.right;
  const plotH = HEIGHT - margin.top - margin.bottom;

  const prob = (n) => 1 - Math.pow(1 - P, n);
  const xScale = (n) => margin.left + (n / N_MAX) * plotW;
  const yScale = (p) => margin.top + (1 - p) * plotH;

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  // gridlines + y labels
  [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
    const y = yScale(tick);
    svg.appendChild(el("line", { class: "chart-grid", x1: margin.left, x2: WIDTH - margin.right, y1: y, y2: y }));
    const label = el("text", { class: "chart-axis-label", x: margin.left - 6, y: y + 3, "text-anchor": "end" });
    label.textContent = `${Math.round(tick * 100)}%`;
    svg.appendChild(label);
  });

  // x labels
  [0, 75, 150, 225, 300].forEach((n) => {
    const label = el("text", { class: "chart-axis-label", x: xScale(n), y: HEIGHT - margin.bottom + 14, "text-anchor": "middle" });
    label.textContent = String(n);
    svg.appendChild(label);
  });

  // area + line
  const points = [];
  for (let n = 0; n <= N_MAX; n++) points.push([xScale(n), yScale(prob(n))]);
  const lineD = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt[0]},${pt[1]}`).join(" ");
  const areaD = `${lineD} L${xScale(N_MAX)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`;
  svg.appendChild(el("path", { class: "chart-area", d: areaD }));
  svg.appendChild(el("path", { class: "chart-line", d: lineD }));

  // reference dots (match the table rows) + endpoint label
  [1, 6, 60, 300].forEach((n) => {
    svg.appendChild(el("circle", { class: "chart-dot", cx: xScale(n), cy: yScale(prob(n)), r: 4 }));
  });
  const endLabel = el("text", {
    class: "chart-endpoint-label",
    x: xScale(N_MAX) - 8,
    y: yScale(prob(N_MAX)) - 8,
    "text-anchor": "end",
  });
  endLabel.textContent = `~${Math.round(prob(N_MAX) * 100)}%`;
  svg.appendChild(endLabel);

  // crosshair (hidden until hover/focus)
  const crosshair = el("line", { class: "chart-crosshair", x1: 0, x2: 0, y1: margin.top, y2: HEIGHT - margin.bottom });
  const crosshairDot = el("circle", { class: "chart-crosshair-dot", r: 5, cx: 0, cy: 0 });
  crosshair.style.display = "none";
  crosshairDot.style.display = "none";
  svg.appendChild(crosshair);
  svg.appendChild(crosshairDot);

  // hit area — pointer + keyboard
  const hit = el("rect", {
    class: "chart-hit",
    x: margin.left,
    y: margin.top,
    width: plotW,
    height: plotH,
    tabindex: "0",
  });
  svg.appendChild(hit);

  const wrap = svg.closest(".chart-wrap");
  const tooltip = document.getElementById("chart-tooltip");
  let currentN = 60;

  function showAt(n) {
    n = Math.max(0, Math.min(N_MAX, Math.round(n)));
    currentN = n;
    const p = prob(n);
    const px = xScale(n);
    const py = yScale(p);

    crosshair.setAttribute("x1", px);
    crosshair.setAttribute("x2", px);
    crosshair.style.display = "block";
    crosshairDot.setAttribute("cx", px);
    crosshairDot.setAttribute("cy", py);
    crosshairDot.style.display = "block";

    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const left = (px / WIDTH) * svgRect.width + (svgRect.left - wrapRect.left);
    const top = (py / HEIGHT) * svgRect.height + (svgRect.top - wrapRect.top);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    tooltip.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = `${Math.round(p * 100)}%`;
    const span = document.createElement("span");
    span.textContent = ` chance at ${n} ${n === 1 ? "person" : "people"}`;
    tooltip.append(strong, span);
    tooltip.hidden = false;
  }

  function hide() {
    crosshair.style.display = "none";
    crosshairDot.style.display = "none";
    tooltip.hidden = true;
  }

  function nFromClientX(clientX) {
    const svgRect = svg.getBoundingClientRect();
    const localX = ((clientX - svgRect.left) / svgRect.width) * WIDTH;
    return ((localX - margin.left) / plotW) * N_MAX;
  }

  hit.addEventListener("pointermove", (e) => showAt(nFromClientX(e.clientX)));
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("pointerdown", (e) => showAt(nFromClientX(e.clientX)));
  hit.addEventListener("focus", () => showAt(currentN));
  hit.addEventListener("blur", hide);
  hit.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); showAt(currentN + (e.shiftKey ? 25 : 5)); }
    if (e.key === "ArrowLeft") { e.preventDefault(); showAt(currentN - (e.shiftKey ? 25 : 5)); }
  });
})();

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
const TABS = {
  signup: { tab: document.getElementById("tab-signup"), view: document.getElementById("view-signup") },
  groups: { tab: document.getElementById("tab-groups"), view: document.getElementById("view-groups") },
  network: { tab: document.getElementById("tab-network"), view: document.getElementById("view-network") },
};

TABS.signup.tab.addEventListener("click", () => switchTab("signup"));
TABS.groups.tab.addEventListener("click", () => {
  switchTab("groups");
  loadAndRender();
});
TABS.network.tab.addEventListener("click", () => {
  switchTab("network");
  loadAndRenderNetwork();
});

function switchTab(name) {
  Object.entries(TABS).forEach(([key, { tab, view }]) => {
    tab.classList.toggle("active", key === name);
    view.classList.toggle("active", key === name);
  });
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
    document.getElementById("coach-field").style.display = currentAction === "start" ? "block" : "none";
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

  // only the group founder decides this — it applies to the whole group, joiners don't get asked
  const wantsCoach = currentAction === "start" ? (document.getElementById("wantsCoach").checked ? "Yes" : "No") : "";

  const payload = {
    secret: SHARED_SECRET,
    fullName: document.getElementById("fullName").value.trim(),
    regNumber: document.getElementById("regNumber").value.trim(),
    postcode: document.getElementById("postcode").value.trim(),
    groupCode,
    wantsCoach,
    known: collectRowValues("known-rows"),
  };

  const submitBtn = document.getElementById("signup-submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="btn-spinner"></span>Submitting…`;

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
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span class="btn-label">Submit</span>`;
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
      postcode: r.Postcode || r.postcode || "",
      known: String(r.Known || "").split("|").map((s) => s.trim()).filter(Boolean),
    };
    const wantsCoach = String(r.WantsCoach || r.wantsCoach || "").trim();
    if (!rawCode) {
      unplaced.push(member);
      return;
    }
    const key = normalize(rawCode);
    if (!map.has(key)) map.set(key, { code: key, displayName: rawCode, members: [], wantsCoach: "" });
    if (wantsCoach) map.get(key).wantsCoach = wantsCoach; // set by whoever started the group
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

// ---------- rendering ----------

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
    if (g.wantsCoach) {
      const coachRow = document.createElement("div");
      coachRow.className = "member-row";
      coachRow.innerHTML = `<span>🚌 Coach tickets</span><span>${escapeHtml(g.wantsCoach)}</span>`;
      block.appendChild(coachRow);
    }
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

// ---------- ring order: nested rings — a ring of families, each family its own inner ring ----------
// Spares circulate inside a family first; only once the whole family already has tickets does
// a spare escape to the next family. Tell me the groups and I'll update this.
const RING_FAMILIES = [
  { name: "Family 1", groups: ["amy's friends", "rebeccas pals", "toby’s crew"] },
  { name: "Family 2", groups: ["brad's", "nina’s group", "pk team"] },
  { name: "Family 3", groups: ["swanfield", "cali road"] },
  { name: "Family 4", groups: ["ruby's group", "emily's group", "nick p's group", "woodys group"] },
  { name: "Family 5", groups: ["noah marshall’s bitches", "harry n's group", "toby smiths crew"] },
  { name: "Family 6", groups: ["les garçons (mikey and co)", "howies", "the gingers", "jay", "ed's group"] },
];

function buildRingPlan(groups) {
  const byCode = new Map(groups.map((g) => [g.code, g]));
  const familyPlans = RING_FAMILIES.map((family, famIdx) => ({
    name: family.name,
    familyIndex: famIdx,
    entries: family.groups.map((code) => ({
      code,
      group: byCode.get(code) || null,
      familyIndex: famIdx,
      familyName: family.name,
      missing: !byCode.get(code),
    })),
  }));
  const placedCodes = new Set(RING_FAMILIES.flatMap((f) => f.groups));
  const unplacedGroups = groups.filter((g) => !placedCodes.has(g.code));
  return { familyPlans, unplacedGroups };
}

const RING_W = 900, RING_H = 900;
const RING_OUTER_R = 330;
const RING_INNER_R = 82;
let ringEdgesList = [];
let ringEntryByCode = new Map();

function arcPath(a, b, r) {
  return `M ${a.x},${a.y} A ${r},${r} 0 0,1 ${b.x},${b.y}`;
}

function renderRingDiagram(familyPlans) {
  const edgesLayer = document.getElementById("ring-edges-layer");
  const nodesLayer = document.getElementById("ring-nodes-layer");
  const labelsLayer = document.getElementById("ring-labels-layer");
  edgesLayer.innerHTML = "";
  nodesLayer.innerHTML = "";
  labelsLayer.innerHTML = "";

  const cx = RING_W / 2, cy = RING_H / 2;
  const F = familyPlans.length;
  const clusterCenters = familyPlans.map((fp, i) => {
    const angle = (i / F) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + RING_OUTER_R * Math.cos(angle), y: cy + RING_OUTER_R * Math.sin(angle) };
  });

  ringEntryByCode = new Map();
  familyPlans.forEach((fp, fi) => {
    const center = clusterCenters[fi];
    const k = fp.entries.length;
    fp.entries.forEach((entry, i) => {
      const angle = k === 1 ? -Math.PI / 2 : (i / k) * Math.PI * 2 - Math.PI / 2;
      entry.x = center.x + (k === 1 ? 0 : RING_INNER_R) * Math.cos(angle);
      entry.y = center.y + (k === 1 ? 0 : RING_INNER_R) * Math.sin(angle);
      entry.radius = entry.group ? Math.min(22, 9 + entry.group.members.length * 2) : 12;
      ringEntryByCode.set(entry.code, entry);
    });

    // faint dashed ring around the cluster, purely a visual grouping aid
    if (k >= 2) {
      edgesLayer.appendChild(svgEl("circle", {
        class: "cluster-ring",
        cx: center.x, cy: center.y, r: RING_INNER_R,
      }));
    }
    const badge = document.createElement("div");
    badge.className = "family-badge";
    badge.textContent = fp.name;
    labelsLayer.appendChild(badge);
    badge.style.left = `${(center.x / RING_W) * 100}%`;
    badge.style.top = `${(center.y / RING_H) * 100}%`;
  });

  ringEdgesList = [];

  // intra-family edges: the tight sub-ring within each family
  familyPlans.forEach((fp) => {
    const k = fp.entries.length;
    if (k < 2) return;
    fp.entries.forEach((entry, i) => {
      const next = fp.entries[(i + 1) % k];
      const path = svgEl("path", {
        class: "ring-edge ring-edge-intra",
        d: arcPath(entry, next, RING_INNER_R),
        "marker-end": "url(#ring-arrow)",
      });
      edgesLayer.appendChild(path);
      ringEdgesList.push({ from: entry.code, to: next.code, kind: "intra", el: path });
    });
  });

  // escape edges: only used once an entire family already has tickets
  familyPlans.forEach((fp, fi) => {
    if (fp.entries.length === 0) return;
    const nextFamily = familyPlans[(fi + 1) % F];
    if (nextFamily.entries.length === 0) return;
    // connect whichever pair of nodes (one per family) are physically closest,
    // so the line runs cleanly between the two clusters instead of through either circle
    let fromNode = null, toNode = null, bestDist = Infinity;
    fp.entries.forEach((a) => {
      nextFamily.entries.forEach((b) => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < bestDist) { bestDist = d; fromNode = a; toNode = b; }
      });
    });
    const line = svgEl("line", {
      class: "ring-edge ring-edge-escape",
      x1: fromNode.x, y1: fromNode.y, x2: toNode.x, y2: toNode.y,
      "marker-end": "url(#ring-arrow)",
    });
    edgesLayer.appendChild(line);
    ringEdgesList.push({ from: fromNode.code, to: toNode.code, kind: "escape", el: line });
  });

  ringEntryByCode.forEach((entry) => {
    const classes = ["node-circle", `fam-${entry.familyIndex + 1}`];
    if (entry.missing) classes.push("ring-missing");
    else if (entry.group.members.length < 6) classes.push("ring-forming");
    const circle = svgEl("circle", { class: classes.join(" "), cx: entry.x, cy: entry.y, r: entry.radius, tabindex: "0" });
    nodesLayer.appendChild(circle);
    entry._circle = circle;

    const label = document.createElement("div");
    label.className = "node-label" + (entry.missing ? " ring-missing-label" : "");
    label.textContent = entry.group ? entry.group.displayName : entry.code;
    labelsLayer.appendChild(label);
    entry._label = label;
    label.style.left = `${(entry.x / RING_W) * 100}%`;
    label.style.top = `${((entry.y + entry.radius + 6) / RING_H) * 100}%`;

    circle.addEventListener("pointerdown", () => selectRingNode(entry.code));
    circle.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectRingNode(entry.code); }
    });
  });
}

document.getElementById("ring-bg-rect").addEventListener("pointerdown", () => selectRingNode(null));

function selectRingNode(code) {
  if (!code) {
    ringEntryByCode.forEach((e) => {
      e._circle.classList.remove("dim", "selected");
      e._label.classList.remove("dim");
    });
    ringEdgesList.forEach((e) => {
      e.el.classList.remove("lit", "dim");
      e.el.setAttribute("marker-end", "url(#ring-arrow)");
    });
    document.getElementById("ring-detail-panel").innerHTML = '<p class="panel-empty">Click a group in the ring above for details.</p>';
    return;
  }

  const entry = ringEntryByCode.get(code);
  const incoming = ringEdgesList.filter((e) => e.to === code);
  const outgoing = ringEdgesList.filter((e) => e.from === code);
  const relatedCodes = new Set([code, ...incoming.map((e) => e.from), ...outgoing.map((e) => e.to)]);

  ringEntryByCode.forEach((e) => {
    const related = relatedCodes.has(e.code);
    e._circle.classList.toggle("dim", !related);
    e._circle.classList.toggle("selected", e.code === code);
    e._label.classList.toggle("dim", !related);
  });
  ringEdgesList.forEach((e) => {
    const lit = e.from === code || e.to === code;
    e.el.classList.toggle("lit", lit);
    e.el.classList.toggle("dim", !lit);
    e.el.setAttribute("marker-end", lit ? "url(#ring-arrow-lit)" : "url(#ring-arrow)");
  });

  const labelOf = (c) => {
    const e = ringEntryByCode.get(c);
    return e ? (e.group ? e.group.displayName : e.code) : "—";
  };
  const describe = (e) => labelOf(e.to === code ? e.from : e.to) + (e.kind === "escape" ? " (once that family's fully sorted)" : "");

  const statusClass = entry.missing ? "isolated" : entry.group.members.length === 6 ? "complete" : "forming";
  const statusText = entry.missing ? "Not signed up yet" : entry.group.members.length === 6 ? "Complete, 6/6" : `Forming, ${entry.group.members.length}/6`;

  document.getElementById("ring-detail-panel").innerHTML = `
    <span class="pill ${statusClass}">${escapeHtml(statusText)}</span>
    <h2>${escapeHtml(entry.group ? entry.group.displayName : entry.code)}</h2>
    <p style="margin:0 0 10px;color:var(--muted);font-size:0.85rem;">${escapeHtml(entry.familyName)}</p>
    <div class="panel-grid">
      <div class="panel-col">
        <h3>Members${entry.group ? ` (${entry.group.members.length})` : ""}</h3>
        <ul>${entry.group ? entry.group.members.map((m) => `<li>${escapeHtml(m.fullName)}</li>`).join("") : '<li class="none">Nobody has signed up under this name yet</li>'}</ul>
      </div>
      <div class="panel-col">
        <h3>Flow</h3>
        <ul>
          ${incoming.map((e) => `<li>&larr; receives from: ${escapeHtml(describe(e))}</li>`).join("")}
          ${outgoing.map((e) => `<li>passes to &rarr;: ${escapeHtml(describe(e))}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderRingLegend() {
  const items = RING_FAMILIES.map((f, i) => `<span class="legend-item"><i class="dot fam-${i + 1}"></i>${escapeHtml(f.name)}</span>`);
  items.push('<span class="legend-item"><i class="line"></i>Within family</span>');
  items.push('<span class="legend-item"><i class="line dashed"></i>Between families (once one’s fully sorted)</span>');
  items.push('<span class="legend-item"><i class="dot" style="border-style:dashed;"></i>Still forming</span>');
  items.push('<span class="legend-item"><i class="dot ring-missing-dot"></i>Not signed up yet</span>');
  document.getElementById("ring-family-legend").innerHTML = items.join("");
}

function renderRingUnplacedNotice(unplacedGroups) {
  const el = document.getElementById("ring-unplaced-notice");
  el.innerHTML = unplacedGroups.length
    ? `<div class="notice warn" style="margin-top:12px;">Signed up but not in any family yet: ${unplacedGroups.map((g) => escapeHtml(g.displayName)).join(", ")} — tell me which family these join.</div>`
    : "";
}

let lastGroups = [];
let lastRing = [];

async function loadAndRender() {
  const summaryEl = document.getElementById("groups-summary");
  summaryEl.innerHTML = `<div class="notice">Loading…</div>`;
  try {
    const responses = await fetchResponses();
    const { groups, unplaced } = groupByCode(responses);
    lastGroups = groups;
    const { familyPlans, unplacedGroups } = buildRingPlan(groups);
    lastRing = familyPlans
      .flatMap((fp) => fp.entries)
      .filter((e) => !e.missing)
      .map((e) => ({ code: e.code }));
    renderGroups(groups, unplaced);
    renderRingDiagram(familyPlans);
    renderRingLegend();
    renderRingUnplacedNotice(unplacedGroups);
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

// ---------- network graph: groups as nodes, "known" links as edges ----------
const NET_W = 1000;
const NET_H = 620;
const NET_PAD = 46;
let networkNodesById = new Map();
let networkEdgesList = [];
let networkSelectedId = null;

function svgEl(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function buildNetworkGraph(groups, weight) {
  const nodes = groups.map((g) => {
    const neighbours = weight[g.code] || {};
    return {
      id: g.code,
      name: g.displayName,
      size: g.members.length,
      complete: g.members.length === 6,
      isolated: Object.keys(neighbours).length === 0,
      members: g.members.map((m) => m.fullName),
      radius: 14 + g.members.length * 3,
    };
  });

  const edges = [];
  const seen = new Set();
  nodes.forEach((n) => {
    Object.entries(weight[n.id] || {}).forEach(([otherId, w]) => {
      const pairKey = [n.id, otherId].sort().join("::");
      if (seen.has(pairKey)) return;
      seen.add(pairKey);
      edges.push({ source: n.id, target: otherId, weight: w });
    });
  });

  return { nodes, edges };
}

function runNetworkSimulation(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const R0 = Math.min(NET_W, NET_H) * 0.34;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    n.x = NET_W / 2 + R0 * Math.cos(angle);
    n.y = NET_H / 2 + R0 * Math.sin(angle);
    n.vx = 0;
    n.vy = 0;
  });

  const REPULSION = 32000;
  const SPRING_K = 0.02;
  const IDEAL_LEN = 190;
  const CENTER_K = 0.0025;
  const DAMPING = 0.82;

  for (let iter = 0; iter < 500; iter++) {
    nodes.forEach((n) => { n.fx = 0; n.fy = 0; });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.fx -= fx; a.fy -= fy;
        b.fx += fx; b.fy += fy;
      }
    }
    edges.forEach((e) => {
      const a = byId.get(e.source), b = byId.get(e.target);
      const idealLen = IDEAL_LEN / (1 + Math.min(e.weight, 8) * 0.15);
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - idealLen) * SPRING_K;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.fx += fx; a.fy += fy;
      b.fx -= fx; b.fy -= fy;
    });
    nodes.forEach((n) => {
      n.fx += (NET_W / 2 - n.x) * CENTER_K;
      n.fy += (NET_H / 2 - n.y) * CENTER_K;
      n.vx = (n.vx + n.fx) * DAMPING;
      n.vy = (n.vy + n.fy) * DAMPING;
      n.x = Math.min(NET_W - NET_PAD - n.radius, Math.max(NET_PAD + n.radius, n.x + n.vx));
      n.y = Math.min(NET_H - NET_PAD - n.radius, Math.max(NET_PAD + n.radius, n.y + n.vy));
    });
  }
}

function renderNetworkStats(groups) {
  const complete = groups.filter((g) => g.members.length === 6).length;
  const forming = groups.length - complete;
  const people = groups.reduce((sum, g) => sum + g.members.length, 0);
  const isolated = networkEdgesList.length
    ? groups.filter((g) => !networkEdgesList.some((e) => e.source === g.code || e.target === g.code)).length
    : groups.length;
  document.getElementById("network-stats").innerHTML = `
    <div class="stat"><span class="stat-value">${groups.length}</span><span class="stat-label">groups</span></div>
    <div class="stat"><span class="stat-value">${people}</span><span class="stat-label">people</span></div>
    <div class="stat teal"><span class="stat-value">${complete}</span><span class="stat-label">complete, 6/6</span></div>
    <div class="stat mustard"><span class="stat-value">${forming}</span><span class="stat-label">still forming</span></div>
    <div class="stat"><span class="stat-value">${isolated}</span><span class="stat-label">no friend link</span></div>
  `;
}

function renderNetworkGraph(nodes, edges) {
  const edgesLayer = document.getElementById("network-edges-layer");
  const nodesLayer = document.getElementById("network-nodes-layer");
  const labelsLayer = document.getElementById("network-labels-layer");
  const svg = document.getElementById("network-svg");
  edgesLayer.innerHTML = "";
  nodesLayer.innerHTML = "";
  labelsLayer.innerHTML = "";

  networkNodesById = new Map(nodes.map((n) => [n.id, n]));
  networkEdgesList = edges;
  networkSelectedId = null;

  edges.forEach((e) => {
    const a = networkNodesById.get(e.source), b = networkNodesById.get(e.target);
    const line = svgEl("line", {
      class: "edge",
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      "stroke-width": Math.min(1.5 + e.weight * 0.9, 7),
    });
    edgesLayer.appendChild(line);
    e._el = line;
  });

  nodes.forEach((n) => {
    const statusClass = n.isolated ? "isolated" : n.complete ? "complete" : "forming";
    const circle = svgEl("circle", {
      class: `node-circle ${statusClass}`,
      cx: n.x, cy: n.y, r: n.radius,
      tabindex: "0",
    });
    nodesLayer.appendChild(circle);
    n._circle = circle;

    const label = document.createElement("div");
    label.className = "node-label";
    label.textContent = n.name;
    labelsLayer.appendChild(label);
    n._label = label;

    positionNetworkLabel(n);
    attachNetworkDrag(svg, circle, n);
  });
}

function positionNetworkLabel(n) {
  n._label.style.left = `${(n.x / NET_W) * 100}%`;
  n._label.style.top = `${((n.y + n.radius + 6) / NET_H) * 100}%`;
}

function updateNetworkNodePosition(n) {
  n._circle.setAttribute("cx", n.x);
  n._circle.setAttribute("cy", n.y);
  positionNetworkLabel(n);
  networkEdgesList.forEach((e) => {
    if (e.source === n.id || e.target === n.id) {
      const a = networkNodesById.get(e.source), b = networkNodesById.get(e.target);
      e._el.setAttribute("x1", a.x); e._el.setAttribute("y1", a.y);
      e._el.setAttribute("x2", b.x); e._el.setAttribute("y2", b.y);
    }
  });
}

function attachNetworkDrag(svg, circle, n) {
  circle.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    const startClientX = ev.clientX, startClientY = ev.clientY;
    const startX = n.x, startY = n.y;
    let moved = false;

    function onMove(e2) {
      const rect = svg.getBoundingClientRect();
      const scaleX = NET_W / rect.width, scaleY = NET_H / rect.height;
      const dx = (e2.clientX - startClientX) * scaleX;
      const dy = (e2.clientY - startClientY) * scaleY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      n.x = Math.min(NET_W - NET_PAD - n.radius, Math.max(NET_PAD + n.radius, startX + dx));
      n.y = Math.min(NET_H - NET_PAD - n.radius, Math.max(NET_PAD + n.radius, startY + dy));
      updateNetworkNodePosition(n);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!moved) selectNetworkNode(n.id);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  circle.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectNetworkNode(n.id); }
  });
}

function selectNetworkNode(id) {
  networkSelectedId = id;
  const neighbourIds = new Set();
  if (id) {
    networkEdgesList.forEach((e) => {
      if (e.source === id) neighbourIds.add(e.target);
      if (e.target === id) neighbourIds.add(e.source);
    });
  }

  networkNodesById.forEach((n) => {
    const related = !id || n.id === id || neighbourIds.has(n.id);
    n._circle.classList.toggle("dim", !related);
    n._circle.classList.toggle("selected", n.id === id);
    n._label.classList.toggle("dim", !related);
  });
  networkEdgesList.forEach((e) => {
    const touches = id && (e.source === id || e.target === id);
    e._el.classList.toggle("lit", !!touches);
    e._el.classList.toggle("dim", !!id && !touches);
  });

  const panel = document.getElementById("network-detail-panel");
  if (!id) {
    panel.innerHTML = `<p class="panel-empty">Click a group above to see its members and which other groups it's linked to.</p>`;
    return;
  }
  const n = networkNodesById.get(id);
  const statusClass = n.isolated ? "isolated" : n.complete ? "complete" : "forming";
  const statusText = n.isolated ? "No friend link to another group" : n.complete ? "Complete, 6/6" : `Forming, ${n.size}/6`;
  const links = networkEdgesList
    .filter((e) => e.source === id || e.target === id)
    .map((e) => {
      const otherId = e.source === id ? e.target : e.source;
      return { name: networkNodesById.get(otherId).name, weight: e.weight };
    })
    .sort((a, b) => b.weight - a.weight);

  panel.innerHTML = `
    <span class="pill ${statusClass}">${escapeHtml(statusText)}</span>
    <h2>${escapeHtml(n.name)}</h2>
    <div class="panel-grid">
      <div class="panel-col">
        <h3>Members (${n.members.length})</h3>
        <ul>${n.members.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
      </div>
      <div class="panel-col">
        <h3>Linked groups</h3>
        <ul>${links.length ? links.map((l) => `<li>${escapeHtml(l.name)} (${l.weight} link${l.weight === 1 ? "" : "s"})</li>`).join("") : '<li class="none">None yet</li>'}</ul>
      </div>
    </div>
  `;
}

document.getElementById("network-bg-rect").addEventListener("pointerdown", () => selectNetworkNode(null));

async function loadAndRenderNetwork() {
  const statsEl = document.getElementById("network-stats");
  statsEl.innerHTML = `<div class="notice">Loading…</div>`;
  try {
    const responses = await fetchResponses();
    const { groups } = groupByCode(responses);
    if (groups.length === 0) {
      statsEl.innerHTML = `<div class="notice warn">No groups yet.</div>`;
      document.getElementById("network-edges-layer").innerHTML = "";
      document.getElementById("network-nodes-layer").innerHTML = "";
      document.getElementById("network-labels-layer").innerHTML = "";
      return;
    }
    const weight = buildKnownWeights(groups);
    const { nodes, edges } = buildNetworkGraph(groups, weight);
    runNetworkSimulation(nodes, edges);
    renderNetworkGraph(nodes, edges);
    renderNetworkStats(groups);
  } catch (err) {
    statsEl.innerHTML = `<div class="notice danger">Couldn't load data (${err.message}).</div>`;
  }
}

document.getElementById("network-refresh-btn").addEventListener("click", loadAndRenderNetwork);
