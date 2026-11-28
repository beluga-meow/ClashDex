/* PekkaDex — Attack Planner (planner.html)
   A manual drawing board: pick a defence, tap a grid square, then read which
   Army Library composition fits the counts. The optional screenshot is only
   drawn behind the grid; this script never analyses it.

   Everything is stored in localStorage. Nothing is sent anywhere. */
(() => {
  "use strict";

  const COLS = 12;
  const ROWS = 12;
  const STORE = "pdx.planner.v1";

  /* Defence tokens only say what the building can hit. Levels, ranges and
     damage are deliberately absent — they are not verified data here. */
  const DEFENCES = [
    { id: "air-defence", name: "Air Defence", short: "AD", target: "air" },
    { id: "air-sweeper", name: "Air Sweeper", short: "AS", target: "air" },
    { id: "inferno", name: "Inferno Tower", short: "IN", target: "both" },
    { id: "eagle", name: "Eagle Artillery", short: "EA", target: "both" },
    { id: "scattershot", name: "Scattershot", short: "SC", target: "both" },
    { id: "x-bow", name: "X-Bow", short: "XB", target: "both" },
    { id: "wizard-tower", name: "Wizard Tower", short: "WT", target: "both" },
    { id: "archer-tower", name: "Archer Tower", short: "AT", target: "both" },
    { id: "cannon", name: "Cannon", short: "CA", target: "ground" },
    { id: "mortar", name: "Mortar", short: "MO", target: "ground" },
    { id: "monolith", name: "Monolith", short: "MN", target: "both" },
    { id: "spell-tower", name: "Spell Tower", short: "ST", target: "both" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  const state = {
    th: 15,
    selected: "air-defence",
    cells: [], // { d: defence id, r, c }
    armies: [],
    shotUrl: null,
    shotName: "",
  };

  const defenceById = id => DEFENCES.find(entry => entry.id === id) || null;
  const cellKey = (r, c) => `${r}-${c}`;
  const placedAt = (r, c) => state.cells.find(cell => cell.r === r && cell.c === c) || null;

  /* --------------------------------------------------------------- storage */
  function save() {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({ th: state.th, cells: state.cells }));
    } catch (_) { /* storage can be blocked */ }
  }

  function restore() {
    try {
      const raw = window.localStorage.getItem(STORE);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Number.isInteger(parsed.th) && parsed.th >= 1 && parsed.th <= 19) state.th = parsed.th;
      if (Array.isArray(parsed.cells)) {
        state.cells = parsed.cells.filter(cell =>
          cell && defenceById(cell.d) &&
          Number.isInteger(cell.r) && cell.r >= 0 && cell.r < ROWS &&
          Number.isInteger(cell.c) && cell.c >= 0 && cell.c < COLS);
      }
    } catch (_) { /* a corrupt save should not stop the page */ }
  }

  /* ----------------------------------------------------------------- board */
  function paintBoard() {
    const board = $("#plannerBoard");
    if (!board) return;
    let html = "";
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = placedAt(r, c);
        const defence = cell ? defenceById(cell.d) : null;
        html += `<button class="planner-cell${defence ? " planner-cell--filled" : ""}${defence ? " planner-cell--" + defence.target : ""}"
          type="button" data-cell="${cellKey(r, c)}"
          aria-label="Row ${r + 1}, column ${c + 1}: ${defence ? defence.name : "empty"}"
          ${defence ? `title="${esc(defence.name)}"` : ""}>${defence ? `<span aria-hidden="true">${esc(defence.short)}</span>` : ""}</button>`;
      }
    }
    board.innerHTML = html;
  }

  function paintPalette() {
    const palette = $("#plannerPalette");
    if (!palette) return;
    palette.innerHTML = DEFENCES.map(defence => `
      <button class="planner-token planner-token--${defence.target}" type="button"
        data-defence="${defence.id}" aria-pressed="${state.selected === defence.id}">
        <span class="planner-token__short" aria-hidden="true">${esc(defence.short)}</span>
        <span class="planner-token__name">${esc(defence.name)}</span>
        <span class="planner-token__target">${defence.target === "both" ? "Air &amp; ground" : defence.target === "air" ? "Air only" : "Ground only"}</span>
      </button>`).join("");
  }

  function paintPlaced() {
    const placed = $("#plannerPlaced");
    const count = $("#plannerCount");
    if (!placed) return;
    if (count) count.textContent = String(state.cells.length);
    if (!state.cells.length) {
      placed.innerHTML = `<p class="pdx-note">Nothing placed yet.</p>`;
      return;
    }
    const counts = {};
    state.cells.forEach(cell => { counts[cell.d] = (counts[cell.d] || 0) + 1; });
    placed.innerHTML = `<ul class="planner-placed__list">
      ${Object.entries(counts).map(([id, amount]) => {
        const defence = defenceById(id);
        return `<li><span class="planner-dot planner-dot--${defence.target}" aria-hidden="true">${esc(defence.short)}</span>
          ${esc(defence.name)} <b>×${amount}</b></li>`;
      }).join("")}
    </ul>`;
  }

  function tail(th, army) {
    return Number(army.minTh) <= th && Number(army.maxTh) >= th;
  }

  function score(army, airThreat, groundThreat, airOnly, groundOnly) {
    const popularity = Number(army.popularity) || 0;
    let value;
    if (army.type === "Air") value = 48 - airThreat * 5 + groundOnly * 4;
    else if (army.type === "Ground") value = 48 - groundThreat * 4 + airOnly * 5;
    else value = 52 - (airThreat + groundThreat) * 2 + Math.min(airOnly, groundOnly) * 2;
    value += popularity / 12;
    return Math.max(5, Math.min(97, Math.round(value)));
  }

  function paintAnalysis() {
    const balance = $("#plannerBalance");
    const picks = $("#plannerPicks");
    if (!balance || !picks) return;

    const placed = state.cells.map(cell => defenceById(cell.d)).filter(Boolean);
    const airThreat = placed.filter(item => item.target === "air" || item.target === "both").length;
    const groundThreat = placed.filter(item => item.target === "ground" || item.target === "both").length;
    const airOnly = placed.filter(item => item.target === "air").length;
    const groundOnly = placed.filter(item => item.target === "ground").length;
    const total = placed.length || 1;

    balance.innerHTML = `
      <div class="planner-meter">
        <span class="planner-meter__label">Can hit air</span>
        <span class="planner-meter__bar"><i style="width:${Math.round(airThreat / total * 100)}%"></i></span>
        <b>${airThreat}</b>
      </div>
      <div class="planner-meter">
        <span class="planner-meter__label">Can hit ground</span>
        <span class="planner-meter__bar planner-meter__bar--ground"><i style="width:${Math.round(groundThreat / total * 100)}%"></i></span>
        <b>${groundThreat}</b>
      </div>
      <p class="pdx-note">${placed.length
        ? `${airOnly} defence${airOnly === 1 ? "" : "s"} are air-only and ${groundOnly} ground-only; the rest hit both.`
        : "Place a few defences and this panel starts counting."}</p>`;

    if (!placed.length) {
      picks.innerHTML = `<p class="pdx-note">No defences placed yet, so there is nothing to rank. Add the Air Defences and the Eagle first — they decide most plans.</p>`;
      return;
    }

    const ranked = state.armies
      .filter(army => tail(state.th, army))
      .map(army => ({ army, score: score(army, airThreat, groundThreat, airOnly, groundOnly) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const lead = airThreat > groundThreat + 2
      ? "This board has more answers to air than to ground."
      : groundThreat > airThreat + 2
        ? "This board has more answers to ground than to air."
        : "The board is close to balanced between air and ground.";

    picks.innerHTML = `
      <p class="planner-lead"><b>${esc(lead)}</b> Ranked from the ${ranked.length} arm${ranked.length === 1 ? "y" : "ies"} on file for Town Hall ${state.th}.</p>
      ${ranked.length ? ranked.map(({ army, score: points }) => `
        <a class="planner-pick" href="./armies.html">
          <span class="planner-pick__score" aria-hidden="true">${points}</span>
          <span class="planner-pick__body">
            <strong>${esc(army.name)}</strong>
            <span class="planner-pick__meta">${esc(army.type)} · ${esc(army.difficulty)} · TH ${esc(army.minTh)}–${esc(army.maxTh)}</span>
            <span class="planner-pick__army">${esc(army.army)}</span>
          </span>
        </a>`).join("")
        : `<p class="pdx-note">No Army Library entry covers Town Hall ${state.th}. Try the Attack Guides instead.</p>`}`;
  }

  function paintAll() {
    paintBoard();
    paintPalette();
    paintPlaced();
    paintAnalysis();
    const select = $("#plannerTh");
    if (select) select.value = String(state.th);
    save();
  }

  /* ------------------------------------------------------------ vision board */
  function applyShot(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("That file is not an image, so nothing was loaded.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus("That screenshot is over 8 MB. Try a smaller one.");
      return;
    }
    if (state.shotUrl) URL.revokeObjectURL(state.shotUrl);
    state.shotUrl = URL.createObjectURL(file);
    state.shotName = file.name;
    paintShot();
    setStatus(`Showing ${file.name} behind the grid. It is not saved and never uploaded.`);
  }

  function paintShot() {
    const layer = $("#plannerShotLayer");
    if (!layer) return;
    const opacity = Number($("#plannerOpacity")?.value || 45) / 100;
    if (!state.shotUrl) {
      layer.style.backgroundImage = "none";
      layer.removeAttribute("data-on");
      return;
    }
    layer.style.backgroundImage = `url("${state.shotUrl}")`;
    layer.style.opacity = String(opacity);
    layer.setAttribute("data-on", "1");
  }

  function clearShot() {
    if (state.shotUrl) URL.revokeObjectURL(state.shotUrl);
    state.shotUrl = null;
    state.shotName = "";
    const input = $("#plannerShot");
    if (input) input.value = "";
    paintShot();
  }

  function setStatus(message) {
    const node = $("#plannerStatus");
    if (node) node.textContent = message;
  }

  /* ------------------------------------------------------------------ plan */
  function planText() {
    const placed = state.cells.map(cell => defenceById(cell.d)).filter(Boolean);
    const counts = {};
    placed.forEach(item => { counts[item.name] = (counts[item.name] || 0) + 1; });
    const lines = [
      `PekkaDex attack plan — Town Hall ${state.th}`,
      "",
      "Defences marked:",
      ...(Object.keys(counts).length
        ? Object.entries(counts).map(([name, amount]) => `- ${name} ×${amount}`)
        : ["- none"]),
      "",
      "Ranked armies:",
      ...state.armies
        .filter(army => tail(state.th, army))
        .map(army => ({ army, score: score(army,
          placed.filter(item => item.target === "air" || item.target === "both").length,
          placed.filter(item => item.target === "ground" || item.target === "both").length,
          placed.filter(item => item.target === "air").length,
          placed.filter(item => item.target === "ground").length) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ army, score: points }) => `- ${army.name} (${points}/100) — ${army.army}`),
    ];
    return lines.join("\n");
  }

  /* ------------------------------------------------------------------ wire */
  function wire() {
    const board = $("#plannerBoard");
    if (board) {
      board.addEventListener("click", event => {
        const cell = event.target.closest("[data-cell]");
        if (!cell) return;
        const [r, c] = cell.dataset.cell.split("-").map(Number);
        const existing = placedAt(r, c);
        if (existing) state.cells = state.cells.filter(item => !(item.r === r && item.c === c));
        else state.cells.push({ d: state.selected, r, c });
        paintAll();
      });
    }

    const palette = $("#plannerPalette");
    if (palette) {
      palette.addEventListener("click", event => {
        const token = event.target.closest("[data-defence]");
        if (!token) return;
        state.selected = token.dataset.defence;
        paintPalette();
        const defence = defenceById(state.selected);
        const hint = $("#plannerHint");
        if (hint && defence) hint.textContent = `${defence.name} selected. Tap an empty square to place it, or tap a placed defence to remove it.`;
      });
    }

    $("#plannerTh")?.addEventListener("change", event => {
      state.th = Number(event.target.value);
      paintAnalysis();
      save();
    });

    $("#plannerReset")?.addEventListener("click", () => {
      if (!state.cells.length) { setStatus("The board is already empty."); return; }
      state.cells = [];
      paintAll();
      setStatus("Board cleared. Your Town Hall choice is unchanged.");
    });

    $("#plannerShot")?.addEventListener("change", event => {
      applyShot(event.target.files && event.target.files[0]);
    });
    $("#plannerOpacity")?.addEventListener("input", paintShot);
    $("#plannerClearShot")?.addEventListener("click", () => {
      clearShot();
      setStatus("Screenshot removed from the board.");
    });

    $("#plannerCopy")?.addEventListener("click", async () => {
      const text = planText();
      let ok = false;
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; }
      } catch (_) { ok = false; }
      if (!ok) {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.append(area);
        area.select();
        try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
        area.remove();
      }
      setStatus(ok ? "Plan copied to the clipboard." : "Copying was blocked by the browser.");
    });
  }

  async function loadArmies() {
    try {
      const response = await fetch("./assets/data/armies.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`armies.json answered ${response.status}`);
      const data = await response.json();
      state.armies = data.armies || [];
    } catch (error) {
      console.error("[PekkaDex] planner could not load armies:", error);
      setStatus("The Army Library data could not load, so the ranking is unavailable.");
    }
    paintAnalysis();
  }

  function start() {
    restore();
    wire();
    paintAll();
    loadArmies();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
