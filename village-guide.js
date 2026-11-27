
/* PekkaDex Villager Greeter */
(() => {
  "use strict";

  if (window.__pekkaDexVillager) return;
  window.__pekkaDexVillager = true;

  const reactions = [
    "./Villager_info.webp",
    "./Villager_Shocked.webp",
    "./Villager_Crying.webp",
    "./Villager_pleading.webp",
    "./Villager_Scared.webp",
    "./Villager_Mad.webp"
  ];

  const guide = document.createElement("div");
  guide.id = "villageGuide";

  guide.innerHTML = `
    <div class="vg-bubble" id="vgBubble">
      <button class="vg-bubble-close" aria-label="Dismiss greeting">×</button>
      Hey Chief! Welcome to PekkaDex!
    </div>
    <img class="vg-character"
      src="./Villager_info.webp"
      alt="PekkaDex Village Guide">
    <button class="vg-character-close"
      aria-label="Hide Village Guide">×</button>
  `;

  document.body.appendChild(guide);

  const character = guide.querySelector(".vg-character");
  const bubble = guide.querySelector(".vg-bubble");
  const bubbleClose = guide.querySelector(".vg-bubble-close");
  const characterClose = guide.querySelector(".vg-character-close");

  // Preload all expressions
  reactions.forEach(src => {
    const img = new Image();
    img.src = src;
  });

  // Greeting can be dismissed independently
  bubbleClose.addEventListener("click", () => {
    bubble.hidden = true;
  });

  // Hide the entire character
  characterClose.addEventListener("click", () => {
    guide.classList.add("vg-hidden");
  });

  // Cycle through expressions
  let index = 0;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (!reducedMotion) {
    setInterval(() => {
      index = (index + 1) % reactions.length;
      character.src = reactions[index];
    }, 5000);
  }
})();
