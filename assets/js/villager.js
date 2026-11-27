/* PekkaDex — Lady Villager website guide.
   She is a guide, not a chatbot: one portrait, one short line that matches the
   page, and nothing that moves on its own or covers navigation.

   Artwork: the six images live in ./assets/villager/ (Villager_info.webp for
   the home greeting, Villager_Mad.webp for the army page, Villager_Shocked.webp
   for the profile, Villager_pleading.webp for signing out). If a file is
   missing the guide falls back to a small medallion instead of showing a broken
   image, so the page keeps working until the art is added. */
(() => {
  "use strict";

  if (window.PDXVillager) return;

  const BASE = "./assets/villager/";
  /* All six expressions were uploaded to the repository root and moved into
     assets/villager/. The medallion stays as a fallback if a file ever goes
     missing, but art is used by default. */
  const ART_SHIPPED = true;
  const FALLBACK_FACE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><circle cx="12" cy="8" r="3.4"></circle><path d="M5.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M3.5 8.5 5 6l2.5-.5"></path></svg>';
  const MOODS = {
    welcome: { file: "Villager_info.webp", alt: "Lady Villager greeting you", line: "Hey Chief! Welcome to PekkaDex!" },
    brave: { file: "Villager_Mad.webp", alt: "Lady Villager looking determined", line: "Ready for battle, Chief?" },
    shocked: { file: "Villager_Shocked.webp", alt: "Lady Villager looking shocked", line: "Whoa! Look at those stats!" },
    farewell: { file: "Villager_pleading.webp", alt: "Lady Villager pleading", line: "Leaving already, Chief? See you next time!" }
  };

  const PAGE_MOOD = {
    home: "welcome",
    armies: "brave",
    profile: "shocked"
  };

  let node = null;
  let face = null;
  let lineEl = null;
  let hideTimer = 0;
  let currentMood = "welcome";

  function build() {
    if (node) return node;
    node = document.createElement("aside");
    node.className = "pdx-guide";
    node.id = "pdxGuide";
    node.setAttribute("aria-label", "Lady Villager website guide");
    if (!document.querySelector(".cx-tabbar")) node.classList.add("pdx-guide--no-tabbar");

    face = document.createElement("div");
    face.className = "pdx-guide__face";
    face.setAttribute("aria-hidden", "true");

    const bubble = document.createElement("div");
    bubble.className = "pdx-guide__bubble";
    lineEl = document.createElement("p");
    lineEl.setAttribute("role", "status");
    lineEl.setAttribute("aria-live", "polite");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "pdx-guide__close";
    close.setAttribute("aria-label", "Dismiss the guide");
    close.textContent = "×";
    close.addEventListener("click", hide);

    bubble.append(lineEl, close);
    node.append(face, bubble);
    document.body.appendChild(node);
    return node;
  }

  function paintFace(mood) {
    const config = MOODS[mood];
    face.textContent = "";
    face.classList.remove("pdx-guide__face--fallback");
    if (!config) return;
    if (!ART_SHIPPED) {
      face.classList.add("pdx-guide__face--fallback");
      face.innerHTML = FALLBACK_FACE;
      return;
    }
    const image = document.createElement("img");
    image.src = BASE + config.file;
    image.alt = config.alt;
    image.width = 84;
    image.height = 84;
    image.decoding = "async";
    image.loading = "eager";
    image.addEventListener("error", () => {
      /* Keep the guide usable and never render a broken image icon. */
      image.remove();
      face.classList.add("pdx-guide__face--fallback");
      face.innerHTML = FALLBACK_FACE;
    }, { once: true });
    face.appendChild(image);
  }

  function show(mood, options) {
    const key = MOODS[mood] ? mood : "welcome";
    const config = MOODS[key];
    const opts = options || {};
    try {
      if (sessionStorage.getItem("pdxGuideDismissed:" + key) === "1") return;
    } catch (_) { /* private mode — still show it */ }

    build();
    currentMood = key;
    node.dataset.mood = key;
    paintFace(key);
    lineEl.textContent = opts.line || config.line;
    node.hidden = false;
    clearTimeout(hideTimer);
    if (opts.sticky !== true) hideTimer = setTimeout(hide, 14000);
  }

  function hide() {
    if (!node) return;
    node.hidden = true;
    try { sessionStorage.setItem("pdxGuideDismissed:" + currentMood, "1"); } catch (_) { /* ignore */ }
  }

  /* Public hooks for other page scripts. */
  window.PDXVillager = { show, hide, moods: MOODS };

  function boot() {
    const mood = PAGE_MOOD[document.body.dataset.guide];
    if (mood) show(mood);

    /* Sign-out is never delayed or blocked: the message is fired and the real
       handler on the button runs on its own. */
    document.addEventListener("click", event => {
      if (!event.target.closest("#signOut, #authLogout")) return;
      show("farewell", { sticky: true });
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
