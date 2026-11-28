/* PekkaDex — Heroes Encyclopedia extras (heroes.html)
   Three lazily-loaded tabs that sit beside Heroes / Equipment / Cosmetics:

     #loadouts[/hero-id]   suggested two-piece equipment pairings
     #pets                 Pet House facts, the pet list and pairings
     #guides[/topic]       supercharge, squads and Blacksmith notes

   heroes.js owns the tab routing and calls window.pdxHeroExtras.render() once
   a tab is open. Each tab fetches its JSON on first use and caches it, so the
   main encyclopedia load is unchanged. Every JSON value is escaped. */
(() => {
  "use strict";

  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  const cache = new Map();
  async function fetchJSON(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path, { cache: "no-cache" }).then(response => {
        if (!response.ok) throw new Error(`${path} answered ${response.status}`);
        return response.json();
      }));
    }
    return cache.get(path);
  }

  const state = {
    tab: null,
    hero: null,
    topic: null,
    pending: {},
    failed: {},
  };

  const HERO_ORDER = ["barbarian-king", "archer-queen", "grand-warden", "royal-champion", "minion-prince", "dragon-duke"];

  function panel(tab) {
    return document.getElementById(`${tab}Content`);
  }

  function skeleton(tab) {
    const node = panel(tab);
    if (!node) return;
    node.innerHTML = `<div class="pdx-grid extras-grid" aria-hidden="true">
      ${Array.from({ length: 3 }, () => '<div class="pdx-skeleton"></div>').join("")}
    </div>`;
  }

  function errorBox(tab, message) {
    const node = panel(tab);
    if (!node) return;
    node.innerHTML = `<div class="pdx-empty"><b>This tab could not load</b>
      <p class="pdx-note">${esc(message)}</p>
      <button class="pdx-btn" type="button" data-extras-retry data-extras-tab="${esc(tab)}">Try again</button></div>`;
  }

  function chip(text, gold) {
    return `<span class="pdx-chip${gold ? " pdx-chip--gold" : ""}">${esc(text)}</span>`;
  }

  /* ------------------------------------------------------------- loadouts */
  async function renderLoadouts(heroId) {
    const node = panel("loadouts");
    if (!node) return;
    if (!cache.has("loadouts:index")) {
      if (state.pending.loadouts) return;
      state.pending.loadouts = true;
      skeleton("loadouts");
      try {
        const [loadouts, heroes, equipment] = await Promise.all([
          fetchJSON("./assets/data/loadouts.json"),
          fetchJSON("./assets/data/heroes.json"),
          fetchJSON("./assets/data/equipment.json"),
        ]);
        cache.set("loadouts:index", { loadouts, heroes, equipment });
      } catch (error) {
        state.failed.loadouts = error;
        errorBox("loadouts", "The loadout data did not answer. Check your connection and retry.");
        return;
      } finally {
        state.pending.loadouts = false;
      }
    }
    const index = cache.get("loadouts:index");
    if (!index) return;
    const { loadouts, heroes, equipment } = index;
    const heroList = (heroes.heroes || []).filter(hero => HERO_ORDER.includes(hero.id) || (heroes.heroes || []).length <= 6);
    const entries = loadouts.loadouts || [];
    const wanted = heroId && entries.some(entry => entry.hero === heroId)
      ? heroId
      : (entries[0] || {}).hero || (heroList[0] || {}).id;
    state.hero = wanted;
    const hero = heroList.find(item => item.id === wanted) || heroList[0] || null;
    const items = new Map((equipment.equipment || []).map(item => [item.id, item]));
    const heroPicks = heroList.map(entry => `
      <button class="loadout-pick${entry.id === wanted ? " is-on" : ""}" type="button" role="tab" aria-selected="${entry.id === wanted}" data-loadout-hero="${esc(entry.id)}">
        <img src="${esc(entry.art)}" alt="" width="56" height="56" loading="lazy" decoding="async">
        <span>${esc(entry.name)}</span>
      </button>`).join("");

    const cards = entries.filter(entry => entry.hero === wanted).map(entry => {
      const arts = (entry.items || []).map(id => {
        const item = items.get(id);
        return item
          ? `<figure class="loadout-art">
               <img src="${esc(item.art)}" alt="${esc(item.name)}" width="120" height="120" loading="lazy" decoding="async">
               <figcaption>${esc(item.name)}</figcaption>
             </figure>`
          : "";
      }).join("");
      return `<article class="pdx-card loadout-card">
        <div class="loadout-card__arts">${arts}</div>
        <div class="pdx-card__body">
          <div class="loadout-card__chips">${chip("Suggestion")}${hero ? chip(hero.name, true) : ""}</div>
          <h3 class="pdx-card__title">${esc(entry.name)}</h3>
          <p class="loadout-card__best"><b>Best for:</b> ${esc(entry.bestFor)}</p>
          <p class="pdx-note">${esc(entry.reason)}</p>
          ${entry.guide ? `<a class="pdx-btn pdx-btn--sm" href="./attack-guides.html#guide-${encodeURIComponent(entry.guide)}">Read the attack guide</a>` : ""}
          ${entry.verified === false ? `<p class="loadout-card__flag">${chip("Unverified")} <span>${esc(entry.notes || "Suggested pairing")}</span></p>` : ""}
        </div>
      </article>`;
    }).join("");

    node.innerHTML = `
      <p class="pdx-note">Pick a hero to see suggested two-piece pairs. These are opinions about what a pair is good for, not a tier list, and they use only the equipment that has an entry in this archive.</p>
      <div class="loadout-picker" role="tablist" aria-label="Choose a hero">${heroPicks}</div>
      <div class="pdx-grid extras-grid extras-grid--loadouts">${cards || `<div class="pdx-empty"><b>No loadouts for that hero yet</b><p class="pdx-note">The loadout file has no suggestions for this hero.</p></div>`}</div>
      <p class="pdx-note">${esc(loadouts.note || "")}</p>`;
  }

  /* ----------------------------------------------------------------- pets */
  async function renderPets() {
    const node = panel("pets");
    if (!node) return;
    if (!cache.has("pets:index")) {
      if (state.pending.pets) return;
      state.pending.pets = true;
      skeleton("pets");
      try {
        const [pets, heroes] = await Promise.all([
          fetchJSON("./assets/data/pets.json"),
          fetchJSON("./assets/data/heroes.json"),
        ]);
        cache.set("pets:index", { pets, heroes });
      } catch (error) {
        state.failed.pets = error;
        errorBox("pets", "The pet data did not answer. Check your connection and retry.");
        return;
      } finally {
        state.pending.pets = false;
      }
    }
    const index = cache.get("pets:index");
    if (!index) return;
    const { pets, heroes } = index;
    const house = pets.petHouse || {};
    const levels = (house.maxLevelByTh || []).map(row => `
      <div><dt>Town Hall ${esc(row.th)}</dt><dd>Pet House level ${esc(row.maxLevel)}</dd></div>`).join("");
    const houseFacts = (house.facts || []).map(fact => `
      <li><b>${esc(fact.label)}</b><span>${esc(fact.text)}</span></li>`).join("");

    const featured = pets.featured;
    const featuredFacts = featured
      ? `<div class="pet-feature pdx-panel">
           <div>
             <p class="eyebrow">ON FILE</p>
             <h3>${esc(featured.name)}</h3>
             <p class="pdx-note">${esc(featured.notes || "")}</p>
           </div>
           <dl class="pdx-facts">${(featured.facts || []).map(fact => `
             <div><dt>${esc(fact.label)}</dt><dd>${esc(fact.text)}</dd></div>`).join("")}</dl>
         </div>`
      : "";

    /* Stacked cards instead of a five-column table: on a 360px phone the
       Details column used to be pushed off the edge of the screen. */
    const cards = (pets.pets || []).map(pet => `
      <article class="pdx-card pet-card">
        <span class="pdx-card__media pet-card__art">
          ${pet.art
            ? `<img src="${esc(pet.art)}" alt="${esc(pet.name)} pet art" width="220" height="220" loading="lazy" decoding="async">`
            : `<span class="art-missing" role="img" aria-label="${esc(pet.name)} — art not on file">🐾</span>`}
        </span>
        <div class="pdx-card__body">
          <p class="pdx-card__meta">Pet ${esc(pet.order)} · ${esc(pet.unlock)}</p>
          <h3 class="pdx-card__title">${esc(pet.name)}</h3>
          <p class="pet-card__status">${pet.verified === false ? chip("Unverified") : chip("On file", true)}</p>
          <p class="pdx-note">${esc(pet.detail || pet.notes || "Details not confirmed")}</p>
        </div>
      </article>`).join("");

    const heroById = new Map((heroes.heroes || []).map(hero => [hero.id, hero]));
    const petById = new Map((pets.pets || []).map(pet => [pet.id, pet]));
    const pairings = (pets.pairings?.items || []).map(pair => {
      const hero = heroById.get(pair.hero);
      const names = (pair.petIds || []).map(id => (petById.get(id) || {}).name || "Unknown pet");
      return `<article class="pdx-card pairing-card">
        <div class="pairing-card__head">
          ${hero ? `<img src="${esc(hero.art)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : ""}
          <div>
            <h3 class="pdx-card__title">${esc(hero ? hero.name : pair.hero)}</h3>
            <p class="pdx-card__meta">${esc(names.join(" · "))}</p>
          </div>
        </div>
        <p class="pdx-note">${esc(pair.reason)}</p>
      </article>`;
    }).join("");

    node.innerHTML = `
      <div class="pets-house pdx-panel">
        <div>
          <p class="eyebrow">PET HOUSE</p>
          <h3>How pets work</h3>
          <p class="pdx-note">The Pet House unlocks at ${esc(house.unlock || "Town Hall 14")}. ${esc(pets.note || "")}</p>
        </div>
        <dl class="pdx-facts">${levels}</dl>
        <ul class="pet-facts">${houseFacts}</ul>
      </div>
      ${featuredFacts}
      <h3 class="extras-subhead">Every pet, in unlock order</h3>
      <p class="pdx-note">Only L.A.S.S.I has a full stat line on file. The other pets are listed by name and unlock order, and their card says so instead of inventing numbers.</p>
      <div class="pdx-grid pet-grid">${cards}</div>
      <h3 class="extras-subhead">Which pet for which hero</h3>
      <p class="pdx-note">Suggestions, not a tier list. ${esc(pets.pairings?.note || "")}</p>
      <div class="pdx-grid pairing-grid">${pairings}</div>
      ${pets.pairings?.verified === false ? `<p class="extras-flag">${chip("Unverified")} <span>Pairing advice is an opinion and is not checked against the live game.</span></p>` : ""}`;
  }

  /* --------------------------------------------------------------- guides */
  function guideTable(table) {
    if (!table || !Array.isArray(table.rows)) return "";
    const head = (table.head || []).map(label => `<th scope="col">${esc(label)}</th>`).join("");
    const rows = table.rows.map(row => {
      const cells = [row.level, row.name, row.contents].filter(value => value !== undefined);
      return `<tr>${cells.map(value => `<td>${value === "" ? "" : esc(value)}</td>`).join("")}</tr>`;
    }).join("");
    return `<div class="tool-table-wrap">
      <table class="tool-table extras-table">
        ${table.caption ? `<caption>${esc(table.caption)}</caption>` : ""}
        <thead><tr>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  async function renderGuides(topic) {
    const node = panel("guides");
    if (!node) return;
    if (!cache.has("guides:index")) {
      if (state.pending.guides) return;
      state.pending.guides = true;
      skeleton("guides");
      try {
        const guides = await fetchJSON("./assets/data/guides.json");
        cache.set("guides:index", guides);
      } catch (error) {
        state.failed.guides = error;
        errorBox("guides", "The notes data did not answer. Check your connection and retry.");
        return;
      } finally {
        state.pending.guides = false;
      }
    }
    const guides = cache.get("guides:index");
    if (!guides) return;
    const sections = (guides.sections || []).map(section => `
      <section class="extras-guide paper-panel" id="extras-${esc(section.id)}">
        <div class="extras-guide__head">
          <p class="eyebrow">${esc(section.eyebrow || "NOTES")}</p>
          <h3>${esc(section.name)}</h3>
          <p class="pdx-note">${esc(section.summary || "")}</p>
        </div>
        ${(section.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join("")}
        ${Array.isArray(section.bullets) && section.bullets.length
          ? `<ul class="extras-list">${section.bullets.map(text => `<li>${esc(text)}</li>`).join("")}</ul>`
          : ""}
        ${guideTable(section.table)}
        ${section.notes ? `<p class="extras-guide__note">${esc(section.notes)}</p>` : ""}
      </section>`).join("");

    node.innerHTML = `
      <p class="pdx-note">${esc(guides.note || "")}</p>
      <div class="extras-jump">
        ${(guides.sections || []).map(section => `<a class="pdx-chip" href="#guides/${esc(section.id)}">${esc(section.name)}</a>`).join("")}
      </div>
      ${sections}`;

    if (topic) {
      const target = document.getElementById(`extras-${topic}`);
      if (target) window.requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }

  /* ---------------------------------------------------------------- router */
  function render(tab, extra) {
    state.tab = tab;
    if (tab === "loadouts") {
      const hero = extra && extra.hero ? extra.hero : state.hero;
      return renderLoadouts(hero);
    }
    if (tab === "pets") return renderPets();
    if (tab === "guides") return renderGuides(extra && extra.topic ? extra.topic : state.topic);
    return undefined;
  }

  function bind() {
    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const retry = target.closest("[data-extras-retry]");
      if (retry) {
        const tab = retry.dataset.extrasTab;
        state.pending[tab] = false;
        state.failed[tab] = null;
        cache.delete(`${tab}:index`);
        if (tab === "loadouts") renderLoadouts(state.hero);
        else if (tab === "pets") renderPets();
        else if (tab === "guides") renderGuides(state.topic);
        return;
      }

      const heroPick = target.closest("[data-loadout-hero]");
      if (heroPick) {
        state.hero = heroPick.dataset.loadoutHero;
        const next = `#loadouts/${state.hero}`;
        if (location.hash === next) renderLoadouts(state.hero);
        else location.hash = next;
        return;
      }

      const jump = target.closest("[data-extras-topic]");
      if (jump) {
        const topic = jump.dataset.extrasTopic;
        state.topic = topic;
        const next = `#guides/${topic}`;
        if (location.hash === next) renderGuides(topic);
        else location.hash = next;
      }
    });
  }

  window.pdxHeroExtras = { render };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
