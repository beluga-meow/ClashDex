/* PekkaDex — Heroes Encyclopedia module
   Single-page integration: renders inside the existing #heroes section.
   No separate HTML page is created. Existing homepage sections are untouched.
   Add this script after app.js in index.html.
*/
(() => {
  "use strict";
  if (window.__pdxHeroesEncyclopediaLoaded) return;
  window.__pdxHeroesEncyclopediaLoaded = true;

  const HEROES = [
    {
      id: "barbarian-king", name: "Barbarian King", role: "Ground tank", icon: "👑",
      description: "A powerful frontline hero who leads ground attacks and protects nearby troops.",
      equipment: ["Barbarian Puppet", "Rage Vial", "Earthquake Boots", "Vampstache", "Giant Gauntlet", "Spiky Ball"],
      skins: ["Gladiator King", "King Barbarian"]
    },
    {
      id: "archer-queen", name: "Archer Queen", role: "Ranged damage", icon: "🏹",
      description: "A long-range hero suited to precise attacks, funneling and taking key defenses.",
      equipment: ["Archer Puppet", "Invisibility Vial", "Giant Arrow", "Healer Puppet", "Frozen Arrow", "Magic Mirror"],
      skins: ["Elven Archer"]
    },
    {
      id: "grand-warden", name: "Grand Warden", role: "Support hero", icon: "🧙",
      description: "A support hero whose abilities help nearby troops survive critical moments.",
      equipment: ["Eternal Tome", "Life Gem", "Rage Gem", "Healing Tome", "Fireball", "Lavaloon Puppet"],
      skins: ["Grand Mage"]
    },
    {
      id: "royal-champion", name: "Royal Champion", role: "Defense hunter", icon: "🛡️",
      description: "A mobile hero who targets defenses and supports late-stage attack plans.",
      equipment: ["Seeking Shield", "Royal Gem", "Hog Rider Puppet", "Haste Vial", "Rocket Spear", "Electro Boots"],
      skins: ["Tempest Champion"]
    },
    {
      id: "minion-prince", name: "Minion Prince", role: "Air support", icon: "🦇",
      description: "An airborne hero who adds pressure and support to a wide range of armies.",
      equipment: ["Henchmen Puppet", "Dark Orb", "Metal Pants"],
      skins: ["Lich Prince", "Anime Fury Prince"]
    },
    {
      id: "dragon-duke", name: "Dragon Duke", role: "Melee brawler", icon: "🐲",
      description: "A melee hero who fights up close with powerful fire-based attacks.",
      equipment: ["Rocket Backpack", "Flame Blower", "Electro Fangs", "Heart of Fire", "Shock Blast"],
      skins: ["Drakan Duke", "Hydra Duke", "Kane", "Anime Fury Dragon Duke"]
    }
  ];

  const SCENERIES = [
    { name: "Year of the Snake", icon: "🐍", note: "Scenery collection entry" },
    { name: "Clash of Dragons", icon: "🐉", note: "Scenery collection entry" },
    { name: "Wasteland Scenery", icon: "🏜️", note: "Scenery collection entry" },
    { name: "Ruined Kingdom Wasteland", icon: "🏰", note: "Scenery collection entry" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  const CSS = `
  .pdx-ency{display:grid;gap:14px;min-width:0}
  .pdx-intro{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
  .pdx-kicker{font-size:12px;font-weight:900;letter-spacing:1.3px;color:#9a5a12}
  .pdx-intro h3{margin:2px 0 4px;font:400 clamp(23px,4vw,30px) var(--cx-title,Impact,sans-serif);color:var(--cx-ink,#4a2c12)}
  .pdx-intro p{margin:0;color:var(--cx-ink2,#765a38);font-size:14px;line-height:1.45}
  .pdx-seal{display:grid;place-items:center;flex:0 0 58px;height:58px;border:3px solid #5a3300;border-radius:17px;background:linear-gradient(var(--cx-g1,#ffe778),var(--cx-g2,#f7b823));font-size:29px}
  .pdx-main-tabs,.pdx-sub-tabs{display:flex;gap:7px;flex-wrap:wrap}
  .pdx-tab{flex:1 1 130px;min-height:48px;padding:9px 14px;border:3px solid var(--cx-w4,#49290f);border-radius:12px;background:linear-gradient(var(--cx-w1,#b8793b),var(--cx-w2,#805027));color:#fff0c6;font:400 16px var(--cx-title,Impact,sans-serif);text-shadow:0 2px #43240e;box-shadow:0 3px 0 var(--cx-w4,#49290f);cursor:pointer}
  .pdx-tab.is-active{background:linear-gradient(var(--cx-g1,#ffe778),var(--cx-g2,#f7b823));border-color:#5a3300;color:#4a2c12;text-shadow:0 1px #fff8;box-shadow:0 3px 0 #9b6810}
  .pdx-hero-strip{display:flex;gap:0;overflow-x:auto;overscroll-behavior-x:contain;padding:5px 3px 10px;scroll-snap-type:x mandatory;scrollbar-width:thin;min-width:0}
  .pdx-hero-pick{position:relative;display:flex;flex:1 0 112px;min-width:104px;max-width:180px;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:112px;padding:9px 5px 8px;border:2px solid #76502b;border-right-width:1px;border-radius:0;background:linear-gradient(#fff5dc,#e8cf98);color:#4a2c12;cursor:pointer;scroll-snap-align:start}
  .pdx-hero-pick:first-child{border-radius:13px 0 0 13px;border-left-width:3px}
  .pdx-hero-pick:last-child{border-radius:0 13px 13px 0;border-right-width:3px}
  .pdx-hero-pick.is-active{z-index:1;border:3px solid #5a3300;background:linear-gradient(#ffe990,#f5bb32);box-shadow:inset 0 0 0 2px #fff6,0 0 0 2px #f7b823,0 4px 12px #4a2c1266}
  .pdx-portrait{display:grid;place-items:center;width:65px;height:65px;overflow:hidden;border:2px solid #805027;border-radius:13px;background:radial-gradient(circle at 50% 35%,#ffe58b,#bd7a2b);font-size:37px;line-height:1}
  .pdx-portrait img{width:100%;height:100%;object-fit:cover}
  .pdx-hero-pick strong{font:400 14px/1.1 var(--cx-title,Impact,sans-serif);text-align:center}
  .pdx-hero-pick small{font-size:10px;font-weight:800;color:#72502b;text-transform:uppercase;letter-spacing:.35px}
  .pdx-profile{display:grid;gap:13px;padding:14px;border:3px solid var(--cx-w2,#805027);border-radius:17px;background:linear-gradient(#fff8e6,#f1dba9);color:var(--cx-ink,#4a2c12);min-width:0}
  .pdx-profile-head{display:flex;align-items:center;gap:13px;min-width:0}
  .pdx-profile-art{display:grid;place-items:center;flex:0 0 82px;height:82px;border:3px solid #805027;border-radius:18px;background:radial-gradient(circle,#ffe778,#b8793b);font-size:47px;overflow:hidden}
  .pdx-profile-art img{width:100%;height:100%;object-fit:cover}
  .pdx-profile-head h3{margin:0;font:400 clamp(22px,4vw,29px) var(--cx-title,Impact,sans-serif);color:#4a2c12}
  .pdx-role{display:inline-block;margin-top:5px;padding:4px 9px;border:2px solid #805027;border-radius:999px;background:linear-gradient(#ffe778,#f7b823);font-size:12px;font-weight:900;color:#4a2c12}
  .pdx-profile-head p{margin:6px 0 0;font-size:14px;color:#705331;line-height:1.45}
  .pdx-section-title{margin:3px 0 0;font:400 19px var(--cx-title,Impact,sans-serif);color:#4a2c12}
  .pdx-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .pdx-stat{padding:10px 8px;border:2px solid #d3b77e;border-radius:12px;background:#fff5dc;text-align:center;min-width:0}
  .pdx-stat b{display:block;font:400 18px var(--cx-title,Impact,sans-serif);color:#76502b}
  .pdx-stat span{display:block;margin-top:3px;font-size:11px;font-weight:800;color:#806344}
  .pdx-table-wrap{overflow-x:auto;border:2px solid #c5a56c;border-radius:12px;background:#fffaf0}
  .pdx-level-table{width:100%;min-width:520px;border-collapse:collapse;font-size:13px}
  .pdx-level-table th,.pdx-level-table td{padding:9px 10px;border-bottom:1px solid #e2d0a7;text-align:left;white-space:nowrap}
  .pdx-level-table th{background:#e8d09a;color:#4a2c12;font-weight:900}
  .pdx-empty{padding:13px;border:2px dashed #bd9b60;border-radius:12px;background:#fff8e8;color:#755532;font-size:13px;line-height:1.5}
  .pdx-equipment-grid,.pdx-cosmetic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}
  .pdx-equipment{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:2px solid #c6a66e;border-radius:12px;background:#fffaf0}
  .pdx-eq-icon{display:grid;place-items:center;flex:0 0 38px;height:38px;border:2px solid #805027;border-radius:10px;background:linear-gradient(#ffe778,#e7a92d);font-size:20px}
  .pdx-equipment b,.pdx-cosmetic b{display:block;font:400 14px/1.2 var(--cx-title,Impact,sans-serif);color:#4a2c12;overflow-wrap:anywhere}
  .pdx-equipment small,.pdx-cosmetic small{display:block;margin-top:4px;color:#806344;font-size:11px;font-weight:700;line-height:1.35}
  .pdx-cosmetic{overflow:hidden;border:3px solid #805027;border-radius:14px;background:#fffaf0;box-shadow:0 3px 0 #49290f;min-width:0}
  .pdx-cosmetic-art{display:grid;place-items:center;min-height:108px;background:linear-gradient(145deg,#b85be0,#57258d);font-size:49px}
  .pdx-cosmetic.scenery .pdx-cosmetic-art{background:linear-gradient(145deg,#56b8dd,#15548a)}
  .pdx-cosmetic-body{padding:10px}
  .pdx-cosmetic-body p{margin:5px 0 0;color:#806344;font-size:12px}
  .pdx-cosmetic-body .pdx-unverified{font-weight:800;color:#96600e}
  .pdx-filter-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .pdx-search{flex:1 1 220px;min-width:0}
  .pdx-search input{width:100%;box-sizing:border-box}
  .pdx-hidden{display:none!important}
  @media(max-width:560px){.pdx-hero-pick{flex:0 0 100px;min-width:100px;min-height:104px}.pdx-portrait{width:58px;height:58px}.pdx-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pdx-profile{padding:10px}.pdx-profile-art{flex-basis:68px;height:68px;font-size:39px}.pdx-equipment-grid,.pdx-cosmetic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:360px){.pdx-hero-pick{flex-basis:88px;min-width:88px}.pdx-hero-pick strong{font-size:12px}.pdx-equipment-grid,.pdx-cosmetic-grid{grid-template-columns:1fr}}
  `;

  function injectStyles() {
    if ($('#pdx-heroes-style')) return;
    const style = document.createElement('style');
    style.id = 'pdx-heroes-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function init() {
    const section = $('#heroes');
    if (!section || section.dataset.pdxEncyclopedia === '1') return;
    section.dataset.pdxEncyclopedia = '1';
    injectStyles();

    let selectedHero = HEROES[0].id;
    let mainTab = 'heroes';
    let heroTab = 'overview';
    let cosmeticTab = 'skins';
    let skinQuery = '';

    section.innerHTML = `
      <div class="section-heading">
        <div><div class="eyebrow">THE PEKKADEX ARCHIVE</div><h2>Clash <span>Heroes</span> Encyclopedia</h2><p class="section-subtitle">Explore heroes, equipment, skins and sceneries in one archive.</p></div>
        <span class="section-badge">HERO ARCHIVE</span>
      </div>
      <div class="cx-panel cx-app pdx-ency" id="pdxHeroesApp">
        <div class="pdx-intro"><div><span class="pdx-kicker">CLASH OF CLANS COLLECTION</span><h3>Choose your collection</h3><p>Select a hero or browse the cosmetic archive.</p></div><span class="pdx-seal" aria-hidden="true">⚔️</span></div>
        <div class="pdx-main-tabs" role="tablist" aria-label="Encyclopedia categories">
          <button type="button" class="pdx-tab is-active" data-main-tab="heroes" role="tab" aria-selected="true">⚔ HEROES</button>
          <button type="button" class="pdx-tab" data-main-tab="cosmetics" role="tab" aria-selected="false">🎨 COSMETICS</button>
        </div>
        <div id="pdxHeroView">
          <div class="pdx-hero-strip" id="pdxHeroStrip" role="group" aria-label="Choose a hero"></div>
          <div id="pdxHeroProfile"></div>
        </div>
        <div id="pdxCosmeticsView" class="pdx-hidden">
          <div class="pdx-sub-tabs" role="tablist" aria-label="Cosmetic type">
            <button type="button" class="pdx-tab is-active" data-cosmetic-tab="skins" role="tab" aria-selected="true">✨ SKINS</button>
            <button type="button" class="pdx-tab" data-cosmetic-tab="sceneries" role="tab" aria-selected="false">🏞 SCENERIES</button>
          </div>
          <div class="pdx-filter-row" style="margin:12px 0">
            <label class="pdx-search"><span class="pdx-kicker">SEARCH COLLECTION</span><input id="pdxCosmeticSearch" type="search" placeholder="Search skins or sceneries…" autocomplete="off"></label>
          </div>
          <div id="pdxCosmeticGrid" class="pdx-cosmetic-grid"></div>
        </div>
        <p class="cx-help">Fan-made reference. Exact prices, release dates and level-by-level stats are displayed only when verified against current game data.</p>
      </div>`;

    const app = $('#pdxHeroesApp', section);
    const heroStrip = $('#pdxHeroStrip', app);
    const profile = $('#pdxHeroProfile', app);
    const cosmeticGrid = $('#pdxCosmeticGrid', app);
    const search = $('#pdxCosmeticSearch', app);

    function heroImage(h, className) {
      const src = `./assets/heroes/${h.id}.webp`;
      return `<span class="${className}"><img src="${src}" alt="${esc(h.name)} portrait" loading="lazy" onerror="this.remove();this.parentElement.textContent='${h.icon}'"></span>`;
    }

    function renderHeroStrip() {
      heroStrip.innerHTML = HEROES.map(h => `
        <button type="button" class="pdx-hero-pick ${h.id === selectedHero ? 'is-active' : ''}" data-hero-id="${h.id}" aria-pressed="${h.id === selectedHero}">
          ${heroImage(h, 'pdx-portrait')}<strong>${esc(h.name)}</strong><small>${esc(h.role)}</small>
        </button>`).join('');
    }

    function renderProfile() {
      const h = HEROES.find(item => item.id === selectedHero) || HEROES[0];
      const tabs = [
        ['overview', 'OVERVIEW'], ['equipment', 'EQUIPMENT'], ['skins', 'SKINS']
      ];
      let content = '';
      if (heroTab === 'overview') {
        content = `
          <h4 class="pdx-section-title">Hero overview</h4>
          <p style="margin:0;color:#705331;font-size:14px;line-height:1.5">${esc(h.description)}</p>
          <h4 class="pdx-section-title">Hero stats · Level 1 to Max</h4>
          <div class="pdx-empty"><b>Level data pending verification.</b><br>The level-by-level stat table is reserved for verified in-game values. No estimated or invented stats are shown.</div>
        `;
      } else if (heroTab === 'equipment') {
        content = `<h4 class="pdx-section-title">Available equipment</h4><div class="pdx-equipment-grid">${h.equipment.map(name => `
          <article class="pdx-equipment"><span class="pdx-eq-icon" aria-hidden="true">🛠️</span><div><b>${esc(name)}</b><small>Equipment stats by level: awaiting verified data</small></div></article>`).join('')}</div>`;
      } else {
        content = `<h4 class="pdx-section-title">${esc(h.name)} skins</h4><div class="pdx-cosmetic-grid">${h.skins.map(name => `
          <article class="pdx-cosmetic"><div class="pdx-cosmetic-art">✨</div><div class="pdx-cosmetic-body"><b>${esc(name)}</b><small class="pdx-unverified">Price / release date not verified</small></div></article>`).join('')}</div>`;
      }
      profile.innerHTML = `
        <article class="pdx-profile">
          <div class="pdx-profile-head">${heroImage(h, 'pdx-profile-art')}<div style="min-width:0"><h3>${esc(h.name)}</h3><span class="pdx-role">${esc(h.role)}</span><p>${esc(h.description)}</p></div></div>
          <div class="pdx-stat-grid"><div class="pdx-stat"><b>${h.equipment.length}</b><span>Listed equipment</span></div><div class="pdx-stat"><b>${h.skins.length}</b><span>Listed skins</span></div><div class="pdx-stat"><b>1–Max</b><span>Level range</span></div></div>
          <div class="pdx-sub-tabs" role="tablist" aria-label="Hero profile sections">${tabs.map(([id,label]) => `<button type="button" class="pdx-tab ${heroTab === id ? 'is-active' : ''}" data-hero-tab="${id}" role="tab" aria-selected="${heroTab === id}">${label}</button>`).join('')}</div>
          <div class="pdx-profile-content">${content}</div>
        </article>`;
    }

    function renderCosmetics() {
      const q = skinQuery.trim().toLowerCase();
      if (cosmeticTab === 'skins') {
        const items = HEROES.flatMap(h => h.skins.map(name => ({ name, hero: h.name, icon: '✨' })))
          .filter(item => !q || `${item.name} ${item.hero}`.toLowerCase().includes(q));
        cosmeticGrid.innerHTML = items.length ? items.map(item => `
          <article class="pdx-cosmetic"><div class="pdx-cosmetic-art">${item.icon}</div><div class="pdx-cosmetic-body"><b>${esc(item.name)}</b><p>${esc(item.hero)}</p><small class="pdx-unverified">Price / release date not verified</small></div></article>`).join('')
          : '<div class="pdx-empty">No skins match your search.</div>';
      } else {
        const items = SCENERIES.filter(item => !q || `${item.name} ${item.note}`.toLowerCase().includes(q));
        cosmeticGrid.innerHTML = items.length ? items.map(item => `
          <article class="pdx-cosmetic scenery"><div class="pdx-cosmetic-art">${item.icon}</div><div class="pdx-cosmetic-body"><b>${esc(item.name)}</b><p>${esc(item.note)}</p><small class="pdx-unverified">Price / release date not verified</small></div></article>`).join('')
          : '<div class="pdx-empty">No sceneries match your search.</div>';
      }
    }

    function setMainTab(tab) {
      mainTab = tab;
      $('#pdxHeroView', app).classList.toggle('pdx-hidden', tab !== 'heroes');
      $('#pdxCosmeticsView', app).classList.toggle('pdx-hidden', tab !== 'cosmetics');
      app.querySelectorAll('[data-main-tab]').forEach(button => {
        const active = button.dataset.mainTab === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      if (tab === 'cosmetics') renderCosmetics();
    }

    app.addEventListener('click', event => {
      const main = event.target.closest('[data-main-tab]');
      if (main) { setMainTab(main.dataset.mainTab); return; }
      const hero = event.target.closest('[data-hero-id]');
      if (hero) {
        selectedHero = hero.dataset.heroId;
        heroTab = 'overview';
        renderHeroStrip();
        renderProfile();
        return;
      }
      const heroSection = event.target.closest('[data-hero-tab]');
      if (heroSection) { heroTab = heroSection.dataset.heroTab; renderProfile(); return; }
      const cosmetic = event.target.closest('[data-cosmetic-tab]');
      if (cosmetic) {
        cosmeticTab = cosmetic.dataset.cosmeticTab;
        app.querySelectorAll('[data-cosmetic-tab]').forEach(button => {
          const active = button.dataset.cosmeticTab === cosmeticTab;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', String(active));
        });
        renderCosmetics();
      }
    });
    search.addEventListener('input', () => { skinQuery = search.value; renderCosmetics(); });

    renderHeroStrip();
    renderProfile();
    renderCosmetics();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
