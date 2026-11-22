
/* =========================================
   CLASHVAULT - MAIN APP.JS
   UPGRADED KINGDOM EDITION
   ========================================= */

(() => {
  "use strict";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  /* =========================================
     INITIALIZATION
     ========================================= */

  function initializeClashVault() {
    if (window.clashVaultInitialized) return;
    window.clashVaultInitialized = true;

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
      }, 2800);
    }

    /* =========================================
       MODAL
       ========================================= */

    function openModal(title, message) {
      const modal = $("#modalBackdrop");
      if (!modal) return;

      $("#modalTitle").textContent = title;
      $("#modalText").textContent = message;

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

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

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

    function closeNavigation() {
      mainNav?.classList.remove("open");

      if (mobileMenu) {
        mobileMenu.textContent = "☰";
        mobileMenu.setAttribute("aria-expanded", "false");
      }
    }

    mobileMenu?.addEventListener("click", () => {
      if (!mainNav) return;

      const opened = mainNav.classList.toggle("open");

      mobileMenu.textContent = opened ? "×" : "☰";
      mobileMenu.setAttribute("aria-expanded", String(opened));
    });

    $$(".main-nav a").forEach((link) => {
      link.addEventListener("click", closeNavigation);
    });

    /* =========================================
       ACTIVE NAVIGATION
       ========================================= */

    const navLinks = $$(".main-nav a");

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          navLinks.forEach((link) => {
            link.classList.toggle(
              "active",
              link.getAttribute("href") === `#${entry.target.id}`
            );
          });
        });
      }, {
        threshold: 0.15
      });

      $$("main section[id]").forEach((section) => {
        observer.observe(section);
      });
    }

    /* =========================================
       BASE LIBRARY FILTERS
       ========================================= */

    const baseFilters = $("#baseFilters");

    baseFilters?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;

      $$(".filter-chip", baseFilters).forEach((chip) => {
        chip.classList.toggle("selected", chip === button);
      });

      const filter = button.dataset.filter;

      $$(".base-card").forEach((card) => {
        card.hidden =
          filter !== "All" &&
          card.dataset.type !== filter;
      });
    });

    /* =========================================
       PLAYER FINDER
       ========================================= */

    const playerForm = $("#playerSearchForm");

    playerForm?.addEventListener("submit", (event) => {
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
          message.textContent = "Please enter a player tag.";
        }

        input.focus();
        return;
      }

      if (!/^[0289PYLQGRJCUV]{3,15}$/.test(tag)) {
        if (message) {
          message.textContent =
            "Invalid player tag. Please check the characters.";
        }

        input.focus();
        return;
      }

      if (message) {
        message.textContent =
          "Player tag format checked successfully.";
      }

      if (result) {
        result.hidden = false;
        result.textContent =
          `Player tag #${tag} is valid in format. ` +
          "Live profile information requires the official Clash of Clans API backend.";
      }

      toast("Player tag format verified.");
    });

    /* =========================================
       BUILDER TRACKER
       ========================================= */

    const STORAGE_KEY = "clashvault-upgrades-v1";
    const OLD_STORAGE_KEY = "clashdex-upgrades-v1";

    const BUILDERS = [
      "Builder 1",
      "Builder 2",
      "Builder 3",
      "Builder 4",
      "Builder 5",
      "Builder 6"
    ];

    let upgrades = [];

    function createId() {
      return window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

    function loadUpgrades() {
      try {
        let saved = localStorage.getItem(STORAGE_KEY);

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
        console.error("Tracker loading error:", error);
        upgrades = [];
        toast("Could not load saved tracker data.");
      }
    }

    function saveUpgrades() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(upgrades)
        );

        return true;
      } catch (error) {
        console.error("Tracker saving error:", error);
        toast("Unable to save tracker data.");
        return false;
      }
    }

    function formatRemaining(milliseconds) {
      if (milliseconds <= 0) return "READY!";

      const seconds = Math.floor(milliseconds / 1000);

      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      if (days) return `${days}d ${hours}h ${minutes}m`;

      return `${hours.toString().padStart(2, "0")}:` +
        `${minutes.toString().padStart(2, "0")}:` +
        `${secs.toString().padStart(2, "0")}`;
    }

    function getBuilderUpgrade(builder) {
      return upgrades.find((item) =>
        item.builder === builder &&
        Number(item.endAt) > Date.now()
      );
    }

    function getBuilderStatus(builder) {
      const upgrade = getBuilderUpgrade(builder);

      if (upgrade) return "busy";

      return "available";
    }

    /* =========================================
       BUILDER CARD GENERATOR
       ========================================= */

    function renderBuilderCards() {
      const tracker = $(".tracker-panel");
      if (!tracker) return;

      let container = $("#builderCards");

      if (!container) {
        container = document.createElement("div");
        container.id = "builderCards";
        container.className = "builder-cards";

        const form = $("#upgradeForm");

        if (form) {
          form.insertAdjacentElement("afterend", container);
        } else {
          tracker.appendChild(container);
        }
      }

      const now = Date.now();

      container.innerHTML = BUILDERS.map((builder) => {
        const upgrade = getBuilderUpgrade(builder);

        if (!upgrade) {
          return `
            <article class="builder-card builder-available">
              <div class="builder-card-top">
                <span class="builder-avatar">🛠️</span>
                <span class="builder-status available">
                  AVAILABLE
                </span>
              </div>

              <h4>${builder}</h4>
              <p>No active upgrade</p>

              <div class="builder-progress-track">
                <div class="builder-progress-fill"
                     style="width:0%"></div>
              </div>

              <small>Ready for a new task</small>
            </article>
          `;
        }

        const remaining = Math.max(
          0,
          Number(upgrade.endAt) - now
        );

        const total = Math.max(
          1,
          Number(upgrade.durationMs) ||
          (Number(upgrade.endAt) - Number(upgrade.startAt || now))
        );

        const elapsed = Math.max(0, total - remaining);

        const progress = Math.min(
          100,
          Math.max(0, (elapsed / total) * 100)
        );

        return `
          <article class="builder-card builder-busy">
            <div class="builder-card-top">
              <span class="builder-avatar">🔨</span>
              <span class="builder-status busy">
                WORKING
              </span>
            </div>

            <h4>${builder}</h4>
            <p class="builder-upgrade-name">
              ${escapeHTML(upgrade.name)}
            </p>

            <div class="builder-progress-track">
              <div class="builder-progress-fill"
                   style="width:${progress.toFixed(2)}%">
              </div>
            </div>

            <div class="builder-progress-label">
              <span>${progress.toFixed(0)}% complete</span>
              <strong>${formatRemaining(remaining)}</strong>
            </div>
          </article>
        `;
      }).join("");
    }

    /* =========================================
       UPGRADE LIST
       ========================================= */

    function renderUpgrades() {
      const list = $("#upgradeList");
      const activeCount = $("#activeCount");
      const summary = $("#builderSummary");

      const now = Date.now();

      const active = upgrades.filter(
        (item) => Number(item.endAt) > now
      ).length;

      const completed = upgrades.length - active;

      if (activeCount) {
        activeCount.textContent = active;
      }

      if (summary) {
        summary.textContent = upgrades.length
          ? `${active} active upgrade${active === 1 ? "" : "s"} · ${completed} completed`
          : "No upgrades tracked yet. Add your first upgrade.";
      }

      if (list) {
        if (!upgrades.length) {
          list.innerHTML = `
            <div class="empty-state">
              🛠️
              <strong>Your builders are ready.</strong>
              <span>Add an upgrade above to start a countdown.</span>
            </div>
          `;
        } else {
          list.innerHTML = upgrades.map((item) => {
            const remaining = Number(item.endAt) - now;
            const done = remaining <= 0;

            return `
              <div class="upgrade-item">
                <div>
                  <strong>${escapeHTML(item.name)}</strong>
                  <small>
                    ${escapeHTML(item.builder || "Builder")}
                    · ${done ? "Ready to collect" : "Upgrade in progress"}
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
      }

      renderBuilderCards();
    }

    /* =========================================
       ADD UPGRADE
       ========================================= */

    $("#upgradeForm")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const nameInput = $("#upgradeName");
      const hoursInput = $("#upgradeHours");
      const builderSelect = $("#builderSelect");

      if (!nameInput || !hoursInput) return;

      const name = nameInput.value.trim();
      const hours = Number(hoursInput.value);
      const builder = builderSelect?.value || "Builder 1";

      if (!name) {
        toast("Enter an upgrade name.");
        nameInput.focus();
        return;
      }

      if (
        !Number.isFinite(hours) ||
        hours <= 0 ||
        hours > 1000
      ) {
        toast("Enter a valid duration between 0.1 and 1000 hours.");
        hoursInput.focus();
        return;
      }

      if (getBuilderUpgrade(builder)) {
        toast(`${builder} already has an active upgrade.`);
        return;
      }

      const durationMs = hours * 60 * 60 * 1000;
      const startAt = Date.now();

      upgrades.push({
        id: createId(),
        name,
        builder,
        startAt,
        durationMs,
        endAt: startAt + durationMs
      });

      if (!saveUpgrades()) {
        upgrades.pop();
        return;
      }

      renderUpgrades();

      nameInput.value = "";

      toast(`${builder} started a new upgrade!`);
    });

    /* =========================================
       REMOVE / COLLECT UPGRADE
       ========================================= */

    $("#upgradeList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;

      const id = button.dataset.remove;

      const item = upgrades.find(
        (upgrade) => String(upgrade.id) === String(id)
      );

      if (!item) return;

      const done = Number(item.endAt) <= Date.now();

      upgrades = upgrades.filter(
        (upgrade) => String(upgrade.id) !== String(id)
      );

      if (!saveUpgrades()) {
        upgrades.push(item);
        return;
      }

      renderUpgrades();

      toast(
        done
          ? "Upgrade collected! Builder is available."
          : "Upgrade removed from tracker."
      );
    });

    loadUpgrades();
    renderUpgrades();

    /* =========================================
       LIVE COUNTDOWN
       ========================================= */

    setInterval(() => {
      renderUpgrades();
    }, 1000);

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
      ) return;

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
      const announcement = $("#announcementText");

      if (announcement) {
        announcement.textContent =
          labelMode === "auto"
            ? `Seasonal theme: ${label} · Automatic calendar theme.`
            : `Theme preview: ${label} · Change theme using the moon button.`;
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

        themeButton.title = `Current theme: ${label}`;
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
          : `${themeLabels[theme]} enabled.`
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
       DETAIL BUTTONS
       ========================================= */

    $$("[data-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        openModal(
          button.dataset.detail,
          "This is starter content. Verified base layouts, screenshots, in-game links, ratings, army compositions and creator video guides can be connected as those features are implemented."
        );
      });
    });

    /* =========================================
       ONLINE / OFFLINE STATUS
       ========================================= */

    window.addEventListener("online", () => {
      toast("Connection restored!");
    });

    window.addEventListener("offline", () => {
      toast("You are offline. Local tracker remains available.");
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
          console.error("Service Worker error:", error);
        }
      });
    }

    console.log("⚔️ ClashVault initialized successfully!");
  }

  /* =========================================
     START APP
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

})();
