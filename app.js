
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const toast = (message) => {
  const el = $("#toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
};

function openModal(title, message) {
  $("#modalTitle").textContent = title;
  $("#modalText").textContent = message;
  $("#modalBackdrop").hidden = false;
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
}

$("#modalClose").addEventListener("click", closeModal);
$("#modalOk").addEventListener("click", closeModal);

$("#modalBackdrop").addEventListener("click", (e) => {
  if (e.target === $("#modalBackdrop")) closeModal();
});

$("#year").textContent = new Date().getFullYear();

$("#closeAnnouncement").addEventListener("click", () => {
  $("#announcement").remove();
});

$("#mobileMenu").addEventListener("click", () => {
  $("#mainNav").classList.toggle("open");
  $("#mobileMenu").textContent =
    $("#mainNav").classList.contains("open") ? "×" : "☰";
});

$$(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    $("#mainNav").classList.remove("open");
    $("#mobileMenu").textContent = "☰";
  });
});

// BASE LIBRARY FILTERS
$("#baseFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  $$(".filter-chip").forEach((chip) => {
    chip.classList.toggle("selected", chip === button);
  });

  $$(".base-card").forEach((card) => {
    card.hidden =
      button.dataset.filter !== "All" &&
      card.dataset.type !== button.dataset.filter;
  });
});

// PLAYER FINDER
$("#playerSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const input = $("#playerTag");
  const tag = input.value.trim().replace(/^#/, "").toUpperCase();
  const result = $("#playerResult");

  if (!tag) {
    $("#playerSearchMessage").textContent =
      "Please enter a player tag first.";
    input.focus();
    return;
  }

  if (!/^[0289PYLQGRJCUV]{3,15}$/.test(tag)) {
    $("#playerSearchMessage").textContent =
      "That tag format doesn't look right. Check the characters and try again.";
    result.hidden = true;
    return;
  }

  result.hidden = false;
  result.textContent =
    `Tag #${tag} looks valid. Live player details are not connected yet. A secure official API backend is required to retrieve the real profile.`;

  $("#playerSearchMessage").textContent =
    "Tag checked successfully.";
});

// BUILDER TRACKER
const STORAGE_KEY = "clashdex-upgrades-v1";

let upgrades = [];

try {
  upgrades = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

  if (!Array.isArray(upgrades)) upgrades = [];
} catch {
  upgrades = [];
}

function saveUpgrades() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(upgrades));
  } catch (error) {
    console.error("Could not save upgrades:", error);
    toast("Unable to save tracker data on this device.");
  }
}

function formatRemaining(ms) {
  if (ms <= 0) return "Completed";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;

  return `${minutes}m`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderUpgrades() {
  const list = $("#upgradeList");

  const active = upgrades.filter(
    (item) => Number(item.endAt) > Date.now()
  ).length;

  $("#activeCount").textContent = active;

  $("#builderSummary").textContent = upgrades.length
    ? `${active} active upgrade${active === 1 ? "" : "s"} · ${upgrades.length - active} completed`
    : "No upgrades tracked yet. Add your first upgrade.";

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
            ${escapeHTML(item.builder)} ·
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

$("#upgradeForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("#upgradeName").value.trim();
  const hours = Number($("#upgradeHours").value);

  if (!name || !Number.isFinite(hours) || hours <= 0) return;

  upgrades.push({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now() + Math.random()),

    name,
    builder: $("#builderSelect").value,
    endAt: Date.now() + hours * 60 * 60 * 1000
  });

  saveUpgrades();
  renderUpgrades();

  $("#upgradeName").value = "";

  toast("Upgrade added to your village tracker!");
});

$("#upgradeList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  upgrades = upgrades.filter(
    (item) => item.id !== button.dataset.remove
  );

  saveUpgrades();
  renderUpgrades();

  toast("Tracker entry removed.");
});

renderUpgrades();
setInterval(renderUpgrades, 30000);

// SEASONAL THEME ENGINE
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

  if (month === 10) return "halloween";

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

  $("#announcementText").textContent =
    labelMode === "auto"
      ? `Seasonal theme: ${label} · Theme changes automatically with the calendar.`
      : `Theme preview: ${label} · Tap the moon button to cycle themes.`;

  $("#themeButton").textContent = ({
    christmas: "❄️",
    halloween: "🎃",
    lunar: "🏮",
    summer: "☀️",
    default: "🌙"
  })[resolved];

  $("#themeButton").title =
    `Current theme: ${label}. Click to change.`;
}

function cycleTheme() {
  themeIndex = (themeIndex + 1) % themes.length;

  const theme = themes[themeIndex];

  applyTheme(theme, theme === "auto" ? "auto" : "preview");

  toast(
    theme === "auto"
      ? "Automatic seasonal theme enabled."
      : `${themeLabels[theme] || "Classic Kingdom"} preview enabled.`
  );
}

$("#themeButton").addEventListener("click", cycleTheme);

$("#previewSeason").addEventListener("click", () => {
  const current = automaticTheme();
  const next = current === "default" ? "christmas" : current;

  themeIndex = themes.indexOf(next);

  applyTheme(next, "preview");

  toast(`${themeLabels[next]} preview enabled.`);
});

applyTheme("auto");

// INFORMATIONAL DETAIL BUTTONS
$$("[data-detail]").forEach((button) => {
  button.addEventListener("click", () => {
    openModal(
      button.dataset.detail,
      "This is a starter content card. The full ClashDex version can connect verified base data, screenshots, copy links, ratings, troop compositions and creator video guides."
    );
  });
});

// SERVICE WORKER REGISTRATION
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
        "ClashDex Service Worker registered:",
        registration.scope
      );

    } catch (error) {
      console.error(
        "ClashDex Service Worker registration failed:",
        error
      );
    }
  });
}
