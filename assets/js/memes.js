/* PekkaDex — Memes & Emotes gallery (memes.html)
   Reads assets/data/memes.json, renders a lazy-loaded tile grid, filters by a
   search query and opens a full-screen viewer. No image is fetched from
   outside the repository. */
(() => {
  "use strict";

  const state = { data: null, tab: "memes", query: "", status: "loading" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function currentTab() {
    const hash = (location.hash || "").replace(/^#/, "").toLowerCase();
    return hash === "emotes" ? "emotes" : "memes";
  }

  function items() {
    if (!state.data) return [];
    return state.tab === "emotes" ? state.data.emotes : state.data.memes;
  }

  function filtered() {
    const needle = state.query.trim().toLowerCase();
    if (!needle) return items();
    return items().filter(item =>
      `${item.title} ${item.caption || ""}`.toLowerCase().includes(needle));
  }

  function tile(item, index) {
    const caption = item.caption
      ? `<span class="memes-tile__caption">${esc(item.caption)}</span>`
      : "";
    return `<button class="memes-tile${state.tab === "emotes" ? " memes-tile--emote" : ""}" type="button"
        data-gallery-item="${esc(item.id)}" aria-label="${esc(item.title)} — open the full picture">
      <span class="memes-tile__art">
        <img src="./${esc(item.src)}" alt="${esc(item.title)}" loading="${index < 4 ? "eager" : "lazy"}"
          decoding="async" width="320" height="400">
      </span>
      <span class="memes-tile__body">
        <strong>${esc(item.title)}</strong>
        ${caption}
      </span>
    </button>`;
  }

  function paint() {
    const grid = $("#memesGrid");
    const status = $("#memesStatus");
    const count = $("#memesCount");
    if (!grid) return;
    grid.setAttribute("aria-busy", "false");
    const all = items();
    const shown = filtered();
    if (count) count.textContent = `${(state.data.memes || []).length} memes · ${(state.data.emotes || []).length} emotes in the archive`;
    if (status) {
      status.textContent = state.query.trim()
        ? `${shown.length} of ${all.length} ${state.tab === "emotes" ? "emotes" : "memes"} match “${state.query.trim()}”.`
        : `${all.length} ${state.tab === "emotes" ? "emotes" : "memes"} shown.`;
    }
    if (!shown.length) {
      grid.innerHTML = `<div class="pdx-empty"><b>Nothing matches that search</b>
        <p class="pdx-note">Try a shorter word, or clear the box to see the whole ${state.tab === "emotes" ? "emote set" : "meme wall"}.</p></div>`;
      return;
    }
    grid.innerHTML = shown.map(tile).join("");
  }

  function paintTabs() {
    document.querySelectorAll("[data-gallery]").forEach(tab => {
      const on = tab.dataset.gallery === state.tab;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
  }

  function setTab(tab, { hash = true } = {}) {
    state.tab = tab === "emotes" ? "emotes" : "memes";
    if (hash && location.hash.replace(/^#/, "") !== state.tab) {
      history.replaceState(null, "", "#" + state.tab);
    }
    paintTabs();
    paint();
  }

  /* -------------------------------------------------------------- viewer */
  let lastFocused = null;

  function openViewer(id) {
    const item = items().find(entry => entry.id === id);
    if (!item) return;
    const viewer = $("#memesViewer");
    const art = $("#viewerArt");
    lastFocused = document.activeElement;
    $("#viewerTitle").textContent = item.title;
    $("#viewerCaption").textContent = item.caption || "";
    art.innerHTML = `<img src="./${esc(item.src)}" alt="${esc(item.title)}" decoding="async">`;
    viewer.hidden = false;
    document.body.style.overflow = "hidden";
    const close = $("[data-viewer-close]", viewer);
    if (close) close.focus();
  }

  function closeViewer() {
    const viewer = $("#memesViewer");
    if (!viewer || viewer.hidden) return;
    viewer.hidden = true;
    document.body.style.overflow = "";
    $("#viewerArt").innerHTML = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus({ preventScroll: true });
    lastFocused = null;
  }

  function wire() {
    document.querySelectorAll("[data-gallery]").forEach(tab => {
      tab.addEventListener("click", () => setTab(tab.dataset.gallery));
    });
    const search = $("#memesQuery");
    if (search) search.addEventListener("input", () => { state.query = search.value; paint(); });
    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tileNode = target.closest("[data-gallery-item]");
      if (tileNode) { openViewer(tileNode.dataset.galleryItem); return; }
      if (target.closest("[data-viewer-close]")) closeViewer();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeViewer();
    });
    window.addEventListener("hashchange", () => setTab(currentTab(), { hash: false }));
  }

  async function load() {
    try {
      const response = await fetch("./assets/data/memes.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`memes.json answered ${response.status}`);
      state.data = await response.json();
      state.status = "ready";
      state.tab = currentTab();
      paintTabs();
      paint();
    } catch (error) {
      state.status = "error";
      console.error("[PekkaDex] meme data failed to load:", error);
      const grid = $("#memesGrid");
      if (grid) grid.innerHTML = `<div class="pdx-empty"><b>The gallery could not load</b>
        <p class="pdx-note">The picture index is a static JSON file; reload the page to try again.</p></div>`;
      const status = $("#memesStatus");
      if (status) status.textContent = "";
    }
  }

  function start() {
    wire();
    paintTabs();
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
