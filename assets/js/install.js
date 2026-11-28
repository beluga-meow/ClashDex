/* PekkaDex — "Install app" menu entry (index.html).
   There is no Android APK for this site, and this script does not pretend
   there is one. It offers the real install path the site already supports
   (PWA manifest + service worker) and explains the manual steps when the
   browser has not offered its install prompt. */
(() => {
  "use strict";

  const button = document.getElementById("installApp");
  if (!button) return;

  const standalone = () => {
    try {
      return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    } catch (_) {
      return false;
    }
  };

  if (standalone()) {
    button.hidden = true;
    return;
  }

  let deferred = null;
  let sheet = null;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferred = event;
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    button.hidden = true;
    close();
  });

  function buildSheet() {
    const wrap = document.createElement("div");
    wrap.className = "pdx-sheet";
    wrap.id = "installSheet";
    wrap.hidden = true;

    const scrim = document.createElement("button");
    scrim.className = "pdx-sheet__scrim";
    scrim.type = "button";
    scrim.setAttribute("data-close-install", "");
    scrim.setAttribute("aria-label", "Close install help");

    const panel = document.createElement("div");
    panel.className = "pdx-sheet__panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "installSheetTitle");

    const bar = document.createElement("div");
    bar.className = "pdx-sheet__bar";
    const title = document.createElement("strong");
    title.id = "installSheetTitle";
    title.textContent = "Install PekkaDex";
    const closeButton = document.createElement("button");
    closeButton.className = "pdx-btn pdx-btn--wood pdx-btn--icon";
    closeButton.type = "button";
    closeButton.setAttribute("data-close-install", "");
    closeButton.setAttribute("aria-label", "Close install help");
    closeButton.textContent = "×";
    bar.append(title, closeButton);

    const body = document.createElement("div");
    body.className = "pdx-sheet__body";
    const lead = document.createElement("p");
    lead.textContent = "PekkaDex has no Android APK. Building and signing one is a release step this site cannot do for you, so there is no download button pretending otherwise.";
    const how = document.createElement("p");
    how.className = "pdx-note";
    how.textContent = "What does work: PekkaDex is an installable web app. In Chrome on Android, open the ⋮ menu and choose “Install app” or “Add to Home screen”. On iPhone, use Share → “Add to Home Screen” in Safari.";
    const offline = document.createElement("p");
    offline.className = "pdx-note";
    offline.textContent = "Once added, it opens from your home screen like an app and keeps working when your connection drops, because the service worker caches the pages you have visited.";
    const done = document.createElement("button");
    done.className = "pdx-btn";
    done.type = "button";
    done.setAttribute("data-close-install", "");
    done.textContent = "Got it";
    body.append(lead, how, offline, done);

    panel.append(bar, body);
    wrap.append(scrim, panel);
    document.body.append(wrap);
    return wrap;
  }

  function open() {
    if (!sheet) sheet = buildSheet();
    sheet.hidden = false;
    const focusTarget = sheet.querySelector("[data-close-install]");
    if (focusTarget instanceof HTMLElement) focusTarget.focus({ preventScroll: true });
  }

  function close() {
    if (sheet) sheet.hidden = true;
    button.focus({ preventScroll: true });
  }

  button.addEventListener("click", async () => {
    if (deferred) {
      try {
        deferred.prompt();
        await deferred.userChoice;
      } catch (_) { /* the prompt can only be used once; fall through */ }
      deferred = null;
      return;
    }
    open();
  });

  document.addEventListener("click", event => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-close-install]")) close();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && sheet && !sheet.hidden) close();
  });
})();
