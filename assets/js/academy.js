/* PekkaDex — Attack Academy learning path (attack-guides.html)
   Renders the six-stage path from academy.json and recommends armies from
   armies.json for the Town Hall the visitor picks. No game data is invented:
   the picks are existing Army Library entries filtered by their TH range. */
(() => {
  "use strict";

  const state = { stages: [], armies: [], th: 15, status: "loading" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const STORE = "pdx.academy.th";

  function readTh() {
    try {
      const saved = Number(window.localStorage.getItem(STORE));
      if (Number.isInteger(saved) && saved >= 1 && saved <= 19) return saved;
    } catch (_) { /* storage can be blocked */ }
    return 15;
  }

  function saveTh() {
    try { window.localStorage.setItem(STORE, String(state.th)); } catch (_) { /* ignore */ }
  }

  function picks() {
    return state.armies
      .filter(army => state.th >= Number(army.minTh) && state.th <= Number(army.maxTh))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 4);
  }

  function paintPicks() {
    const out = $("#academyPicks");
    if (!out) return;
    const list = picks();
    const mix = list.reduce((counts, army) => {
      counts[army.type] = (counts[army.type] || 0) + 1;
      return counts;
    }, {});
    out.innerHTML = `
      <p class="academy-picks__lead">${list.length
        ? `<b>${list.length}</b> arm${list.length === 1 ? "y" : "ies"} on file for Town Hall ${state.th}.`
        : `No army on file covers Town Hall ${state.th} yet.`}</p>
      <div class="academy-picks__grid">
        ${list.map(army => `<a class="academy-pick" href="./armies.html">
          <span class="academy-pick__type">${esc(army.type)}</span>
          <strong>${esc(army.name)}</strong>
          <span class="academy-pick__range">TH ${esc(army.minTh)}–${esc(army.maxTh)} · ${esc(army.difficulty)}</span>
          <span class="academy-pick__army">${esc(army.army)}</span>
        </a>`).join("")}
      </div>
      ${list.length ? `<p class="pdx-note">Mix on file for this Town Hall: ${Object.entries(mix).map(([type, count]) => `${esc(type)} ${count}`).join(" · ")}. Community recommendations, not a tier list.</p>` : ""}`;
  }

  function paintStages() {
    const out = $("#academyStages");
    if (!out) return;
    out.innerHTML = state.stages.map(stage => `
      <li class="academy-stage">
        <span class="academy-stage__num" aria-hidden="true">${stage.n}</span>
        <div class="academy-stage__body">
          <h3>${esc(stage.title)}</h3>
          <p class="academy-stage__goal">${esc(stage.goal)}</p>
          <ul class="academy-stage__checks">
            ${stage.checks.map(check => `<li>${esc(check)}</li>`).join("")}
          </ul>
          ${stage.practice ? `<a class="pdx-btn pdx-btn--wood pdx-btn--sm academy-stage__link" href="${esc(stage.practice.href)}">${esc(stage.practice.label)}</a>` : ""}
        </div>
      </li>`).join("");
  }

  function paint() {
    paintStages();
    paintPicks();
    const select = $("#academyTh");
    if (select) select.value = String(state.th);
  }

  function wire() {
    const select = $("#academyTh");
    if (select) {
      select.addEventListener("change", () => {
        state.th = Number(select.value);
        saveTh();
        paintPicks();
      });
    }
  }

  async function load() {
    try {
      const [academy, armies] = await Promise.all([
        fetch("./assets/data/academy.json", { cache: "no-cache" }).then(response => {
          if (!response.ok) throw new Error(`academy.json answered ${response.status}`);
          return response.json();
        }),
        fetch("./assets/data/armies.json", { cache: "no-cache" }).then(response => response.ok ? response.json() : { armies: [] }),
      ]);
      state.stages = academy.stages || [];
      state.armies = armies.armies || [];
      state.th = readTh();
      state.status = "ready";
      paint();
    } catch (error) {
      state.status = "error";
      console.error("[PekkaDex] academy data failed to load:", error);
      const out = $("#academyStages");
      if (out) out.innerHTML = `<li class="pdx-empty"><b>The learning path could not load</b>
        <p class="pdx-note">The guide text below still works; reload to try again.</p></li>`;
    }
  }

  function start() {
    const root = $("#academy");
    if (!root) return;
    wire();
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
