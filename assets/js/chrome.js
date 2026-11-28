/* PekkaDex — shared page chrome.

   Every page carries the same static header markup (.site-header); this script
   adds the one full-screen menu drawer and one bottom tab bar, then keeps the
   current page marked. It replaces the two older menus (the homepage's
   .main-nav dropdown and the per-page .cx-tabbar copy in each HTML file), so
   there is a single navigation to maintain and no link that points at a page
   that has not been built yet.

   No data is fetched here. */
(() => {
  "use strict";
  if (window.__pdxChrome) return;
  window.__pdxChrome = true;

  const SPRITE = "./assets/icons/icons.svg";

  /* The full 13-destination menu. Every href points at a page or section that
     exists in this repo, so the drawer never contains a dead link. */
  const MENU = [
    { href: "./index.html", icon: "home", label: "Home", note: "The kingdom overview" },
    { href: "./index.html#player-finder", icon: "search", label: "Players", note: "Find a player or clan" },
    { href: "./bases.html", icon: "bases", label: "Base Library", note: "Layouts with copy links" },
    { href: "./armies.html", icon: "attack", label: "Attack Academy", note: "Armies and attack plans" },
    { href: "./attack-guides.html", icon: "spark", label: "Attack Guides", note: "Queen Walk and attack school" },
    { href: "./planner.html", icon: "bases", label: "Attack Planner", note: "Draw the base, read the plan" },
    { href: "./heroes.html", icon: "heroes", label: "Encyclopedia", note: "Heroes, gear, skins, pets" },
    { href: "./heroes.html#heroes", icon: "heroes", label: "Heroes", note: "The six-hero roster" },
    { href: "./heroes.html#equipment", icon: "gear", label: "Equipment", note: "Gear, levels and loadouts" },
    { href: "./troops.html", icon: "attack", label: "Troops", note: "Troops and Super Troops" },
    { href: "./memes.html", icon: "palette", label: "Memes & Emotes", note: "The community gallery" },
    { href: "./upgrades.html", icon: "gear", label: "Village Tools", note: "Time to max and tracker" },
    { href: "./profile.html", icon: "user", label: "Profile", note: "Your saved player tag" },
  ];

  const TABS = [
    { href: "./index.html", icon: "home", label: "Home", page: "home" },
    { href: "./index.html#player-finder", icon: "players", label: "Players", page: "players" },
    { href: "./bases.html", icon: "bases", label: "Bases", page: "bases" },
    { href: "./armies.html", icon: "attack", label: "Attack", page: "attacks" },
    { href: "./heroes.html", icon: "heroes", label: "Heroes", page: "heroes" },
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const icon = name => `<svg class="pdx-ico" aria-hidden="true" focusable="false"><use href="${SPRITE}#i-${name}"></use></svg>`;

  /* Which tab is "on": the page's own data-page wins, otherwise the file name. */
  function currentPage() {
    if (document.body.dataset.page) return document.body.dataset.page;
    const file = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
    if (file === "bases") return "bases";
    if (file === "armies") return "attacks";
    if (file === "attack-guides") return "guides";
    if (file === "heroes") return "heroes";
    if (file === "upgrades") return "tools";
    return file === "index" ? "home" : file;
  }

  /* ------------------------------------------------------------- drawer */
  function buildDrawer() {
    const page = currentPage();
    const drawer = document.createElement("div");
    drawer.className = "pdx-drawer";
    drawer.id = "pdxDrawer";
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "pdxDrawerTitle");
    drawer.innerHTML = `
      <div class="pdx-drawer__bar">
        <h2 class="pdx-drawer__title" id="pdxDrawerTitle">MENU</h2>
        <button class="pdx-btn pdx-btn--wood pdx-btn--icon" type="button" data-drawer-close aria-label="Close menu">
          ${icon("close")}
        </button>
      </div>
      <ul class="pdx-drawer__list">
        ${MENU.map(item => `
          <li>
            <a class="pdx-drawer__link" href="${item.href}"
               ${isCurrent(item.href, page) ? 'aria-current="page"' : ""}>
              ${icon(item.icon)}
              <span>${item.label}<small>${item.note}</small></span>
            </a>
          </li>`).join("")}
      </ul>`;
    document.body.appendChild(drawer);
    return drawer;
  }

  function isCurrent(href, page) {
    if (page === "home") return href === "./index.html";
    if (page === "bases") return href === "./bases.html";
    if (page === "attacks") return href === "./armies.html";
    if (page === "guides") return href === "./attack-guides.html";
    if (page === "planner") return href === "./planner.html";
    if (page === "heroes") return href === "./heroes.html";
    if (page === "troops") return href === "./troops.html";
    if (page === "memes") return href === "./memes.html";
    if (page === "tools") return href === "./upgrades.html";
    if (page === "profile") return href === "./profile.html";
    return false;
  }

  let drawer = null;
  let opener = null;

  function openDrawer(trigger) {
    drawer = drawer || buildDrawer();
    opener = trigger || document.activeElement;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    const menuButton = $("#pdxMenuBtn");
    if (menuButton) menuButton.setAttribute("aria-expanded", "true");
    const button = $("[data-drawer-close]", drawer);
    if (button) button.focus();
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    document.body.style.overflow = "";
    const menuButton = $("#pdxMenuBtn");
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    if (opener && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    opener = null;
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !drawer || drawer.hidden) return;
    const focusable = Array.from(drawer.querySelectorAll('a[href], button:not([disabled])'))
      .filter(node => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------ tab bar */
  function buildTabbar() {
    if ($(".cx-tabbar")) return;
    const page = currentPage();
    const nav = document.createElement("nav");
    nav.className = "cx-tabbar";
    nav.setAttribute("aria-label", "Quick navigation");
    nav.innerHTML = TABS.map(tab => `
      <a href="${tab.href}"${tab.page === page ? ' class="on" aria-current="page"' : ""}>
        <img class="tab-ico" src="./assets/icons/nav-${tab.icon}.png" alt="" width="28" height="28" decoding="async">
        <span>${tab.label}</span>
      </a>`).join("") +
      `<button type="button" data-drawer-open aria-label="Open the full menu">
         <span class="more-ico" aria-hidden="true">☰</span><span>More</span>
       </button>`;
    document.body.appendChild(nav);
  }

  /* --------------------------------------------------------------- wire */
  function wire() {
    const menuButton = $("#pdxMenuBtn");
    if (menuButton) {
      menuButton.addEventListener("click", () => {
        if (drawer && !drawer.hidden) closeDrawer();
        else openDrawer(menuButton);
      });
    }
    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-drawer-open]")) { openDrawer(target.closest("[data-drawer-open]")); return; }
      if (target.closest("[data-drawer-close]")) { closeDrawer(); return; }
      if (drawer && !drawer.hidden && target === drawer) { closeDrawer(); return; }
      const link = target.closest(".pdx-drawer__link");
      if (link) closeDrawer();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && drawer && !drawer.hidden) { closeDrawer(); return; }
      trapFocus(event);
    });
    /* A hash click on the same page should close the drawer too, without
       waiting for a hashchange that never fires. */
    window.addEventListener("hashchange", closeDrawer);
    /* Mark the tab that matches the current page, including on home where the
       URL has no hash. */
    const page = currentPage();
    Array.from(document.querySelectorAll(".cx-tabbar a")).forEach(link => {
      const label = (link.textContent || "").trim().toLowerCase();
      const match = TABS.find(tab => tab.page === page && label === tab.label.toLowerCase());
      if (match) { link.classList.add("on"); link.setAttribute("aria-current", "page"); }
    });
  }

  function start() {
    buildTabbar();
    wire();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
