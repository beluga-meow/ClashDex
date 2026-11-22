
/* =========================================
   CLASHVAULT - MAIN APP.JS
   ========================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

/* =========================================
   INITIALIZATION
   ========================================= */

function initializeClashVault() {
  /* =========================================
     TOAST NOTIFICATIONS
     ========================================= */

  function toast(message) {
    const el = $("#toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }

  /* =========================================
     MODAL
     ========================================= */

  function openModal(title, message) {
    const modal = $("#modalBackdrop");
    if (!modal) return;

    const modalTitle = $("#modalTitle");
    const modalText = $("#modalText");

    if (modalTitle) modalTitle.textContent = title;
    if (modalText) modalText.textContent = message;

    modal.hidden = false;
  }

  function closeModal() {
    const modal = $("#modalBackdrop");
    if (modal) modal.hidden = true;
  }

  $("#modalClose")?.addEventListener("click", closeModal);
  $("#modalOk")?.addEventListener("click", closeModal);

  $("#modalBackdrop")?.addEventListener("click", (event) => {
    if (event.target === $("#modalBackdrop")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  /* =========================================
     FOOTER YEAR
     ========================================= */

  const yearElement = $("#year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  /* =========================================
     ANNOUNCEMENT
     ========================================= */

  $("#closeAnnouncement")?.addEventListener("click", () => {
    $("#announcement")?.remove();
  });

  /* =========================================
     MOBILE NAVIGATION
     ========================================= */

  const mobileMenu = $("#mobileMenu");
  const mainNav = $("#mainNav");

  mobileMenu?.addEventListener("click", () => {
    if (!mainNav) return;

    const isOpen = mainNav.classList.toggle("open");

    mobileMenu.textContent = isOpen ? "×" : "☰";
    mobileMenu.setAttribute("aria-expanded", String(isOpen));
  });

  $$(".main-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav?.classList.remove("open");

      if (mobileMenu) {
        mobileMenu.textContent = "☰";
        mobileMenu.setAttribute("aria-expanded", "false");
      }
    });
  });

  /* =========================================
     BASE LIBRARY FILTERS
     ========================================= */

  const baseFilters = $("#baseFilters");

  baseFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    $$(".filter-chip").forEach((chip) => {
      chip.classList.toggle("selected", chip === button);
    });

    const selectedFilter = button.dataset.filter;

    $$(".base-card").forEach((card) => {
      const matches =
        selectedFilter === "All" ||
        card.dataset.type === selectedFilter;

      card.hidden = !matches;
    });
  });

  /* =========================================
     PLAYER FINDER
     ========================================= */

  const playerSearchForm = $("#playerSearchForm");

  playerSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#playerTag");
    const message = $("#playerSearchMessage");
    const result = $("#playerResult");

    if (!input) return;

    const tag = input.value
      .trim()
      .replace(/^#/, "")
      .toUpperCase();

    if (result) result.hidden = true;

    if (!tag) {
      if (message) {
        message.textContent = "Please enter a player tag first.";
      }

      input.focus();
      return;
    }

    if (!/^[0289PYLQGRJCUV]{3,15}$/.test(tag)) {
      if (message) {
        message.textContent =
          "That tag format doesn't look right. Check the characters and try again.";
      }

      return;
    }

    if (result) {
      result.hidden = false;
      result.textContent =
        `Player tag #${tag} passed the format check. ` +
        "Live player details will appear here once the secure official API backend is connected.";
    }

    if (message) {
      message.textContent = "Player tag format checked successfully.";
    }
  });

  /* =========================================
     BUILDER TRACKER
     ========================================= */

  const STORAGE_KEY = "clashvault-upgrades-v1";
  const OLD_STORAGE_KEY = "clashdex-upgrades-v1";

  let upgrades = [];

  function loadUpgrades() {
    try {
      let saved = localStorage.getItem(STORAGE_KEY);

      // Preserve data from the previous ClashDex version.
      if (saved === null) {
        saved = localStorage.getItem(OLD_STORAGE_KEY);

        if (saved !== null) {
          localStorage.setItem(STORAGE_KEY, saved);
        }
      }

      const parsed = JSON.parse(saved || "[]");

      upgrades = Array.isArray(parsed)
        ? parsed.filter((item) =>
            item &&
            typeof item.name === "string" &&
            Number.isFinite(Number(item.endAt))
          )
        : [];

    } catch (error) {
      console.error("Could not load tracker data:", error);
      upgrades = [];
    }
  }

  function saveUpgrades() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(upgrades)
      );

    } catch (error) {
      console.error("Could not save upgrades:", error);
      toast("Unable to save tracker data on this device.");
    }
  }

  function formatRemaining(milliseconds) {
    if (milliseconds <= 0) return "Completed";

    const totalSeconds = Math.floor(milliseconds / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days) return `${days}d ${hours}h ${minutes}m`;
    if (hours) return `${hours}h ${minutes}m`;

    return `${minutes}m`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function createId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function renderUpgrades() {
    const list = $("#upgradeList");
    const activeCount = $("#activeCount");
    const summary = $("#builderSummary");

    if (!list) return;

    const active = upgrades.filter(
      (item) => Number(item.endAt) > Date.now()
    ).length;

    if (activeCount) {
      activeCount.textContent = active;
    }

    if (summary) {
      summary.textContent = upgrades.length
        ? `${active} active upgrade${active === 1 ? "" : "s"} · ${upgrades.length - active} completed`
        : "No upgrades tracked yet. Add your first upgrade.";
    }

    if (!upgrades.length) {
      list.innerHTML = `
        <div class="empty-state">
          🛠️
          <strong>Your builders are ready.</strong>
          <span>Add an upgrade above to start a countdown.</span>
        </div>
      `;

      return;
    }

    list.innerHTML = upgrades.map((item) => {
      const remaining = Number(item.endAt) - Date.now();
      const done = remaining <= 0;

      return `
        <div class="upgrade-item">
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <small>
              ${escapeHTML(item.builder || "Builder")} ·
              ${done ? "Ready to collect" : "Upgrade in progress"}
            </small>
          </div>

          <div class="upgrade-time">
            ${formatRemaining(remaining)}
          </div>

          <button
            class="remove-upgrade"
            data-remove="${escapeHTML(item.id)}"
            aria-label="Remove ${escapeHTML(item.name)}"
          >
            ${done ? "Collect ✓" : "Remove ×"}
          </button>
        </div>
      `;
    }).join("");
  }

  const upgradeForm = $("#upgradeForm");

  upgradeForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const nameInput = $("#upgradeName");
    const hoursInput = $("#upgradeHours");
    const builderSelect = $("#builderSelect");

    if (!nameInput || !hoursInput) return;

    const name = nameInput.value.trim();
    const hours = Number(hoursInput.value);

    if (!name) {
      toast("Please enter an upgrade name.");
      nameInput.focus();
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      toast("Please enter a valid upgrade duration.");
      hoursInput.focus();
      return;
    }

    upgrades.push({
      id: createId(),
      name,
      builder: builderSelect?.value || "Builder",
      endAt: Date.now() + hours * 60 * 60 * 1000
    });

    saveUpgrades();
    renderUpgrades();

    nameInput.value = "";

    toast("Upgrade added to your village tracker!");
  });

  $("#upgradeList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;

    const id = button.dataset.remove;

    upgrades = upgrades.filter(
      (item) => String(item.id) !== String(id)
    );

    saveUpgrades();
    renderUpgrades();

    toast("Tracker entry removed.");
  });

  loadUpgrades();
  renderUpgrades();

  setInterval(renderUpgrades, 30000);

  /* =========================================
     SEASONAL THEME ENGINE
     ========================================= */

  const themes = [
    "auto",
    "default",
    "christmas",
    "halloween",
    "lunar",
    "summer"
  ];

  const themeLabels = {
    default: "Classic Kingdom",
    christmas: "Winter Festival",
    halloween: "Haunted Kingdom",
    lunar: "Lunar Celebration",
    summer: "Summer Kingdom"
  };

  let themeIndex = 0;

  function automaticTheme(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (month === 12 || (month === 1 && day <= 7)) {
      return "christmas";
    }

    if (month === 10) {
      return "halloween";
    }

    if ((month === 1 && day >= 20) || month === 2) {
      return "lunar";
    }

    if (month >= 6 && month <= 8) {
      return "summer";
    }

    return "default";
  }

  function makeParticles(theme) {
    const host = $("#seasonEffects");
    if (!host) return;

    host.innerHTML = "";

    const symbols = {
      christmas: ["❄", "✦", "❅"],
      halloween: ["🦇", "✦", "·"],
      lunar: ["✦", "✧", "🏮"],
      summer: ["✦", "☀", "·"]
    };

    const choices = symbols[theme] || [];

    if (
      !choices.length ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const count = theme === "halloween" ? 13 : 24;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");

      particle.className = "season-particle";

      particle.textContent =
        choices[Math.floor(Math.random() * choices.length)];

      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${7 + Math.random() * 10}s`;
      particle.style.animationDelay = `${-Math.random() * 12}s`;
      particle.style.fontSize = `${10 + Math.random() * 12}px`;

      host.appendChild(particle);
    }
  }

  function applyTheme(theme, labelMode = "auto") {
    document.body.classList.remove(
      "theme-christmas",
      "theme-halloween",
      "theme-lunar",
      "theme-summer"
    );

    const resolved =
      theme === "auto" ? automaticTheme() : theme;

    if (resolved !== "default") {
      document.body.classList.add(`theme-${resolved}`);
    }

    makeParticles(resolved);

    const label = themeLabels[resolved] || "Classic Kingdom";
    const announcementText = $("#announcementText");

    if (announcementText) {
      announcementText.textContent =
        labelMode === "auto"
          ? `Seasonal theme: ${label} · Theme changes automatically with the calendar.`
          : `Theme preview: ${label} · Tap the moon button to cycle themes.`;
    }

    const themeButton = $("#themeButton");

    if (themeButton) {
      themeButton.textContent = ({
        christmas: "❄️",
        halloween: "🎃",
        lunar: "🏮",
        summer: "☀️",
        default: "🌙"
      })[resolved];

      themeButton.title =
        `Current theme: ${label}. Click to change.`;
    }
  }

  function cycleTheme() {
    themeIndex = (themeIndex + 1) % themes.length;

    const theme = themes[themeIndex];

    applyTheme(
      theme,
      theme === "auto" ? "auto" : "preview"
    );

    toast(
      theme === "auto"
        ? "Automatic seasonal theme enabled."
        : `${themeLabels[theme] || "Classic Kingdom"} preview enabled.`
    );
  }

  $("#themeButton")?.addEventListener("click", cycleTheme);

  $("#previewSeason")?.addEventListener("click", () => {
    const current = automaticTheme();
    const next = current === "default" ? "christmas" : current;

    themeIndex = themes.indexOf(next);

    applyTheme(next, "preview");

    toast(`${themeLabels[next]} preview enabled.`);
  });

  applyTheme("auto");

  /* =========================================
     INFORMATIONAL DETAIL BUTTONS
     ========================================= */

  $$("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(
        button.dataset.detail,
        "This is starter content. ClashVault can connect verified base layouts, screenshots, in-game links, ratings, army compositions and creator video guides as those features are implemented."
      );
    });
  });

  /* =========================================
     SERVICE WORKER
     ========================================= */

  if (
    "serviceWorker" in navigator &&
    (
      location.protocol === "https:" ||
      location.hostname === "localhost"
    )
  ) {
    window.addEventListener("load", async () => {
      try {
        const registration =
          await navigator.serviceWorker.register("./service-worker.js");

        console.log(
          "ClashVault Service Worker registered:",
          registration.scope
        );

      } catch (error) {
        console.error(
          "ClashVault Service Worker registration failed:",
          error
        );
      }
    });
  }

  console.log("ClashVault app initialized successfully.");
}

/* =========================================
   START APP WHEN HTML IS READY
   ========================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeClashVault,
    { once: true }
  );
} else {
  initializeClashVault();
}
