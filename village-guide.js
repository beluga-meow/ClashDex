/* PekkaDex Village Guide v1 — local website guide, no external API */
(() => {
  "use strict";
  if (window.__pekkaDexVillageGuide) return;
  window.__pekkaDexVillageGuide = true;

  const routes = [
    { keys:["player finder","players","player","find chief","player tag"], label:"Player Finder", href:"#player-finder", description:"Search for a Chief using their Clash of Clans player tag." },
    { keys:["base library","bases","base","layout","defense","defence"], label:"Base Library", href:"#bases", description:"Browse base layout ideas and defensive categories." },
    { keys:["attack academy","attacks","attack","army","strategy"], label:"Attack Academy", href:"#attacks", description:"Explore attack strategies and army guide concepts." },
    { keys:["clash heroes","heroes","hero","equipment","skins","skin"], label:"Clash Heroes", href:"#heroes", description:"Visit the Heroes section for hero-related content." },
    { keys:["my account","account","login","log in","sign in","profile"], label:"PekkaDex Account", href:"#account", description:"Open your account area to sign in or connect your player tag." },
    { keys:["events","event","updates","update","news","season"], label:"Events & Updates", href:"#events", description:"See the events and updates area." },
    { keys:["homepage","home"], label:"Homepage", href:"#home", description:"Return to the PekkaDex homepage." }
  ];

  const root=document.createElement("div");
  root.id="villageGuide";
  root.innerHTML=
    '<button class="vg-launcher" type="button" aria-expanded="false" aria-controls="vgPanel" aria-label="Open PekkaDex Village Guide">'+
      '<span class="vg-avatar" aria-hidden="true">👩‍🌾</span><span>Village Guide<small>HEY CHIEF! NEED HELP?</small></span>'+
    '</button>'+
    '<section class="vg-panel" id="vgPanel" role="dialog" aria-label="PekkaDex Village Guide chat" aria-modal="false" hidden>'+
      '<header class="vg-head"><span class="vg-avatar" aria-hidden="true">👩‍🌾</span><span><strong>PekkaDex Village Guide</strong><span class="vg-status">● Ready to help, Chief!</span></span><button class="vg-close" type="button" aria-label="Close chat">×</button></header>'+
      '<div class="vg-messages" aria-live="polite" aria-relevant="additions"></div>'+
      '<div class="vg-quick" aria-label="Suggested questions">'+
        '<button type="button" data-question="Where can I find players?">Find players</button>'+
        '<button type="button" data-question="Show me the base library">Browse bases</button>'+
        '<button type="button" data-question="Where are the heroes?">Heroes</button>'+
        '<button type="button" data-question="How do I log in?">My account</button>'+
      '</div>'+
      '<form class="vg-form"><input class="vg-input" type="text" maxlength="240" placeholder="Ask me something, Chief..." autocomplete="off" aria-label="Message the Village Guide"><button class="vg-send" type="submit">Send</button></form>'+
    '</section>';
  document.body.appendChild(root);

  const launcher=root.querySelector(".vg-launcher");
  const panel=root.querySelector(".vg-panel");
  const close=root.querySelector(".vg-close");
  const messages=root.querySelector(".vg-messages");
  const form=root.querySelector(".vg-form");
  const input=root.querySelector(".vg-input");

  function openChat(){
    panel.hidden=false;
    launcher.setAttribute("aria-expanded","true");
    if(!messages.childElementCount) addMessage("guide","Hey Chief! Welcome to PekkaDex! I'm your Village Guide. Ask me where to find something, and I'll show you the way.");
    input.focus();
  }
  function closeChat(){
    panel.hidden=true;
    launcher.setAttribute("aria-expanded","false");
    launcher.focus();
  }
  function addMessage(who,text,route){
    const bubble=document.createElement("div");
    bubble.className="vg-message "+who;
    bubble.appendChild(document.createTextNode(text));
    if(route){
      bubble.appendChild(document.createElement("br"));
      const link=document.createElement("a");
      link.href=route.href;
      link.textContent="Open "+route.label;
      bubble.appendChild(link);
    }
    messages.appendChild(bubble);
    messages.scrollTop=messages.scrollHeight;
  }
  function answer(raw){
    const q=raw.toLowerCase().trim().replace(/[?!.,]/g," ").replace(/\s+/g," ");
    const route=routes.find(r=>r.keys.some(k=>q===k || q.startsWith(k+" ") || q.endsWith(" "+k) || q.includes(" "+k+" ")));
    if(route){
      addMessage("guide",route.description,route);
      return;
    }
    if(/what can you do|help|features|guide/.test(q)){
      addMessage("guide","I can help you explore PekkaDex! I can guide you to Player Finder, Base Library, Attack Academy, Clash Heroes, your Account, and Events & Updates. Try asking: “Where are the heroes?”");
      return;
    }
    if(/thank|thanks|salamat/.test(q)){
      addMessage("guide","You're welcome, Chief! Happy exploring. ⚔️");
      return;
    }
    if(/hello|hi|hey|good morning|good afternoon/.test(q)){
      addMessage("guide","Hey Chief! What would you like to explore today? Ask me about players, bases, attacks, heroes, your account, or events.");
      return;
    }
    addMessage("guide","I'm still learning, Chief! I can currently guide you around the website and explain its main sections. Try asking about Players, Bases, Attack Academy, Heroes, Account, or Events.");
  }
  function submitQuestion(value){
    const q=String(value||"").trim();
    if(!q)return;
    addMessage("chief",q);
    answer(q);
  }

  launcher.addEventListener("click",()=>panel.hidden?openChat():closeChat());
  close.addEventListener("click",closeChat);
  root.querySelectorAll("[data-question]").forEach(btn=>btn.addEventListener("click",()=>submitQuestion(btn.getAttribute("data-question"))));
  form.addEventListener("submit",event=>{
    event.preventDefault();
    submitQuestion(input.value);
    input.value="";
    input.focus();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!panel.hidden)closeChat();
  });
})();
