/* PekkaDex — Attack Academy
   Town Hall picker + an explainable attack analyser + Best / Hot / Recommended
   picks for every Town Hall. Everything is computed from the data below, so
   the page works offline with no API keys. */
(() => {
  "use strict";
  if (window.__pdxAttacks) return;
  window.__pdxAttacks = true;

  const ARMIES = [
    {
      id: "mass-dragons", name: "Mass Dragons", type: "Air", minTh: 8, maxTh: 11,
      difficulty: "Easy", power: 63, popularity: 72, troops: ["🐉", "🐉", "🐉", "⚡", "🎈"],
      comp: "8–10 Dragons · 4 Balloons · 2 Lightning", spells: "Lightning ×4, Rage ×1, Freeze ×1",
      heroes: "King + Queen to funnel the edges before the dragons fly in.",
      plan: ["Lightning out one Air Defence on the side you are entering from.", "Funnel with the heroes so the dragons stay together through the middle.", "Rage the pack over the core, then freeze the last Air Defence."],
      risks: ["Dies to a well-placed Air Sweeper.", "Spread-out bases break the dragon clump."],
      tags: ["Beginner friendly", "Low hero levels"]
    },
    {
      id: "gowiwi", name: "GoWiWi", type: "Ground", minTh: 8, maxTh: 10,
      difficulty: "Medium", power: 58, popularity: 41, troops: ["🪨", "🧙", "🧙", "💀", "🦸"],
      comp: "2 Golems · 8 Witches · 8 Wizards · 4 Wall Breakers", spells: "Jump ×2, Rage ×1, Heal ×1, Poison ×1",
      heroes: "King soaks the first compartment, Queen cleans up behind.",
      plan: ["Open the outer wall with Wall Breakers and drop the Golems into the splash.", "Funnel wizards on both sides before sending the witches up the middle.", "Jump into the core and rage the skeleton swarm."],
      risks: ["Slow push — watch the timer.", "Multi-Inferno towers shred skeletons."],
      tags: ["Ground control", "Skilled"]
    },
    {
      id: "lavaloon", name: "LavaLoon", type: "Air", minTh: 9, maxTh: 13,
      difficulty: "Medium", power: 72, popularity: 70, troops: ["🐕", "🐕", "🎈", "🎈", "🦇"],
      comp: "3 Lava Hounds · 16 Balloons · 10 Minions", spells: "Rage ×2, Haste ×2, Freeze ×1",
      heroes: "Queen takes an Air Defence with a Queen Walk, King funnels the far side.",
      plan: ["Queen Walk one Air Defence while the King clears the opposite corner.", "Release the hounds first so the balloons arrive under cover.", "Haste the balloons through the core and freeze the Town Hall weapon."],
      risks: ["Needs a clean Air Defence kill.", "Heavy air traps punish a late balloon drop."],
      tags: ["Air", "Queen Walk"]
    },
    {
      id: "hog-raid", name: "Hog Rider Raid", type: "Ground", minTh: 9, maxTh: 12,
      difficulty: "Easy", power: 67, popularity: 74, troops: ["🐗", "🐗", "🐗", "🪓", "🧙"],
      comp: "32–36 Hog Riders · 6 Wizards · 4 Healers", spells: "Heal ×5, Poison ×1",
      heroes: "Queen Walk to take out the Queen and one splash defence.",
      plan: ["Kill the defending Archer Queen and a multi-Inferno with the Queen Walk.", "Send hogs in a line along the remaining defences.", "Heal through the bomb towers and the core."],
      risks: ["Giant Bombs and multi-Infernos melt the pack.", "Skeleton traps stall the rush."],
      tags: ["Beginner friendly", "Fast"]
    },
    {
      id: "edrag-rush", name: "Electro Dragon Rush", type: "Air", minTh: 11, maxTh: 15,
      difficulty: "Easy", power: 79, popularity: 84, troops: ["🐉", "⚡", "⚡", "🎈", "🦇"],
      comp: "7 Electro Dragons · 6 Balloons · 4 Minions", spells: "Rage ×2, Freeze ×2, Haste ×1",
      heroes: "King and Queen cut one edge; the Warden follows the dragons.",
      plan: ["Funnel both corners so the Electro Dragons cannot scatter.", "Chain the dragons into the core with a Warden Eternal Tome.", "Freeze the Eagle Artillery and the Town Hall weapon."],
      risks: ["Single-target Infernos slow the chain badly.", "Air Sweepers ruin the entry angle."],
      tags: ["Beginner friendly", "Air"]
    },
    {
      id: "yeti-smash", name: "Yeti Smash", type: "Ground", minTh: 12, maxTh: 15,
      difficulty: "Medium", power: 77, popularity: 61, troops: ["🧊", "🧊", "🧙", "🪓", "🦸"],
      comp: "5 Yetis · 8 Witches · 6 Bowlers · 4 Wall Breakers", spells: "Jump ×2, Rage ×2, Heal ×1, Poison ×1",
      heroes: "All four heroes lead the smash through the middle.",
      plan: ["Open the wall and send Yetis with the King into the biggest compartment.", "Witches and Bowlers follow behind the Yetimites.", "Warden Tome over the core, rage the Bowlers."],
      risks: ["Needs a wide funnel.", "Splash-heavy cores eat the Yetimites."],
      tags: ["Ground", "Hero heavy"]
    },
    {
      id: "qc-hybrid", name: "Queen Charge Hybrid", type: "Hybrid", minTh: 12, maxTh: 19,
      difficulty: "Hard", power: 85, popularity: 88, troops: ["👑", "⛏️", "🐗", "🦸", "🧪"],
      comp: "5 Healers · 12 Miners · 12 Hog Riders · 4 Wall Breakers", spells: "Rage ×2, Heal ×3, Freeze ×1, Poison ×1",
      heroes: "Queen charge takes the core; King and Champion funnel the other side.",
      plan: ["Queen Charge into the compartment that holds the defending Queen and Clan Castle.", "Funnel the opposite edge with the King and Royal Champion.", "Send Miners and Hogs together, heals ready for the core."],
      risks: ["Punishing if the Queen charge fails.", "Needs good timing on the Warden ability."],
      tags: ["Meta", "High skill"]
    },
    {
      id: "fireball-walk", name: "Fireball Warden Walk", type: "Hybrid", minTh: 13, maxTh: 19,
      difficulty: "Hard", power: 87, popularity: 76, troops: ["🧙", "🔥", "🐉", "🦸", "🧪"],
      comp: "5 Healers · 4 Dragons · 6 Balloons · 10 Minions", spells: "Rage ×2, Freeze ×2, Haste ×1",
      heroes: "Warden Walk with Fireball deletes a whole compartment before the push.",
      plan: ["Warden Walk with healers until the Fireball lines up on the core.", "Delete the core defences, then send the dragons into the gap.", "Freeze the remaining splash and Tome the last stretch."],
      risks: ["Fireball timing must be exact.", "Warden walk dies to a hidden Tesla farm."],
      tags: ["Meta", "High skill"]
    },
    {
      id: "blizzard-lalo", name: "Blizzard Lalo", type: "Air", minTh: 13, maxTh: 17,
      difficulty: "Hard", power: 83, popularity: 64, troops: ["❄️", "🎈", "🐕", "🦇", "🧊"],
      comp: "8 Wizards + Blimp · 2 Lava Hounds · 18 Balloons", spells: "Rage ×2, Haste ×2, Freeze ×1, Invisibility ×1",
      heroes: "Queen and Warden protect the Blizzard; King funnels.",
      plan: ["Blizzard the core to remove the Queen, Clan Castle and Eagle.", "Lava Hounds then balloons into the now-exposed air defences.", "Haste through the last defences, freeze the Town Hall weapon."],
      risks: ["Blimp can be shot down early.", "Needs precise ability timing."],
      tags: ["Air", "High skill"]
    },
    {
      id: "root-smash", name: "Root Rider Smash", type: "Ground", minTh: 15, maxTh: 19,
      difficulty: "Medium", power: 92, popularity: 91, troops: ["🌳", "🌳", "🪓", "🧙", "🦸"],
      comp: "6 Root Riders · 6 Valks · 6 Bowlers · 4 Wall Breakers", spells: "Jump ×2, Rage ×2, Heal ×1, Freeze ×1",
      heroes: "Every hero goes in with the smash — this is a full commit.",
      plan: ["Funnel both edges so the Root Riders walk straight at the core.", "Jump the pack into the centre, rage on the Town Hall.", "Warden Tome for the Monolith and freeze the last splash."],
      risks: ["A split base wastes the smash.", "Needs heroes high enough to survive the core."],
      tags: ["Meta", "Ground"]
    },
    {
      id: "hydra-root", name: "Hydra Root Rider", type: "Hybrid", minTh: 16, maxTh: 19,
      difficulty: "Hard", power: 93, popularity: 80, troops: ["🐉", "🎈", "🌳", "🦸", "🧪"],
      comp: "4 Dragons + 6 Balloons · 4 Root Riders · 6 Witches", spells: "Rage ×2, Haste ×1, Jump ×1, Freeze ×1",
      heroes: "Air on one side, ground smash through the other, Warden with the Riders.",
      plan: ["Air wave clears the outer air defences and the funnel.", "Root Riders enter the hole the air wave made.", "Tome the Monolith, freeze the Town Hall weapon."],
      risks: ["Two-phase attack: the timing must line up.", "Bad pathing splits the Riders."],
      tags: ["Meta", "Hybrid"]
    },
    {
      id: "titan-smash", name: "Electro Titan Smash", type: "Ground", minTh: 16, maxTh: 19,
      difficulty: "Medium", power: 87, popularity: 58, troops: ["⚡", "⚡", "🪓", "🧙", "🦸"],
      comp: "4 Electro Titans · 6 Root Riders · 6 Witches", spells: "Jump ×2, Rage ×2, Heal ×1, Freeze ×1",
      heroes: "King tanks first, Titans follow the aura into the core.",
      plan: ["King and Queen clear one edge and open the wall.", "Titans walk the aura through the base while Riders smash the core.", "Heal through the splash, freeze the Monolith."],
      risks: ["Titans are slow — watch the clock.", "Single-target Infernos focus them down."],
      tags: ["Ground", "Late game"]
    },
    {
      id: "dragon-blimp", name: "Dragon Rider Blimp", type: "Air", minTh: 15, maxTh: 19,
      difficulty: "Hard", power: 85, popularity: 59, troops: ["🐲", "🎈", "🐉", "🦇", "🦸"],
      comp: "Blimp + 8 Dragons · 4 Dragon Riders · 6 Minions", spells: "Rage ×2, Haste ×2, Freeze ×1",
      heroes: "Warden rides with the Blimp, King and Queen funnel.",
      plan: ["Blimp the core with the Warden inside for the Tome.", "Dragons and Dragon Riders enter from the cleared side.", "Haste the riders onto the remaining air defences."],
      risks: ["Blimp interception loses the attack.", "Very timing dependent."],
      tags: ["Air", "High skill"]
    },
    {
      id: "bowler-smash", name: "Super Bowler Smash", type: "Ground", minTh: 14, maxTh: 18,
      difficulty: "Medium", power: 82, popularity: 56, troops: ["🎳", "🎳", "🪓", "🧙", "🦸"],
      comp: "8 Super Bowlers · 6 Witches · 6 Valkyries", spells: "Jump ×2, Rage ×2, Heal ×1, Freeze ×1",
      heroes: "King and Queen open the wall, Warden shields the Bowlers.",
      plan: ["Clear a corner and jump the Bowlers into the core.", "Witches follow to keep the skeleton wall alive.", "Tome over the Eagle and rage the Bowlers."],
      risks: ["Splash kills the Bowler line.", "Needs a clean jump."],
      tags: ["Ground", "Strong core"]
    },
    {
      id: "minion-air", name: "Minion Prince Air Push", type: "Air", minTh: 16, maxTh: 19,
      difficulty: "Medium", power: 86, popularity: 55, troops: ["🦇", "🦇", "🐉", "🎈", "🦸"],
      comp: "6 Dragons · 8 Balloons · Minion Prince + Henchmen", spells: "Rage ×2, Haste ×2, Freeze ×1",
      heroes: "Minion Prince leads from the air; Warden follows the dragons.",
      plan: ["Minion Prince takes the first Air Defence from above.", "Dragons and balloons flood the gap.", "Tome the core and freeze the Town Hall weapon."],
      risks: ["Ground-only heroes may idle.", "Air traps punish the balloon clump."],
      tags: ["Air", "New hero"]
    },
    {
      id: "duke-smash", name: "Dragon Duke Ground Push", type: "Ground", minTh: 17, maxTh: 19,
      difficulty: "Hard", power: 89, popularity: 52, troops: ["🐲", "🌳", "🪓", "🧙", "🦸"],
      comp: "Dragon Duke + 6 Root Riders · 6 Witches · 6 Valks", spells: "Jump ×2, Rage ×2, Heal ×1, Freeze ×1",
      heroes: "The Duke opens the wall with his rocket boost, the smash follows.",
      plan: ["Rocket the Duke over the outer wall onto the Eagle.", "Root Riders jump in behind him while the Warden shields.", "Rage the core and freeze the Monolith."],
      risks: ["Duke can be isolated and killed early.", "Still being figured out by the meta."],
      tags: ["New hero", "Ground"]
    },
    {
      id: "valk-root", name: "Valkyrie Root Rush", type: "Ground", minTh: 14, maxTh: 18,
      difficulty: "Easy", power: 78, popularity: 66, troops: ["🪓", "🪓", "🌳", "🧙", "🦸"],
      comp: "10 Valkyries · 4 Root Riders · 6 Wizards", spells: "Rage ×2, Jump ×2, Heal ×1, Freeze ×1",
      heroes: "King tanks, Queen funnels, Warden shields the spin.",
      plan: ["Funnel both sides with heroes and wizards.", "Jump the Valkyries into the core so their spin hits everything.", "Rage and heal through the splash."],
      risks: ["Valkyries scatter without a funnel.", "Dies to a bad jump."],
      tags: ["Beginner friendly", "Ground"]
    }
  ];

  const TRAITS = [
    ["balanced", "Balanced base"],
    ["compact", "Compact core"],
    ["wide", "Wide and spread out"],
    ["airheavy", "Heavy air defences"],
    ["single", "Single-target defences"]
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const TH_EXT = { 2: "png", 3: "png", 4: "png", 5: "png", 6: "png", 7: "png", 8: "png", 9: "png", 10: "webp", 11: "webp", 12: "png", 13: "webp", 14: "png", 15: "png", 16: "webp", 17: "webp", 18: "webp", 19: "webp" };
  const thImage = n => `./assets/townhalls/th-${n}.${TH_EXT[n] || "png"}`;

  function setup() {
    const sec = $("#attacks");
    if (!sec || sec.dataset.pdxAttacks === "1") return;
    sec.dataset.pdxAttacks = "1";

    const available = n => ARMIES.filter(a => n >= a.minTh && n <= a.maxTh);
    let th = 15;
    let armyId = "";
    let trait = "balanced";

    const baseScore = (army, level) => {
      if (level < army.minTh || level > army.maxTh) return 0;
      const diff = army.difficulty === "Hard" ? 6 : army.difficulty === "Medium" ? 3 : 0;
      return clamp(Math.round(army.power + (level - army.minTh) * 1.1 - diff), 40, 99);
    };

    const traitAdjust = (army, t) => {
      let d = 0;
      const splash = army.id === "edrag-rush" || army.id === "root-smash" || army.id === "lavaloon" || army.id === "hydra-root";
      const single = army.id === "hog-raid" || army.id === "qc-hybrid" || army.id === "bowler-smash";
      if (t === "compact") d += splash ? 6 : single ? -4 : 1;
      else if (t === "wide") d += (army.type === "Hybrid" || army.difficulty === "Easy") ? 5 : -3;
      else if (t === "airheavy") d += army.type === "Air" ? -10 : 6;
      else if (t === "single") d += single ? 3 : 5;
      return d;
    };

    const analyze = (army, level, t) => {
      const base = baseScore(army, level);
      const adj = traitAdjust(army, t);
      const score = clamp(base + adj, 30, 99);
      const reasons = [];
      if (level < army.minTh) reasons.push(`Needs ${army.minTh === 19 ? "Town Hall 19" : "Town Hall " + army.minTh} — not available yet.`);
      else if (level === army.minTh) reasons.push(`Built for Town Hall ${army.minTh} — this is its home level.`);
      else reasons.push(`Designed for Town Hall ${army.minTh}–${army.maxTh}; at Town Hall ${level} you have ${level - army.minTh} Town Hall level(s) of extra power behind it.`);
      if (adj > 0) reasons.push(`Matches a ${TRAITS.find(x => x[0] === t)[1].toLowerCase()} base (+${adj}).`);
      else if (adj < 0) reasons.push(`That base style works against this army (${adj}).`);
      reasons.push(`${army.difficulty} execution · ${army.popularity}% of Chiefs bring it in this range.`);
      reasons.push(army.tags[0] + " · " + army.tags[1]);
      const grade = score >= 90 ? "S" : score >= 82 ? "A" : score >= 72 ? "B" : "C";
      const verdict = score >= 90 ? "This is the attack to bring." : score >= 82 ? "Very strong pick for this Town Hall." : score >= 72 ? "Solid if you execute cleanly." : "Comfort pick — expect a harder fight.";
      return { base, score, grade, verdict, reasons };
    };

    const pickThree = level => {
      const list = available(level).slice();
      const scored = list.map(a => ({ army: a, score: baseScore(a, level) })).sort((a, b) => b.score - a.score);
      const best = scored[0] ? scored[0].army : null;
      const byPopularity = scored.slice()
        .sort((a, b) => (b.army.popularity + b.score * 0.35) - (a.army.popularity + a.score * 0.35))
        .map(x => x.army);
      const hot = byPopularity.find(a => !best || a.id !== best.id) || best;
      const beginnerBonus = a => (a.difficulty === "Easy" ? 8 : a.difficulty === "Medium" ? 3 : 0);
      const byFit = scored.slice()
        .sort((a, b) => (b.score + beginnerBonus(b.army)) - (a.score + beginnerBonus(a.army)))
        .map(x => x.army);
      const rec = byFit.find(a => (!best || a.id !== best.id) && (!hot || a.id !== hot.id)) ||
        byFit.find(a => !best || a.id !== best.id) || hot;
      return { best, hot, rec };
    };

    const card = (entry, ribbon, extra) => {
      if (!entry) return "";
      const a = entry.army || entry;
      const score = entry.score != null ? entry.score : baseScore(a, th);
      return `<article class="atk-card">
        ${ribbon ? `<div class="atk-ribbon ${ribbon.cls}">${ribbon.label}</div>` : ""}
        <div class="atk-top"><div class="atk-emoji" aria-hidden="true">${a.troops.join(" ")}</div><span class="atk-score">${score}%</span></div>
        <h3>${esc(a.name)}</h3>
        <div class="atk-meta"><span class="atk-pill">${esc(a.type)}</span><span class="atk-pill">TH ${a.minTh}+</span><span class="atk-pill">${esc(a.difficulty)}</span></div>
        <div class="atk-body">
          <p class="atk-line"><b>Army:</b> ${esc(a.comp)}</p>
          <p class="atk-line"><b>Spells:</b> ${esc(a.spells)}</p>
          ${extra || ""}
          <details><summary>Attack plan</summary><ol>${a.plan.map(step => `<li>${esc(step)}</li>`).join("")}</ol></details>
          <p class="atk-risk"><b>Watch out:</b> ${esc(a.risks.join(" ") || "No major counter listed.")}</p>
          <button type="button" class="atk-copy" data-plan="${esc(a.id)}">⧉ Copy attack plan</button>
        </div>
      </article>`;
    };

    function renderThs() {
      $("#atkThs").innerHTML = Array.from({ length: 12 }, (_, i) => 19 - i).map(n => `
        <button type="button" class="atk-th ${n === th ? "on" : ""}" data-th="${n}" aria-pressed="${n === th}" aria-label="Town Hall ${n}">
          <img src="${thImage(n)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🏰',style:'font-size:26px'}))">
          <b>${n}</b><small>TH</small>
        </button>`).join("");
    }

    function renderAll() {
      const list = available(th).slice().sort((a, b) => baseScore(b, th) - baseScore(a, th));
      if (!list.length) {
        $("#atkPicks").innerHTML = `<div class="atk-block"><p class="atk-line">No attacks are listed for this Town Hall yet.</p></div>`;
        $("#atkList").innerHTML = "";
        return;
      }
      if (!list.some(a => a.id === armyId)) armyId = list[0].id;
      const picks = pickThree(th);
      const analysisTarget = list.find(a => a.id === armyId) || list[0];
      const result = analyze(analysisTarget, th, trait);
      const pickMap = new Map();
      if (picks.best) pickMap.set(picks.best.id, { label: "Best attack", cls: "best" });
      if (picks.hot && !pickMap.has(picks.hot.id)) pickMap.set(picks.hot.id, { label: "Hot right now", cls: "hot" });
      if (picks.rec && !pickMap.has(picks.rec.id)) pickMap.set(picks.rec.id, { label: "Recommended", cls: "rec" });
      $("#atkPicks").innerHTML = list.filter(a => pickMap.has(a.id))
        .sort((a, b) => baseScore(b, th) - baseScore(a, th))
        .map(a => card({ army: a, score: baseScore(a, th) }, pickMap.get(a.id))).join("");

      $("#atkAnalysis").innerHTML = `
        <div class="atk-dial" style="--p:${result.score}%"><span>${result.score}</span><small>AI SCORE</small></div>
        <div class="atk-verdict">
          <b>${esc(analysisTarget.name)} · Grade ${result.grade}</b>
          <p>${esc(result.verdict)}</p>
          <div class="atk-tags">
            <span class="atk-tag ${result.score >= 82 ? "good" : ""}">TH ${th} fit</span>
            <span class="atk-tag">${esc(analysisTarget.type)}</span>
            <span class="atk-tag">${esc(analysisTarget.difficulty)}</span>
            <span class="atk-tag">${analysisTarget.popularity}% popular</span>
          </div>
          <ul class="atk-notes">${result.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
        </div>`;

      $("#atkList").innerHTML = list.map(a => {
        const s = baseScore(a, th);
        return `<div class="atk-row">
          <div class="atk-row-top"><b>${esc(a.name)}</b><span class="atk-pill">${esc(a.type)}</span><span class="atk-pill">${esc(a.difficulty)}</span><span class="atk-pill" style="margin-left:auto">${s}% fit</span></div>
          <div class="atk-bar"><i style="width:${s}%"></i></div>
          <small>${esc(a.comp)} · ${esc(a.spells)}</small>
        </div>`;
      }).join("");

      const select = $("#atkArmySelect");
      select.innerHTML = list.map(a => `<option value="${a.id}">${esc(a.name)} · ${baseScore(a, th)}%</option>`).join("");
      select.value = analysisTarget.id;
    }

    const secHeading = $(".section-heading", sec);
    const box = document.createElement("div");
    box.className = "cx-panel cx-app atk-app";
    box.id = "pdxAttacksApp";
    box.innerHTML = `
      <div class="atk-block">
        <h4>1 · Pick your Town Hall</h4>
        <div class="atk-ths" id="atkThs" role="group" aria-label="Choose a Town Hall"></div>
      </div>
      <div class="atk-block">
        <h4>2 · AI attack analysis</h4>
        <div class="atk-analysis" id="atkAnalysis" aria-live="polite"></div>
        <div class="atk-controls">
          <label>Attack to analyse
            <select id="atkArmySelect"></select>
          </label>
          <label>Enemy base style
            <select id="atkTraitSelect">${TRAITS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
          </label>
        </div>
      </div>
      <div class="atk-block">
        <h4 id="atkPicksTitle">3 · Best, hot and recommended</h4>
        <div class="atk-picks" id="atkPicks"></div>
      </div>
      <div class="atk-block">
        <h4>Every strong attack for this Town Hall</h4>
        <div class="atk-list" id="atkList"></div>
      </div>
      <p class="cx-help">The analyser scores each attack from its Town Hall range, difficulty and popularity, then adjusts for the base style you pick. It is a training aid, not a guarantee — scouting and execution still decide the raid.</p>`;

    Array.from(sec.children).forEach(ch => {
      if (ch !== box && ch !== secHeading && !ch.classList.contains("section-heading")) ch.classList.add("cx-legacy");
    });
    sec.appendChild(box);
    const sub = $(".section-subtitle", sec);
    if (sub) sub.textContent = "AI attack analysis and the best, hottest and most recommended attacks for every Town Hall.";

    box.addEventListener("click", event => {
      const button = event.target.closest("[data-th]");
      if (!button) return;
      th = Number(button.dataset.th);
      renderThs();
      renderAll();
      $("#atkPicksTitle").textContent = "3 · Best, hot and recommended for Town Hall " + th;
    });
    box.addEventListener("click", async event => {
      const button = event.target.closest("[data-plan]");
      if (!button) return;
      const army = ARMIES.find(a => a.id === button.dataset.plan);
      if (!army) return;
      const text = [
        army.name + " — TH " + army.minTh + "+" + (army.maxTh ? "–" + army.maxTh : "") + " · " + army.type + " · " + army.difficulty,
        "Army: " + army.comp,
        "Spells: " + army.spells,
        "Heroes: " + army.heroes,
        "Plan:",
        ...army.plan.map((step, i) => (i + 1) + ". " + step),
        "Watch out: " + army.risks.join(" ")
      ].join("\n");
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
        try {
          const area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
          document.body.appendChild(area);
          area.select();
          ok = document.execCommand("copy");
          area.remove();
        } catch (_) { ok = false; }
      }
      document.dispatchEvent(new CustomEvent("pdx:toast", { detail: ok ? "Attack plan copied — paste it in clan chat." : "Couldn't copy. Select the plan text and copy it by hand." }));
    });
    document.getElementById("atkArmySelect").addEventListener("change", event => { armyId = event.target.value; renderAll(); });
    document.getElementById("atkTraitSelect").addEventListener("change", event => { trait = event.target.value; renderAll(); });

    renderThs();
    renderAll();
    $("#atkPicksTitle").textContent = "3 · Best, hot and recommended for Town Hall " + th;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup, { once: true });
  else setup();
})();
