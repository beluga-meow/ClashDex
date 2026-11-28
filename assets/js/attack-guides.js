/* PekkaDex — Attack Guides (attack-guides.html)
   The guide text lives in assets/data/attack-guides.json; the troop lists,
   spell lists and step plans are merged from assets/data/armies.json so the
   Army Library stays the single source for those facts.

   Every value from JSON is escaped before it is placed in a template string. */
(() => {
  "use strict";

  const app = document.getElementById("guideApp");
  if (!app) return;

  const esc = value => String(value == null ? "" : value)
    .replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  async function fetchJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    return response.json();
  }

  function list(items, className) {
    if (!Array.isArray(items) || !items.length) return "";
    return `<ul class="${className}">${items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`;
  }

  function steps(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return `<ol class="guide-steps">${items.map(item => `<li>${esc(item)}</li>`).join("")}</ol>`;
  }

  function verifiedChip(guide, army) {
    const unverified = [];
    if (guide.verified === false) unverified.push(...(guide.unverified || ["the guide text"]));
    if (army && army.verified === false) unverified.push(...(army.unverified || []));
    if (!unverified.length) return "";
    const unique = [...new Set(unverified)].slice(0, 4);
    return `<p class="guide-unverified"><span class="pdx-chip">Unverified</span>
      <span>${esc(unique.join(" · "))}</span></p>`;
  }

  function armyFacts(army) {
    const rows = [
      ["Town Hall", `${army.minTh}–${army.maxTh}`],
      ["Troops", army.army],
      ["Spells", army.spells],
      ["Siege machine", army.siege || "None listed"],
      ["Heroes", army.heroes],
    ];
    return `<dl class="pdx-facts">${rows.map(([label, value]) => `
      <div><dt>${esc(label)}</dt><dd>${esc(value || "Not on file")}</dd></div>`).join("")}</dl>`;
  }

  function armyBlock(army) {
    if (!army) {
      return `<div class="pdx-empty"><b>No merged army entry</b>
        <p class="pdx-note">This guide's related army id is not in armies.json, so no composition is shown rather than a guessed one.</p></div>`;
    }
    return `<section class="guide-army" aria-label="Army composition from the Army Library">
      <h3>What the army looks like</h3>
      ${armyFacts(army)}
      <h4>Plan</h4>
      ${steps(army.strategy)}
      <h4>Risks</h4>
      ${list(army.risks, "guide-risks")}
      <a class="pdx-btn pdx-btn--sm guide-army__link" href="./armies.html?army=${encodeURIComponent(army.id)}">Open the full army entry</a>
    </section>`;
  }

  function queenWalk(guide) {
    const parts = (guide.parts || []).map((part, index) => `
      <section class="guide-part" aria-labelledby="guide-part-${index + 1}">
        <span class="guide-part__num" aria-hidden="true">${index + 1}</span>
        <div>
          <h3 id="guide-part-${index + 1}">${esc(part.title)}</h3>
          ${(part.paragraphs || []).map(text => `<p>${esc(text)}</p>`).join("")}
        </div>
      </section>`).join("");
    const setup = [
      ["Healers", guide.healers],
      ["Equipment", guide.equipment],
      ["Spells", guide.spells],
    ].filter(([, value]) => value);
    return `<div class="guide-setup">
        <dl class="pdx-facts">${setup.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
      </div>
      <div class="guide-parts">${parts}</div>
      <div class="guide-two-col">
        <section><h3>Common mistakes</h3>${list(guide.mistakes, "guide-mistakes")}</section>
        <section><h3>Practice tips</h3>${list(guide.practice, "guide-practice")}</section>
      </div>`;
  }

  function shortGuide(guide, army) {
    return `<div class="guide-two-col guide-two-col--wide">
        <section class="guide-focus">
          <h3>What matters most</h3>
          ${list(guide.focus, "guide-focus__list")}
        </section>
        ${armyBlock(army)}
      </div>`;
  }

  function guideCard(guide, armyById) {
    const army = guide.relatedArmy ? armyById.get(guide.relatedArmy) : null;
    const isQueen = Array.isArray(guide.parts);
    const chips = [];
    if (army) chips.push(`<span class="pdx-chip">TH ${esc(army.minTh)}–${esc(army.maxTh)}</span>`);
    if (army) chips.push(`<span class="pdx-chip">${esc(army.difficulty)}</span>`);
    chips.push(`<span class="pdx-chip pdx-chip--gold">${esc(isQueen ? "Three-part guide" : "Short guide")}</span>`);

    return `<article class="guide-card paper-panel" id="guide-${esc(guide.id)}" aria-labelledby="guide-title-${esc(guide.id)}">
      <header class="guide-card__head">
        <p class="eyebrow">${esc(isQueen ? "QUEEN WALK" : "ATTACK GUIDE")}</p>
        <h2 id="guide-title-${esc(guide.id)}">${esc(guide.title)}</h2>
        <p class="guide-card__lede">${esc(guide.lede)}</p>
        <div class="guide-card__chips">${chips.join("")}</div>
      </header>
      ${isQueen ? queenWalk(guide) : shortGuide(guide, army)}
      ${verifiedChip(guide, army)}
      ${guide.notes ? `<p class="pdx-note guide-note">${esc(guide.notes)}</p>` : ""}
    </article>`;
  }

  function paintNav(guides) {
    const nav = document.getElementById("guideNav");
    if (!nav) return;
    nav.textContent = "";
    for (const guide of guides) {
      const link = document.createElement("a");
      link.className = "pdx-tab";
      link.href = `#guide-${guide.id}`;
      link.textContent = guide.title;
      nav.append(link);
    }
  }

  function paintError(error) {
    console.error("[PekkaDex] attack guides failed to load:", error);
    app.textContent = "";
    const box = document.createElement("div");
    box.className = "pdx-empty";
    const title = document.createElement("b");
    title.textContent = "The guides could not load";
    const note = document.createElement("p");
    note.className = "pdx-note";
    note.textContent = "The guide data file did not answer. Check your connection and reload, or read the Army Library in the meantime.";
    const link = document.createElement("a");
    link.className = "pdx-btn";
    link.href = "./armies.html";
    link.textContent = "Open the Army Library";
    box.append(title, note, link);
    app.append(box);
  }

  async function init() {
    try {
      const [guidesDoc, armiesDoc] = await Promise.all([
        fetchJSON("./assets/data/attack-guides.json"),
        fetchJSON("./assets/data/armies.json"),
      ]);
      const armies = Array.isArray(armiesDoc.armies) ? armiesDoc.armies : [];
      const armyById = new Map(armies.map(army => [army.id, army]));
      const guides = Array.isArray(guidesDoc.guides) ? guidesDoc.guides : [];
      paintNav(guides);
      app.innerHTML = guides.map(guide => guideCard(guide, armyById)).join("");

      /* Deep links land after the cards exist, so scroll once they are painted. */
      if (location.hash && location.hash.startsWith("#guide-")) {
        const target = document.getElementById(location.hash.slice(1));
        if (target) {
          window.requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
        }
      }
    } catch (error) {
      paintError(error);
    }
  }

  init();
})();
