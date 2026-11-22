/* CLASHVAULT REDESIGN
   Add this file to the repository root, then load it AFTER auth.js:
   <script src="./clashvault-redesign.js"></script>
*/
(() => {
  "use strict";
  if (window.__clashVaultRedesignLoaded) return;
  window.__clashVaultRedesignLoaded = true;

  const style = document.createElement("style");
  style.textContent = `
    :root{--cv-ink:#24180f;--cv-wood:#4b2c18;--cv-wood2:#704321;--cv-gold:#f4c65e;--cv-gold2:#ffdf87;--cv-stone:#d7c7a5;--cv-grass:#416d36}
    body{background:linear-gradient(180deg,#18251c,#263a27 42%,#18251c);color:#f7ecd4}
    .site-header{background:linear-gradient(#302219,#1d1712);border-color:rgba(244,198,94,.25)}
    .brand-mark,.brand-accent,.section-heading h2 span{color:var(--cv-gold)}
    .main-nav a.active,.main-nav a:hover{color:var(--cv-gold2)}
    .button-green,.header-cta{background:linear-gradient(#79a94d,#426d31);border:1px solid #b8d47a;box-shadow:inset 0 1px #ffffff40,0 4px 0 #294522}
    .button-gold{background:linear-gradient(#ffdc7a,#c58a2f);color:#39210d;border:1px solid #ffe6a2;box-shadow:0 4px 0 #80521e}
    .cv-panel{background:linear-gradient(155deg,#3b2b20,#241b15);border:2px solid #8e6537;border-radius:18px;box-shadow:0 8px 0 #0003,inset 0 1px #ffffff14;padding:20px}
    .cv-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0}
    .cv-select,.cv-input{min-height:48px;border:1px solid #9b784c;border-radius:10px;background:#1d1915;color:#f8edcf;padding:0 14px;width:100%}
    .cv-select:focus,.cv-input:focus{outline:2px solid var(--cv-gold)}
    .cv-tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:2px solid #71502e;margin-bottom:16px}
    .cv-tab,.cv-chip{border:1px solid #8b6539;border-radius:999px;padding:10px 15px;background:#49301d;color:#f7e5c2;font-weight:800;cursor:pointer}
    .cv-tab.active,.cv-chip.active{background:linear-gradient(#ffdf83,#c58b36);color:#39220d;border-color:#ffe6a5}
    .cv-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}
    .cv-criteria{margin-top:14px;padding:14px;background:#211a15;border:1px solid #6d4b2b;border-radius:12px;display:grid;gap:12px}
    .cv-criteria[hidden],.cv-hide[hidden]{display:none!important}
    .cv-check{display:flex;align-items:center;gap:9px;color:#f3e5c9}
    .cv-check input{width:20px;height:20px;accent-color:#d99e3f}
    .cv-help{color:#d7c7a5;font-size:13px;line-height:1.5}
    .cv-result-note{margin-top:14px;padding:12px 14px;background:#211a15;border-left:4px solid var(--cv-gold);color:#ead9b8;border-radius:8px}
    .cv-base-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}
    .cv-card{overflow:hidden;border:2px solid #8a704d;border-radius:14px;background:#f1e5cb;color:#382719;box-shadow:0 5px 0 #0003}
    .cv-art{min-height:155px;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 50% 40%,#8bb65b,#426b35 55%,#283e26);color:white;font-size:56px;text-shadow:0 3px 5px #15220f}
    .cv-art:before{content:"";position:absolute;inset:12px;border:2px dashed #ffffff59;border-radius:12px}
    .cv-body{padding:13px}
    .cv-meta{display:flex;justify-content:space-between;gap:8px;color:#68421f;font-size:11px;font-weight:900;letter-spacing:.6px}
    .cv-body h3{margin:9px 0 6px;color:#352313;font-size:17px}
    .cv-body p{color:#72583d;font-size:13px;min-height:36px}
    .cv-copy{width:100%;border:0;border-radius:9px;padding:11px;background:linear-gradient(#f8bd50,#d77b20);color:#321a08;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #945016}
    .cv-builder-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px}
    .cv-count{padding:14px;text-align:center;border-radius:12px;background:#211a15;border:1px solid #75512f}
    .cv-count strong{display:block;font-size:27px;color:var(--cv-gold)}
    .cv-count span{color:#d8c5a3;font-size:11px;font-weight:800}
    .cv-builder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .cv-builder{background:linear-gradient(150deg,#4a3524,#2a2018);border:1px solid #8c693d;border-radius:13px;padding:15px}
    .cv-builder-state{font-size:11px;font-weight:900;letter-spacing:1px;color:#8fdb91}
    .cv-builder.working .cv-builder-state{color:#f2c65e}
    .cv-builder h3{margin:9px 0 5px;color:#fff0d0}
    .cv-builder p{color:#d5c2a0;font-size:12px;min-height:32px}
    .cv-toggle{width:100%;border:1px solid #caa15a;background:#624322;color:#fff0d0;border-radius:8px;padding:10px;font-weight:800;cursor:pointer}
    .cv-builder.working .cv-toggle{background:#426d36}
    .cv-login-needed{text-align:center;padding:30px 18px;color:#f3e5c9}
    .cv-login-needed a{color:#ffdb7b;font-weight:800}
    @media(max-width:650px){.cv-base-grid{gap:10px}.cv-art{min-height:115px;font-size:44px}.cv-body{padding:10px}.cv-body h3{font-size:14px}.cv-builder-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cv-search-row{grid-template-columns:1fr}.cv-toolbar>*{flex:1 1 100%}}
    @media(max-width:380px){.cv-base-grid,.cv-builder-grid{grid-template-columns:1fr}.cv-builder-summary{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const thOptions = Array.from({length:19},(_,i)=>19-i);
  const thSelect = (id, label="All Town Halls") =>
    `<select class="cv-select" id="${id}" aria-label="${label}">
      <option value="all">${label}</option>
      ${thOptions.map(n=>`<option value="${n}">🏰 Town Hall ${n}</option>`).join("")}
    </select>`;

  function notify(message){
    const toast=$("#toast");
    if(toast){toast.textContent=message;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2400);}
    else alert(message);
  }

  function renderPlayerFinder(){
    const section=$("#player-finder");
    if(!section)return;
    section.innerHTML=`
      <div class="section-heading"><div><div class="eyebrow">FIND CHIEFS & CLANS</div><h2>Player <span>Finder</span></h2><p class="section-subtitle">Search players and clans using clear filters.</p></div><span class="section-badge">PLAYER INTEL</span></div>
      <div class="cv-panel">
        <div class="cv-tabs" role="tablist">
          <button class="cv-tab active" type="button" data-search-tab="players">👤 Search Players</button>
          <button class="cv-tab" type="button" data-search-tab="clans">👥 Search Clans</button>
        </div>
        <div id="cvPlayerPane">
          <form id="cvPlayerForm">
            <div class="cv-search-row"><input class="cv-input" id="cvPlayerQuery" placeholder="Find a Player (enter Name or Tag)" autocomplete="off"><button class="button button-green" type="submit">Search Player →</button></div>
            <div class="cv-toolbar"><button class="cv-chip" type="button" id="cvPlayerCriteriaBtn">＋ Add criteria</button></div>
            <div class="cv-criteria" id="cvPlayerCriteria" hidden>
              <label class="cv-check"><input type="checkbox" id="cvExactName"> Only Players with that exact Name</label>
              ${thSelect("cvPlayerTH")}
              <p class="cv-help">Town Hall filter is applied when the connected search source supports it.</p>
              <button class="cv-chip" type="button" id="cvClosePlayerCriteria">Close criteria</button>
            </div>
          </form>
        </div>
        <div id="cvClanPane" hidden>
          <form id="cvClanForm">
            <div class="cv-search-row"><input class="cv-input" id="cvClanQuery" placeholder="Find a Clan (enter Name or Tag)" autocomplete="off"><button class="button button-green" type="submit">Search Clan →</button></div>
            <div class="cv-toolbar"><button class="cv-chip" type="button" id="cvClanCriteriaBtn">＋ Add criteria</button></div>
            <div class="cv-criteria" id="cvClanCriteria" hidden>
              <label class="cv-help">Minimum Clan Level</label><input class="cv-input" id="cvClanLevel" type="number" min="1" max="30" placeholder="Any level">
              <label class="cv-help">Minimum Members</label><input class="cv-input" id="cvClanMembers" type="number" min="1" max="50" placeholder="Any member count">
              ${thSelect("cvClanTH","Any Town Hall")}
              <button class="cv-chip" type="button" id="cvCloseClanCriteria">Close criteria</button>
            </div>
          </form>
        </div>
        <div class="cv-result-note" id="cvSearchMessage" aria-live="polite">Choose Players or Clans, enter a name or tag, then search. Live results need a secure official API connection.</div>
      </div>`;
    const pPane=$("#cvPlayerPane"),cPane=$("#cvClanPane"),message=$("#cvSearchMessage");
    $$("[data-search-tab]",section).forEach(btn=>btn.addEventListener("click",()=>{
      $$("[data-search-tab]",section).forEach(b=>b.classList.toggle("active",b===btn));
      const players=btn.dataset.searchTab==="players";
      pPane.hidden=!players;cPane.hidden=players;
      message.textContent=players?"Search by player tag for a direct profile lookup.":"Search by clan name or clan tag. Live results need the secure API connection.";
    }));
    $("#cvPlayerCriteriaBtn").onclick=()=>$("#cvPlayerCriteria").hidden=false;
    $("#cvClosePlayerCriteria").onclick=()=>$("#cvPlayerCriteria").hidden=true;
    $("#cvClanCriteriaBtn").onclick=()=>$("#cvClanCriteria").hidden=false;
    $("#cvCloseClanCriteria").onclick=()=>$("#cvClanCriteria").hidden=true;
    $("#cvPlayerForm").addEventListener("submit",e=>{
      e.preventDefault();
      const q=$("#cvPlayerQuery").value.trim();
      if(!q){message.textContent="Please enter a player name or tag.";return;}
      if(q.startsWith("#")||/^[0289PYLQGRJCUV]{3,15}$/i.test(q.replace(/^#/,""))){
        message.textContent="Player tag format received. To show the real profile, connect the secure Clash of Clans API backend. A tag is required for direct player profile lookup.";
      }else{
        message.textContent="Name search selected. The official API does not provide a global player-name search. Search within a clan member list or enter the exact Player Tag to identify the correct Chief.";
      }
    });
    $("#cvClanForm").addEventListener("submit",e=>{
      e.preventDefault();
      const q=$("#cvClanQuery").value.trim();
      message.textContent=q
        ?"Clan search request prepared. Real clan results and criteria need the secure official API backend; no sample clans are being shown as real results."
        :"Please enter a clan name or clan tag.";
    });
  }

  const sampleBases=[
    ["Anti 3-Star Fortress",19,"War","🛡️","Anti 3 Stars"],
    ["Resource Keeper",18,"Farming","🌾","Anti Everything"],
    ["Legend League Ring",17,"Defence","🏆","Legend League"],
    ["Air Trap Maze",16,"Defence","⚡","Anti Air / Electro Dragon"],
    ["Hybrid Guard",15,"Hybrid","⚔️","Hybrid"],
    ["Trophy Shield",14,"War","🏰","Anti 2 Stars"]
  ];
  const sampleArmies=[
    ["Electro Dragon Push",19,"Air Army","🐉","Air"],
    ["Root Rider Smash",18,"Ground Army","🌳","Ground"],
    ["Hybrid Miner Hog",17,"Hybrid Army","🐗","Hybrid"],
    ["Yeti Witch Push",16,"Ground Army","🧙","Ground"]
  ];
  function renderBaseLibrary(){
    const section=$("#bases");if(!section)return;
    section.innerHTML=`
      <div class="section-heading"><div><div class="eyebrow">BATTLE-TESTED IDEAS</div><h2>Base <span>Library</span></h2><p class="section-subtitle">Browse layouts by Town Hall, mode and defense strategy.</p></div><span class="section-badge">LAYOUT ARCHIVE</span></div>
      <div class="cv-panel">
        <div class="cv-tabs"><button class="cv-tab active" data-library="bases">🏰 Base Layouts</button><button class="cv-tab" data-library="armies">⚔️ Troop / Army Layouts</button></div>
        <div class="cv-toolbar">${thSelect("cvBaseTH")}<div class="cv-sort"><label for="cvSort">Sort by</label><select class="cv-select" id="cvSort"><option>Date</option><option>Views</option><option>Rating</option><option>Updated</option></select></div></div>
        <div class="cv-toolbar" id="cvBaseFilters">${["All","War","Farming","Defence","Troll / Funny"].map((x,i)=>`<button class="cv-chip ${i===0?"active":""}" data-base-filter="${x}">${x}</button>`).join("")}</div>
        <div class="cv-toolbar" id="cvTags">${["Anti 2 Stars","Anti 3 Stars","Anti Everything","Legend League","Anti Air / Electro Dragon","Hybrid"].map(x=>`<button class="cv-chip" data-tag="${x}">◆ ${x}</button>`).join("")}</div>
        <div class="cv-base-grid" id="cvLayoutGrid"></div>
        <p class="cv-help" id="cvLayoutNote">These are design placeholders, not verified in-game layouts. Real layout links and preview images must be added before the Copy In-Game Link action can work.</p>
      </div>`;
    let mode="bases",filter="All",tag="";
    const grid=$("#cvLayoutGrid"),note=$("#cvLayoutNote");
    function cards(){
      const list=mode==="bases"?sampleBases:sampleArmies;
      const th=$("#cvBaseTH").value;
      const shown=list.filter(x=>(th==="all"||String(x[1])===th)&&(mode!=="bases"||filter==="All"||x[2]===filter|| (filter==="Troll / Funny"&&x[2]==="Troll"))&&(!tag||x[4]===tag));
      grid.innerHTML=shown.map((x,i)=>`<article class="cv-card"><div class="cv-art">${x[3]}<span style="position:absolute;right:12px;top:10px;background:#2879c8;padding:5px 8px;border-radius:6px;font-size:11px">PREVIEW</span></div><div class="cv-body"><div class="cv-meta"><span>🏰 TH ${x[1]}</span><span>${x[2].toUpperCase()}</span></div><h3>${x[0]}</h3><p>${mode==="bases"?"Community layout concept · preview pending":"Army composition concept · army link pending"}</p><button class="cv-copy" type="button" data-page-copy="${mode}-${x[1]}-${i}">Copy Page Link</button></div></article>`).join("")||`<p class="cv-help">No sample cards match these filters.</p>`;
      note.textContent="Sample design cards only. Copy Page Link shares this ClashVault page, not an in-game base or army link. Add verified Supercell share URLs to enable actual in-game copying.";
    }
    $$("[data-library]",section).forEach(btn=>btn.onclick=()=>{
      mode=btn.dataset.library;
      $$("[data-library]",section).forEach(b=>b.classList.toggle("active",b===btn));
      $("#cvBaseFilters").hidden=mode!=="bases";$("#cvTags").hidden=mode!=="bases";cards();
    });
    $$("[data-base-filter]",section).forEach(btn=>btn.onclick=()=>{
      filter=btn.dataset.baseFilter;$$("[data-base-filter]",section).forEach(b=>b.classList.toggle("active",b===btn));cards();
    });
    $$("[data-tag]",section).forEach(btn=>btn.onclick=()=>{
      tag=tag===btn.dataset.tag?"":btn.dataset.tag;$$("[data-tag]",section).forEach(b=>b.classList.toggle("active",b.dataset.tag===tag));cards();
    });
    $("#cvBaseTH").onchange=cards;$("#cvSort").onchange=cards;
    grid.addEventListener("click",async e=>{
      const b=e.target.closest("[data-page-copy]");if(!b)return;
      const url=`${location.origin}${location.pathname}#bases`;
      try{await navigator.clipboard.writeText(url);notify("ClashVault page link copied. In-game layout link is not connected yet.");}
      catch{notify("Copy unavailable in this browser. Copy the page address from your browser.");}
    });
    cards();
  }

  function renderBuilderTracker(){
    const section=$("#tracker");if(!section)return;
    section.innerHTML=`
      <div class="section-heading"><div><div class="eyebrow">YOUR VILLAGE AT A GLANCE</div><h2>Builder <span>Tracker</span></h2><p class="section-subtitle">See which builders are available or working.</p></div><span class="section-badge">MY VILLAGE</span></div>
      <div class="cv-panel" id="cvBuilderPanel"><div class="cv-login-needed" id="cvBuilderGate">🔒<h3>Sign in to view your builders</h3><p>Your builder status is saved to your ClashVault account on this device.</p><a href="#account">Go to Account →</a></div></div>`;
    const panel=$("#cvBuilderPanel");
    const builders=Array.from({length:6},(_,i)=>({id:i+1,working:false}));
    let currentUser=null,states=[];
    const storageKey=uid=>`clashvault-builder-status-v2-${uid}`;
    function load(){
      try{states=JSON.parse(localStorage.getItem(storageKey(currentUser))||"[]");}catch{states=[];}
      states=builders.map(b=>({id:b.id,working:!!states.find(s=>s.id===b.id)?.working}));
    }
    function save(){localStorage.setItem(storageKey(currentUser),JSON.stringify(states));}
    function draw(){
      const working=states.filter(s=>s.working).length,available=6-working;
      panel.innerHTML=`
        <div class="cv-builder-summary"><div class="cv-count"><strong>6</strong><span>TOTAL BUILDERS</span></div><div class="cv-count"><strong>${available}</strong><span>AVAILABLE</span></div><div class="cv-count"><strong>${working}</strong><span>WORKING</span></div></div>
        <p class="cv-help">Update each status to match your in-game village. ClashVault cannot read live builder timers directly from Supercell.</p>
        <div class="cv-builder-grid">${states.map(s=>`<article class="cv-builder ${s.working?"working":""}"><div class="cv-builder-state">${s.working?"🔨 WORKING":"🟢 AVAILABLE"}</div><h3>Builder ${s.id}</h3><p>${s.working?"Marked as busy in your village.":"Ready for your next upgrade."}</p><button class="cv-toggle" type="button" data-builder="${s.id}">${s.working?"Mark Available":"Mark Working"}</button></article>`).join("")}</div>`;
      panel.querySelectorAll("[data-builder]").forEach(btn=>btn.onclick=()=>{
        const s=states.find(x=>x.id===Number(btn.dataset.builder));s.working=!s.working;save();draw();
      });
    }
    function setUser(user){
      currentUser=user||null;
      if(!currentUser){
        panel.innerHTML=`<div class="cv-login-needed">🔒<h3>Sign in to view your builders</h3><p>Your builder status is saved to your ClashVault account on this device.</p><a href="#account">Go to Account →</a></div>`;
        return;
      }
      load();draw();
    }
    const client=window.supabaseClient;
    if(client?.auth){
      client.auth.getSession().then(({data})=>setUser(data?.session?.user||null)).catch(()=>setUser(null));
      client.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
    }else setUser(null);
  }

  function start(){
    renderPlayerFinder();
    renderBaseLibrary();
    renderBuilderTracker();
    console.info("ClashVault redesign loaded. Authentication file was not modified.");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
