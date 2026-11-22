/* =====================================================================
   ClashVault: Clash of Clans look + working finder, library and builders
   File name: clashvault-redesign.js   (version 2)

   ADD THIS ONE LINE in index.html, right before </body>, AFTER auth.js:
     <script src="./clashvault-redesign.js?v=2"></script>

   Safe by design
   - It never edits app.js, auth.js, style.css or your Supabase setup.
   - The old Player Finder / Base Library / Tracker are only HIDDEN, never
     deleted, and only after the new version was built without errors.
   - To undo everything: remove that one <script> line.
   ===================================================================== */
(() => {
  "use strict";
  if (window.__cxLoaded) return;
  window.__cxLoaded = true;

  /* ============ 1. SETTINGS you may edit ============ */
  const SETTINGS = {
    EDGE_FUNCTION: "coc",  // name of your Supabase Edge Function (see coc-edge-function.ts)
    PROXY_BASE: "",        // optional: your own proxy URL ending in /v1 ("" = not used)
    MAX_TOWN_HALL: 19,     // raise this when Supercell releases a new Town Hall
    DEFAULT_BUILDERS: 5    // builders shown the first time a player opens the tracker
  };

  /* ============ 2. LAYOUTS (bases + troop/army links) ============
     To make "Copy link" copy a REAL in-game link, paste it in `link`:
       base : https://link.clashofclans.com/en?action=OpenLayout&id=...
       army : https://link.clashofclans.com/en?action=CopyArmy&army=...
     Cards with an empty link show "SAMPLE" and copy this page's link instead. */
  const LAYOUTS = [
    { kind: "base", th: 19, cat: "War",     icon: "🛡️", name: "Anti 3-Star Fortress", note: "Split key defenses around a compact core.", link: "" },
    { kind: "base", th: 19, cat: "Trophy",  icon: "🏆", name: "Legend Ring",          note: "Tight ring for pushing trophies.", link: "" },
    { kind: "base", th: 18, cat: "Farming", icon: "🌾", name: "Resource Keeper",      note: "Storages protected deep inside.", link: "" },
    { kind: "base", th: 18, cat: "War",     icon: "🏰", name: "Air Trap Maze",        note: "Built to slow Electro Dragons.", link: "" },
    { kind: "base", th: 17, cat: "Hybrid",  icon: "⚔️", name: "Hybrid Guard",         note: "Balanced for trophies and loot.", link: "" },
    { kind: "base", th: 16, cat: "War",     icon: "🛡️", name: "Star Saver",           note: "Makes the third star hard to get.", link: "" },
    { kind: "base", th: 15, cat: "Trophy",  icon: "🏆", name: "Champion's Ring",      note: "Layout concept for trophy pushing.", link: "" },
    { kind: "base", th: 14, cat: "Farming", icon: "🌾", name: "Loot Vault",           note: "Keeps Gold and Elixir safe.", link: "" },
    { kind: "army", th: 19, cat: "Air",     icon: "🐉", name: "Electro Dragon Push",  note: "Simple air attack. Funnel first.", link: "" },
    { kind: "army", th: 18, cat: "Ground",  icon: "🌳", name: "Root Rider Smash",     note: "Ground push backed by your heroes.", link: "" },
    { kind: "army", th: 17, cat: "Hybrid",  icon: "🐗", name: "Miner + Hog Hybrid",   note: "Fast, flexible and beginner friendly.", link: "" },
    { kind: "army", th: 16, cat: "Ground",  icon: "🧙", name: "Yeti + Witch Push",    note: "Strong mid-game ground army.", link: "" }
  ];

  /* ============ 3. Small helpers ============ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => (typeof n === "number" ? n.toLocaleString() : "-");
  const div = (cls, id) => { const d = document.createElement("div"); d.className = cls; if (id) d.id = id; return d; };
  const safe = (where, fn) => { try { fn(); } catch (e) { try { console.warn("[ClashVault]", where, "skipped:", e); } catch (_) {} } };

  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = div("cx-toast", "cxToast");
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 2600);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }

  const normTag = t => "#" + String(t || "").trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "").replace(/O/g, "0");
  const validTag = t => /^#[0289PYLQGRJCUV]{3,15}$/.test(t);
  const isTagInput = s => { const t = normTag(s); return validTag(t) && (/^\s*#/.test(s) || /\d/.test(t)); };
  const gameLink = (action, tag) => "https://link.clashofclans.com/en?action=" + action + "&tag=" + encodeURIComponent(String(tag).replace(/^#/, ""));
  const isGameLink = u => typeof u === "string" && /^https:\/\/link\.clashofclans\.com\//.test(u);
  const roleName = r => ({ leader: "Leader", coLeader: "Co-leader", admin: "Elder", member: "Member" }[r] || "");
  const thOptions = label => '<option value="">' + label + "</option>" +
    Array.from({ length: SETTINGS.MAX_TOWN_HALL }, (_, i) => SETTINGS.MAX_TOWN_HALL - i)
      .map(n => '<option value="' + n + '">Town Hall ' + n + "</option>").join("");

  /* Old sections are hidden only AFTER the new UI is ready. */
  function swapIn(sec, box) {
    sec.appendChild(box);
    Array.from(sec.children).forEach(ch => {
      if (ch !== box && !ch.classList.contains("section-heading")) ch.classList.add("cx-legacy");
    });
  }
  function setHeading(sec, titleHtml, subtitle) {
    const h = $(".section-heading h2", sec);
    if (h && titleHtml) h.innerHTML = titleHtml;
    const p = $(".section-subtitle", sec);
    if (p && subtitle) p.textContent = subtitle;
  }

  /* ============ 4. Supabase + Clash of Clans API ============ */
  function sbClient() {
    try { if (window.supabaseClient && window.supabaseClient.auth) return window.supabaseClient; } catch (_) {}
    try { if (typeof supabaseClient !== "undefined" && supabaseClient && supabaseClient.auth) return supabaseClient; } catch (_) {}
    try { if (window.sb && window.sb.auth) return window.sb; } catch (_) {}
    try { if (window.supabase && window.supabase.auth) return window.supabase; } catch (_) {}
    return null;
  }

  class ApiError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const errText = e => (e instanceof ApiError ? e.message : "Something went wrong. Try again in a moment.");

  /* Returns { status, data }. Real calls need the secure Edge Function. */
  async function rawGet(path) {
    if (SETTINGS.PROXY_BASE) {
      let r;
      try { r = await fetch(SETTINGS.PROXY_BASE.replace(/\/+$/, "") + path, { headers: { accept: "application/json" } }); }
      catch (_) { throw new ApiError("offline", "Can't reach the API proxy. Check your connection and the proxy URL."); }
      let data = null;
      try { data = await r.json(); } catch (_) {}
      return { status: r.status, data: data };
    }
    const sb = sbClient();
    if (sb && sb.functions && sb.functions.invoke) {
      let res;
      try { res = await sb.functions.invoke(SETTINGS.EDGE_FUNCTION, { body: { path: path } }); } catch (_) { res = { error: true }; }
      if (res.error || !res.data || typeof res.data.status !== "number") {
        throw new ApiError("not-connected", 'Live search isn\'t connected yet. Deploy the "' + SETTINGS.EDGE_FUNCTION + '" Edge Function and this will start working.');
      }
      return res.data;
    }
    throw new ApiError("not-connected", "Live search isn't connected yet. The Supabase client wasn't found on this page.");
  }

  async function api(path) {
    const r = await rawGet(path);
    if (r.status >= 200 && r.status < 300 && r.data) return r.data;
    const map = {
      400: "That search isn't valid. Check the tag or name.",
      403: "Supercell rejected the API key. Check that the key allows the proxy IP address.",
      404: "Not found. Double-check the tag.",
      429: "Too many searches at once. Wait a few seconds and try again.",
      503: "The Clash of Clans API is in maintenance. Try again later."
    };
    throw new ApiError("http-" + r.status, map[r.status] || "The Clash of Clans API had a problem (" + r.status + "). Try again in a moment.");
  }

  /* ============ 5. Theme (CSS) ============ */
  const CSS = `
:root{
--cx-w1:#b57a3d;--cx-w2:#8a5427;--cx-w3:#5c3517;--cx-w4:#34190a;
--cx-p1:#fdf1d2;--cx-p2:#f3dda8;--cx-p3:#d6b270;
--cx-g1:#ffe778;--cx-g2:#f7b823;--cx-g3:#8a4f05;
--cx-n1:#b2ea5a;--cx-n2:#62b52c;--cx-n3:#2a6a10;
--cx-r1:#ff8068;--cx-r2:#dc3d2e;--cx-r3:#8b1e14;
--cx-ink:#4a2c12;--cx-ink2:#6f5130;--cx-line:#1b0f05;
--cx-title:"Lilita One","Luckiest Guy",Impact,"Arial Black",system-ui,sans-serif;
--cx-body:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
--cx-ol:-2px -2px 0 var(--cx-line),2px -2px 0 var(--cx-line),-2px 2px 0 var(--cx-line),2px 2px 0 var(--cx-line),0 3px 0 var(--cx-line),0 6px 8px rgba(0,0,0,.3);
--cx-ols:-1px -1px 0 var(--cx-line),1px -1px 0 var(--cx-line),-1px 1px 0 var(--cx-line),1px 1px 0 var(--cx-line),0 2px 0 var(--cx-line);
}

/* ---------- page + bars ---------- */
html.cx body{font-family:var(--cx-body);color:var(--cx-ink);background:#17508f linear-gradient(180deg,#2e8fdc 0,#1f6db8 560px,#17508f 1500px,#123f73 100%)}
html.cx #toast:empty{display:none}
html.cx .cx-legacy{display:none!important}
html.cx .announcement{background:linear-gradient(#e8493c,#b3281d);border-bottom:3px solid #5d130c;color:#fff;font-family:var(--cx-title);font-weight:400;font-size:14px;letter-spacing:.3px;text-shadow:var(--cx-ols)}
html.cx .announcement-close{min-width:36px;min-height:36px;color:#fff;text-shadow:var(--cx-ols)}
html.cx .site-header{background:linear-gradient(#a8692f,#7a4a22 58%,#5c3517);border-bottom:4px solid var(--cx-w4);box-shadow:inset 0 2px 0 rgba(255,255,255,.28),0 6px 16px rgba(0,0,0,.35);-webkit-backdrop-filter:none;backdrop-filter:none}
html.cx .brand{font-family:var(--cx-title);font-weight:400;letter-spacing:.5px;color:#fff;text-shadow:var(--cx-ols);line-height:1.05}
html.cx .brand small{display:block;margin-top:2px;font-family:var(--cx-body);font-size:9px;font-weight:800;letter-spacing:1.3px;color:#ffe9b8;text-shadow:none}
html.cx .brand-accent{color:var(--cx-g1)}
html.cx .brand-mark{background:linear-gradient(var(--cx-g1),var(--cx-g2));border:3px solid #5a3300;border-radius:12px;color:#5a3300;text-shadow:none;box-shadow:inset 0 2px 0 rgba(255,255,255,.55),0 3px 0 var(--cx-w4)}
html.cx .main-nav a{font-family:var(--cx-title);font-weight:400;font-size:15px;letter-spacing:.3px;color:#ffeab8;text-shadow:0 2px 0 var(--cx-w4);padding:7px 10px;border-radius:10px}
html.cx .main-nav a:hover,html.cx .main-nav a.active{color:#fff;background:rgba(0,0,0,.28)}
html.cx .mobile-menu{background:linear-gradient(var(--cx-g1),var(--cx-g2));border:3px solid #5a3300;color:#4a2c12;box-shadow:0 3px 0 var(--cx-g3)}

/* ---------- buttons ---------- */
html.cx .button,html.cx .header-cta,html.cx .cx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:10px 20px;font-family:var(--cx-title);font-weight:400;font-size:17px;letter-spacing:.4px;color:#fff;text-shadow:var(--cx-ols);border:3px solid var(--cx-line);border-radius:14px;cursor:pointer;transition:transform .12s,filter .12s}
html.cx .button:hover,html.cx .header-cta:hover,html.cx .cx-btn:hover{transform:translateY(-2px);filter:brightness(1.06)}
html.cx .button:active,html.cx .header-cta:active,html.cx .cx-btn:active{transform:translateY(3px)}
html.cx .button-gold,html.cx .cx-btn.gold{background:linear-gradient(var(--cx-g1),var(--cx-g2) 55%,#e39a12);box-shadow:inset 0 3px 0 rgba(255,255,255,.55),0 5px 0 var(--cx-g3),0 9px 14px rgba(0,0,0,.3)}
html.cx .button-green,html.cx .header-cta,html.cx .cx-btn.green{background:linear-gradient(var(--cx-n1),var(--cx-n2) 55%,#4a9a1d);box-shadow:inset 0 3px 0 rgba(255,255,255,.5),0 5px 0 var(--cx-n3),0 9px 14px rgba(0,0,0,.3)}
html.cx .button-ghost,html.cx .cx-btn.blue{background:linear-gradient(#6fb6f0,#2f7cc8 55%,#2468b0);box-shadow:inset 0 3px 0 rgba(255,255,255,.45),0 5px 0 #153f73,0 9px 14px rgba(0,0,0,.3)}
html.cx .cx-btn.sm{min-height:42px;padding:7px 14px;font-size:15px;border-width:2px;box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 3px 0 rgba(0,0,0,.35)}
html.cx .header-cta{min-height:44px;font-size:14px;padding:8px 14px}
html.cx .button:disabled,html.cx .cx-btn:disabled{filter:grayscale(.6);opacity:.7;transform:none;cursor:not-allowed}
html.cx .small-action{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 14px;font-family:var(--cx-title);font-weight:400;font-size:14px;letter-spacing:.3px;color:#4a2c12;background:linear-gradient(var(--cx-g1),var(--cx-g2));border:2px solid #5a3300;border-radius:11px;box-shadow:inset 0 2px 0 rgba(255,255,255,.55),0 3px 0 var(--cx-g3);cursor:pointer}
html.cx .small-action:hover{background:linear-gradient(#fff0a0,#ffc63a);color:#4a2c12}

/* ---------- headings ---------- */
html.cx .eyebrow{background:linear-gradient(#e8493c,#b3281d);border:2px solid #5d130c;color:#fff;font-family:var(--cx-title);font-weight:400;font-size:13px;letter-spacing:.8px;text-shadow:0 1px 0 #5d130c}
html.cx .section-heading h2{font-family:var(--cx-title);font-weight:400;letter-spacing:.5px;line-height:1.1;font-size:clamp(32px,8vw,48px);color:#fff;text-shadow:var(--cx-ol)}
html.cx .section-heading h2 span{color:var(--cx-g1)}
html.cx .section-subtitle{color:#eaf5ff;font-size:16px;line-height:1.5;text-shadow:0 1px 2px rgba(7,25,50,.65)}
html.cx .section-badge{font-family:var(--cx-title);font-weight:400;font-size:13px;letter-spacing:.5px;color:#5a3300;background:linear-gradient(var(--cx-g1),var(--cx-g2));border:2px solid #5a3300;box-shadow:0 3px 0 var(--cx-g3)}
html.cx .text-link{color:var(--cx-g1);font-family:var(--cx-title);font-size:15px;text-shadow:var(--cx-ols)}
html.cx #bases .section-heading .text-link{display:none}
html.cx .section-footnote{margin:14px 0 0;color:#dcecfb;font-size:14px;line-height:1.5;text-align:center;text-shadow:0 1px 2px rgba(7,25,50,.6)}

/* ---------- hero: sunny Clash village ---------- */
html.cx .hero{isolation:isolate;padding-bottom:116px;background:radial-gradient(ellipse at 82% 18%,rgba(255,255,255,.55),rgba(255,255,255,0) 40%),linear-gradient(180deg,#1b64ad 0%,#2f8ddb 58%,#62b8ef 100%)}
html.cx .hero::before{display:none}
html.cx .hero::after{content:"";position:absolute;z-index:-1;left:-8%;right:-8%;bottom:-1px;height:84px;background:linear-gradient(#9be04f,#5fae2c 45%,#3a8a1e);border-radius:50% 50% 0 0/100% 100% 0 0;box-shadow:inset 0 6px 0 rgba(255,255,255,.28)}
html.cx .hero h1{font-family:var(--cx-title);font-weight:400;color:#fff;text-shadow:var(--cx-ol);letter-spacing:.5px;line-height:1.05;font-size:clamp(40px,10.5vw,76px)}
html.cx .hero h1 span{color:var(--cx-g1)}
html.cx .hero-copy p{color:#fff;background:rgba(9,36,72,.5);border:2px solid rgba(255,255,255,.2);border-radius:14px;padding:12px 14px;font-size:16px;line-height:1.6;text-shadow:0 1px 2px rgba(0,0,0,.5)}
html.cx .hero-proof{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);font-size:13px}
html.cx .hero-proof strong{display:block;font-family:var(--cx-title);font-weight:400;font-size:17px;text-shadow:var(--cx-ols)}
html.cx .hero-proof small{display:block;font-size:13px}
html.cx .proof-avatars{display:flex}
html.cx .proof-avatars span{display:grid;place-items:center;width:38px;height:38px;margin-left:-8px;border-radius:50%;background:linear-gradient(var(--cx-g1),var(--cx-g2));border:3px solid #5a3300;font-size:18px}
html.cx .proof-avatars span:first-child{margin-left:0}
html.cx .hero-orbit{border-color:rgba(255,255,255,.38)}
html.cx .orbit-two{border-color:rgba(255,255,255,.22)}
html.cx .hero-sun{background:radial-gradient(circle,rgba(255,244,170,.85),transparent 70%)}
html.cx .castle-body{background:linear-gradient(90deg,#c9bda3,#efe6d0 50%,#b8aa8c);border-color:#6d6048;box-shadow:0 10px 0 #4f4533,0 18px 28px rgba(0,0,0,.3)}
html.cx .tower{background:linear-gradient(90deg,#b8aa8c,#efe6d0,#b8aa8c);border-color:#6d6048;box-shadow:0 9px 0 #4f4533}
html.cx .castle-roof{background:linear-gradient(145deg,#e0503f,#8f2418);filter:drop-shadow(0 5px 0 #5d130c)}
html.cx .tower::before{background:#d4402f}
html.cx .castle-door{background:#5a3317;border-color:#8a5427}
html.cx .floating-tag{background:linear-gradient(var(--cx-p1),var(--cx-p2));border:3px solid var(--cx-w2);color:var(--cx-ink);font-family:var(--cx-title);font-weight:400;font-size:13px;box-shadow:0 4px 0 var(--cx-w4),0 10px 16px rgba(0,0,0,.25)}
.cx-cloud{position:absolute;z-index:-1;width:110px;height:34px;background:#fff;border-radius:34px;opacity:.9;animation:cx-drift 90s linear infinite}
.cx-cloud::before,.cx-cloud::after{content:"";position:absolute;background:#fff;border-radius:50%}
.cx-cloud::before{width:50px;height:50px;left:16px;top:-24px}
.cx-cloud::after{width:38px;height:38px;right:16px;top:-16px}
.cx-c1{top:78px;left:-200px;animation-delay:-30s}
.cx-c2{top:170px;left:-200px;animation-duration:120s;animation-delay:-80s;opacity:.7}
.cx-c3{top:34px;left:-200px;animation-duration:105s;animation-delay:-8s;opacity:.8}
@keyframes cx-drift{from{transform:translateX(0)}to{transform:translateX(calc(100vw + 400px))}}

/* ---------- quick stats ---------- */
html.cx .quick-stats{background:linear-gradient(var(--cx-p1),var(--cx-p2));border:4px solid var(--cx-w2);border-radius:20px;box-shadow:inset 0 3px 0 rgba(255,255,255,.65),0 6px 0 var(--cx-w4),0 16px 26px rgba(0,0,0,.35)}
html.cx .quick-stats>div{border-right-color:rgba(138,84,39,.25)}
html.cx .stat-icon{background:linear-gradient(#8a5427,#5c3517);border:3px solid var(--cx-w4);box-shadow:inset 0 2px 0 rgba(255,255,255,.25)}
html.cx .quick-stats strong{font-family:var(--cx-title);font-weight:400;color:var(--cx-ink);font-size:18px}
html.cx .quick-stats small{color:var(--cx-ink2);font-size:12px;font-weight:700}

/* ---------- parchment panels (new + old sections) ---------- */
html.cx .cx-panel,html.cx .auth-panel,html.cx .attack-feature,html.cx .event-card{background:linear-gradient(var(--cx-p1),var(--cx-p2));border:4px solid var(--cx-w2);border-radius:22px;color:var(--cx-ink);box-shadow:inset 0 3px 0 rgba(255,255,255,.65),0 6px 0 var(--cx-w4),0 16px 26px rgba(0,0,0,.3)}
html.cx .cx-panel{padding:16px}
html.cx .attack-section{background:transparent}
html.cx .attack-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
html.cx .attack-visual{background:linear-gradient(145deg,#2f6fb4,#17427a);border-bottom:4px solid var(--cx-w2)}
html.cx .attack-label{font-family:var(--cx-title);font-weight:400;font-size:12px;letter-spacing:.5px;border:2px solid #5a3300;background:linear-gradient(var(--cx-g1),var(--cx-g2))}
html.cx .attack-info h3,html.cx .event-card h3,html.cx .auth-panel h3{font-family:var(--cx-title);font-weight:400;color:var(--cx-ink);font-size:22px}
html.cx .attack-info p,html.cx .event-card p,html.cx .auth-panel p{color:var(--cx-ink2);font-size:15px;line-height:1.55}
html.cx .attack-bottom span{color:var(--cx-ink2);font-size:13px;font-weight:700}
html.cx .card-meta span{background:#f6e6bd;border:2px solid var(--cx-p3);color:var(--cx-ink);font-size:12px;font-weight:800}
html.cx .event-kicker{color:#9a5a12;font-size:12px}
html.cx .event-symbol{background:#fff8e6;border:3px solid var(--cx-p3)}
html.cx .form-note{color:var(--cx-ink2);font-size:13px;line-height:1.5}
html.cx .store-banner{background:radial-gradient(circle at 88% 50%,rgba(255,231,120,.4),transparent 28%),linear-gradient(120deg,#7a3bb5,#3d1c70);border:4px solid var(--cx-g2);box-shadow:0 6px 0 #1f0d3d,0 16px 28px rgba(0,0,0,.35)}
html.cx .store-banner h2{font-family:var(--cx-title);font-weight:400;color:#fff;text-shadow:var(--cx-ol);font-size:clamp(24px,6vw,34px)}
html.cx .store-banner p{color:#f1e6ff;font-size:15px}
html.cx .store-emblem{border-color:var(--cx-g2);background:rgba(255,255,255,.14)}
html.cx #account .auth-choice{grid-template-columns:auto 1fr;width:100%;text-align:left;align-items:center}
html.cx #account .auth-choice small{display:block;font-family:var(--cx-body);font-weight:700;font-size:12px;text-shadow:0 1px 0 rgba(0,0,0,.55)}
html.cx #account .player-link-panel,html.cx .auth-status,html.cx #account .auth-pending-email{background:#fff8e6;border:2px solid var(--cx-p3);color:var(--cx-ink)}
html.cx #account #authPlayerStatus{color:#2f7a14}
html.cx #account #authUserName{font-family:var(--cx-title);font-weight:400}
html.cx #account .auth-emblem,html.cx .modal-icon{background:linear-gradient(var(--cx-g1),var(--cx-g2));border:3px solid #5a3300}
html.cx .modal{background:linear-gradient(var(--cx-p1),var(--cx-p2));border:4px solid var(--cx-w2);box-shadow:0 8px 0 var(--cx-w4),0 20px 40px rgba(0,0,0,.45);color:var(--cx-ink)}
html.cx .modal h2{font-family:var(--cx-title);font-weight:400;color:var(--cx-ink)}
html.cx .modal-close{background:linear-gradient(var(--cx-r1),var(--cx-r2));border:2px solid var(--cx-line);color:#fff;box-shadow:0 3px 0 var(--cx-r3)}
html.cx .site-footer{background:linear-gradient(#3a2210,#24130a);border-top:5px solid var(--cx-w2);color:#e9d4a8}
html.cx .site-footer a:hover{color:var(--cx-g1)}
html.cx .footer-brand{font-family:var(--cx-title);font-weight:400;color:#fff}
html.cx .footer-links{font-size:14px}
html.cx .copyright{color:rgba(233,212,168,.75);font-size:12px}
html.cx .toast{background:#24130a;border-color:var(--cx-g2)}

/* ---------- inputs ---------- */
html.cx input,html.cx select,html.cx textarea{background:#fff8e6;border:2px solid #b98a4e;color:var(--cx-ink);font-weight:600;border-radius:12px;min-height:48px;font-size:16px}
html.cx input:focus,html.cx select:focus,html.cx textarea:focus{border-color:var(--cx-g2);box-shadow:0 0 0 3px rgba(247,184,35,.4)}
html.cx input::placeholder{color:#a08560}
html.cx label{color:#6b4a26;font-size:14px;font-weight:800}

/* ---------- ClashVault components ---------- */
.cx-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.cx-tab,.cx-chip{font-family:var(--cx-title);font-weight:400;font-size:15px;letter-spacing:.3px;color:#ffeab8;text-shadow:0 2px 0 var(--cx-w4);background:linear-gradient(var(--cx-w1),var(--cx-w2));border:3px solid var(--cx-w4);border-radius:12px;padding:8px 14px;min-height:44px;cursor:pointer;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 3px 0 var(--cx-w4)}
.cx-tab.on,.cx-chip.on{color:#4a2c12;text-shadow:0 1px 0 rgba(255,255,255,.5);background:linear-gradient(var(--cx-g1),var(--cx-g2));border-color:#5a3300;box-shadow:inset 0 2px 0 rgba(255,255,255,.6),0 3px 0 var(--cx-g3)}
.cx-seg{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.cx-field{display:grid;gap:6px;margin:0 0 12px}
.cx-field>span{font-size:14px;font-weight:800;color:#6b4a26}
.cx-field em{font-style:normal;font-weight:600;color:#8a6d47}
.cx-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cx-crit{margin:0 0 12px;padding:12px;border:2px dashed #b98a4e;border-radius:14px;background:rgba(255,255,255,.4)}
.cx-crit h4{margin:0 0 10px;font:400 18px var(--cx-title);color:var(--cx-ink)}
.cx-check{display:flex;align-items:center;gap:10px;min-height:44px;margin:0 0 6px;font-size:15px;font-weight:800;color:var(--cx-ink);cursor:pointer}
html.cx .cx-check input{flex:none;width:26px;height:26px;min-height:0;accent-color:#62b52c;cursor:pointer}
.cx-help{margin:8px 0 0;color:var(--cx-ink2);font-size:13px;line-height:1.5}
.cx-msg{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:#fff8e6;border:2px solid var(--cx-p3);color:#5c3f1f;font-size:14px;line-height:1.5}
.cx-msg.err{background:#ffe3dc;border-color:var(--cx-r2);color:#7c1d12}
.cx-msg.ok{background:#e6f6d3;border-color:var(--cx-n2);color:#2c5a12}
.cx-results{display:grid;gap:12px;margin-top:14px}
.cx-card{border:3px solid var(--cx-w2);border-radius:18px;background:#fffaf0;overflow:hidden;box-shadow:0 4px 0 var(--cx-w4)}
.cx-head{display:flex;align-items:center;gap:12px;padding:12px 14px;background:linear-gradient(#3a82c8,#1d4f8c);border-bottom:3px solid #0f2d52;color:#fff}
.cx-head img{width:46px;height:56px;object-fit:contain;flex:none}
.cx-head h3{margin:0;font-family:var(--cx-title);font-weight:400;font-size:24px;line-height:1.1;text-shadow:var(--cx-ols);word-break:break-word}
.cx-head small{display:block;margin-top:2px;color:#d6ebff;font-weight:700;font-size:13px}
.cx-th{margin-left:auto;flex:none;display:grid;place-items:center;min-width:64px;padding:6px 8px;border:3px solid #5a3300;border-radius:12px;background:linear-gradient(var(--cx-g1),var(--cx-g2));color:#4a2c12;font-family:var(--cx-title);line-height:1.05;text-align:center;box-shadow:0 3px 0 var(--cx-g3)}
.cx-th b{font-weight:400;font-size:26px}
.cx-th span{font-size:12px}
.cx-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px}
.cx-stat{padding:9px 10px;background:#f6e6bd;border:2px solid var(--cx-p3);border-radius:12px}
.cx-stat b{display:block;font-family:var(--cx-title);font-weight:400;font-size:21px;color:var(--cx-ink);line-height:1.15}
.cx-stat span{font-size:12px;font-weight:800;color:var(--cx-ink2)}
.cx-sub{margin:0;padding:0 12px 6px;font:400 18px var(--cx-title);color:var(--cx-ink)}
.cx-heroes{display:grid;gap:8px;padding:0 12px 14px}
.cx-hrow{display:grid;gap:4px;font-size:14px;font-weight:800;color:var(--cx-ink)}
.cx-hrow div:first-child{display:flex;justify-content:space-between;gap:8px}
.cx-bar{height:12px;border-radius:8px;background:#e6d3a6;border:2px solid var(--cx-p3);overflow:hidden}
.cx-bar i{display:block;height:100%;background:linear-gradient(var(--cx-n1),var(--cx-n2))}
.cx-actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 12px 14px}
.cx-list{display:grid;gap:10px;margin-top:14px}
.cx-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;background:#fffaf0;border:2px solid var(--cx-p3);border-radius:14px}
.cx-row img{width:40px;height:48px;object-fit:contain}
.cx-row .grow{flex:1;min-width:150px}
.cx-row strong{display:block;font:400 18px var(--cx-title);color:var(--cx-ink);word-break:break-word}
.cx-row small{display:block;color:var(--cx-ink2);font-size:13px;font-weight:700}
.cx-pill{display:inline-block;padding:3px 9px;border-radius:999px;background:linear-gradient(var(--cx-g1),var(--cx-g2));border:2px solid #5a3300;color:#4a2c12;font:400 13px/1.3 var(--cx-title)}
.cx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:14px}
.cx-lay{display:flex;flex-direction:column;border:3px solid var(--cx-w2);border-radius:18px;overflow:hidden;background:#fffaf0;box-shadow:0 4px 0 var(--cx-w4)}
.cx-art{position:relative;display:grid;place-items:center;min-height:130px;font-size:56px;background:radial-gradient(circle at 50% 38%,#9ad25a,#4f9a2a 60%,#2f6e1b);border-bottom:3px solid var(--cx-w2)}
.cx-art.army{background:radial-gradient(circle at 50% 38%,#7fb8f0,#2f6fb4 62%,#1b4a85)}
.cx-art i{position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:8px;background:#6b4423;border:2px solid var(--cx-w4);color:#fff;font:400 12px var(--cx-title);font-style:normal}
.cx-art i.ok{background:var(--cx-n2);border-color:var(--cx-n3)}
.cx-lay-body{display:flex;flex-direction:column;gap:8px;padding:12px;flex:1}
.cx-lay-meta{display:flex;gap:6px;flex-wrap:wrap}
.cx-lay h3{margin:0;font:400 20px var(--cx-title);color:var(--cx-ink)}
.cx-lay p{margin:0;flex:1;color:var(--cx-ink2);font-size:14px;line-height:1.45}
.cx-bar-top{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;justify-content:space-between;margin-bottom:14px}
.cx-hud{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:linear-gradient(#3a82c8,#1d4f8c);border:3px solid #0f2d52;color:#fff;font:400 20px var(--cx-title);text-shadow:var(--cx-ols)}
.cx-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
.cx-sum div{padding:10px 6px;text-align:center;background:#f6e6bd;border:2px solid var(--cx-p3);border-radius:14px}
.cx-sum b{display:block;font:400 30px/1.1 var(--cx-title);color:var(--cx-ink)}
.cx-sum span{font-size:13px;font-weight:800;color:var(--cx-ink2)}
.cx-sum .free b{color:#2f7a14}
.cx-sum .busy b{color:#c0560a}
.cx-bgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cx-b{display:grid;gap:8px;padding:12px;text-align:center;background:#fffaf0;border:3px solid var(--cx-p3);border-radius:16px;box-shadow:0 3px 0 var(--cx-p3)}
.cx-b.busy{border-color:#e08a1e;background:#fff1d6}
.cx-b-ico{display:grid;place-items:center;width:52px;height:52px;margin:0 auto;font-size:28px;border-radius:14px;border:3px solid #5a3300;background:linear-gradient(var(--cx-g1),var(--cx-g2));box-shadow:0 3px 0 var(--cx-g3)}
.cx-b h3{margin:0;font:400 19px var(--cx-title);color:var(--cx-ink)}
.cx-state{font-size:12px;font-weight:900;letter-spacing:.6px;color:#2f7a14}
.cx-b.busy .cx-state{color:#c0560a}
.cx-gate{text-align:center;padding:22px 8px}
.cx-gate .big{font-size:48px;line-height:1.2}
.cx-gate h3{margin:6px 0;font:400 24px var(--cx-title);color:var(--cx-ink)}
.cx-gate p{margin:0 auto 16px;max-width:420px;color:var(--cx-ink2);font-size:15px;line-height:1.5}
.cx-toast{position:fixed;left:50%;bottom:24px;z-index:2000;max-width:min(92vw,420px);padding:12px 16px;border-radius:14px;background:linear-gradient(#3a2210,#24130a);border:3px solid var(--cx-g2);color:#fff;font:400 15px/1.3 var(--cx-title);text-align:center;text-shadow:var(--cx-ols);box-shadow:0 10px 24px rgba(0,0,0,.4);opacity:0;pointer-events:none;transform:translate(-50%,20px);transition:opacity .2s,transform .2s}
.cx-toast.on{opacity:1;transform:translate(-50%,0)}
.cx-tabbar{display:none}
@media(min-width:700px){.cx-bgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){
html.cx body{padding-bottom:86px}
html.cx .main-nav{background:linear-gradient(#7a4a22,#5c3517);border-bottom:4px solid var(--cx-w4)}
html.cx .main-nav a{padding:13px 8px;font-size:17px;border-radius:0;border-bottom:1px solid rgba(0,0,0,.25)}
.cx-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:500;display:grid;grid-template-columns:repeat(6,1fr);gap:2px;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));background:linear-gradient(#7a4a22,#5c3517);border-top:4px solid var(--cx-w4);box-shadow:0 -6px 16px rgba(0,0,0,.35)}
.cx-tabbar a{display:grid;justify-items:center;align-content:center;gap:1px;min-height:48px;padding:3px 0;border-radius:10px;color:#ffeab8;font:400 11px/1.1 var(--cx-title);text-shadow:0 1px 0 var(--cx-w4)}
.cx-tabbar a span{font-size:20px;line-height:1}
.cx-tabbar a.on{background:linear-gradient(var(--cx-g1),var(--cx-g2));color:#4a2c12;text-shadow:none;box-shadow:inset 0 2px 0 rgba(255,255,255,.6)}
.cx-toast{bottom:96px}
}
@media(max-width:600px){
html.cx .cx-panel{padding:12px;border-width:3px}
.cx-tab{flex:1;justify-content:center}
.cx-head h3{font-size:21px}
html.cx .quick-stats strong{font-size:15px}
html.cx .quick-stats small{font-size:11px}
html.cx .hero-copy p{font-size:15px}
}
@media(max-width:480px){html.cx .hero-buttons .button{flex:1 1 100%}}
`;

  function injectTheme() {
    document.documentElement.classList.add("cx");
    if (!$("#cx-font")) {
      const l = document.createElement("link");
      l.id = "cx-font";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
      document.head.appendChild(l);
    }
    if (!$("#cx-style")) {
      const s = document.createElement("style");
      s.id = "cx-style";
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }

  /* ============ 6. Hero clouds ============ */
  function decorateHero() {
    const hero = $(".hero");
    if (!hero || $(".cx-cloud", hero)) return;
    ["cx-c1", "cx-c2", "cx-c3"].forEach(c => {
      const s = document.createElement("span");
      s.className = "cx-cloud " + c;
      s.setAttribute("aria-hidden", "true");
      hero.appendChild(s);
    });
  }

  /* ============ 7. Player + Clan finder ============ */
  const badge = c => {
    const u = c && c.badgeUrls && (c.badgeUrls.small || c.badgeUrls.medium);
    return (typeof u === "string" && u.indexOf("https://api-assets.clashofclans.com/") === 0)
      ? '<img src="' + esc(u) + '" alt="" loading="lazy" width="46" height="56">' : "";
  };
  const stat = (label, v) => '<div class="cx-stat"><b>' + num(v) + "</b><span>" + label + "</span></div>";
  const heroRow = h => {
    const pct = Math.max(0, Math.min(100, Math.round((h.level / (h.maxLevel || h.level || 1)) * 100)));
    return '<div class="cx-hrow"><div><span>' + esc(h.name) + "</span><span>Lv " + esc(h.level) + "/" + esc(h.maxLevel || h.level) +
      '</span></div><div class="cx-bar"><i style="width:' + pct + '%"></i></div></div>';
  };

  function playerCard(p) {
    const heroes = (p.heroes || []).filter(h => h.village === "home");
    const clan = p.clan ? esc(p.clan.name) + " · " + esc(p.clan.tag) : "No clan";
    const role = p.role ? " · " + esc(roleName(p.role)) : "";
    return '<article class="cx-card"><div class="cx-head">' + badge(p.clan) +
      "<div><h3>" + esc(p.name) + "</h3><small>" + esc(p.tag) + role + "</small><small>" + clan + "</small></div>" +
      '<div class="cx-th"><span>TH</span><b>' + esc(p.townHallLevel == null ? "?" : p.townHallLevel) + "</b></div></div>" +
      '<div class="cx-stats">' +
      stat("⭐ XP level", p.expLevel) + stat("🏆 Trophies", p.trophies) +
      stat("🥇 Best trophies", p.bestTrophies) + stat("🌟 War stars", p.warStars) +
      stat("🎁 Donated", p.donations) + stat("📥 Received", p.donationsReceived) + "</div>" +
      (heroes.length ? '<h4 class="cx-sub">Heroes</h4><div class="cx-heroes">' + heroes.map(heroRow).join("") + "</div>" : "") +
      '<div class="cx-actions"><button class="cx-btn gold sm" type="button" data-copy="' + esc(p.tag) + '">Copy tag</button>' +
      '<a class="cx-btn green sm" href="' + esc(gameLink("OpenPlayerProfile", p.tag)) + '" target="_blank" rel="noopener noreferrer">Open in game</a></div></article>';
  }

  const memberRow = m =>
    '<div class="cx-row"><div class="grow"><strong>' + esc(m.name) + "</strong><small>" + esc(m.tag) + " · " + esc(roleName(m.role)) +
    " · 🏆 " + num(m.trophies) + '</small></div><span class="cx-pill">TH ' + esc(m.townHallLevel == null ? "?" : m.townHallLevel) +
    '</span><button class="cx-btn blue sm" type="button" data-view="' + esc(m.tag) + '">View</button></div>';

  function clanRow(c) {
    const type = ({ open: "Open", inviteOnly: "Invite only", closed: "Closed" }[c.type]) || "";
    const req = c.requiredTownhallLevel ? " · needs TH " + c.requiredTownhallLevel + "+" : "";
    return '<div class="cx-row">' + badge(c) + '<div class="grow"><strong>' + esc(c.name) + "</strong><small>" + esc(c.tag) +
      " · Level " + esc(c.clanLevel == null ? "?" : c.clanLevel) + " · " + esc(c.members == null ? "?" : c.members) + "/50 members" +
      (type ? " · " + type : "") + esc(req) + "</small></div>" +
      '<button class="cx-btn blue sm" type="button" data-members="' + esc(c.tag) + '">Find a player here</button>' +
      '<button class="cx-btn gold sm" type="button" data-copy="' + esc(c.tag) + '">Copy tag</button>' +
      '<a class="cx-btn green sm" href="' + esc(gameLink("OpenClanProfile", c.tag)) + '" target="_blank" rel="noopener noreferrer">Open</a></div>';
  }

  function buildFinder() {
    const sec = $("#player-finder");
    if (!sec) return;
    const th = thOptions("Any Town Hall");
    const box = div("cx-panel cx-app", "cxFinder");
    box.innerHTML =
      '<div class="cx-tabs" role="tablist" aria-label="Search type">' +
        '<button type="button" class="cx-tab on" data-tab="players" role="tab" aria-selected="true">👤 Players</button>' +
        '<button type="button" class="cx-tab" data-tab="clans" role="tab" aria-selected="false">🛡️ Clans</button></div>' +
      '<form id="cxPlayerForm" novalidate>' +
        '<div class="cx-seg" role="group" aria-label="Search player by">' +
          '<button type="button" class="cx-chip on" data-mode="tag">Player tag</button>' +
          '<button type="button" class="cx-chip" data-mode="name">Player name</button></div>' +
        '<label class="cx-field" data-m="name" hidden><span>Player name</span><input id="cxPName" maxlength="30" placeholder="Enter player name" autocomplete="off"></label>' +
        '<label class="cx-field" data-m="tag"><span>Player tag</span><input id="cxPTag" maxlength="16" placeholder="#2PP" autocomplete="off" autocapitalize="characters"></label>' +
        '<div class="cx-crit" data-m="name" hidden><h4>Criteria</h4>' +
          '<label class="cx-field"><span>Clan tag <em>(the clan to search in)</em></span><input id="cxPClan" maxlength="16" placeholder="#CLANTAG" autocomplete="off" autocapitalize="characters"></label>' +
          '<label class="cx-field"><span>Town Hall</span><select id="cxPTH">' + th + "</select></label>" +
          '<label class="cx-check"><input type="checkbox" id="cxExact"><span>Only players with that exact name</span></label>' +
          '<p class="cx-help">Supercell\'s API can\'t search every player by name, so ClashVault searches the members of the clan you enter. When names match, the Town Hall filter picks the right Chief. Don\'t know the clan tag? Use the Clans tab.</p></div>' +
        '<button class="cx-btn green" type="submit">Search player</button></form>' +
      '<form id="cxClanForm" novalidate hidden>' +
        '<label class="cx-field"><span>Clan name or tag</span><input id="cxCName" maxlength="40" placeholder="Name (3+ letters) or #TAG" autocomplete="off"></label>' +
        '<div class="cx-crit"><h4>Criteria</h4><div class="cx-two">' +
          '<label class="cx-field"><span>Min clan level</span><input id="cxCLvl" type="number" inputmode="numeric" min="1" max="50" placeholder="Any"></label>' +
          '<label class="cx-field"><span>Min members</span><input id="cxCMin" type="number" inputmode="numeric" min="1" max="50" placeholder="Any"></label></div>' +
          '<label class="cx-field"><span>Clans I can join with</span><select id="cxCTH">' + th + "</select></label></div>" +
        '<button class="cx-btn green" type="submit">Search clan</button></form>' +
      '<p class="cx-msg" id="cxMsg" aria-live="polite">Search a player by tag, or by name inside a clan.</p>' +
      '<div class="cx-results" id="cxOut"></div>';

    const msg = $("#cxMsg", box), out = $("#cxOut", box);
    const pForm = $("#cxPlayerForm", box), cForm = $("#cxClanForm", box);
    let mode = "tag";
    const say = (t, kind) => { msg.textContent = t; msg.className = "cx-msg" + (kind ? " " + kind : ""); };
    const lock = (form, on) => {
      const b = $("button[type=submit]", form);
      if (!b) return;
      if (!b.dataset.l) b.dataset.l = b.textContent;
      b.disabled = on;
      b.textContent = on ? "Searching…" : b.dataset.l;
    };

    $$(".cx-tab", box).forEach(b => b.addEventListener("click", () => {
      $$(".cx-tab", box).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      const players = b.dataset.tab === "players";
      pForm.hidden = !players;
      cForm.hidden = players;
      out.innerHTML = "";
      say(players ? "Search a player by tag, or by name inside a clan." : "Search a clan by name or tag, then narrow it down with the criteria.");
    }));
    $$("[data-mode]", box).forEach(b => b.addEventListener("click", () => {
      mode = b.dataset.mode;
      $$("[data-mode]", box).forEach(x => x.classList.toggle("on", x === b));
      $$("[data-m]", box).forEach(x => { x.hidden = x.dataset.m !== mode; });
      out.innerHTML = "";
      say(mode === "tag" ? "Enter a player tag like #2PP." : "Enter the player name and the clan tag to search in.");
    }));

    async function loadPlayer(tag) {
      say("Loading profile…");
      try {
        const p = await api("/players/" + encodeURIComponent(tag));
        out.innerHTML = playerCard(p);
        say("Found " + (p.name || "player") + ".", "ok");
      } catch (e) {
        out.innerHTML = "";
        say(errText(e), "err");
      }
    }

    pForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (mode === "tag") {
        const tag = normTag($("#cxPTag", box).value);
        if (!validTag(tag)) { say("Enter a valid player tag, like #2PP. Tags only use 0289PYLQGRJCUV.", "err"); return; }
        lock(pForm, true);
        await loadPlayer(tag);
        lock(pForm, false);
        return;
      }
      const name = $("#cxPName", box).value.trim();
      const clan = normTag($("#cxPClan", box).value);
      if (!name) { say("Enter the player name.", "err"); return; }
      if (!validTag(clan)) { say("Enter the clan tag to search in, like #2PP. Don't know it? Use the Clans tab.", "err"); return; }
      lock(pForm, true);
      out.innerHTML = "";
      say("Searching clan members…");
      try {
        const data = await api("/clans/" + encodeURIComponent(clan) + "/members");
        const q = name.toLowerCase();
        const thv = $("#cxPTH", box).value;
        const exact = $("#cxExact", box).checked;
        const hits = (data.items || []).filter(m => {
          const n = String(m.name || "").toLowerCase();
          return (exact ? n === q : n.indexOf(q) !== -1) && (!thv || String(m.townHallLevel) === thv);
        });
        if (!hits.length) say("No member matched. Check the spelling, the Town Hall filter or the clan tag.", "err");
        else if (hits.length === 1) await loadPlayer(hits[0].tag);
        else {
          out.innerHTML = '<div class="cx-list">' + hits.map(memberRow).join("") + "</div>";
          say(hits.length + " players match. Tap View on the right one. Town Hall and trophies help you tell them apart.", "ok");
        }
      } catch (err) {
        say(errText(err), "err");
      }
      lock(pForm, false);
    });

    cForm.addEventListener("submit", async e => {
      e.preventDefault();
      const raw = $("#cxCName", box).value.trim();
      if (!raw) { say("Enter a clan name (3+ letters) or a clan tag.", "err"); return; }
      lock(cForm, true);
      out.innerHTML = "";
      say("Searching clans…");
      try {
        const lvl = parseInt($("#cxCLvl", box).value, 10) || 0;
        const mem = parseInt($("#cxCMin", box).value, 10) || 0;
        const thv = parseInt($("#cxCTH", box).value, 10) || 0;
        let items;
        if (isTagInput(raw)) {
          items = [await api("/clans/" + encodeURIComponent(normTag(raw)))];
        } else {
          if (raw.length < 3) throw new ApiError("input", "Clan names need at least 3 letters.");
          const qs = ["name=" + encodeURIComponent(raw), "limit=20"];
          if (lvl) qs.push("minClanLevel=" + lvl);
          if (mem) qs.push("minMembers=" + mem);
          items = (await api("/clans?" + qs.join("&"))).items || [];
        }
        items = items.filter(c => (!lvl || c.clanLevel >= lvl) && (!mem || c.members >= mem) &&
          (!thv || !c.requiredTownhallLevel || c.requiredTownhallLevel <= thv));
        if (!items.length) say("No clans matched. Try another name or loosen the criteria.", "err");
        else {
          out.innerHTML = '<div class="cx-list">' + items.map(clanRow).join("") + "</div>";
          say(items.length + (items.length === 1 ? " clan found." : " clans found."), "ok");
        }
      } catch (err) {
        say(errText(err), "err");
      }
      lock(cForm, false);
    });

    out.addEventListener("click", async e => {
      const c = e.target.closest("[data-copy]");
      if (c) { toast((await copyText(c.dataset.copy)) ? "Copied " + c.dataset.copy : "Couldn't copy. Copy it by hand."); return; }
      const v = e.target.closest("[data-view]");
      if (v) { loadPlayer(v.dataset.view); return; }
      const m = e.target.closest("[data-members]");
      if (m) {
        $('[data-tab="players"]', box).click();
        $('[data-mode="name"]', box).click();
        $("#cxPClan", box).value = m.dataset.members;
        $("#cxPName", box).focus();
        say("Clan " + m.dataset.members + " is filled in. Enter the player name and search.");
      }
    });

    swapIn(sec, box);
    setHeading(sec, null, "Search players and clans by tag, name or criteria.");
  }

  /* ============ 8. Base + troop library ============ */
  function buildLibrary() {
    const sec = $("#bases");
    if (!sec) return;
    const CATS = { base: ["All", "War", "Farming", "Trophy", "Hybrid"], army: ["All", "Air", "Ground", "Hybrid"] };
    let kind = "base", cat = "All", th = "";
    const box = div("cx-panel cx-app", "cxLibrary");
    box.innerHTML =
      '<div class="cx-tabs" role="tablist" aria-label="Library">' +
        '<button type="button" class="cx-tab on" data-k="base" role="tab" aria-selected="true">🏰 Base layouts</button>' +
        '<button type="button" class="cx-tab" data-k="army" role="tab" aria-selected="false">⚔️ Troop layouts</button></div>' +
      '<label class="cx-field"><span>Town Hall</span><select id="cxLTH">' + thOptions("All Town Halls") + "</select></label>" +
      '<div class="cx-seg" id="cxCats" role="group" aria-label="Layout type"></div>' +
      '<div class="cx-grid" id="cxGrid"></div>' +
      '<p class="cx-help">Cards marked SAMPLE are placeholders. Cards marked READY copy a real in-game link you can paste into Clash of Clans.</p>';
    const grid = $("#cxGrid", box), cats = $("#cxCats", box);

    const card = x => {
      const real = isGameLink(x.link);
      return '<article class="cx-lay"><div class="cx-art ' + x.kind + '">' + x.icon + "<i" + (real ? ' class="ok">READY' : ">SAMPLE") + "</i></div>" +
        '<div class="cx-lay-body"><div class="cx-lay-meta"><span class="cx-pill">TH ' + esc(x.th) + '</span><span class="cx-pill">' + esc(x.cat) + "</span></div>" +
        "<h3>" + esc(x.name) + "</h3><p>" + esc(x.note) + "</p>" +
        '<button class="cx-btn green sm" type="button" data-i="' + LAYOUTS.indexOf(x) + '">Copy link</button></div></article>';
    };
    const drawCats = () => {
      cats.innerHTML = CATS[kind].map(c => '<button type="button" class="cx-chip' + (c === cat ? " on" : "") + '" data-c="' + c + '">' + c + "</button>").join("");
    };
    const draw = () => {
      const list = LAYOUTS.filter(x => x.kind === kind && (!th || String(x.th) === th) && (cat === "All" || x.cat === cat));
      grid.innerHTML = list.length ? list.map(card).join("")
        : '<p class="cx-msg" style="grid-column:1/-1">No ' + (kind === "base" ? "base" : "troop") + " layouts for this filter yet.</p>";
    };

    $$(".cx-tab", box).forEach(b => b.addEventListener("click", () => {
      kind = b.dataset.k;
      cat = "All";
      $$(".cx-tab", box).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      drawCats();
      draw();
    }));
    cats.addEventListener("click", e => {
      const b = e.target.closest("[data-c]");
      if (!b) return;
      cat = b.dataset.c;
      drawCats();
      draw();
    });
    $("#cxLTH", box).addEventListener("change", e => { th = e.target.value; draw(); });
    grid.addEventListener("click", async e => {
      const b = e.target.closest("[data-i]");
      if (!b) return;
      const x = LAYOUTS[Number(b.dataset.i)];
      if (!x) return;
      if (isGameLink(x.link)) {
        toast((await copyText(x.link)) ? "Link copied. Paste it in Clash of Clans." : "Couldn't copy. Try again.");
        return;
      }
      const page = location.origin + location.pathname + "#bases";
      toast((await copyText(page)) ? "Page link copied. This sample has no in-game link yet." : "Couldn't copy the link.");
    });

    drawCats();
    draw();
    swapIn(sec, box);
    setHeading(sec, null, "Pick your Town Hall, then copy a base or troop layout link.");
  }

  /* ============ 9. Builder tracker (sign in to see builders) ============ */
  function buildTracker() {
    const sec = $("#tracker");
    if (!sec) return;
    const box = div("cx-panel cx-app", "cxTracker");
    let uid = null, st = null;
    const key = id => "cx-builders-v3:" + id;
    const norm = s => {
      const total = Math.min(6, Math.max(1, parseInt(s && s.total, 10) || SETTINGS.DEFAULT_BUILDERS));
      return { total: total, busy: Array.from({ length: total }, (_, i) => !!(s && s.busy && s.busy[i])) };
    };
    const load = () => { try { return norm(JSON.parse(localStorage.getItem(key(uid)) || "null")); } catch (_) { return norm(null); } };
    const save = () => { try { localStorage.setItem(key(uid), JSON.stringify(st)); } catch (_) { toast("Couldn't save on this device."); } };

    function gate() {
      box.innerHTML = '<div class="cx-gate"><div class="big" aria-hidden="true">🔒</div><h3>Sign in to see your builders</h3>' +
        "<p>After you sign in, you'll see how many builders are available and how many are working.</p>" +
        '<a class="cx-btn green" href="#account">Go to Account</a></div>';
    }
    function draw() {
      const working = st.busy.filter(Boolean).length, free = st.total - working;
      box.innerHTML =
        '<div class="cx-bar-top"><span class="cx-hud" title="Available builders">🔨 ' + free + "/" + st.total + "</span>" +
        '<label class="cx-field" style="margin:0;min-width:150px"><span>My builders</span><select id="cxBTotal">' +
        [1, 2, 3, 4, 5, 6].map(n => '<option value="' + n + '"' + (n === st.total ? " selected" : "") + ">" + n + " builders</option>").join("") +
        "</select></label></div>" +
        '<div class="cx-sum"><div><b>' + st.total + '</b><span>Total</span></div><div class="free"><b>' + free +
        '</b><span>Available</span></div><div class="busy"><b>' + working + "</b><span>Working</span></div></div>" +
        '<div class="cx-bgrid">' + st.busy.map((b, i) =>
          '<div class="cx-b' + (b ? " busy" : "") + '"><div class="cx-b-ico" aria-hidden="true">' + (b ? "🔨" : "😴") + "</div><h3>Builder " + (i + 1) +
          '</h3><div class="cx-state">' + (b ? "WORKING" : "AVAILABLE") + '</div><button class="cx-btn ' + (b ? "gold" : "green") +
          ' sm" type="button" data-b="' + i + '">' + (b ? "Mark available" : "Mark working") + "</button></div>").join("") + "</div>" +
        '<div class="cx-actions" style="padding:14px 0 0"><button class="cx-btn blue sm" type="button" id="cxBReset">All available</button></div>' +
        '<p class="cx-help">Supercell doesn\'t share live builder timers, so tap each builder to match your village. ClashVault remembers it on this device.</p>';
    }

    box.addEventListener("click", e => {
      if (!uid || !st) return;
      const b = e.target.closest("[data-b]");
      if (b) { const i = Number(b.dataset.b); st.busy[i] = !st.busy[i]; save(); draw(); return; }
      if (e.target.closest("#cxBReset")) { st.busy = st.busy.map(() => false); save(); draw(); }
    });
    box.addEventListener("change", e => {
      if (!uid || !st || e.target.id !== "cxBTotal") return;
      st = norm({ total: e.target.value, busy: st.busy });
      save();
      draw();
    });

    function setUser(id) {
      if (id === uid) return;
      uid = id;
      if (!uid) { st = null; gate(); return; }
      st = load();
      draw();
    }

    let sbUser = null;
    const emailKey = u => (u && (u.email || u.id)) ? String(u.email || u.id).toLowerCase() : null;
    const domUser = () => {
      const li = $("#authLoggedIn");
      if (!li || li.hidden) return null;
      const em = (($("#authUserEmail") || {}).textContent || "").trim().toLowerCase();
      return em || "signed-in";
    };
    const refresh = () => setUser(sbUser || domUser());

    gate();
    swapIn(sec, box);
    setHeading(sec, 'Builder <span>Tracker</span>', "See how many builders are free and how many are working.");

    const sb = sbClient();
    if (sb && sb.auth) {
      try {
        sb.auth.getSession().then(r => { sbUser = emailKey(r && r.data && r.data.session && r.data.session.user); refresh(); }).catch(refresh);
        sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => { sbUser = emailKey(session && session.user); refresh(); }, 0); });
      } catch (_) {}
    }
    const acc = $("#account");
    if (acc && "MutationObserver" in window) {
      new MutationObserver(refresh).observe(acc, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true, characterData: true });
    }
    refresh();
  }

  /* ============ 10. Mobile bottom menu (game style) ============ */
  function buildTabbar() {
    if ($(".cx-tabbar")) return;
    const items = [["home", "🏠", "Home"], ["player-finder", "🔍", "Players"], ["bases", "🏰", "Bases"],
      ["attacks", "⚔️", "Attack"], ["tracker", "🔨", "Builders"], ["account", "👤", "Account"]];
    const nav = document.createElement("nav");
    nav.className = "cx-tabbar";
    nav.setAttribute("aria-label", "Quick navigation");
    nav.innerHTML = items.map(i => '<a href="#' + i[0] + '" data-s="' + i[0] + '"><span aria-hidden="true">' + i[1] + "</span>" + i[2] + "</a>").join("");
    document.body.appendChild(nav);
    const links = $$("a", nav);
    const setOn = id => links.forEach(a => a.classList.toggle("on", a.dataset.s === id));
    setOn("home");
    if ("IntersectionObserver" in window) {
      const targets = [[$(".hero"), "home"]].concat(items.slice(1).map(i => [document.getElementById(i[0]), i[0]]));
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        const t = targets.find(x => x[0] === en.target);
        if (t) setOn(t[1]);
      }), { rootMargin: "-45% 0px -50% 0px" });
      targets.forEach(t => { if (t[0]) io.observe(t[0]); });
    }
  }

  /* ============ 11. Start ============ */
  function start() {
    safe("theme", injectTheme);
    safe("hero", decorateHero);
    safe("finder", buildFinder);
    safe("library", buildLibrary);
    safe("tracker", buildTracker);
    safe("tabbar", buildTabbar);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
