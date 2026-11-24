/* PekkaDex — Clash Heroes Encyclopedia page logic (heroes.html)
   Fully static: heroes, equipment, skins and sceneries. No external images,
   every portrait is drawn inline so nothing can 404. */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- data */
  const HEROES = [
    {
      id: "barbarian-king", name: "Barbarian King", role: "Ground tank", unlock: "Town Hall 7",
      icon: "👑", target: "Ground only", speed: "Medium",
      bio: "The first hero most Chiefs unlock. He walks into the thick of the fight, soaks up damage and clears a path for the rest of the army.",
      ability: { name: "Iron Fist", desc: "When the ability is triggered the King grows in size, hits harder and recovers a chunk of health. Save it for the moment he reaches the core." },
      stats: { health: 10, damage: 8, speed: 5, utility: 6 },
      art: { skin: "#f4c593", hair: "#d9a12b", armor: "#93a4b3", accent: "#f7b823", face: "beard", head: "crown" },
      equipment: [
        ["Barbarian Puppet", "Common", "🪆", "Summons a group of Barbarians around the King when his ability is used. Good for extra bodies in the funnel."],
        ["Rage Vial", "Common", "🧪", "Drops a rage spell on the King when the ability triggers, boosting his damage and speed."],
        ["Earthquake Boots", "Common", "👟", "The King stomps on landing, damaging and slowing nearby buildings and walls."],
        ["Vampstache", "Epic", "🧛", "Every hit he lands heals him, which keeps him alive through long walks."],
        ["Giant Gauntlet", "Epic", "🧤", "Greatly increases his size and damage, and his punches send out a shockwave."],
        ["Spiky Ball", "Epic", "⚽", "Throws a bouncing spiked ball that damages several defences in a line."]
      ],
      skins: [
        ["Bruiser King", "Legendary", "1,500 Gems", "#f2b21c", "The gold-plated brawler look from the Hero Skins shop."],
        ["Gladiator King", "Legendary", "1,500 Gems", "#9b5b2a", "Arena armour with a crested helmet and twin blades."],
        ["King Barbarian", "Epic", "₱189.00", "#b02c2c", "Classic barbarian warpaint, fur and a heavy axe."],
        ["Valhalla King", "Epic", "Gold Pass", "#4c7fc4", "Frost-blue northern armour with a horned helm."]
      ]
    },
    {
      id: "archer-queen", name: "Archer Queen", role: "Ranged damage", unlock: "Town Hall 9",
      icon: "🏹", target: "Ground & Air", speed: "Fast",
      bio: "The precision tool of every attack. She picks off defences from range and her ability buys precious seconds on the inside of a base.",
      ability: { name: "Royal Cloak", desc: "She turns invisible for a few seconds and heals herself, letting her slip past splash defences and finish a core compartment." },
      stats: { health: 6, damage: 10, speed: 7, utility: 8 },
      art: { skin: "#f7d3ad", hair: "#8b4fd6", armor: "#3f7fbf", accent: "#ffe778", face: "long", head: "tiara" },
      equipment: [
        ["Archer Puppet", "Common", "🏹", "Summons Archers to fight beside the Queen when her ability is used."],
        ["Invisibility Vial", "Common", "🧪", "Extends and strengthens her cloak, keeping her hidden for longer."],
        ["Giant Arrow", "Epic", "🎯", "Fires one huge arrow across the base that damages every building it crosses."],
        ["Healer Puppet", "Epic", "💗", "Summons Healers that follow and heal nearby troops."],
        ["Frozen Arrow", "Epic", "❄️", "Her arrows slow the buildings they hit, buying time for the push."],
        ["Magic Mirror", "Epic", "🪞", "Creates a copy of the Queen that fights alongside her for a short time."]
      ],
      skins: [
        ["Fury Queen", "Legendary", "₱189.00", "#c03a8a", "Red braids, a visor and dual hand crossbows."],
        ["Elven Archer", "Epic", "1,500 Gems", "#3f9d6a", "Forest-green elven armour with a longbow."],
        ["Valkyrie Queen", "Legendary", "1,500 Gems", "#8d6fd6", "Winged helm and a spear of the fallen."],
        ["Archer Queen of the North", "Epic", "Gold Pass", "#5aa8d6", "Winter furs and a crystal-tipped arrow."]
      ]
    },
    {
      id: "grand-warden", name: "Grand Warden", role: "Support hero", unlock: "Town Hall 11",
      icon: "🧙", target: "Ground & Air", speed: "Medium",
      bio: "The only hero who can be set to follow your army. His aura keeps troops alive and his ability can turn a losing push into a three star.",
      ability: { name: "Eternal Tome", desc: "Makes nearby troops and heroes invulnerable for a few seconds — the classic answer to a Eagle Artillery or Monolith shot." },
      stats: { health: 5, damage: 6, speed: 6, utility: 10 },
      art: { skin: "#e8b98e", hair: "#b06be0", armor: "#6d5bb5", accent: "#ffe778", face: "beard", head: "circlet" },
      equipment: [
        ["Eternal Tome", "Common", "📖", "The default book. Grants temporary invulnerability to nearby troops."],
        ["Life Gem", "Common", "💎", "Increases the health of troops inside the Warden's aura."],
        ["Rage Gem", "Epic", "🔴", "Troops in the aura deal more damage while the ability is active."],
        ["Healing Tome", "Epic", "💚", "Heals all friendly troops in range instead of only shielding them."],
        ["Fireball", "Epic", "🔥", "Calls down a massive fireball that can wipe out a whole compartment."],
        ["Lavaloon Puppet", "Epic", "🎈", "Summons Lava Hounds and Balloons when the ability is used."]
      ],
      skins: [
        ["Shaman Warden", "Legendary", "₱189.00", "#5c7f3f", "Tribal mask, staff and a cloak of feathers."],
        ["Grand Mage", "Epic", "1,500 Gems", "#7a4fd6", "Arcane robes with a floating spellbook."],
        ["Party Warden", "Rare", "Event reward", "#e05aa8", "Confetti robe and a party hat. Purely for style."],
        ["Frost Warden", "Epic", "Gold Pass", "#4f9fd6", "Ice-crowned robes that match the winter sceneries."]
      ]
    },
    {
      id: "royal-champion", name: "Royal Champion", role: "Defence hunter", unlock: "Town Hall 13",
      icon: "🛡️", target: "Ground & Air", speed: "Fast",
      bio: "A mobile duelist who jumps straight onto defences. She is usually sent in behind the main push to clean up the back end of a base.",
      ability: { name: "Seeking Shield", desc: "Throws her shield at up to four defences, damaging them and then returning to her hand." },
      stats: { health: 7, damage: 9, speed: 8, utility: 7 },
      art: { skin: "#e8b98e", hair: "#3f6fd0", armor: "#3c8fd6", accent: "#ffe778", face: "short", head: "band" },
      equipment: [
        ["Seeking Shield", "Common", "🛡️", "Her signature throw: the shield bounces between four defences."],
        ["Royal Gem", "Common", "💠", "Restores health and shields her when the ability is used."],
        ["Hog Rider Puppet", "Common", "🐗", "Summons Hog Riders that jump onto nearby defences."],
        ["Haste Vial", "Epic", "⚡", "Gives her a burst of speed and attack rate."],
        ["Rocket Spear", "Epic", "🚀", "Launches a spear that explodes on impact for heavy area damage."],
        ["Electro Boots", "Epic", "🥾", "Her leaps chain lightning between nearby buildings."]
      ],
      skins: [
        ["Nomad Champion", "Legendary", "₱189.00", "#d69a2a", "Desert wanderer with a spear and round shield."],
        ["Tempest Champion", "Legendary", "1,500 Gems", "#3f9fd6", "Storm armour crackling with lightning."],
        ["Champion of the Sea", "Epic", "Gold Pass", "#1f7f9c", "Coral armour and a trident."]
      ]
    },
    {
      id: "minion-prince", name: "Minion Prince", role: "Air support", unlock: "Town Hall 16",
      icon: "🦇", target: "Ground & Air", speed: "Fast",
      bio: "An airborne hero who flies over walls and adds constant pressure. He is the natural pick for air armies and for reaching compartments ground heroes cannot.",
      ability: { name: "Dark Orb", desc: "Drops a dark orb that damages and slows everything beneath him while he keeps attacking from the air." },
      stats: { health: 6, damage: 8, speed: 9, utility: 6 },
      art: { skin: "#8fd8ee", hair: "#2a4f9e", armor: "#4b3f8f", accent: "#b06be0", face: "short", head: "horns" },
      equipment: [
        ["Henchmen Puppet", "Common", "🦇", "Summons Minions that swarm the nearest defences."],
        ["Dark Orb", "Epic", "🔮", "A slowing, damaging orb dropped on the strongest defence below."],
        ["Metal Pants", "Epic", "🩳", "Heavy armour for his legs: more health and reduced knockback."],
        ["Fire Fork", "Epic", "🍴", "Hurls a burning trident that pierces a line of buildings."]
      ],
      skins: [
        ["Armored Prince", "Legendary", "₱189.00", "#7f8fa6", "Full plate armour with a glowing blue core."],
        ["Lich Prince", "Legendary", "1,500 Gems", "#5c8fa6", "Undead crown and spectral wings."],
        ["Anime Fury Prince", "Epic", "Event reward", "#e05aa8", "Bright anime-inspired armour with energy trails."],
        ["Fallen Prince", "Epic", "Gold Pass", "#3f3f6f", "Dark feathers and a broken halo."]
      ]
    },
    {
      id: "dragon-duke", name: "Dragon Duke", role: "Melee brawler", unlock: "Town Hall 17",
      icon: "🐲", target: "Ground only", speed: "Fast",
      bio: "A close-range bruiser who fights with fire. He is built to punch through a compartment and stay there, trading hits with defences.",
      ability: { name: "Heart of Fire", desc: "Ignites his attacks and leaves a trail of flame, damaging everything he walks past." },
      stats: { health: 9, damage: 9, speed: 6, utility: 5 },
      art: { skin: "#e9a067", hair: "#8f3a1f", armor: "#6b3f2a", accent: "#ff8a3c", face: "wild", head: "helm" },
      equipment: [
        ["Rocket Backpack", "Common", "🚀", "Short rocket boosts that carry him over a wall."],
        ["Flame Blower", "Common", "🔥", "A cone of flame that damages several buildings in front of him."],
        ["Electro Fangs", "Epic", "⚡", "Bites chain lightning between nearby defences."],
        ["Heart of Fire", "Epic", "❤️‍🔥", "His ability: burning attacks and a damaging trail."],
        ["Shock Blast", "Epic", "💥", "A ground slam that stuns defences in a small radius."]
      ],
      skins: [
        ["Drakan Duke", "Legendary", "1,500 Gems", "#a8431f", "Scaled armour and dragon-wing pauldrons."],
        ["Hydra Duke", "Legendary", "₱189.00", "#2f8f6f", "Three-headed hydra theme with green flame."],
        ["Kane", "Epic", "Event reward", "#6f3f9f", "Shadow-flame armour with a horned mask."],
        ["Anime Fury Dragon Duke", "Epic", "Gold Pass", "#e05a2a", "Over-the-top spiky armour and fire aura."]
      ]
    }
  ];

  const SCENERIES = [
    ["Year of the Snake", "🐍", "linear-gradient(160deg,#3fbf7f,#0b5a3a)", "Lunar New Year scenery with lanterns, blossom trees and a serpent statue."],
    ["Clash of Dragons", "🐉", "linear-gradient(160deg,#c0563a,#5a1a12)", "Volcanic dragon roost with lava rivers and bone arches."],
    ["Wasteland Scenery", "🏜️", "linear-gradient(160deg,#e0b25a,#7a4a12)", "Cracked desert ground, rusted walls and a bone-dry well."],
    ["Ruined Kingdom Wasteland", "🏰", "linear-gradient(160deg,#8f8f9f,#33333f)", "A broken castle backdrop with fog and fallen towers."],
    ["Snow Day", "❄️", "linear-gradient(160deg,#a8d8f0,#3f6f9f)", "Snow-covered pines, frozen ponds and a cosy lodge."],
    ["Pirate Cove", "🏴‍☠️", "linear-gradient(160deg,#3f9fb0,#0b3f5e)", "A smuggler's harbour with docks, cannons and a treasure hoard."],
    ["Jungle Ruins", "🌿", "linear-gradient(160deg,#4fa845,#124a1f)", "Overgrown temple stones, hanging vines and hidden statues."],
    ["Royal Arena", "🏟️", "linear-gradient(160deg,#d6b25a,#6b4a12)", "A tournament ground with banners, sand and spectator stands."]
  ];

  /* --------------------------------------------------------------- utils */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const heroById = id => HEROES.find(h => h.id === id) || HEROES[0];
  const slug = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* Drop-in art: put a file at assets/<folder>/<slug>.webp|png|jpg|svg and it is
     used automatically. Without a file the drawn portrait or emoji stays. */
  const ART_EXTS = ["webp", "png", "jpg", "jpeg", "svg"];
  window.pdxArtFail = img => {
    const next = (Number(img.dataset.ext) || 0) + 1;
    if (next < ART_EXTS.length) {
      img.dataset.ext = next;
      img.src = img.dataset.base + "." + ART_EXTS[next];
    } else {
      img.remove();
    }
  };
  const dropIn = (folder, name, alt) => {
    const base = `./assets/${folder}/${slug(name)}`;
    return `<img class="drop-in" alt="${esc(alt || name)}" loading="lazy" src="${base}.${ART_EXTS[0]}" data-base="${base}" data-ext="0" onload="this.classList.add('is-on')" onerror="window.pdxArtFail(this)">`;
  };

  /* ------------------------------------------------------- hero portraits
     One design per hero lives in assets/heroes/<hero-id>.svg so the same
     artwork is used on the homepage chips, the picks, the profile and the
     skin cards (tinted) without any page ever loading a missing image. */
  function portrait(h, label, tint) {
    const alt = esc(label || h.name + " portrait");
    const img = `<img src="./assets/heroes/${h.id}.svg" width="240" height="240" alt="${alt}" loading="lazy" onerror="this.remove()">`;
    return tint ? `<span class="hero-tint" style="--t:${tint}">${img}<i aria-hidden="true"></i></span>` : img;
  }

  function runeArt() {
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#ffffff" stroke-opacity=".35" fill="none" stroke-width="2">
        <circle cx="60" cy="60" r="44" stroke-dasharray="6 10"/>
        <circle cx="60" cy="60" r="33" stroke-dasharray="3 9"/>
        <path d="M60 12v16M60 92v16M12 60h16M92 60h16"/>
      </g>
      <g fill="#ffffff" fill-opacity=".5">
        <circle cx="60" cy="16" r="2.4"/><circle cx="104" cy="60" r="2.4"/><circle cx="60" cy="104" r="2.4"/><circle cx="16" cy="60" r="2.4"/>
      </g>
    </svg>`;
  }

  function figure(h, tint) {
    /* Hero bust used inside skin cards; the tint echoes that skin's theme. */
    return `<span class="art-figure">${portrait(h, h.name + " skin preview", tint)}</span>`;
  }

  /* --------------------------------------------------------------- state */
  let selected = HEROES[0].id;
  let mainTab = "heroes";
  let heroTab = "overview";
  let cosmeticTab = "skins";
  let skinFilter = "all";
  let eqLevel = 1;

  /* -------------------------------------------------------------- render */
  function renderHeroPicks(target, compact) {
    const root = $(target);
    if (!root) return;
    root.innerHTML = HEROES.map(h => `
      <button type="button" class="hero-pick ${h.id === selected ? "is-active" : ""}" data-hero="${h.id}"
        aria-pressed="${h.id === selected}" aria-label="${esc(h.name)}">
        <span class="portrait">${portrait(h)}</span>
        <strong>${esc(h.name)}</strong>
        ${compact ? "" : `<small>${esc(h.role)}</small>`}
      </button>`).join("");
  }

  function statsMarkup(h) {
    const labels = { health: "Health", damage: "Damage", speed: "Speed", utility: "Utility" };
    return `<div class="stat-bars">${Object.keys(labels).map(key => `
      <div class="stat-bar">
        <div><span>${labels[key]}</span><span>${h.stats[key]}/10</span></div>
        <i><b style="width:${h.stats[key] * 10}%"></b></i>
      </div>`).join("")}</div>`;
  }

  /* Equipment levels: Commons upgrade to 18, Epics to 27. The damage shown per
     level is an illustrative progression so you can see how adding levels moves
     the number; it is not a scraped in-game table. */
  const EQ_LEVELS = { Common: { min: 1, max: 18, base: 90, step: 6 }, Epic: { min: 1, max: 27, base: 260, step: 12 } };
  const eqRange = rarity => EQ_LEVELS[rarity] || EQ_LEVELS.Common;
  const eqEffective = (rarity, level) => Math.min(Math.max(level, 1), eqRange(rarity).max);
  const eqDamage = (rarity, level) => {
    const r = eqRange(rarity);
    return r.base + (eqEffective(rarity, level) - r.min) * r.step;
  };

  function syncEqLevel() {
    const out = $("#eqLevelOut");
    if (out) out.textContent = eqLevel;
    $$(".equipment-card[data-rarity]").forEach(card => {
      const rarity = card.dataset.rarity;
      const eff = eqEffective(rarity, eqLevel);
      const lv = $(".eq-stat", card), dmg = $(".eq-dmg", card);
      if (lv) lv.textContent = "Lv " + eff + (eff < eqLevel ? " (max)" : "");
      if (dmg) dmg.textContent = eqDamage(rarity, eqLevel);
    });
  }

  function setEqLevel(value) {
    eqLevel = Math.min(Math.max(Number(value) || 1, 1), 27);
    syncEqLevel();
  }

  function equipmentMarkup(h) {
    return `<div class="eq-level-bar">
      <label for="eqLevelRange">Equipment level <b id="eqLevelOut">${eqLevel}</b></label>
      <input id="eqLevelRange" type="range" min="1" max="27" step="1" value="${eqLevel}" aria-label="Equipment level">
      <small>Commons upgrade 1–18, Epics 1–27. Every level adds a fixed amount of damage; the numbers are an illustrative progression, not in-game values.</small>
    </div>
    <div class="equipment-grid">${h.equipment.map(([name, rarity, icon, desc]) => {
      const max = eqRange(rarity).max;
      const eff = eqEffective(rarity, eqLevel);
      return `<article class="equipment-card" data-rarity="${rarity}">
        <span class="eq-icon" aria-hidden="true">${icon}${dropIn("equipment", name, name)}</span>
        <div>
          <b>${esc(name)}</b>
          <span class="rarity ${rarity.toLowerCase()}">${esc(rarity)}</span>
          <span class="eq-levels">Lv 1–${max}</span>
          <small>${esc(desc)}</small>
          <span class="eq-progress"><b class="eq-stat">Lv ${eff}${eff < eqLevel ? " (max)" : ""}</b> · <b class="eq-dmg">${eqDamage(rarity, eqLevel)}</b> damage</span>
        </div>
      </article>`;
    }).join("")}</div>`;
  }

  function heroSkinCards(h) {
    if (!h.skins.length) return `<div class="empty">No skins listed for this hero yet.</div>`;
    return `<div class="skin-grid">${h.skins.map(([name, rarity, price, tint], i) => `
      <article class="skin-card ${i === 0 ? "is-featured" : ""}" style="--skin:${tint}">
        <h3 class="skin-name">${esc(name)}</h3>
        <div class="skin-art" style="background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.28),transparent 65%),linear-gradient(160deg,${tint},#00000055)">
          <span class="art-rune">${runeArt()}</span>
          ${figure(h, tint)}
          ${dropIn("skins", name, name)}
          <span class="skin-rarity">${esc(rarity)}</span>
        </div>
        <div class="skin-price"><span class="gem" aria-hidden="true"></span>${esc(price)}</div>
      </article>`).join("")}</div>`;
  }

  function renderProfile() {
    const h = heroById(selected);
    $("#heroAvatar").innerHTML = portrait(h);
    $("#heroName").textContent = h.name;
    $("#heroRole").textContent = h.role;
    $("#heroDesc").textContent = h.bio;
    $("#heroMeta").innerHTML = `<span>Unlocked at ${esc(h.unlock)}</span><span>Targets: ${esc(h.target)}</span><span>Speed: ${esc(h.speed)}</span>`;
    $$("[data-hero-tab]").forEach(b => {
      const on = b.dataset.heroTab === heroTab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    const content = $("#heroContent");
    if (heroTab === "equipment") {
      content.innerHTML = `<h3 class="section-title">Equipment available to ${esc(h.name)}</h3>${equipmentMarkup(h)}
        <div class="level-note"><h3>How equipment works</h3><p>Each hero can carry two pieces of equipment. Commons start unlocked, Epics are earned through events and the shop. Upgrading a piece adds damage at every level up to its cap.</p></div>`;
      syncEqLevel();
    } else if (heroTab === "skins") {
      content.innerHTML = `<h3 class="section-title">${esc(h.name)} skins</h3>${heroSkinCards(h)}
        <p class="muted" style="margin-top:12px">Prices shown are shop reference values and change with events and region. Cosmetics never affect hero stats.</p>`;
    } else {
      content.innerHTML = `
        <h3 class="section-title">Strengths</h3>
        ${statsMarkup(h)}
        <div class="ability-card"><h4>Hero ability · ${esc(h.ability.name)}</h4><p>${esc(h.ability.desc)}</p></div>
        <h3 class="section-title">Quick facts</h3>
        <div class="content-grid">
          <article class="item"><div class="item-info"><p class="meta">Unlock</p><h3>${esc(h.unlock)}</h3><p>Requires the matching Hero Hall level to unlock and upgrade.</p></div></article>
          <article class="item"><div class="item-info"><p class="meta">Targets</p><h3>${esc(h.target)}</h3><p>Buildings this hero can attack, and what they can safely ignore.</p></div></article>
          <article class="item"><div class="item-info"><p class="meta">Equipment slots</p><h3>${h.equipment.length} pieces</h3><p>Two can be equipped at the same time. Mix offence with survivability.</p></div></article>
        </div>`;
    }
  }

  function renderEquipmentTab() {
    const h = heroById(selected);
    renderHeroPicks("#equipmentPicks", true);
    $("#equipmentContent").innerHTML = `
      <div class="hero-summary">
        <span class="hero-avatar">${portrait(h)}</span>
        <div class="hero-summary-copy">
          <p class="eyebrow">EQUIPMENT LOADOUT</p>
          <h2>${esc(h.name)}</h2>
          <span class="role-pill">${esc(h.role)}</span>
          <p>${h.equipment.length} pieces listed · equip any two. Common gear comes unlocked, Epics are earned from events, the shop and clan games.</p>
        </div>
      </div>
      ${equipmentMarkup(h)}
      <div class="level-note" style="margin-top:14px"><h3>Upgrade tips</h3><p>Prioritise the equipment you use in every war. Commons are cheap to max; save Epic equipment ore for the one piece that carries your main army.</p></div>`;
    syncEqLevel();
  }

  function renderCosmetics() {
    $$("[data-cosmetic]").forEach(b => {
      const on = b.dataset.cosmetic === cosmeticTab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $("#skinFilters").hidden = cosmeticTab !== "skins";
    if (cosmeticTab === "skins") {
      $("#skinFilters").innerHTML = `
        <div class="show-row">
          <span>Show</span>
          <div class="show-strip" role="group" aria-label="Filter skins by hero">
            <button type="button" class="${skinFilter === "all" ? "is-active" : ""}" data-filter="all" aria-pressed="${skinFilter === "all"}" aria-label="All heroes"><span style="display:grid;place-items:center;width:100%;height:100%;font:400 22px var(--hx-title);color:#fff;background:linear-gradient(#a83fe0,#5a1a9c)">✦</span></button>
            ${HEROES.map(h => `<button type="button" class="${skinFilter === h.id ? "is-active" : ""}" data-filter="${h.id}" aria-pressed="${skinFilter === h.id}" aria-label="${esc(h.name)}">${portrait(h)}</button>`).join("")}
          </div>
        </div>`;
      const list = HEROES.filter(h => skinFilter === "all" || h.id === skinFilter)
        .flatMap(h => h.skins.map(s => ({ skin: s, hero: h })));
      $("#cosmeticContent").innerHTML = list.length ? `<div class="skin-grid">${list.map(({ skin, hero }, index) => {
        const [name, rarity, price, tint] = skin;
        return `<article class="skin-card ${index === 0 ? "is-featured" : ""}">
          <h3 class="skin-name">${esc(name)}</h3>
          <div class="skin-art" style="background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.3),transparent 65%),linear-gradient(160deg,${tint},#00000066)">
            <span class="art-rune">${runeArt()}</span>
            ${figure(hero, tint)}
            ${dropIn("skins", name, name)}
            <span class="skin-rarity">${esc(rarity)}</span>
          </div>
          <div class="skin-price"><span class="gem" aria-hidden="true"></span>${esc(price)}</div>
        </article>`;
      }).join("")}</div>` : `<div class="empty-state"><b>No skins for this hero yet</b>Pick another hero from the Show row.</div>`;
    } else {
      $("#cosmeticContent").innerHTML = `<div class="scenery-grid">${SCENERIES.map(([name, icon, bg, note]) => `
        <article class="scenery-card">
          <div class="scenery-art" style="background:${bg}">${icon}${dropIn("sceneries", name, name)}</div>
          <h3>${esc(name)}</h3>
          <p>${esc(note)}</p>
        </article>`).join("")}</div>`;
    }
  }

  function setMainTab(tab) {
    mainTab = tab;
    $$("[data-main]").forEach(b => {
      const on = b.dataset.main === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $("#heroArea").hidden = tab !== "heroes";
    $("#equipmentArea").hidden = tab !== "equipment";
    $("#cosmeticsArea").hidden = tab !== "cosmetics";
    if (tab === "equipment") renderEquipmentTab();
    if (tab === "cosmetics") renderCosmetics();
  }

  function bind() {
    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.main) { setMainTab(button.dataset.main); return; }
      if (button.dataset.cosmetic) { cosmeticTab = button.dataset.cosmetic; renderCosmetics(); return; }
      if (button.dataset.filter) { skinFilter = button.dataset.filter; renderCosmetics(); return; }
      if (button.dataset.heroTab) { heroTab = button.dataset.heroTab; renderProfile(); return; }
      if (button.dataset.hero) {
        selected = button.dataset.hero;
        heroTab = "overview";
        renderHeroPicks("#heroPicks");
        renderProfile();
        if (mainTab === "equipment") renderEquipmentTab();
        return;
      }
    });
    document.addEventListener("input", event => {
      if (event.target && event.target.id === "eqLevelRange") setEqLevel(event.target.value);
    });
  }

  function readHash() {
    const raw = decodeURIComponent((location.hash || "").replace(/^#/, "")).trim();
    if (!raw) return;
    const match = HEROES.find(h => h.id === raw.toLowerCase().replace(/\s+/g, "-"));
    if (match) {
      selected = match.id;
      heroTab = "overview";
      renderHeroPicks("#heroPicks");
      renderProfile();
      if (mainTab === "equipment") renderEquipmentTab();
      window.requestAnimationFrame(() => {
        const target = document.getElementById("heroArea");
        if (target) target.scrollIntoView({ block: "start" });
      });
    }
  }

  function init() {
    HEROES.forEach(h => { h.skins.forEach(s => { if (!s[3]) s[3] = "#8d37ca"; }); });
    renderHeroPicks("#heroPicks");
    renderProfile();
    bind();
    readHash();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
