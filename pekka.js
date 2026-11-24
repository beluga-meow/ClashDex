/* ClashVault v7: gold theme, Armies, Heroes pages, Sceneries, OTP loader */
(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const t=$("#toast");if(!t)return alert(m);t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)};
const copy=async txt=>{try{await navigator.clipboard.writeText(txt)}catch(_){const a=document.createElement("textarea");a.value=txt;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}};

/* ---- theme css, appended last so it wins ---- */
const l=document.createElement("link");l.rel="stylesheet";l.href="./vault.css?v=7";document.head.appendChild(l);

/* ---- DATA (edit freely) ---- */
const ARMIES=[
 {name:"Electro Dragon Mass",th:"TH 12+",rate:4.3,code:"u23x8-u7x2-u10x4",s:"s0x4-s5x2",troops:[["⚡","E-Drag","epic"],["💚","Healer","rare"],["🐲","Baby Drag","epic"],["🦇","Bat Spell","rare"],["⚡","Lightning","epic"],["❄️","Freeze","epic"],["🏰","CC",""],["🛠️","Siege",""]],perf:{Attack:["GREAT",86],Defense:["MEDIOCRE",50],Synergy:["GREAT",84],Versatility:["GOOD",68],"F2P Score":["GOOD",64]}},
 {name:"Dragon Mass",th:"TH 10+",rate:4.0,code:"u8x10-u7x2",s:"s2x3-s1x2-s5x1",troops:[["🐉","Dragon","epic"],["💚","Healer","rare"],["😡","Rage","epic"],["💗","Heal","rare"],["❄️","Freeze","epic"],["🏰","CC",""],["🎈","Balloon",""],["🧙","Wizard",""]],perf:{Attack:["GOOD",72],Defense:["MEDIOCRE",48],Synergy:["GREAT",80],Versatility:["GREAT",78],"F2P Score":["GREAT",82]}},
 {name:"Miner Healer",th:"TH 10+",rate:3.9,code:"u11x14-u7x3",s:"s1x4-s3x2-s5x2",troops:[["⛏️","Miner","epic"],["💚","Healer","rare"],["💗","Heal","rare"],["🦘","Jump","epic"],["❄️","Freeze","epic"],["🏰","CC",""],["🧙","Wizard",""],["🐲","Baby Drag",""]],perf:{Attack:["GOOD",70],Defense:["MEDIOCRE",52],Synergy:["GREAT",83],Versatility:["GOOD",66],"F2P Score":["GODLY",92]}},
 {name:"Giant Healer",th:"TH 8+",rate:3.4,code:"u3x14-u7x4",s:"s1x3-s2x2",troops:[["💪","Giant","rare"],["💚","Healer","rare"],["💗","Heal","rare"],["😡","Rage","epic"],["🧙","Wizard",""],["💣","W.Breaker",""],["🏰","CC",""],["🏹","Archer",""]],perf:{Attack:["MEDIOCRE",52],Defense:["MEDIOCRE",50],Synergy:["GREAT",80],Versatility:["GREAT",76],"F2P Score":["GODLY",95]}}
];
const HEROES=[
 {id:"barbarian-king",name:"Barbarian King",role:"Ground tank",icon:"👑",about:"Frontline hero that leads ground attacks and tanks for your troops.",eq:[["Barbarian Puppet",""],["Rage Vial",""],["Earthquake Boots",""],["Vampstache","epic"],["Giant Gauntlet","epic"],["Spiky Ball","epic"]]},
 {id:"archer-queen",name:"Archer Queen",role:"Ranged damage",icon:"🏹",about:"Long-range hero for precise funneling and taking out key defenses.",eq:[["Archer Puppet",""],["Invisibility Vial",""],["Giant Arrow","epic"],["Healer Puppet","epic"],["Frozen Arrow","epic"],["Magic Mirror","epic"]]},
 {id:"grand-warden",name:"Grand Warden",role:"Support",icon:"🧙",about:"Support hero whose abilities protect nearby troops at critical moments.",eq:[["Eternal Tome",""],["Life Gem",""],["Rage Gem","epic"],["Healing Tome","epic"],["Fireball","epic"],["Lavaloon Puppet","epic"]]},
 {id:"royal-champion",name:"Royal Champion",role:"Defense hunter",icon:"🛡️",about:"Mobile hero that hunts defenses and supports late-stage attacks.",eq:[["Seeking Shield",""],["Royal Gem",""],["Hog Rider Puppet",""],["Haste Vial","epic"],["Rocket Spear","epic"],["Electro Boots","epic"]]},
 {id:"minion-prince",name:"Minion Prince",role:"Air support",icon:"🦇",about:"Airborne hero that adds pressure and support to many armies.",eq:[["Henchmen Puppet",""],["Dark Orb","epic"],["Metal Pants","epic"]]}
];
/* Skins: add real entries here or in skins.json as {"barbarian-king":[{"name":"...","note":"..."}]} */
let SKINS={};
const SCENES=[
 {n:"Classic Village",e:"🏰",c:"#2f6b1f,#8bc34a",d:"The original green village backdrop every Chief starts with."},
 {n:"Winter Wonderland",e:"⛄",c:"#1e3a5f,#bfe3ff",d:"Snow-covered base with festive lights."},
 {n:"Pirate Cove",e:"🏴‍☠️",c:"#0f3b57,#e0b25c",d:"Sandy shores and ships around your village."},
 {n:"Spooky Hollow",e:"🎃",c:"#2a1240,#ff7a18",d:"Dark skies, pumpkins and bats."},
 {n:"Sunny Summer",e:"🏖️",c:"#0c6b8a,#ffd36b",d:"Bright beach-day look for your base."},
 {n:"Lunar Lanterns",e:"🏮",c:"#6b0f1a,#ffb703",d:"Red and gold festival decorations."}
];

/* ---- ARMIES ---- */
function armyLink(a){return "https://link.clashofclans.com/en?action=CopyArmy&army="+a.code+"-"+a.s}
function buildArmies(){
 const sec=$("#armies");if(!sec)return;
 sec.innerHTML='<div class="section-heading"><div><h2>🔥 Trending <span>Armies</span></h2><p class="section-subtitle">Top attack armies with performance analysis.</p></div></div><div class="v-grid" id="vArmies"></div>';
 $("#vArmies").innerHTML=ARMIES.map((a,i)=>'<article class="v-card"><div class="v-head"><span class="v-rank">#'+(i+1)+'</span><h3>'+esc(a.name)+'</h3><span class="v-score">'+a.rate+'</span></div>'+
 '<div class="v-troops">'+a.troops.map(t=>'<div class="v-troop '+t[2]+'"><div>'+t[0]+'<small>'+esc(t[1])+'</small></div></div>').join("")+'</div>'+
 '<div class="v-perf"><div class="v-perf-h"><b>📊 ARMY PERFORMANCE</b><span class="v-ai">AI Analyzed</span></div>'+
 Object.entries(a.perf).map(([k,[w,p]])=>'<div><div class="v-row"><span>'+k+'</span><span class="v-'+w+'">'+w+'</span></div><div class="v-bar"><i data-w="'+p+'" style="background:currentColor" class="v-'+w+'"></i></div></div>').join("")+'</div>'+
 '<button class="v-btn" data-i="'+i+'">📋 Copy link · Open in game</button></article>').join("");
 $("#vArmies").addEventListener("click",async e=>{const b=e.target.closest(".v-btn");if(!b)return;const a=ARMIES[b.dataset.i],u=armyLink(a);await copy(u);toast("Army link copied. Opening Clash of Clans…");setTimeout(()=>{location.href=u},500)});
 const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){$$("i[data-w]",x.target).forEach(i=>i.style.width=i.dataset.w+"%");io.unobserve(x.target)}}),{threshold:.2});
 $$(".v-perf",sec).forEach(p=>io.observe(p));
}

/* ---- SCENERIES ---- */
function buildScenes(){
 const sec=$("#sceneries");if(!sec)return;
 sec.innerHTML='<div class="section-heading"><div><h2>Choose Your <span>Scenery</span></h2><p class="section-subtitle">Tap a scenery to see its details.</p></div></div><div class="v-grid" id="vScenes"></div>';
 $("#vScenes").innerHTML=SCENES.map((s,i)=>{const[c1,c2]=s.c.split(",");return '<button class="v-scene" data-i="'+i+'" style="background:linear-gradient(145deg,'+c1+','+c2+')"><em>'+s.e+'</em><span>'+esc(s.n)+'</span></button>'}).join("");
 $("#vScenes").addEventListener("click",e=>{const b=e.target.closest(".v-scene");if(!b)return;const s=SCENES[b.dataset.i],[c1,c2]=s.c.split(",");
  const p=document.createElement("div");p.className="v-pop";p.innerHTML='<div><div class="art" style="background:linear-gradient(145deg,'+c1+','+c2+')"><b>'+s.e+'</b></div><div class="bd"><h3>'+esc(s.n)+'</h3><p>'+esc(s.d)+'</p><button class="v-btn" style="justify-self:stretch">Close</button></div></div>';
  p.addEventListener("click",ev=>{if(ev.target===p||ev.target.classList.contains("v-btn"))p.remove()});document.body.appendChild(p)});
}

/* ---- HEROES (grid + separate pages via #hero/<id>) ---- */
function buildHeroes(){
 const sec=$("#heroes");if(!sec)return;
 $$(":scope > :not(.section-heading)",sec).forEach(n=>n.remove());
 const g=document.createElement("div");g.className="v-grid";
 g.innerHTML=HEROES.map(h=>'<a class="v-card" href="#hero/'+h.id+'" style="text-decoration:none"><div class="v-head"><span style="font-size:44px">'+h.icon+'</span><div><h3>'+h.name+'</h3><small>'+h.role+'</small></div></div><small>'+h.eq.length+' equipment · Skins</small></a>').join("");
 sec.appendChild(g);
}
function heroPage(id,tab){
 let pg=$("#vHeroPage");if(pg)pg.remove();
 const h=HEROES.find(x=>x.id===id);if(!h)return;
 const sk=SKINS[h.id]||[];
 pg=document.createElement("div");pg.id="vHeroPage";pg.className="v-page";
 const body=tab==="skins"?(sk.length?'<div class="v-grid">'+sk.map(s=>'<div class="v-card"><h3>'+esc(s.name)+'</h3><small>'+esc(s.note||"")+'</small></div>').join("")+'</div>':'<div class="v-empty">No skins added for '+h.name+' yet.<br><small>Add them in skins.json and they appear here.</small></div>'):
  '<div class="v-eq">'+h.eq.map(e=>'<div class="v-eqi '+e[1]+'"><i>'+(e[1]?"✨":"🔧")+'</i><div><b>'+esc(e[0])+'</b><br><small>'+(e[1]?"Epic":"Common")+' equipment</small></div></div>').join("")+'</div>';
 pg.innerHTML='<div class="in"><button class="v-btn" style="justify-self:start" id="vBack">← All heroes</button><div class="v-hero-top"><span class="ic">'+h.icon+'</span><div><h2 style="margin:0">'+h.name+'</h2><p style="margin:4px 0 0">'+esc(h.about)+'</p></div></div><div class="v-tabs"><button data-t="skins" class="'+(tab==="skins"?"on":"")+'">🎨 Skins</button><button data-t="equipment" class="'+(tab!=="skins"?"on":"")+'">🎒 Equipment</button></div>'+body+'</div>';
 document.body.appendChild(pg);document.body.style.overflow="hidden";
 $("#vBack",pg).onclick=()=>{location.hash="heroes"};
 $$(".v-tabs button",pg).forEach(b=>b.onclick=()=>{location.hash="hero/"+id+"/"+b.dataset.t});
}
function route(){
 const m=location.hash.match(/^#hero\/([\w-]+)(?:\/(skins|equipment))?/);
 if(m)heroPage(m[1],m[2]||"equipment");else{$("#vHeroPage")?.remove();document.body.style.overflow=""}
}
window.addEventListener("hashchange",route);

/* ---- OTP cartoony loader ---- */
function authLoader(){
 const panel=$(".auth-panel"),form=$("#authEmailForm");if(!panel||!form)return;
 const ld=document.createElement("div");ld.className="v-load";ld.innerHTML='<b>Sending your code…</b><div class="v-track"><i></i></div><small>Hang tight, Chief!</small>';panel.appendChild(ld);
 const off=()=>ld.classList.remove("on");
 form.addEventListener("submit",()=>{const v=$("#authEmail").value.trim();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))ld.classList.add("on")});
 $("#authResend")?.addEventListener("click",()=>{if(!$("#authResend").disabled)ld.classList.add("on")});
 new MutationObserver(off).observe($("#authOtpScreen"),{attributes:true,attributeFilter:["hidden"]});
 new MutationObserver(()=>{const t=$("#authMessage").textContent;if(t&&!/sending/i.test(t))off()}).observe($("#authMessage"),{childList:true,characterData:true,subtree:true});
 setInterval(()=>{if(ld.classList.contains("on")&&!ld.dataset.t){ld.dataset.t=1;setTimeout(()=>{off();delete ld.dataset.t},15000)}},1000);
}

function init(){
 buildArmies();buildScenes();buildHeroes();authLoader();route();
 fetch("./skins.json",{cache:"no-store"}).then(r=>r.ok?r.json():{}).then(j=>{SKINS=j;route()}).catch(()=>{});
}
/* run after app.js has built its UI */
window.addEventListener("load",()=>setTimeout(init,150));
})();
