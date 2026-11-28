/* PekkaDex homepage extras: feature banner, event news, pick of the day and
   scroll-in motion. Everything is progressive: with JavaScript off the page
   keeps its static hero, its first banner slide and the fallback event cards.

   Data comes from assets/data/events.json plus the existing catalogs, so no
   number, date or item is invented in this file. */
(() => {
  "use strict";
  if (window.__pdxHome) return;
  window.__pdxHome = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const reduceMotion = () => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; }
  };
  const fetchJSON = async url => {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(url + " returned " + response.status);
    return response.json();
  };

  /* ------------------------------------------------------------ banner */
  function setupBanner() {
    const banner = $("[data-banner]");
    if (!banner) return;
    const slides = $$("[data-slide]", banner);
    if (slides.length < 2) return;

    const dotsBox = $("[data-banner-dots]", banner);
    const nav = $("[data-banner-nav]", banner);
    const status = $("[data-banner-status]", banner);
    const labelOf = slide => {
      const heading = $("h2", slide);
      return heading ? heading.textContent.trim() : "Slide";
    };

    let index = 0;
    let timer = 0;
    const dots = slides.map((slide, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "banner__dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Show slide " + (i + 1) + " of " + slides.length + ": " + labelOf(slide));
      dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
      dot.addEventListener("click", () => { show(i, true); restart(); });
      dotsBox.append(dot);
      return dot;
    });
    if (nav) nav.hidden = false;

    function show(next, announce) {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === index;
        slide.hidden = !active;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", active ? "false" : "true");
      });
      dots.forEach((dot, i) => dot.setAttribute("aria-selected", i === index ? "true" : "false"));
      if (announce && status) status.textContent = "Slide " + (index + 1) + " of " + slides.length + ": " + labelOf(slides[index]);
    }

    const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
    const start = () => {
      if (timer || reduceMotion() || document.hidden) return;
      timer = window.setInterval(() => show(index + 1), 7000);
    };
    const restart = () => { stop(); start(); };

    banner.addEventListener("pointerenter", stop);
    banner.addEventListener("pointerleave", restart);
    banner.addEventListener("focusin", stop);
    banner.addEventListener("focusout", event => {
      if (!banner.contains(event.relatedTarget)) restart();
    });
    banner.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") { show(index - 1, true); restart(); }
      else if (event.key === "ArrowRight") { show(index + 1, true); restart(); }
    });
    const prev = $("[data-banner-prev]", banner);
    const next = $("[data-banner-next]", banner);
    if (prev) prev.addEventListener("click", () => { show(index - 1, true); restart(); });
    if (next) next.addEventListener("click", () => { show(index + 1, true); restart(); });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());

    show(0);
    start();
  }

  /* ------------------------------------------------------------- events */
  const EVENT_ICON = { update: "spark", roadmap: "gear", link: "arrow-right" };

  function renderEvents(data) {
    const grid = $("#eventGrid");
    if (!grid || !data || !Array.isArray(data.events)) return;
    const events = data.events
      .filter(event => event && event.title)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    if (!events.length) return;

    grid.innerHTML = events.map(event => {
      const icon = EVENT_ICON[event.kind] || "spark";
      let dateHTML = "";
      if (event.date) {
        const parsed = new Date(event.date + "T00:00:00Z");
        if (!Number.isNaN(parsed.getTime())) {
          const text = parsed.toLocaleDateString(undefined, {
            day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
          });
          dateHTML = ' · <time datetime="' + esc(event.date) + '">' + esc(text) + "</time>";
        }
      }
      const external = event.external ? ' target="_blank" rel="noopener noreferrer"' : "";
      const link = event.link
        ? '<a class="small-action" href="' + esc(event.link) + '"' + external + ">" +
          esc(event.linkLabel || "Read more") + (event.external ? " ↗" : "") + "</a>"
        : "";
      return '<article class="event-card">' +
        '<div class="event-symbol" aria-hidden="true"><svg class="pdx-ico" width="26" height="26" focusable="false">' +
        '<use href="./assets/icons/icons.svg#i-' + icon + '"></use></svg></div>' +
        "<div>" +
        '<span class="event-kicker">' + esc(event.badge || (event.kind === "link" ? "Official" : "Update")) + dateHTML + "</span>" +
        "<h3>" + esc(event.title) + "</h3>" +
        "<p>" + esc(event.body || "") + "</p>" +
        link +
        "</div></article>";
    }).join("");
  }

  function setupEvents() {
    if (!$("#eventGrid")) return;
    fetchJSON("./assets/data/events.json").then(renderEvents).catch(error => {
      /* The static cards in index.html stay in place; only log for a developer. */
      try { console.warn("[PekkaDex] events.json unavailable:", error.message); } catch (_) {}
    });
  }

  /* ---------------------------------------------------------- daily pick */
  const HERO_NAMES = {
    "barbarian-king": "Barbarian King",
    "archer-queen": "Archer Queen",
    "grand-warden": "Grand Warden",
    "royal-champion": "Royal Champion",
    "minion-prince": "Minion Prince",
    "dragon-duke": "Dragon Duke"
  };

  const dayKey = () => new Date().toISOString().slice(0, 10);
  const dayIndex = (key, length) => {
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
    return hash % length;
  };

  function pickMarkup(item) {
    const media = $("[data-pick-media]");
    const title = $("[data-pick-title]");
    const text = $("[data-pick-text]");
    const date = $("[data-pick-date]");
    const link = $("[data-pick-link]");
    if (!media || !title) return;

    media.innerHTML = '<img src="' + esc(item.art) + '" alt="' + esc(item.name + " " + item.kindLabel) +
      '" width="360" height="240" loading="lazy" decoding="async">';
    title.textContent = item.name;
    if (date) date.textContent = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    if (text) text.textContent = item.kind === "scenery"
      ? "A scenery from the PekkaDex archive, with the in-game screenshot on file. Open the encyclopedia for the full gallery."
      : item.kind === "pet"
        ? "A hero pet from the PekkaDex archive. Open the Pets tab for the full list and pairings."
        : "A " + (HERO_NAMES[item.hero] || "hero") + " skin from the PekkaDex archive. Open the cosmetics tab for the full set.";
    if (link) {
      link.href = item.kind === "pet" ? "./heroes.html#pets"
        : item.kind === "scenery" ? "./heroes.html#cosmetics/sceneries"
          : "./heroes.html#cosmetics/skins";
    }
  }

  async function setupPick() {
    if (!$("[data-pick]")) return;
    try {
      const [skins, sceneries, pets] = await Promise.all([
        fetchJSON("./assets/data/skins.json"),
        fetchJSON("./assets/data/sceneries.json"),
        fetchJSON("./assets/data/pets.json")
      ]);
      const pool = []
        .concat((skins.skins || []).filter(item => item.art).map(item => ({ name: item.name, art: item.art, hero: item.hero, kind: "skin", kindLabel: "skin" })))
        .concat((sceneries.sceneries || []).filter(item => item.art).map(item => ({ name: item.name, art: item.art, kind: "scenery", kindLabel: "scenery" })))
        .concat((pets.pets || []).filter(item => item.art).map(item => ({ name: item.name, art: item.art, kind: "pet", kindLabel: "pet" })));
      if (!pool.length) return;
      pickMarkup(pool[dayIndex(dayKey(), pool.length)]);
    } catch (error) {
      try { console.warn("[PekkaDex] pick of the day unavailable:", error.message); } catch (_) {}
    }
  }

  /* ------------------------------------------------------------- motion */
  function setupReveal() {
    if (reduceMotion() || !("IntersectionObserver" in window)) return;
    const sections = $$("main > section").filter(section =>
      !section.classList.contains("hero") &&
      !section.classList.contains("quick-stats") &&
      !section.classList.contains("banner") &&
      !section.classList.contains("quick-tiles") &&
      !section.classList.contains("pick-section"));
    if (!sections.length) return;
    sections.forEach(section => section.classList.add("reveal"));
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    sections.forEach(section => io.observe(section));
  }

  function start() {
    setupBanner();
    setupEvents();
    setupPick();
    setupReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
