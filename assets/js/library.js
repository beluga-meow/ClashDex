/* PekkaDex — Base Library + Army Library.
   One script powers bases.html and armies.html. It reads the page's
   data-library attribute, loads assets/data/<page>.json and renders filters,
   cards and a detail view. Filters are mirrored into the query string so a
   filtered library can be linked, and ?base=<id> / ?army=<id> opens a detail.

   Nothing is invented here: records come from the JSON and every unverified
   field is shown as unverified. */
(() => {
  "use strict";

  const page = document.body.dataset.library;
  const root = document.getElementById("libApp");
  if (!page || !root || window.__pdxLibrary) return;
  window.__pdxLibrary = true;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const esc = value =>
    String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  const TH_EXT = { 2: "png", 3: "png", 4: "png", 5: "png", 6: "png", 7: "png", 8: "png", 9: "png", 10: "webp", 11: "webp", 12: "png", 13: "webp", 14: "png", 15: "png", 16: "webp", 17: "webp", 18: "webp", 19: "webp" };
  const thImage = th => (TH_EXT[th] ? `./assets/townhalls/th-${th}.${TH_EXT[th]}` : "");

  const CONFIG = {
    bases: {
      file: "./assets/data/bases.json",
      key: "id",
      param: "base",
      label: "base layout",
      plural: "layouts",
      sorts: [
        ["newest", "Town Hall: high to low"],
        ["oldest", "Town Hall: low to high"],
        ["name", "Name A to Z"]
      ]
    },
    armies: {
      file: "./assets/data/armies.json",
      key: "id",
      param: "army",
      label: "army",
      plural: "armies",
      sorts: [
        ["newest", "Town Hall requirement: high to low"],
        ["oldest", "Town Hall requirement: low to high"],
        ["name", "Name A to Z"]
      ]
    }
  }[page];

  const state = { th: "", cat: "All", q: "", sort: "newest", records: [], cats: [], meta: null, openId: null };
  let lastFocus = null;

  /* ------------------------------------------------------------ utilities */
  let toastEl = null;
  let toastTimer = 0;
  function toast(message) {
    const text = String(message || "");
    if (!text) return;
    if (!toastEl) {
      toastEl = document.createElement("p");
      toastEl.className = "lib-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 2800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through to the legacy path */ }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  const norm = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /* --------------------------------------------------------------- filters */
  function readUrl() {
    const params = new URLSearchParams(location.search);
    if (/^(1[0-9]|[1-9])$/.test(params.get("th") || "")) state.th = params.get("th");
    if (params.get("cat")) state.cat = params.get("cat");
    if (params.get("q")) state.q = params.get("q").slice(0, 60);
    if (params.get("sort") && CONFIG.sorts.some(s => s[0] === params.get("sort"))) state.sort = params.get("sort");
    return params.get(CONFIG.param);
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (state.th) params.set("th", state.th);
    if (state.cat !== "All") params.set("cat", state.cat);
    if (state.q) params.set("q", state.q);
    if (state.sort !== "newest") params.set("sort", state.sort);
    if (state.openId) params.set(CONFIG.param, state.openId);
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
  }

  function categories() {
    /* Every declared category is offered, even an empty one: hiding it would
       suggest the category does not exist rather than that no entry is on file. */
    return ["All"].concat(state.meta.categories || []);
  }

  function matches(record) {
    if (state.th && page === "bases" && String(record.th) !== state.th) return false;
    if (state.th && page === "armies") {
      const level = Number(state.th);
      if (level < record.minTh || level > record.maxTh) return false;
    }
    if (state.cat !== "All" && !(record.categories || []).includes(state.cat)) return false;
    if (state.q) {
      const haystack = norm([record.name, record.army, record.spells, record.note, record.heroes, (record.categories || []).join(" ")].filter(Boolean).join(" "));
      if (!norm(state.q).split(" ").every(word => haystack.includes(word))) return false;
    }
    return true;
  }

  function visible() {
    const list = state.records.filter(matches);
    const byName = (a, b) => a.name.localeCompare(b.name);
    if (state.sort === "name") return list.sort(byName);
    if (page === "bases") {
      return list.sort((a, b) => (state.sort === "oldest" ? a.th - b.th : b.th - a.th) || byName(a, b));
    }
    return list.sort((a, b) => (state.sort === "oldest" ? a.minTh - b.minTh : b.minTh - a.minTh) || byName(a, b));
  }

  /* ---------------------------------------------------------------- render */
  function renderThs() {
    const wrap = $("#libThs");
    if (!wrap) return;
    let html = `<button type="button" class="lib-th lib-th--all" data-th="" aria-pressed="${state.th === ""}">
        <b style="font-size:22px;line-height:1">★</b><small>All</small>
      </button>`;
    for (let level = 19; level >= 1; level--) {
      const image = thImage(level);
      html += `<button type="button" class="lib-th" data-th="${level}" aria-pressed="${state.th === String(level)}" aria-label="Town Hall ${level}">
        ${image ? `<img src="${image}" alt="" width="40" height="40" loading="lazy" decoding="async">` : `<b>TH</b>`}
        <b>${level}</b><small>TH</small>
      </button>`;
    }
    wrap.innerHTML = html;
  }

  function renderCats() {
    const wrap = $("#libCats");
    if (!wrap) return;
    wrap.innerHTML = state.cats
      .map(cat => `<button type="button" class="lib-chip" data-cat="${esc(cat)}" aria-pressed="${state.cat === cat}">${esc(cat)}</button>`)
      .join("");
  }

  function renderSort() {
    const select = $("#libSort");
    if (!select) return;
    select.innerHTML = CONFIG.sorts.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join("");
    select.value = state.sort;
  }

  function media(record) {
    if (page === "bases") {
      const image = thImage(record.th);
      return `<div class="lib-card__media">
        <div class="lib-card__badges"><span class="pdx-badge">TH ${record.th}</span></div>
        ${image ? `<img src="${image}" alt="Town Hall ${record.th}" width="128" height="128" loading="lazy" decoding="async">` : ""}
      </div>`;
    }
    return `<div class="lib-card__media lib-card__media--army">
      <div class="lib-card__badges"><span class="pdx-badge">TH ${record.minTh}+</span></div>
    </div>`;
  }

  function card(record) {
    const pills = (record.categories || []).slice(0, 2).map(cat => `<span class="lib-pill">${esc(cat)}</span>`).join("");
    if (page === "bases") {
      return `<article class="lib-card" data-card="${esc(record.id)}">
        ${media(record)}
        <div class="lib-card__body">
          <div class="lib-meta"><span class="lib-pill lib-pill--th">TH ${record.th}</span>${pills}</div>
          <h3 class="lib-card__title">${esc(record.name)}</h3>
          ${record.note ? `<p class="lib-copy">${esc(record.note)}</p>` : ""}
          <span class="lib-flag">Link supplied with the project · not re-tested</span>
          <div class="lib-card__actions">
            <button type="button" class="pdx-btn pdx-btn--wood" data-open="${esc(record.id)}">View details</button>
            <button type="button" class="pdx-btn pdx-btn--ghost" data-copy="${esc(record.id)}" style="color:var(--c-ink);border-color:var(--c-wood-500);text-shadow:none">Copy base link</button>
          </div>
        </div>
      </article>`;
    }
    return `<article class="lib-card" data-card="${esc(record.id)}">
      ${media(record)}
      <div class="lib-card__body">
        <div class="lib-meta"><span class="lib-pill lib-pill--th">TH ${record.minTh}–${record.maxTh}</span>${pills}</div>
        <h3 class="lib-card__title">${esc(record.name)}</h3>
        <p class="lib-copy">${esc(record.army)}</p>
        <div class="lib-meta"><span class="lib-pill">${esc(record.difficulty)}</span><span class="lib-pill">${esc(record.type)}</span></div>
        <div class="lib-card__actions">
          <button type="button" class="pdx-btn pdx-btn--wood" data-open="${esc(record.id)}">View details</button>
          <button type="button" class="pdx-btn pdx-btn--ghost" data-copy="${esc(record.id)}" style="color:var(--c-ink);border-color:var(--c-wood-500);text-shadow:none">Copy army list</button>
        </div>
      </div>
    </article>`;
  }

  function coverage() {
    if (page !== "bases") return "";
    const halls = new Set(state.records.map(record => record.th));
    const missing = [];
    for (let level = 19; level >= 1; level--) if (!halls.has(level)) missing.push(level);
    return `Last data check <time datetime="${esc(state.meta.verifiedOn)}">${esc(state.meta.verifiedOn)}</time>. ` +
      `${state.records.length} linked layouts cover TH${Math.min(...halls)}–TH${Math.max(...halls)}; ` +
      `no genuine link is on file yet for ${missing.length === 1 ? "TH" : "TH "}${missing.join(", ")}.`;
  }

  function render() {
    const list = visible();
    const grid = $("#libGrid");
    const count = $("#libCount");
    const coverageEl = $("#libCoverage");
    if (coverageEl) coverageEl.textContent = coverage();
    if (count) count.textContent = `${list.length} ${list.length === 1 ? CONFIG.label : CONFIG.plural}`;

    if (!list.length) {
      const th = state.th ? `TH${state.th}` : "this filter";
      const baseEmpty = page === "bases"
        ? `<p class="lib-copy">No genuine layout link is on file for ${esc(th)} yet, so nothing is shown rather than a placeholder. Community libraries to check in the meantime:</p>
           <div class="lib-source-links">
             <a class="pdx-btn pdx-btn--wood" href="https://www.coc-prime.com/base-library" target="_blank" rel="noopener noreferrer">coc-prime Base Library</a>
             <a class="pdx-btn pdx-btn--wood" href="https://cocbasefinder.com/" target="_blank" rel="noopener noreferrer">CocBaseFinder</a>
           </div>`
        : `<p class="lib-copy">No army is listed for ${esc(th)} and this filter yet. Clear a filter, or check the same category at a nearby Town Hall.</p>`;
      grid.innerHTML = `<div class="lib-empty" style="grid-column:1/-1"><b>Nothing here yet</b>${baseEmpty}
        <div class="lib-source-links"><button type="button" class="pdx-btn pdx-btn--wood" id="libClear">Clear filters</button></div></div>`;
    } else {
      grid.innerHTML = list.map(card).join("");
    }
  }

  /* ---------------------------------------------------------------- detail */
  const veil = $("#libDetail");
  const body = $("#libDetailBody");
  const titleEl = $("#libDetailTitle");

  function recordFor(id) {
    return state.records.find(record => record.id === id) || null;
  }

  function detailBody(record) {
    if (page === "bases") {
      return `
        <h2 class="lib-sheet__title" id="libDetailHeading">${esc(record.name)}</h2>
        <div class="lib-meta">
          <span class="lib-pill lib-pill--th">TH ${record.th}</span>
          ${(record.categories || []).map(cat => `<span class="lib-pill">${esc(cat)}</span>`).join("")}
          ${(record.tags || []).map(tag => `<span class="lib-pill">${esc(tag)}</span>`).join("")}
        </div>
        <div class="lib-sheet__art">
          ${thImage(record.th) ? `<img src="${thImage(record.th)}" alt="Town Hall ${record.th} artwork" width="150" height="150" decoding="async">` : ""}
        </div>
        ${record.note ? `<div class="lib-block"><h4>About this layout</h4><p>${esc(record.note)}</p></div>` : ""}
        <div class="lib-block">
          <h4>Copy Base link</h4>
          <p>Open this on the phone that has Clash of Clans, or paste it into clan chat and tap it to import the layout.</p>
          <p style="word-break:break-all;font-size:12px;color:var(--c-ink-3)">${esc(record.link)}</p>
          <div class="lib-actions">
            <button type="button" class="pdx-btn pdx-btn--wood" data-copy="${esc(record.id)}">Copy base link</button>
            <a class="pdx-btn pdx-btn--ghost" style="color:var(--c-ink);border-color:var(--c-wood-500);text-shadow:none" href="${esc(record.link)}" target="_blank" rel="noopener noreferrer">Open link</a>
          </div>
        </div>
        <div class="lib-block lib-warn">
          <h4>What is not verified</h4>
          <p>This link shipped with the project but was not re-opened in the game for this build. Layout screenshots and a last-updated date are not on file, so none are shown.</p>
          <p>Source: ${esc(record.source)}</p>
        </div>`;
    }
    return `
      <h2 class="lib-sheet__title" id="libDetailHeading">${esc(record.name)}</h2>
      <div class="lib-meta">
        <span class="lib-pill lib-pill--th">TH ${record.minTh}–${record.maxTh}</span>
        <span class="lib-pill">${esc(record.type)}</span>
        <span class="lib-pill">${esc(record.difficulty)}</span>
        ${(record.categories || []).map(cat => `<span class="lib-pill">${esc(cat)}</span>`).join("")}
      </div>
      <div class="lib-sheet__art lib-sheet__art--army"></div>
      <div class="lib-block"><h4>Army</h4><p>${esc(record.army)}</p></div>
      <div class="lib-block"><h4>Spells</h4><p>${esc(record.spells)}</p></div>
      <div class="lib-block"><h4>Siege machine</h4>
        <p>${record.siege ? esc(record.siege) : "Not specified for this army. Pick whichever siege machine your Town Hall has unlocked and that fits the entry point."}</p>
      </div>
      <div class="lib-block"><h4>Heroes and equipment</h4>
        <p>${esc(record.heroes)}</p>
        <p>${record.equipment ? esc(record.equipment) : "Equipment loadout is left open on purpose: it depends on the gear you own. The encyclopedia lists every piece with its levels."}</p>
      </div>
      <div class="lib-block"><h4>Attack plan</h4><ol>${(record.strategy || []).map(step => `<li>${esc(step)}</li>`).join("")}</ol></div>
      <div class="lib-block lib-warn"><h4>Watch out</h4><ul>${(record.risks || []).map(risk => `<li>${esc(risk)}</li>`).join("")}</ul></div>
      <div class="lib-block">
        <h4>Copy army</h4>
        <p>Clash of Clans does not publish a public CopyArmy web link, so this copies the list as text for clan chat instead of inventing a link.</p>
        <div class="lib-actions">
          <button type="button" class="pdx-btn pdx-btn--wood" data-copy="${esc(record.id)}">Copy army list</button>
          <a class="pdx-btn pdx-btn--ghost" style="color:var(--c-ink);border-color:var(--c-wood-500);text-shadow:none" href="./heroes.html#equipment">Hero equipment</a>
        </div>
      </div>
      <div class="lib-block">
        <h4>Source</h4>
        <p>${esc(record.source)} · ${esc(state.meta.verifiedOn)}</p>
        <p>Composition and tactics are community recommendations, not official data. Verify against the current balance before a war attack.</p>
      </div>`;
  }

  function openDetail(id, updateUrl = true) {
    const record = recordFor(id);
    if (!record || !veil || !body) return;
    lastFocus = document.activeElement;
    state.openId = id;
    if (titleEl) titleEl.textContent = page === "bases" ? "Base details" : "Army details";
    body.innerHTML = detailBody(record);
    veil.hidden = false;
    document.body.style.overflow = "hidden";
    const closeBtn = $("[data-close-detail]", veil);
    if (closeBtn) closeBtn.focus();
    if (updateUrl) writeUrl();
  }

  function closeDetail() {
    if (!veil || veil.hidden) return;
    veil.hidden = true;
    document.body.style.overflow = "";
    state.openId = null;
    writeUrl();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  async function copyRecord(record) {
    if (!record) return;
    let text;
    if (page === "bases") {
      text = record.link;
    } else {
      text = [
        `${record.name} — TH ${record.minTh}–${record.maxTh} · ${record.type} · ${record.difficulty}`,
        `Army: ${record.army}`,
        `Spells: ${record.spells}`,
        record.siege ? `Siege: ${record.siege}` : "",
        `Heroes: ${record.heroes}`,
        "Plan:",
        ...(record.strategy || []).map((step, index) => `${index + 1}. ${step}`),
        `Watch out: ${(record.risks || []).join(" ")}`,
        "PekkaDex Army Library"
      ].filter(Boolean).join("\n");
    }
    const ok = await copyText(text);
    toast(ok
      ? (page === "bases" ? "Base link copied — paste it in clan chat and tap it to import." : "Army list copied — paste it in clan chat.")
      : "Couldn't copy automatically. Select the text and copy it by hand.");
  }

  /* ----------------------------------------------------------------- boot */
  async function boot() {
    const summary = $("#libSummary");
    if (summary) summary.innerHTML = `<div class="pdx-skeleton pdx-skeleton--line"></div>`;
    try {
      const response = await fetch(CONFIG.file, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.meta = data;
      state.records = data[page] || [];
      state.cats = categories();

      const deepId = readUrl();
      if (!state.cats.includes(state.cat)) state.cat = "All";

      const q = $("#libQuery");
      if (q) q.value = state.q;
      renderThs();
      renderCats();
      renderSort();
      if (summary) summary.remove();
      render();

      root.addEventListener("click", event => {
        const th = event.target.closest("[data-th]");
        if (th) {
          state.th = th.getAttribute("data-th");
          renderThs();
          render();
          writeUrl();
          return;
        }
        const chip = event.target.closest("[data-cat]");
        if (chip) {
          state.cat = chip.getAttribute("data-cat");
          renderCats();
          render();
          writeUrl();
          return;
        }
        const clear = event.target.closest("#libClear");
        if (clear) {
          state.th = "";
          state.cat = "All";
          state.q = "";
          const input = $("#libQuery");
          if (input) input.value = "";
          renderThs();
          renderCats();
          render();
          writeUrl();
          return;
        }
        const open = event.target.closest("[data-open]");
        if (open) { openDetail(open.getAttribute("data-open")); return; }
        const copy = event.target.closest("[data-copy]");
        if (copy) copyRecord(recordFor(copy.getAttribute("data-copy")));
      });

      $("#libQuery")?.addEventListener("input", event => {
        state.q = event.target.value.trim();
        render();
        writeUrl();
      });
      $("#libQueryForm")?.addEventListener("submit", event => {
        event.preventDefault();
        state.q = ($("#libQuery")?.value || "").trim();
        render();
        writeUrl();
      });
      $("#libSort")?.addEventListener("change", event => {
        state.sort = event.target.value;
        render();
        writeUrl();
      });

      $("[data-close-detail]", veil)?.addEventListener("click", closeDetail);
      veil?.addEventListener("click", event => {
        if (event.target === veil) closeDetail();
        const copy = event.target.closest("[data-copy]");
        if (copy) copyRecord(recordFor(copy.getAttribute("data-copy")));
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && veil && !veil.hidden) closeDetail();
      });

      if (deepId) openDetail(deepId, false);
    } catch (error) {
      if (summary) {
        summary.innerHTML = `<div class="lib-empty"><b>The library could not load</b>
          <p class="lib-copy">${esc(error.message)}. Check your connection and try again.</p>
          <div class="lib-source-links"><button type="button" class="pdx-btn pdx-btn--wood" onclick="location.reload()">Reload</button></div></div>`;
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
