/* PekkaDex Living Village — visibility-aware animation controller */
(() => {
  const art = document.querySelector(".hero-art");
  if (!art) return;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) { art.classList.add("village-paused"); return; }
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(([entry]) => {
    art.classList.toggle("village-paused", !entry.isIntersecting || document.hidden);
  }, { threshold: 0.08 });
  observer.observe(art);
  document.addEventListener("visibilitychange", () => {
    art.classList.toggle("village-paused", document.hidden);
  });
})();
