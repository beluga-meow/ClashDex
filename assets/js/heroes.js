/* PekkaDex — Clash Heroes Encyclopedia (heroes.html)
   Reads assets/data/*.json, renders the hero index and detail views, the
   equipment loadout planner and the cosmetics gallery.

   Routes (hash):
     #heroes                      hero index
     #hero/barbarian-king         hero detail (legacy #barbarian-king works too)
     #hero/barbarian-king/skins   hero detail with a tab open
     #equipment                   equipment tab (optionally #equipment/<hero>)
     #loadouts[/hero-id]          suggested equipment pairings (heroes-extras.js)
     #pets                        Pet House facts and pets (heroes-extras.js)
     #guides[/topic]              supercharge, squads, Blacksmith (heroes-extras.js)
     #cosmetics                   cosmetics (optionally #cosmetics/sceneries)
*/
(() => {
  "use strict";

  const HERO_TABS = ["overview", "abilities", "equipment", "skins"];
  const SPRITE = "./assets/icons/icons.svg";
  const state = {
    status: "loading", // loading | ready | error
    data: { heroes: [], equipment: [], skins: [], sceneries: [] },
    meta: { verifiedOn: "" },
    main: "heroes",
    heroId: null,
    heroTab: "overview",
    eqHero: null,
    extra: null,
    cosmetic: "skins",
    query: "",
    filters: { hero: "all", source: "all", season: "all", rarity: "all" },
    loadout: {},
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const icon = (name, cls = "pdx-ico") =>
    `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="${SPRITE}#i-${name}"></use></svg>`;
  const titleCase = value => String(value).charAt(0).toUpperCase() + String(value).slice(1);
  const plural = (unit, count) => (unit === "scenery"
    ? (count === 1 ? "scenery" : "sceneries")
    : count === 1 ? unit : unit + "s");
  const heroById = id => state.data.heroes.find(hero => hero.id === id) || null;
  const equipmentById = id => state.data.equipment.find(item => item.id === id) || null;

  /* ------------------------------------------------------------- loading */
  async function fetchJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    return response.json();
  }

  async function loadAll() {
    state.status = "loading";
    render();
    try {
      const [heroes, equipment, skins, sceneries] = await Promise.all([
        fetchJSON("./assets/data/heroes.json"),
        fetchJSON("./assets/data/equipment.json"),
        fetchJSON("./assets/data/skins.json"),
        fetchJSON("./assets/data/sceneries.json"),
      ]);
      state.data = {
        heroes: heroes.heroes || [],
        equipment: equipment.equipment || [],
        skins: skins.skins || [],
        sceneries: sceneries.sceneries || [],
      };
      state.meta.verifiedOn = heroes.verifiedOn || equipment.verifiedOn || "";
      state.eqHero = state.eqHero || (state.data.heroes[0] || {}).id || null;
      state.status = "ready";
      paintLastVerified();
      /* The route was parsed while the data was still empty, so resolve any
         deep link again now that the heroes are known. */
      applyRoute();
    } catch (error) {
      state.status = "error";
      console.error("[PekkaDex] hero data failed to load:", error);
      render();
    }
  }

  function paintLastVerified() {
    const node = $("#lastVerified");
    if (!node || !state.meta.verifiedOn) return;
    const date = new Date(state.meta.verifiedOn + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) return;
    const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    node.innerHTML = `Last verified <time datetime="${esc(state.meta.verifiedOn)}">${esc(label)}</time>`;
  }

  /* -------------------------------------------------------------- routing */
  function findHero(key) {
    const slug = String(key || "").toLowerCase().replace(/[\s_]+/g, "-");
    return state.data.heroes.find(hero => hero.id === slug ||
      hero.name.toLowerCase().replace(/[\s_]+/g, "-") === slug) || null;
  }

  function parseRoute() {
    const raw = decodeURIComponent((location.hash || "").replace(/^#/, "")).replace(/^\/+/, "").trim();
    const parts = raw.split("/").filter(Boolean).map(part => part.toLowerCase());
    if (!parts.length) return { main: "heroes" };
    if (parts[0] === "equipment") {
      const hero = parts[1] ? findHero(parts[1]) : null;
      return { main: "equipment", eqHero: hero ? hero.id : null };
    }
    if (parts[0] === "cosmetics") {
      return { main: "cosmetics", cosmetic: parts[1] === "sceneries" ? "sceneries" : "skins" };
    }
    if (parts[0] === "loadouts") {
      const hero = parts[1] ? findHero(parts[1]) : null;
      return { main: "loadouts", extra: { hero: hero ? hero.id : null } };
    }
    if (parts[0] === "pets") return { main: "pets" };
    if (parts[0] === "guides") return { main: "guides", extra: { topic: parts[1] || null } };
    if (parts[0] === "heroes" || parts[0] === "hero") parts.shift();
    if (!parts.length) return { main: "heroes" };
    const hero = findHero(parts[0]);
    if (!hero) return { main: "heroes" };
    return {
      main: "heroes",
      heroId: hero.id,
      heroTab: HERO_TABS.includes(parts[1]) ? parts[1] : "overview",
    };
  }

  function applyRoute() {
    const route = parseRoute();
    state.main = route.main;
    state.heroId = route.heroId || null;
    state.heroTab = route.heroTab || "overview";
    /* A search typed for skins should not silently hide every scenery. */
    if (route.main === "cosmetics" && route.cosmetic && route.cosmetic !== state.cosmetic) state.query = "";
    state.extra = route.extra || null;
    state.cosmetic = route.cosmetic || "skins";
    if (route.main === "equipment" && route.eqHero) state.eqHero = route.eqHero;
    if (state.heroId && state.heroTab === "equipment" && !state.eqHero) state.eqHero = state.heroId;
    render();
  }

  function go(hash, { replace = false } = {}) {
    const target = "#" + hash;
    if (location.hash === target) { applyRoute(); return; }
    if (replace) history.replaceState(null, "", target);
    else location.hash = target;
    if (replace) render();
  }

  /* --------------------------------------------------------------- render */
  function render() {
    syncMainTabs();
    if (state.status === "loading") {
      renderSkeletons();
      return;
    }
    if (state.status === "error") {
      renderError();
      return;
    }
    if (state.main === "heroes") renderHeroes();
    if (state.main === "equipment") renderEquipmentTab();
    if (state.main === "cosmetics") renderCosmetics();
    if (state.main === "loadouts" || state.main === "pets" || state.main === "guides") {
      /* heroes-extras.js owns these three panels and fetches their JSON lazily. */
      if (window.pdxHeroExtras) window.pdxHeroExtras.render(state.main, state.extra);
    }
  }

  function syncMainTabs() {
    $$("[data-main]").forEach(tab => {
      const on = tab.dataset.main === state.main;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    const panels = {
      heroes: "#heroArea",
      equipment: "#equipmentArea",
      cosmetics: "#cosmeticsArea",
      loadouts: "#loadoutsArea",
      pets: "#petsArea",
      guides: "#guidesArea",
    };
    Object.keys(panels).forEach(key => {
      const panel = $(panels[key]);
      if (panel) panel.hidden = key !== state.main;
    });
  }

  function skeletonGrid(count, className = "") {
    return `<div class="pdx-grid ${className}" aria-hidden="true">` +
      Array.from({ length: count }, () => '<div class="pdx-skeleton"></div>').join("") + "</div>";
  }

  function renderSkeletons() {
    const content = $("#heroContent");
    if (content) content.innerHTML = skeletonGrid(6, "hero-grid");
    const equipment = $("#equipmentContent");
    if (equipment) equipment.innerHTML = skeletonGrid(6, "eq-grid");
    const cosmetics = $("#cosmeticContent");
    if (cosmetics) {
      cosmetics.innerHTML = skeletonGrid(8, "skin-grid");
      cosmetics.setAttribute("aria-busy", "true");
    }
    const status = $("#cosmeticStatus");
    if (status) status.textContent = "Loading the archive…";
  }

  function renderError() {
    const message = `<div class="pdx-empty"><b>The archive could not load</b>
      <p class="pdx-note">The hero data files did not answer. Check your connection and try again.</p>
      <button class="pdx-btn" type="button" data-retry>Try again</button></div>`;
    ["#heroContent", "#equipmentContent", "#cosmeticContent"].forEach(selector => {
      const node = $(selector);
      if (node) node.innerHTML = message;
    });
    const status = $("#cosmeticStatus");
    if (status) status.textContent = "";
  }

  /* ---------------------------------------------------------- hero index */
  function renderHeroes() {
    const count = $("#heroCount");
    if (count) count.textContent = `${state.data.heroes.length} heroes`;
    if (state.heroId) {
      const hero = heroById(state.heroId);
      if (hero) { renderHeroDetail(hero); return; }
      state.heroId = null;
    }
    document.title = "Clash Heroes Encyclopedia — PekkaDex";
    $("#heroContent").innerHTML = `
      <p class="pdx-note">Pick a hero to open their page. Every portrait is the real hero art that ships with the site.</p>
      <div class="pdx-grid hero-grid">
        ${state.data.heroes.map(hero => `
          <a class="pdx-card hero-card" href="#hero/${esc(hero.id)}" data-hero="${esc(hero.id)}">
            <span class="pdx-card__media">
              ${hero.verified === false ? '<span class="pdx-badge">Unverified</span>' : ""}
              <img src="${esc(hero.art)}" alt="${esc(hero.name)} portrait" width="240" height="240" loading="lazy" decoding="async">
            </span>
            <span class="pdx-card__body">
              <span class="pdx-card__title">${esc(hero.name)}</span>
              <span class="pdx-card__meta">${esc(hero.role)} · ${esc(hero.unlock)}</span>
              <span class="hero-card__cta">Open hero ${icon("chevron-right")}</span>
            </span>
          </a>`).join("")}
      </div>`;
  }

  function heroFacts(hero) {
    return `<ul class="hero-facts">
      <li><b>Unlocks</b><span>${esc(hero.unlock)}</span></li>
      <li><b>Targets</b><span>${esc(hero.targets)}</span></li>
      <li><b>Speed</b><span>${esc(hero.speed)}</span></li>
      <li><b>Equipment</b><span>${state.data.equipment.filter(item => item.hero === hero.id).length}</span></li>
      <li><b>Skins</b><span>${state.data.skins.filter(skin => skin.hero === hero.id).length}</span></li>
    </ul>`;
  }

  function renderHeroDetail(hero) {
    document.title = `${hero.name} — PekkaDex Heroes`;
    const tabs = HERO_TABS.map(tab => ({ key: tab, label: titleCase(tab) }));
    $("#heroContent").innerHTML = `
      <div class="hero-detail">
        <a class="hero-back" href="#heroes">${icon("back")} All heroes</a>
        <header class="hero-head">
          <span class="hero-head__art"><img src="${esc(hero.art)}" alt="${esc(hero.name)} portrait" width="320" height="320" decoding="async"></span>
          <div class="hero-head__copy">
            <p class="eyebrow">${esc(hero.role)}</p>
            <h2>${esc(hero.name)}</h2>
            <p class="hero-head__bio">${esc(hero.bio)}</p>
            ${heroFacts(hero)}
            ${hero.verified === false
              ? `<span class="verify-chip">${icon("spark")} Not verified yet</span>
                 ${hero.notes ? `<p class="verify-notes">${esc(hero.notes)}</p>` : ""}`
              : '<span class="verify-chip" style="border-color:#2a6a10;background:#f1fbe8;color:#2a6a10">Checked against published values</span>'}
          </div>
        </header>

        <div class="pdx-tabs hero-tablist" role="tablist" aria-label="Sections for ${esc(hero.name)}">
          ${tabs.map(tab => `
            <button class="pdx-tab" type="button" role="tab"
              id="ht-${esc(hero.id)}-${tab.key}"
              aria-controls="hp-${esc(hero.id)}-${tab.key}"
              aria-selected="${state.heroTab === tab.key}"
              tabindex="${state.heroTab === tab.key ? 0 : -1}"
              data-hero-tab="${tab.key}">${tab.label}</button>`).join("")}
        </div>

        ${tabs.map(tab => `
          <div class="hero-panel" role="tabpanel"
            id="hp-${esc(hero.id)}-${tab.key}"
            aria-labelledby="ht-${esc(hero.id)}-${tab.key}"
            tabindex="0" ${state.heroTab === tab.key ? "" : "hidden"}>
            ${heroPanel(hero, tab.key)}
          </div>`).join("")}
      </div>`;

    if (state.heroTab === "equipment") paintLoadout(hero.id);
  }

  function heroPanel(hero, tab) {
    if (tab === "overview") {
      return `
        <div class="ability-card">
          <h3>Hero ability · ${esc(hero.ability.name)}</h3>
          <p>${esc(hero.ability.text)}</p>
          ${hero.ability.verified === false ? '<span class="verify-chip">Ability text needs confirmation</span>' : ""}
        </div>
        <h3 class="section-title">In this entry</h3>
        <p class="pdx-note">Abilities explains what the hero's ability does. Equipment lists every piece with its per-level wiki table and a two-slot planner. Skins shows the art that ships with the site. Anything the archive could not confirm is labelled instead of guessed.</p>
        <p><button class="pdx-btn pdx-btn--wood" type="button" data-hero-tab="skins">${icon("palette")} See ${esc(hero.name)} skins</button></p>`;
    }
    if (tab === "abilities") {
      return `
        <div class="ability-card">
          <h3>${esc(hero.ability.name)}</h3>
          <p>${esc(hero.ability.text)}</p>
          ${hero.ability.verified === false ? '<span class="verify-chip">Needs confirmation</span>' : ""}
        </div>
        <h3 class="section-title">Equipment that changes the ability</h3>
        <p class="pdx-note">Several pieces of gear trigger or replace part of the ability. Open the Equipment tab to read each one and compare two of them side by side.</p>
        <p><button class="pdx-btn" type="button" data-hero-tab="equipment">Open the equipment tab ${icon("arrow-right")}</button></p>`;
    }
    if (tab === "equipment") {
      return `
        ${plannerMarkup(hero)}
        <div class="eq-grid">
          ${equipmentFor(hero.id).map(item => equipmentCard(item, hero)).join("")}
        </div>`;
    }
    return heroSkins(hero);
  }

  function equipmentFor(heroId) {
    return state.data.equipment.filter(item => item.hero === heroId);
  }

  function heroSkins(hero) {
    const skins = state.data.skins.filter(skin => skin.hero === hero.id);
    if (!skins.length) {
      return `<div class="pdx-empty"><b>No skins listed for ${esc(hero.name)} yet</b>
        <p class="pdx-note">Skin art is added to assets/skins and then regenerated into skins.json.</p></div>`;
    }
    return `
      <p class="pdx-note">Tap a skin for its full art and details. Season, source and price tier are marked as unverified until they are checked against the game.</p>
      <div class="skin-grid">
        ${skins.map(skin => skinCard(skin, hero)).join("")}
      </div>`;
  }

  /* ------------------------------------------------------------ equipment */
  function levelTable(item) {
    const data = (window.PDX_EQ_LEVELS && window.PDX_EQ_LEVELS.items && window.PDX_EQ_LEVELS.items[item.name]) || null;
    if (!data || !data.rows || !data.rows.length) {
      return `<p class="eq-missing">The per-level table for this piece is not in the wiki extract yet, so only its level range is shown.</p>`;
    }
    const head = data.columns.map(column => `<th scope="col">${esc(column)}</th>`).join("");
    const body = data.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
    return `<details class="eq-levels">
      <summary>DPS, boosts &amp; ore per level (${data.rows.length} levels)</summary>
      <div class="eq-table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="eq-missing">Source: <a href="https://clashofclans.fandom.com/wiki/${encodeURIComponent(item.name.replace(/ /g, "_"))}" target="_blank" rel="noopener noreferrer">Clash of Clans Wiki</a>. A dash means the level costs no ore of that type.</p>
    </details>`;
  }

  function equipmentCard(item, hero) {
    const picked = (state.loadout[hero.id] || []).includes(item.id);
    const full = (state.loadout[hero.id] || []).length >= 2 && !picked;
    return `<article class="pdx-card eq-card" data-rarity="${esc(item.rarity)}">
      <span class="pdx-card__media eq-card__media">
        <img src="${esc(item.art)}" alt="${esc(item.name)} icon" width="240" height="180" loading="lazy" decoding="async">
      </span>
      <div class="pdx-card__body">
        <span class="pdx-chip pdx-chip--${item.rarity.toLowerCase()}">${esc(item.rarity)}</span>
        <h3 class="pdx-card__title">${esc(item.name)}</h3>
        <p class="pdx-note">${esc(item.effect.text)}</p>
        <p class="pdx-card__meta">Lv 1–${esc(item.maxLevel)} · ${esc(hero.name)}</p>
        ${levelTable(item)}
        <button class="pdx-btn ${picked ? "" : "pdx-btn--wood"}" type="button"
          data-pick="${esc(item.id)}" data-pick-hero="${esc(hero.id)}"
          aria-pressed="${picked}" ${full ? "disabled" : ""}>
          ${picked ? "In the loadout" : "Add to loadout"}</button>
      </div>
    </article>`;
  }

  function plannerMarkup(hero) {
    return `<section class="planner" aria-labelledby="planner-${esc(hero.id)}">
      <h3 id="planner-${esc(hero.id)}">Loadout planner</h3>
      <p class="pdx-note">Choose two pieces for ${esc(hero.name)}. The panel shows both effects together; it does not add their numbers, because the game's exact stacking is not published here.</p>
      <div class="planner__slots" id="plannerSlots-${esc(hero.id)}"></div>
      <div class="planner__out" id="plannerOut-${esc(hero.id)}"></div>
    </section>`;
  }

  function paintLoadout(heroId) {
    const slots = document.getElementById("plannerSlots-" + heroId);
    const out = document.getElementById("plannerOut-" + heroId);
    if (!slots || !out) return;
    const hero = heroById(heroId);
    const picked = (state.loadout[heroId] || []).map(equipmentById).filter(Boolean);

    slots.innerHTML = [0, 1].map(index => {
      const item = picked[index];
      if (!item) return `<div class="planner__slot"><span>Slot ${index + 1}</span><b>Empty slot</b><span>Pick a piece below.</span></div>`;
      return `<div class="planner__slot">
        <span>Slot ${index + 1}</span>
        <b>${esc(item.name)}</b>
        <span class="pdx-chip pdx-chip--${item.rarity.toLowerCase()}">${esc(item.rarity)}</span>
        <button class="pdx-btn pdx-btn--wood" type="button" data-pick="${esc(item.id)}" data-pick-hero="${esc(heroId)}">Remove</button>
      </div>`;
    }).join("");

    if (!picked.length) {
      out.innerHTML = `<b>Nothing picked yet</b><p class="pdx-note">Add one or two pieces to see their effects listed together.</p>`;
      return;
    }
    out.innerHTML = `<b>${esc(hero ? hero.name : "Loadout")} · ${picked.length} of 2 pieces</b>
      <ul>${picked.map(item => `<li><b>${esc(item.name)}</b> (${esc(item.rarity)}, Lv 1–${esc(item.maxLevel)}) — ${esc(item.effect.text)}</li>`).join("")}</ul>
      <p class="pdx-note">Both effects belong to the same hero. Effect wording is an archive summary, not a damage formula.</p>`;

    $$(".eq-card").forEach(card => {
      const button = $("[data-pick]", card);
      if (!button) return;
      const on = (state.loadout[heroId] || []).includes(button.dataset.pick);
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? "In the loadout" : "Add to loadout";
      button.classList.toggle("pdx-btn--wood", !on);
      button.disabled = !on && picked.length >= 2;
    });
  }

  function togglePick(itemId, heroId) {
    const list = state.loadout[heroId] || (state.loadout[heroId] = []);
    const index = list.indexOf(itemId);
    if (index >= 0) list.splice(index, 1);
    else if (list.length < 2) list.push(itemId);
    else return;
    paintLoadout(heroId);
  }

  function renderEquipmentTab() {
    const hero = heroById(state.eqHero) || state.data.heroes[0];
    if (!hero) return;
    state.eqHero = hero.id;
    $("#equipmentContent").innerHTML = `
      <div class="hero-picker" role="group" aria-label="Choose a hero">
        ${state.data.heroes.map(entry => `
          <button class="hero-pick" type="button" data-eq-hero="${esc(entry.id)}"
            aria-pressed="${entry.id === hero.id}">
            <img src="${esc(entry.art)}" alt="" width="52" height="52" loading="lazy" decoding="async">
            <span>${esc(entry.name)}</span>
          </button>`).join("")}
      </div>
      ${plannerMarkup(hero)}
      <div class="eq-grid">${equipmentFor(hero.id).map(item => equipmentCard(item, hero)).join("")}</div>`;
    paintLoadout(hero.id);
  }

  /* ------------------------------------------------------------- cosmetics */
  function uniqueValues(list, key) {
    return Array.from(new Set(list.map(item => item[key]).filter(Boolean))).sort();
  }

  function filterOptions(list) {
    return {
      hero: uniqueValues(list, "hero").filter(id => heroById(id)),
      source: uniqueValues(list, "source"),
      season: uniqueValues(list, "season"),
      rarity: uniqueValues(list, "rarity"),
    };
  }

  function selectMarkup(id, label, allLabel, values, formatter) {
    const options = values.length
      ? values.map(value => `<option value="${esc(value)}">${esc(formatter ? formatter(value) : value)}</option>`).join("")
      : "";
    return `<label class="pdx-field"><span>${esc(label)}</span>
      <select class="pdx-select" id="${id}" ${values.length ? "" : "disabled"}>
        <option value="all">${esc(allLabel)}${values.length ? "" : " (nothing tagged yet)"}</option>
        ${options}
      </select></label>`;
  }

  function renderFilters(list) {
    const root = $("#skinFilters");
    if (!root) return;
    const options = filterOptions(list);
    root.innerHTML = `
      <div class="filter-bar__row">
        <label class="pdx-field"><span>Search</span>
          <input class="pdx-input" id="filterQuery" type="search" value="${esc(state.query)}"
            placeholder="Search ${state.cosmetic === "skins" ? "skins" : "sceneries"} by name" autocomplete="off">
        </label>
        ${state.cosmetic === "skins" ? selectMarkup("filterHero", "Hero", "All heroes", options.hero, id => (heroById(id) || {}).name || id) : ""}
        ${selectMarkup("filterSource", "Source", "All sources", options.source)}
        ${selectMarkup("filterSeason", "Season", "All seasons", options.season)}
        ${state.cosmetic === "skins" ? selectMarkup("filterRarity", "Rarity", "All rarities", options.rarity) : ""}
      </div>
      <div class="filter-bar__row">
        <button class="pdx-btn pdx-btn--wood filter-clear" type="button" data-filter-reset>Clear filters</button>
        <p class="gallery-note">${options.source.length || options.season.length
          ? "Filters apply as you type."
          : "Season, source and rarity are not confirmed for these entries yet, so only the name and hero filters do anything."}</p>
      </div>`;

    const map = { filterHero: "hero", filterSource: "source", filterSeason: "season", filterRarity: "rarity" };
    Object.keys(map).forEach(id => {
      const node = document.getElementById(id);
      if (node && state.filters[map[id]] !== "all") node.value = state.filters[map[id]];
    });
  }

  function matchesQuery(item) {
    if (!state.query) return true;
    const needle = state.query.toLowerCase();
    return item.name.toLowerCase().includes(needle) ||
      String(item.id).toLowerCase().includes(needle) ||
      (state.cosmetic === "skins" && ((heroById(item.hero) || {}).name || "").toLowerCase().includes(needle));
  }

  function filteredSkins() {
    return state.data.skins.filter(skin =>
      (state.filters.hero === "all" || skin.hero === state.filters.hero) &&
      (state.filters.source === "all" || skin.source === state.filters.source) &&
      (state.filters.season === "all" || skin.season === state.filters.season) &&
      (state.filters.rarity === "all" || skin.rarity === state.filters.rarity) &&
      matchesQuery(skin));
  }

  function filteredSceneries() {
    return state.data.sceneries.filter(scenery =>
      (state.filters.source === "all" || scenery.source === state.filters.source) &&
      (state.filters.season === "all" || scenery.season === state.filters.season) &&
      matchesQuery(scenery));
  }

  function skinCard(skin, hero) {
    const owner = hero || heroById(skin.hero);
    return `<button class="pdx-card skin-card" type="button" data-skin="${esc(skin.id)}">
      <span class="pdx-card__media">
        <img src="${esc(skin.thumb)}" alt="${esc(skin.name)} skin art" width="240" height="240" loading="lazy" decoding="async">
      </span>
      <span class="pdx-card__body">
        <span class="pdx-card__title">${esc(skin.name)}</span>
        <span class="pdx-card__meta">${esc(owner ? owner.name : "")}</span>
      </span>
    </button>`;
  }

  function sceneryCard(scenery) {
    return `<button class="pdx-card scenery-card" type="button" data-scenery="${esc(scenery.id)}">
      <span class="pdx-card__media">
        <img src="${esc(scenery.thumb)}" alt="${esc(scenery.name)} scenery" width="320" height="200" loading="lazy" decoding="async">
      </span>
      <span class="pdx-card__body">
        <span class="pdx-card__title">${esc(scenery.name)}</span>
        <span class="pdx-card__meta">View scenery</span>
      </span>
    </button>`;
  }

  function renderCosmetics() {
    if (state.cosmetic !== "skins") {
      state.filters.hero = "all";
      state.filters.rarity = "all";
    }
    $$("[data-cosmetic]").forEach(tab => {
      const on = tab.dataset.cosmetic === state.cosmetic;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });

    const list = state.cosmetic === "skins" ? state.data.skins : state.data.sceneries;
    const heading = $("#cosmeticsArea .panel-heading h2");
    const kicker = $("#cosmeticsArea .panel-heading .eyebrow");
    if (heading) heading.textContent = state.cosmetic === "skins" ? "Hero Skins" : "Scenery Shop";
    if (kicker) kicker.textContent = state.cosmetic === "skins" ? "PICK A SKIN FOR ITS FULL CARD" : "STEP 1 · PICK A SCENERY";
    renderFilters(list);

    const results = state.cosmetic === "skins" ? filteredSkins() : filteredSceneries();
    const content = $("#cosmeticContent");
    const status = $("#cosmeticStatus");
    const count = $("#cosmeticCount");
    const unit = state.cosmetic === "skins" ? "skin" : "scenery";
    const total = list.length;

    if (count) count.textContent = `${total} ${plural(unit, total)} on file`;
    if (status) {
      status.textContent = results.length === total
        ? `${total} ${plural(unit, total)} shown.`
        : `${results.length} of ${total} ${plural(unit, total)} match.`;
    }

    content.setAttribute("aria-busy", "false");
    if (!results.length) {
      content.innerHTML = `<div class="pdx-empty"><b>Nothing matches those filters</b>
        <p class="pdx-note">Try a shorter search or clear the filters. Every entry here comes from the art that ships with the site.</p>
        <button class="pdx-btn" type="button" data-filter-reset>Clear filters</button></div>`;
      return;
    }

    content.innerHTML = state.cosmetic === "skins"
      ? `<div class="skin-grid">${results.map(skin => skinCard(skin)).join("")}</div>`
      : `<div class="scenery-grid">${results.map(sceneryCard).join("")}</div>`;
  }

  /* ---------------------------------------------------------- dialogs */
  let lastFocus = null;

  function openDialog(el, focusSelector) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.style.overflow = "hidden";
    const target = el.querySelector(focusSelector);
    if (target) target.focus();
  }

  function closeDialog(el) {
    if (!el || el.hidden) return;
    el.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }

  function openSkin(skinId) {
    const skin = state.data.skins.find(entry => entry.id === skinId);
    if (!skin) return;
    const hero = heroById(skin.hero);
    $("#skinSheetTitle").textContent = skin.name;
    $("#skinSheetBody").innerHTML = `
      <div class="pdx-sheet__art"><img src="${esc(skin.art)}" alt="${esc(skin.name)} full art" width="480" height="360" decoding="async"></div>
      <dl class="pdx-facts">
        <div><dt>Hero</dt><dd>${esc(hero ? hero.name : "Unknown")}</dd></div>
        <div><dt>Release date</dt><dd>${esc(skin.released || "Not on file yet")}</dd></div>
        <div><dt>Season</dt><dd>${esc(skin.season || "Not listed yet")}</dd></div>
        <div><dt>Price</dt><dd>${esc(skin.priceTier || "Not verified yet")}</dd></div>
        <div><dt>How to get it</dt><dd>${esc(skin.source || skin.obtainable || "Not listed yet")}</dd></div>
        <div><dt>Availability</dt><dd>${esc(skin.obtainable || skin.availability || "Not confirmed — this skin may no longer be in the shop")}</dd></div>
        <div><dt>Rarity</dt><dd>${esc(skin.rarity || "Not listed yet")}</dd></div>
      </dl>
      <p class="pdx-note">In-game price varies by region. This archive never links to a purchase: open the game's own shop to see today's offer.</p>
      ${skin.verified === false ? '<span class="verify-chip">Details not verified yet</span>' : ""}
      <button class="pdx-btn pdx-btn--wood" type="button" data-close-sheet style="justify-self:start">Back to skins</button>`;
    openDialog($("#skinSheet"), ".pdx-sheet__bar [data-close-sheet]");
  }

  function openScenery(sceneryId) {
    const scenery = state.data.sceneries.find(entry => entry.id === sceneryId);
    if (!scenery) return;
    $("#sceneryTitle").textContent = scenery.name;
    $("#sceneryArt").innerHTML = `<img src="${esc(scenery.art)}" alt="${esc(scenery.name)} full preview" width="1200" height="800" decoding="async">`;
    $("#sceneryDetails").innerHTML = `
      <p><b>Release date:</b> ${esc(scenery.released || "Not on file yet")} · <b>Season:</b> ${esc(scenery.season || "Not listed yet")}</p>
      <p><b>Price:</b> ${esc(scenery.priceTier || "Not verified yet")} · <b>Source:</b> ${esc(scenery.source || "Not listed yet")}</p>
      <p>In-game price varies by region, and sceneries rotate in and out of the shop.</p>
      ${scenery.verified === false ? '<p>Scenery details are not verified yet.</p>' : ""}
      <button class="pdx-btn pdx-btn--wood" type="button" data-close-scenery>Back to Scenery Shop</button>`;
    openDialog($("#sceneryView"), "[data-close-scenery]");
  }

  function trapFocus(event) {
    if (event.key !== "Tab") return;
    const dialog = $(".pdx-sheet:not([hidden]) .pdx-sheet__panel, .pdx-lightbox:not([hidden]) .pdx-lightbox__panel");
    if (!dialog) return;
    const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', dialog)
      .filter(node => !node.disabled && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------- events */
  function bind() {
    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const retry = target.closest("[data-retry]");
      if (retry) { loadAll(); return; }

      const main = target.closest("[data-main]");
      if (main) {
        go(main.dataset.main === "cosmetics" ? "cosmetics/" + state.cosmetic : main.dataset.main);
        refocus("#tab-" + main.dataset.main);
        return;
      }

      const cosmetic = target.closest("[data-cosmetic]");
      if (cosmetic) {
        go("cosmetics/" + cosmetic.dataset.cosmetic);
        refocus("#tab-" + cosmetic.dataset.cosmetic);
        return;
      }

      const heroTab = target.closest("[data-hero-tab]");
      if (heroTab) {
        go(`hero/${state.heroId}/${heroTab.dataset.heroTab}`);
        refocus(`#ht-${state.heroId}-${heroTab.dataset.heroTab}`);
        return;
      }

      const eqHero = target.closest("[data-eq-hero]");
      if (eqHero) { go("equipment/" + eqHero.dataset.eqHero); return; }

      const pick = target.closest("[data-pick]");
      if (pick) {
        const heroId = pick.dataset.pickHero || state.eqHero || state.heroId;
        if (heroId) togglePick(pick.dataset.pick, heroId);
        return;
      }

      const skin = target.closest("[data-skin]");
      if (skin) { openSkin(skin.dataset.skin); return; }

      const scenery = target.closest("[data-scenery]");
      if (scenery) { openScenery(scenery.dataset.scenery); return; }

      if (target.closest("[data-close-sheet]")) { closeDialog($("#skinSheet")); return; }
      if (target.closest("[data-close-scenery]")) { closeDialog($("#sceneryView")); return; }

      if (target.closest("[data-filter-reset]")) {
        state.query = "";
        state.filters = { hero: "all", source: "all", season: "all", rarity: "all" };
        renderCosmetics();
        return;
      }
    });

    document.addEventListener("input", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.id !== "filterQuery") return;
      state.query = input.value.trim();
      const pos = input.selectionStart;
      renderGalleryOnly();
      const again = $("#filterQuery");
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) { /* search inputs reject the range */ } }
    });

    document.addEventListener("change", event => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement)) return;
      const map = { filterHero: "hero", filterSource: "source", filterSeason: "season", filterRarity: "rarity" };
      const key = map[select.id];
      if (!key) return;
      state.filters[key] = select.value;
      renderGalleryOnly();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!$("#skinSheet").hidden) { closeDialog($("#skinSheet")); return; }
        if (!$("#sceneryView").hidden) { closeDialog($("#sceneryView")); return; }
      }
      trapFocus(event);

      const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
      if (!tab) return;
      const list = tab.closest('[role="tablist"]');
      if (!list) return;
      const tabs = $$('[role="tab"]', list).filter(node => !node.disabled);
      const index = tabs.indexOf(tab);
      if (index < 0) return;
      const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      tabs[next].focus();
      tabs[next].click();
    });

    window.addEventListener("hashchange", () => {
      const before = state.heroId;
      applyRoute();
      if (state.heroId && state.heroId !== before) {
        const panel = $("#heroContent");
        if (panel) panel.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }

  /* Tabs are re-created on every render, so put the keyboard focus back on the
     tab the user just chose. */
  function refocus(selector) {
    window.requestAnimationFrame(() => {
      const node = document.querySelector(selector);
      if (node) node.focus({ preventScroll: true });
    });
  }

  /* Re-renders only the results grid so the search field keeps focus while typing. */
  function renderGalleryOnly() {
    const list = state.cosmetic === "skins" ? state.data.skins : state.data.sceneries;
    const results = state.cosmetic === "skins" ? filteredSkins() : filteredSceneries();
    const content = $("#cosmeticContent");
    const status = $("#cosmeticStatus");
    const unit = state.cosmetic === "skins" ? "skin" : "scenery";
    if (status) {
      status.textContent = results.length === list.length
        ? `${list.length} ${plural(unit, list.length)} shown.`
        : `${results.length} of ${list.length} ${plural(unit, list.length)} match.`;
    }
    if (!content) return;
    content.innerHTML = results.length
      ? (state.cosmetic === "skins"
        ? `<div class="skin-grid">${results.map(skin => skinCard(skin)).join("")}</div>`
        : `<div class="scenery-grid">${results.map(sceneryCard).join("")}</div>`)
      : `<div class="pdx-empty"><b>Nothing matches those filters</b>
          <p class="pdx-note">Try a shorter search or clear the filters.</p>
          <button class="pdx-btn" type="button" data-filter-reset>Clear filters</button></div>`;
  }

  function init() {
    bind();
    applyRoute();
    loadAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
