(() => {
  "use strict";
  const HEROES = [
    {id:"barbarian-king",name:"Barbarian King",icon:"👑",role:"Ground tank",desc:"Frontline hero that leads ground attacks and tanks for nearby troops.",equipment:[["Barbarian Puppet","Common"],["Rage Vial","Common"],["Earthquake Boots","Common"],["Vampstache","Epic"],["Giant Gauntlet","Epic"],["Spiky Ball","Epic"]],skins:[["Gladiator King","🎖️"],["King Barbarian","⚔️"]]},
    {id:"archer-queen",name:"Archer Queen",icon:"🏹",role:"Ranged damage",desc:"Long-range hero for precise funneling and key defensive targets.",equipment:[["Archer Puppet","Common"],["Invisibility Vial","Common"],["Giant Arrow","Epic"],["Healer Puppet","Epic"],["Frozen Arrow","Epic"],["Magic Mirror","Epic"]],skins:[["Elven Archer","🏹"]]},
    {id:"grand-warden",name:"Grand Warden",icon:"🧙",role:"Support",desc:"Support hero whose abilities protect nearby troops at critical moments.",equipment:[["Eternal Tome","Common"],["Life Gem","Common"],["Rage Gem","Epic"],["Healing Tome","Epic"],["Fireball","Epic"],["Lavaloon Puppet","Epic"]],skins:[["Grand Mage","✨"]]},
    {id:"royal-champion",name:"Royal Champion",icon:"🛡️",role:"Defense hunter",desc:"Mobile hero that hunts defenses and supports late-stage attacks.",equipment:[["Seeking Shield","Common"],["Royal Gem","Common"],["Hog Rider Puppet","Common"],["Haste Vial","Epic"],["Rocket Spear","Epic"],["Electro Boots","Epic"]],skins:[["Tempest Champion","⚡"]]},
    {id:"minion-prince",name:"Minion Prince",icon:"🦇",role:"Air support",desc:"Airborne hero that adds pressure and support to many armies.",equipment:[["Henchmen Puppet","Common"],["Dark Orb","Epic"],["Metal Pants","Epic"]],skins:[["Lich Prince","💀"],["Anime Fury Prince","🌟"]]},
    {id:"dragon-duke",name:"Dragon Duke",icon:"🐲",role:"Melee brawler",desc:"A melee hero who fights up close with powerful fire-based attacks.",equipment:[["Rocket Backpack","Pending verification"],["Flame Blower","Pending verification"],["Electro Fangs","Pending verification"],["Heart of Fire","Pending verification"],["Shock Blast","Pending verification"]],skins:[["Drakan Duke","🐉"],["Hydra Duke","🐲"],["Kane","⭐"],["Anime Fury Dragon Duke","🔥"]]}
  ];
  const SCENERIES = [
    {name:"Year of the Snake",art:"🐍",note:"Scenery catalog entry; details pending verification."},
    {name:"Clash of Dragons",art:"🐉",note:"Scenery catalog entry; details pending verification."},
    {name:"Wasteland Scenery",art:"🏜️",note:"Scenery catalog entry; details pending verification."},
    {name:"Ruined Kingdom Wasteland",art:"🏰",note:"Scenery catalog entry; details pending verification."}
  ];
  const $ = s => document.querySelector(s);
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let selected = HEROES[0].id, heroTab = "overview", mainTab = "heroes", cosmeticTab = "skins", skinFilter = "all";

  function currentHero(){ return HEROES.find(h => h.id === selected) || HEROES[0]; }
  function portraitMarkup(h, large=false){
    const cls = large ? "hero-avatar" : "portrait";
    const path = `./assets/heroes/${h.id}.webp`;
    return `<span class="${cls}"><img src="${path}" alt="${escapeHTML(h.name)} portrait" onerror="this.replaceWith(document.createTextNode('${h.icon}'))"></span>`;
  }
  function heroButtons(target){
    const root = $(target);
    root.innerHTML = HEROES.map(h => `<button type="button" class="hero-pick ${h.id===selected?"is-active":""}" data-hero="${h.id}" aria-pressed="${h.id===selected}">${portraitMarkup(h)}<small>${escapeHTML(h.name)}</small></button>`).join("");
  }
  function equipmentCards(h){
    return `<div class="content-grid">${h.equipment.map(([name,rarity]) => `<article class="item"><div class="item-art">🛠️</div><div class="item-info"><h3>${escapeHTML(name)}</h3><p class="meta">${escapeHTML(rarity)} equipment</p><p>Level 1–maximum statistics are pending verified game data.</p></div></article>`).join("")}</div>`;
  }
  function skinCards(h){
    return h.skins.length ? `<div class="content-grid">${h.skins.map(([name,icon]) => `<article class="item skin"><div class="item-art">${icon}</div><div class="item-info"><h3>${escapeHTML(name)}</h3><p>Hero skin · ${escapeHTML(h.name)}</p><p class="meta">Release date / price: not verified</p></div></article>`).join("")}</div>` : `<div class="empty">No skin entries listed for this hero.</div>`;
  }
  function drawHero(){
    const h = currentHero();
    heroButtons("#heroPicks");
    $("#heroAvatar").innerHTML = portraitMarkup(h,true).replace(/^<span class="hero-avatar">|<\/span>$/g,"");
    $("#heroName").textContent = h.name;
    $("#heroRole").textContent = h.role;
    $("#heroDesc").textContent = h.desc;
    document.querySelectorAll("[data-hero-tab]").forEach(b => b.classList.toggle("is-active",b.dataset.heroTab===heroTab));
    if(heroTab==="equipment") $("#heroContent").innerHTML = equipmentCards(h);
    else if(heroTab==="skins") $("#heroContent").innerHTML = skinCards(h);
    else $("#heroContent").innerHTML = `<div class="level-note"><h3>${escapeHTML(h.name)} overview</h3><p>${escapeHTML(h.desc)}</p><p>Choose Equipment or Skins above to explore this hero's collection.</p><p>Hero level statistics will be added when verified values are available.</p></div>`;
  }
  function drawEquipment(){
    heroButtons("#equipmentPicks");
    $("#equipmentContent").innerHTML = equipmentCards(currentHero());
  }
  function drawCosmetics(){
    const filters = `<button type="button" class="${skinFilter==="all"?"is-active":""}" data-filter="all">All Heroes</button>` + HEROES.map(h => `<button type="button" class="${skinFilter===h.id?"is-active":""}" data-filter="${h.id}">${h.icon} ${escapeHTML(h.name)}</button>`).join("");
    $("#skinFilters").innerHTML = cosmeticTab==="skins" ? filters : "";
    document.querySelectorAll("[data-cosmetic]").forEach(b => b.classList.toggle("is-active",b.dataset.cosmetic===cosmeticTab));
    if(cosmeticTab==="skins"){
      const list = HEROES.filter(h => skinFilter==="all" || h.id===skinFilter).flatMap(h => h.skins.map(s => ({hero:h,skin:s})));
      $("#cosmeticContent").innerHTML = list.length ? `<div class="content-grid">${list.map(x => `<article class="item skin"><div class="item-art">${x.skin[1]}</div><div class="item-info"><h3>${escapeHTML(x.skin[0])}</h3><p>${escapeHTML(x.hero.name)}</p><p class="meta">Price / release date: not verified</p></div></article>`).join("")}</div>` : `<div class="empty">No listed skins for this filter.</div>`;
    } else {
      $("#cosmeticContent").innerHTML = `<div class="content-grid">${SCENERIES.map(s => `<article class="item scenery"><div class="item-art">${s.art}</div><div class="item-info"><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.note)}</p><p class="meta">Price: not verified</p></div></article>`).join("")}</div>`;
    }
  }
  function switchMain(name){
    mainTab = name;
    document.querySelectorAll("[data-main]").forEach(b => b.classList.toggle("is-active",b.dataset.main===name));
    $("#heroArea").hidden = name!=="heroes";
    $("#equipmentArea").hidden = name!=="equipment";
    $("#cosmeticsArea").hidden = name!=="cosmetics";
    if(name==="equipment") drawEquipment();
    if(name==="cosmetics") drawCosmetics();
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if(!button) return;
    if(button.dataset.main) switchMain(button.dataset.main);
    if(button.dataset.hero){
      selected = button.dataset.hero;
      drawHero(); drawEquipment();
    }
    if(button.dataset.heroTab){ heroTab = button.dataset.heroTab; drawHero(); }
    if(button.dataset.cosmetic){ cosmeticTab = button.dataset.cosmetic; drawCosmetics(); }
    if(button.dataset.filter){ skinFilter = button.dataset.filter; drawCosmetics(); }
  });
  drawHero(); drawEquipment(); drawCosmetics();
})();
