/* PekkaDex — Troop Library (troops.html)
   Reads assets/data/troops.json and derives "used in" from armies.json, so a
   troop is only linked to a composition that actually exists in the repo. */
(() => {
  "use strict";

  const state = { troops: [], squads: [], armies: [], usage: new Map(), kind: "all", query: "", status: "loading" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const SPRITE = "./assets/icons/icons.svg";
  const icon = name => `<svg class="pdx-ico" aria-hidden="true" focusable="false"><use href="${SPRITE}#i-${name}"></use></svg>`;

  const KINDS = [
    { key: "all", label: "All troops" },
    { key: "elixir", label: "Elixir" },
    { key: "dark", label: "Dark Elixir" },
    { key: "super", label: "Super Troops" },
    { key: "squads", label: "Squads" },
  ];

  function hashState() {
    const hash = (location.hash || "").replace(/^#/, "").toLowerCase();
    return KINDS.some(entry => entry.key === hash) ? hash : "all";
  }

  /* ------------------------------------------------- composition matching */
  /* "Seen in" comes from the army's composition field only. Strategy prose,
     hero names and risk notes are ignored, and a segment belongs to its
     longest troop name, so "Sneaky Goblins" never credits plain Goblin and
     "Minion Prince" never credits Minion. */
  const HERO_TERMS = /\b(minion prince|dragon duke|archer queen|barbarian king|grand warden|royal champion)\b/gi;
  const ALIASES = { valkyrie: ["valks"] };

  const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function nameForms(name) {
    const forms = [name, `${name}s`, `${name}es`];
    if (/[^aeiou]y$/i.test(name)) forms.push(`${name.slice(0, -1)}ies`);
    return forms;
  }

  function troopPattern(troop) {
    const names = [troop.name].concat(ALIASES[troop.id] || []);
    const forms = names.reduce((all, name) => all.concat(nameForms(name)), []);
    return new RegExp(`\\b(?:${forms.map(escapeRe).join("|")})\\b`, "i");
  }

  function compositionSegments(army) {
    return String(army.army || "").split(/[·+,/|]/).map(part => part.trim()).filter(Boolean);
  }

  function buildUsage(troops, armies) {
    const index = new Map(troops.map(troop => [troop.id, []]));
    const patterns = troops
      .map(troop => ({ id: troop.id, pattern: troopPattern(troop) }))
      .sort((a, b) => b.pattern.source.length - a.pattern.source.length);
    armies.forEach(army => {
      const credited = new Set();
      compositionSegments(army).forEach(segment => {
        const cleaned = segment.replace(HERO_TERMS, " ");
        if (!cleaned.trim()) return;
        const hit = patterns.find(entry => entry.pattern.test(cleaned));
        if (hit && !credited.has(hit.id)) {
          credited.add(hit.id);
          index.get(hit.id).push(army);
        }
      });
    });
    return index;
  }

  function usedIn(troop) {
    return state.usage.get(troop.id) || [];
  }

  function troopCard(troop) {
    const uses = usedIn(troop);
    const kindLabel = troop.kind === "dark" ? "Dark Elixir" : troop.kind === "super" ? "Super Troop" : "Elixir";
    /* The chip already says "Super Troop", so the role line says what it
       replaces instead of repeating the label. */
    const role = troop.kind === "super" && troop.base
      ? `Replaces ${troop.base}`
      : (troop.role || "").toLowerCase() === kindLabel.toLowerCase() ? "" : troop.role;
    const art = troop.art
      ? `<img src="./${esc(troop.art)}" alt="" width="160" height="160" loading="lazy" decoding="async">`
      : `<span class="troop-card__silhouette" role="img" aria-label="Art not on file for ${esc(troop.name)}">${icon("attack")}</span>`;
    return `<article class="troop-card" data-troop="${esc(troop.id)}">
      <span class="troop-card__art">${art}</span>
      <div class="troop-card__body">
        <span class="pdx-chip pdx-chip--${troop.kind === "super" ? "gold" : troop.kind === "dark" ? "epic" : "rare"}">${esc(kindLabel)}</span>
        <h3 class="troop-card__title">${esc(troop.name)}</h3>
        ${role ? `<p class="troop-card__role">${esc(role)}</p>` : ""}
        <p class="troop-card__use">${esc(troop.use)}</p>
        ${uses.length
          ? `<p class="troop-card__used"><b>Seen in</b> ${uses.slice(0, 4).map(army => esc(army.name)).join(" · ")}${uses.length > 4 ? ` +${uses.length - 4}` : ""}</p>`
          : `<p class="troop-card__used troop-card__used--none">No composition on file lists this troop yet.</p>`}
      </div>
    </article>`;
  }

  function squadCard(squad) {
    return `<article class="squad-card">
      <span class="squad-card__icon"><img src="./${esc(squad.icon)}" alt="" width="72" height="72" loading="lazy" decoding="async"></span>
      <div class="squad-card__body">
        <h3>${esc(squad.name)}</h3>
        <p class="pdx-note">Squad banner and info art from the archive. Squad rules and rewards are not published here.</p>
      </div>
      <span class="squad-card__info"><img src="./${esc(squad.info)}" alt="${esc(squad.name)} info art" loading="lazy" decoding="async"></span>
    </article>`;
  }

  function visibleTroops() {
    const needle = state.query.trim().toLowerCase();
    return state.troops.filter(troop => {
      if (state.kind !== "all" && troop.kind !== state.kind) return false;
      if (!needle) return true;
      return `${troop.name} ${troop.role} ${troop.use} ${troop.base || ""}`.toLowerCase().includes(needle);
    });
  }

  function visibleSquads() {
    const needle = state.query.trim().toLowerCase();
    return state.squads.filter(squad => !needle || squad.name.toLowerCase().includes(needle));
  }

  function paint() {
    const grid = $("#troopGrid");
    const status = $("#troopStatus");
    const stamp = $("#troopStamp");
    if (!grid) return;
    grid.setAttribute("aria-busy", "false");
    if (stamp) stamp.textContent = `${state.troops.length} troops · ${state.troops.filter(t => t.kind === "super").length} Super Troops · ${state.squads.length} squads on file`;
    const isSquads = state.kind === "squads";
    const items = isSquads ? visibleSquads() : visibleTroops();
    const total = isSquads ? state.squads.length : state.troops.length;
    if (status) {
      status.textContent = state.query.trim()
        ? `${items.length} of ${total} ${isSquads ? "squads" : "troops"} match “${state.query.trim()}”.`
        : `${items.length} ${isSquads ? "squads" : "troops"} shown.`;
    }
    if (!items.length) {
      grid.innerHTML = `<div class="pdx-empty"><b>Nothing matches that search</b>
        <p class="pdx-note">Try a shorter word, or switch to another tab.</p></div>`;
      return;
    }
    grid.innerHTML = isSquads
      ? `<div class="squad-grid">${items.map(squadCard).join("")}</div>`
      : items.map(troopCard).join("");
  }

  function setKind(kind, { hash = true } = {}) {
    state.kind = kind;
    if (hash && location.hash.replace(/^#/, "") !== kind) history.replaceState(null, "", "#" + kind);
    document.querySelectorAll("[data-troop-kind]").forEach(tab => {
      const on = tab.dataset.troopKind === kind;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = $("#troopPanel");
      if (panel && on) panel.setAttribute("aria-labelledby", tab.id);
    });
    paint();
  }

  function wire() {
    document.querySelectorAll("[data-troop-kind]").forEach(tab => {
      tab.addEventListener("click", () => setKind(tab.dataset.troopKind));
    });
    const search = $("#troopQuery");
    if (search) search.addEventListener("input", () => { state.query = search.value; paint(); });
    window.addEventListener("hashchange", () => setKind(hashState(), { hash: false }));
  }

  async function load() {
    try {
      const [troops, armies] = await Promise.all([
        fetch("./assets/data/troops.json", { cache: "no-cache" }).then(response => {
          if (!response.ok) throw new Error(`troops.json answered ${response.status}`);
          return response.json();
        }),
        fetch("./assets/data/armies.json", { cache: "no-cache" }).then(response => response.ok ? response.json() : { armies: [] }),
      ]);
      state.troops = troops.troops || [];
      state.squads = troops.squads || [];
      state.armies = armies.armies || [];
      state.usage = buildUsage(state.troops, state.armies);
      state.status = "ready";
      state.kind = hashState();
      setKind(state.kind, { hash: false });
    } catch (error) {
      state.status = "error";
      console.error("[PekkaDex] troop data failed to load:", error);
      const grid = $("#troopGrid");
      if (grid) grid.innerHTML = `<div class="pdx-empty"><b>The troop library could not load</b>
        <p class="pdx-note">The data is a static JSON file; reload the page to try again.</p></div>`;
    }
  }

  function start() {
    wire();
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
