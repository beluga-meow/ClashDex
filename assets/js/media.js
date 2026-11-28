/* PekkaDex — image hygiene.

   One capture-phase error listener means every <img> on every page gets the
   same treatment when a file is missing, renamed or blocked: the broken-image
   icon is replaced by a themed silhouette drawn from an inline SVG, the alt
   text is dropped from the picture, and the surrounding media box gets a
   class the CSS can style. Nothing here guesses what the picture should have
   been — a card with no art simply looks like a card with no art.

   It also fills in loading="lazy", decoding="async" and width/height for
   images that were written without them, so no late image can shove the
   layout around (the CSS aspect-ratio is the second half of that guard). */
(() => {
  "use strict";
  if (window.__pdxMedia) return;
  window.__pdxMedia = true;

  const SILHOUETTE = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="presentation">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffe778"/><stop offset="1" stop-color="#c98a2e"/></linearGradient></defs>' +
      '<path d="M60 14c-15 0-26 9-28 23l-8 3c-3 1-4 5-2 7l8 8v9c0 4 3 7 7 7h6l3 25c0 3 2 5 5 5h18c3 0 5-2 5-5l3-25h6c4 0 7-3 7-7v-9l8-8c2-2 1-6-2-7l-8-3c-2-14-13-23-28-23z" ' +
      'fill="url(#g)" stroke="#3b210c" stroke-width="4" stroke-linejoin="round"/>' +
      '<circle cx="48" cy="52" r="5" fill="#3b210c"/><circle cx="72" cy="52" r="5" fill="#3b210c"/>' +
      '<path d="M50 70c3 4 7 6 10 6s7-2 10-6" fill="none" stroke="#3b210c" stroke-width="4" stroke-linecap="round"/>' +
    "</svg>"
  );

  function fallback(img) {
    if (img.dataset.pdxFallback === "1") return;
    img.dataset.pdxFallback = "1";
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = SILHOUETTE;
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.classList.add("pdx-img--fallback");
    const box = img.closest(".pdx-card__media, .pdx-sheet__art, .pdx-lightbox__art, .hero-head__art, " +
      ".lib-card__media, .lib-sheet__art, .atk-art, .pet-card__art, figure");
    if (box) box.classList.add("pdx-media--fallback");
  }

  document.addEventListener("error", event => {
    const target = event.target;
    if (target instanceof HTMLImageElement) fallback(target);
  }, true);

  function decorate(root) {
    const images = root.querySelectorAll ? root.querySelectorAll("img") : [];
    images.forEach((img, index) => {
      if (!img.hasAttribute("loading")) img.loading = index === 0 ? "eager" : "lazy";
      if (!img.hasAttribute("decoding")) img.decoding = "async";
      /* Intrinsic size stops the layout shift; the SVG sits on the same ratio. */
      if (!img.hasAttribute("width") && !img.naturalWidth) img.setAttribute("width", "64");
      if (!img.hasAttribute("height") && !img.naturalHeight) img.setAttribute("height", "64");
      if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fallback(img);
    });
  }

  function start() {
    decorate(document);
    if (!("MutationObserver" in window)) return;
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.tagName === "IMG") decorate(node.parentNode || document);
          else decorate(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
