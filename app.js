/* =====================================================================
   ClashVault: Clash of Clans look + working finder, library and builders
   File name: clashvault-redesign.js   (version 3)

   INSTALL: 2 steps, nothing else in your site changes
     1) Upload this file to the repo root and replace the old one.
     2) In index.html keep the ONE script line (after auth.js, before </body>)
        and change the number so phones load the new file:
          <script src="./clashvault-redesign.js?v=3"></script>

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
    EDGE_FUNCTION: "coc",           // name of your Supabase Edge Function (see coc-edge-function.ts)
    PROXY_BASE: "",                 // optional: your own proxy URL ending in /v1 ("" = not used)
    LAYOUTS_URL: "./layouts.json",  // optional file with your real base + troop links (see layouts.example.json)
    MAX_TOWN_HALL: 19,              // raise this when Supercell releases a new Town Hall
    DEFAULT_BUILDERS: 5             // builders shown the first time a player opens the tracker
  };

  /* ============ 2. LAYOUTS (bases + troop/army links) ============
     Easiest way to add real layouts: copy layouts.example.json to layouts.json and edit it.
     You can also edit the list below. For "Copy link" to copy a REAL in-game link,
     paste it in `link`:
       base : https://link.clashofclans.com/en?action=OpenLayout&id=...
       army : https://link.clashofclans.com/en?action=CopyArmy&army=...
     Optional per layout: image ("images/my-base.jpg" or https://...), views, rating (0-5),
     added / updated ("2026-11-22").
     Cards with an empty link show SAMPLE and copy this page's link instead. */
  let LAYOUTS = [
    { kind: "base", th: 19, cat: "War",           tag: "Anti 3 Stars",              icon: "🛡️", name: "Anti 3-Star Fortress", note: "Split key defenses around a compact core.", link: "" },
    { kind: "base", th: 19, cat: "Trophy",        tag: "Legend League",             icon: "🏆", name: "Legend Ring",          note: "Tight ring for pushing trophies.", link: "" },
    { kind: "base", th: 18, cat: "Farming",       tag: "Anti Everything",           icon: "🌾", name: "Resource Keeper",      note: "Storages protected deep inside.", link: "" },
    { kind: "base", th: 18, cat: "War",           tag: "Anti Air / Electro Dragon", icon: "🏰", name: "Air Trap Maze",        note: "Built to slow Electro Dragons.", link: "" },
    { kind: "base", th: 17, cat: "Hybrid",        tag: "Hybrid",                    icon: "⚔️", name: "Hybrid Guard",         note: "Balanced for trophies and loot.", link: "" },
    { kind: "base", th: 16, cat: "Defence",       tag: "Anti 2 Stars",              icon: "🛡️", name: "Star Saver",           note: "Makes the third star hard to get.", link: "" },
    { kind: "base", th: 15, cat: "Trophy",        tag: "Anti 3 Stars",              icon: "🏆", name: "Champion's Ring",      note: "Layout concept for trophy pushing.", link: "" },
    { kind: "base", th: 14, cat: "Farming",       tag: "Anti Everything",           icon: "🌾", name: "Loot Vault",           note: "Keeps Gold and Elixir safe.", link: "" },
    { kind: "base", th: 12, cat: "Troll / Funny", tag: "",                          icon: "🤡", name: "Skull Troll Base",     note: "Just for laughs.", link: "" },
    { kind: "army", th: 19, cat: "Air",           tag: "", icon: "🐉", name: "Electro Dragon Push", note: "Simple air attack. Funnel first.", link: "" },
    { kind: "army", th: 18, cat: "Ground",        tag: "", icon: "🌳", name: "Root Rider Smash",    note: "Ground push backed by your heroes.", link: "" },
    { kind: "army", th: 17, cat: "Hybrid",        tag: "", icon: "🐗", name: "Miner + Hog Hybrid",  note: "Fast, flexible and beginner friendly.", link: "" },
    { kind: "army", th: 16, cat: "Ground",        tag: "", icon: "🧙", name: "Yeti + Witch Push",   note: "Strong mid-game ground army.", link: "" }
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
      403: "Supercell rejected the API key. Create the key with the proxy IP 45.79.218.79 (see README-SETUP.md).",
      404: "Not found. Double-check the tag.",
      429: "Too many searches at once. Wait a few seconds and try again.",
      500: "ClashVault's API key isn't set up yet. Add the COC_API_TOKEN secret to the Edge Function.",
      502: "Couldn't reach the Clash of Clans API. Try again in a moment.",
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

/* ---------- v3: more Clash feel ---------- */
.cx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
html.cx.cx-lock{overflow:hidden}
html.cx .cx-panel{position:relative;background:radial-gradient(circle at 8px 8px,#ffe27a 0 2px,#9a5a0c 2px 4px,transparent 4.5px),radial-gradient(circle at calc(100% - 8px) 8px,#ffe27a 0 2px,#9a5a0c 2px 4px,transparent 4.5px),radial-gradient(circle at 8px calc(100% - 8px),#ffe27a 0 2px,#9a5a0c 2px 4px,transparent 4.5px),radial-gradient(circle at calc(100% - 8px) calc(100% - 8px),#ffe27a 0 2px,#9a5a0c 2px 4px,transparent 4.5px),radial-gradient(rgba(138,84,39,.08) 1px,transparent 1.6px) 0 0/8px 8px,linear-gradient(var(--cx-p1),var(--cx-p2))}
.cx-tab{display:inline-flex;align-items:center;justify-content:center;gap:8px}
.cx-tabs2{flex-wrap:nowrap}
.cx-tabs2 .cx-tab{flex:1 1 0;min-height:52px;font-size:16px}
.cx-search{position:relative;display:block;margin:0 0 12px}
.cx-search i{position:absolute;z-index:1;left:15px;top:50%;transform:translateY(-50%);font-style:normal;font-size:18px;pointer-events:none}
html.cx .cx-search input{width:100%;min-height:54px;padding:0 14px 0 46px;font-size:17px;border-radius:14px}
.cx-actions-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 12px}
.cx-add{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:3px 18px 3px 4px;font:400 17px var(--cx-title);letter-spacing:.3px;color:#fff;text-shadow:var(--cx-ols);background:linear-gradient(var(--cx-n1),var(--cx-n2) 55%,#4a9a1d);border:3px solid var(--cx-line);border-radius:999px;box-shadow:inset 0 2px 0 rgba(255,255,255,.5),0 4px 0 var(--cx-n3);cursor:pointer}
.cx-add b{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#fff;border:3px solid var(--cx-n3);color:#3a8a1e;font:400 26px/1 var(--cx-title);text-shadow:none;transition:transform .15s}
.cx-add[aria-expanded="true"] b{transform:rotate(45deg)}
.cx-add:active{transform:translateY(2px)}
.cx-close{display:block;margin:4px 0 0 auto;min-height:44px;padding:0 10px;border:0;background:none;color:#6b4a26;font:400 17px var(--cx-title);letter-spacing:.8px;text-transform:uppercase;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
.cx-go{width:100%}
.cx-label{display:block;margin:0 0 4px;font-size:14px;font-weight:800;color:#6b4a26}
.cx-ths{display:flex;gap:8px;margin:0 -4px 6px;padding:4px 4px 12px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.cx-ths::-webkit-scrollbar{display:none}
.cx-thc{flex:none;scroll-snap-align:start;display:grid;place-items:center;align-content:center;min-width:58px;min-height:58px;padding:4px 8px;font-family:var(--cx-title);line-height:1;color:#ffeab8;text-shadow:0 2px 0 var(--cx-w4);background:linear-gradient(var(--cx-w1),var(--cx-w2));border:3px solid var(--cx-w4);border-radius:12px;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 3px 0 var(--cx-w4);cursor:pointer}
.cx-thc small{font-size:11px;letter-spacing:.6px}
.cx-thc b{font-weight:400;font-size:24px}
.cx-thc.all{min-width:68px}
.cx-thc.all b{font-size:20px}
.cx-thc.on{color:#4a2c12;text-shadow:0 1px 0 rgba(255,255,255,.5);background:linear-gradient(var(--cx-g1),var(--cx-g2));border-color:#5a3300;box-shadow:inset 0 2px 0 rgba(255,255,255,.6),0 3px 0 var(--cx-g3)}
.cx-chip.tag{min-height:40px;padding:6px 12px;font-size:14px}
.cx-more{margin:0 0 12px;border:2px dashed #b98a4e;border-radius:14px;background:rgba(255,255,255,.4)}
.cx-more summary{display:flex;align-items:center;justify-content:space-between;min-height:48px;padding:0 14px;font:400 17px var(--cx-title);color:var(--cx-ink);cursor:pointer;list-style:none}
.cx-more summary::-webkit-details-marker{display:none}
.cx-more summary::after{content:"▾";transition:transform .15s}
.cx-more[open] summary::after{transform:rotate(180deg)}
.cx-more-body{padding:0 12px 6px}
.cx-count{margin:6px 0 0;font-size:14px;font-weight:800;color:var(--cx-ink2)}
.cx-art{width:100%;padding:0;border:0;border-bottom:3px solid var(--cx-w2);color:inherit;font-family:inherit;cursor:pointer;overflow:hidden}
.cx-art::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 2px,transparent 2px 22px),repeating-linear-gradient(-45deg,rgba(0,0,0,.1) 0 2px,transparent 2px 22px)}
.cx-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cx-emo{position:relative;z-index:1;filter:drop-shadow(0 3px 2px rgba(0,0,0,.35))}
.cx-badges{position:absolute;z-index:2;top:8px;right:8px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.cx-bdg{padding:3px 9px;border-radius:8px;border:2px solid var(--cx-w4);background:#6b4423;color:#fff;font:400 12px/1.2 var(--cx-title);font-style:normal;text-shadow:var(--cx-ols)}
.cx-bdg.blue{background:#2f7cc8;border-color:#153f73}
.cx-bdg.orange{background:#ee7a1c;border-color:#7d3a06}
.cx-meta2{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:13px;font-weight:800;color:var(--cx-ink2)}
.cx-stars{font-size:17px;letter-spacing:1px;background:linear-gradient(90deg,#f7b823 var(--r,0%),#d8c7a0 var(--r,0%));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.cx-sheet{position:fixed;inset:0;z-index:3000;display:flex;align-items:flex-end;justify-content:center;background:rgba(14,10,6,.72)}
.cx-sheet[hidden]{display:none}
.cx-sheet-card{position:relative;width:min(100%,520px);max-height:92vh;overflow:auto;padding:14px 14px calc(16px + env(safe-area-inset-bottom,0px));background:linear-gradient(var(--cx-p1),var(--cx-p2));border:4px solid var(--cx-w2);border-bottom:0;border-radius:22px 22px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.45);color:var(--cx-ink)}
.cx-sheet-x{position:absolute;z-index:3;top:20px;right:20px;width:44px;height:44px;border-radius:12px;border:2px solid var(--cx-line);background:linear-gradient(var(--cx-r1),var(--cx-r2));color:#fff;font:400 20px var(--cx-title);text-shadow:var(--cx-ols);box-shadow:0 3px 0 var(--cx-r3);cursor:pointer}
.cx-sheet-art{position:relative;display:grid;place-items:center;min-height:190px;margin:0 0 12px;overflow:hidden;font-size:84px;border:3px solid var(--cx-w2);border-radius:16px;background:radial-gradient(circle at 50% 38%,#9ad25a,#4f9a2a 60%,#2f6e1b)}
.cx-sheet-art.army{background:radial-gradient(circle at 50% 38%,#7fb8f0,#2f6fb4 62%,#1b4a85)}
.cx-sheet-art::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.12) 0 2px,transparent 2px 22px),repeating-linear-gradient(-45deg,rgba(0,0,0,.1) 0 2px,transparent 2px 22px)}
.cx-sheet-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cx-sheet-art .cx-badges{right:auto;left:8px}
.cx-sheet h3{margin:0 0 8px;font:400 26px/1.1 var(--cx-title);color:var(--cx-ink)}
.cx-sheet-nav{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 10px}
.cx-sheet .cx-btn.big{display:flex;width:100%;margin:0 0 8px}
@media(min-width:700px){.cx-sheet{align-items:center}.cx-sheet-card{border-bottom:4px solid var(--cx-w2);border-radius:22px;max-height:88vh}}
.cx-tree{position:absolute;z-index:0;bottom:10px;font-size:38px;line-height:1;pointer-events:none;filter:drop-shadow(0 3px 0 rgba(0,0,0,.25))}
.cx-t1{left:4%}
.cx-t2{left:15%;bottom:6px;font-size:28px}
.cx-t3{right:5%}
.cx-t4{right:16%;bottom:5px;font-size:28px}
html.cx .attack-visual.visual-ground{position:relative;bottom:auto;left:auto;width:auto;height:auto;min-height:165px;border-radius:0;background:linear-gradient(145deg,#2f6fb4,#17427a)}
.cx-disc{max-width:760px;margin:14px auto 0;padding:0 16px 8px;font-size:12px;line-height:1.55;text-align:center;color:rgba(233,212,168,.88)}
.cx-disc a{color:var(--cx-g1);text-decoration:underline}
@media(prefers-reduced-motion:reduce){.cx-cloud{animation:none}.cx-add b,.cx-more summary::after{transition:none}}
@media(max-width:380px){.cx-ths{margin:0 -2px}.cx-thc{min-width:54px}.cx-add{font-size:16px}}
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

  /* ============ 6. Hero clouds + trees, footer notice ============ */
  function decorateHero() {
    const hero = $(".hero");
    if (!hero || $(".cx-cloud", hero)) return;
    ["cx-c1", "cx-c2", "cx-c3"].forEach(c => {
      const s = document.createElement("span");
      s.className = "cx-cloud " + c;
      s.setAttribute("aria-hidden", "true");
      hero.appendChild(s);
    });
    [["cx-t1", "🌳"], ["cx-t2", "🌿"], ["cx-t3", "🌲"], ["cx-t4", "🌿"]].forEach(t => {
      const s = document.createElement("span");
      s.className = "cx-tree " + t[0];
      s.textContent = t[1];
      s.setAttribute("aria-hidden", "true");
      hero.appendChild(s);
    });
  }

  /* Supercell's Fan Content Policy asks fan sites to show this notice. */
  function addDisclaimer() {
    const f = $(".site-footer") || $("footer");
    if (!f || $(".cx-disc", f)) return;
    if (/not endorsed by supercell/i.test(f.textContent || "")) return;
    const p = document.createElement("p");
    p.className = "cx-disc";
    p.innerHTML = 'This material is unofficial and is not endorsed by Supercell. For more information see Supercell\'s Fan Content Policy: ' +
      '<a href="https://www.supercell.com/fan-content-policy/" target="_blank" rel="noopener noreferrer">www.supercell.com/fan-content-policy</a>.';
    f.appendChild(p);
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
    const th = thOptions("All Town Halls");
    const box = div("cx-panel cx-app", "cxFinder");
    box.innerHTML =
      '<div class="cx-tabs cx-tabs2" role="tablist" aria-label="Search type">' +
        '<button type="button" class="cx-tab on" data-tab="players" role="tab" aria-selected="true"><span aria-hidden="true">👤</span>Search players</button>' +
        '<button type="button" class="cx-tab" data-tab="clans" role="tab" aria-selected="false"><span aria-hidden="true">🛡️</span>Search clans</button></div>' +
      '<form id="cxPlayerForm" novalidate>' +
        '<label class="cx-search"><span class="cx-sr">Player name or tag</span><i aria-hidden="true">🔍</i>' +
          '<input id="cxPQ" type="search" maxlength="30" enterkeyhint="search" placeholder="Find a Player (enter Name or #Tag)" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="cx-actions-row"><button type="button" class="cx-add" data-crit="cxPCrit" aria-expanded="false" aria-controls="cxPCrit"><b aria-hidden="true">+</b>Add criteria</button></div>' +
        '<div class="cx-crit" id="cxPCrit" hidden>' +
          '<label class="cx-check"><input type="checkbox" id="cxExact"><span>Only players with that exact name</span></label>' +
          '<label class="cx-field"><span>Town Hall</span><select id="cxPTH">' + th + "</select></label>" +
          '<label class="cx-field"><span>Clan tag <em>(needed to search by name)</em></span><input id="cxPClan" maxlength="16" placeholder="#CLANTAG" autocomplete="off" autocapitalize="characters"></label>' +
          '<p class="cx-help">Supercell\'s API can\'t search every player by name, so ClashVault searches the members of the clan you enter. When several players share a name, the Town Hall filter picks the right Chief. A player tag always works on its own.</p>' +
          '<button type="button" class="cx-close" data-crit-close="cxPCrit">Close</button></div>' +
        '<button class="cx-btn green cx-go" type="submit">Search player</button></form>' +
      '<form id="cxClanForm" novalidate hidden>' +
        '<label class="cx-search"><span class="cx-sr">Clan name or tag</span><i aria-hidden="true">🔍</i>' +
          '<input id="cxCName" type="search" maxlength="40" enterkeyhint="search" placeholder="Find a Clan (enter Name or #Tag)" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="cx-actions-row"><button type="button" class="cx-add" data-crit="cxCCrit" aria-expanded="false" aria-controls="cxCCrit"><b aria-hidden="true">+</b>Add criteria</button></div>' +
        '<div class="cx-crit" id="cxCCrit" hidden><div class="cx-two">' +
          '<label class="cx-field"><span>Min clan level</span><input id="cxCLvl" type="number" inputmode="numeric" min="1" max="50" placeholder="Any"></label>' +
          '<label class="cx-field"><span>Min members</span><input id="cxCMin" type="number" inputmode="numeric" min="1" max="50" placeholder="Any"></label></div>' +
          '<label class="cx-field"><span>Clans I can join with</span><select id="cxCTH">' + th + "</select></label>" +
          '<button type="button" class="cx-close" data-crit-close="cxCCrit">Close</button></div>' +
        '<button class="cx-btn green cx-go" type="submit">Search clan</button></form>' +
      '<p class="cx-msg" id="cxMsg" aria-live="polite">Type a player name or tag. Add criteria to narrow it down.</p>' +
      '<div class="cx-results" id="cxOut"></div>';

    const msg = $("#cxMsg", box), out = $("#cxOut", box);
    const pForm = $("#cxPlayerForm", box), cForm = $("#cxClanForm", box);
    const say = (t, kind) => { msg.textContent = t; msg.className = "cx-msg" + (kind ? " " + kind : ""); };
    const lock = (form, on) => {
      const b = $("button[type=submit]", form);
      if (!b) return;
      if (!b.dataset.l) b.dataset.l = b.textContent;
      b.disabled = on;
      b.textContent = on ? "Searching…" : b.dataset.l;
    };
    const crit = (id, open) => {
      const el = $("#" + id, box);
      if (!el) return;
      el.hidden = !open;
      const b = $('[data-crit="' + id + '"]', box);
      if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
    };

    box.addEventListener("click", e => {
      const a = e.target.closest("[data-crit]");
      if (a) { const el = $("#" + a.dataset.crit, box); if (el) crit(a.dataset.crit, el.hidden); return; }
      const c = e.target.closest("[data-crit-close]");
      if (c) {
        crit(c.dataset.critClose, false);
        const o = $('[data-crit="' + c.dataset.critClose + '"]', box);
        if (o) o.focus();
      }
    });

    $$(".cx-tab", box).forEach(b => b.addEventListener("click", () => {
      $$(".cx-tab", box).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      const players = b.dataset.tab === "players";
      pForm.hidden = !players;
      cForm.hidden = players;
      out.innerHTML = "";
      say(players ? "Type a player name or tag. Add criteria to narrow it down." : "Type a clan name (3+ letters) or tag. Add criteria to narrow it down.");
    }));

    async function loadPlayer(tag) {
      say("Loading profile…");
      try {
        const p = await api("/players/" + encodeURIComponent(tag));
        out.innerHTML = playerCard(p);
        say("Found " + (p.name || "player") + ".", "ok");
        try { out.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (_) {}
      } catch (e) {
        out.innerHTML = "";
        say(errText(e), "err");
      }
    }

    pForm.addEventListener("submit", async e => {
      e.preventDefault();
      const q = $("#cxPQ", box).value.trim();
      const exact = $("#cxExact", box).checked;
      const clanRaw = $("#cxPClan", box).value.trim();
      const thv = $("#cxPTH", box).value;
      if (!q && !clanRaw) { say("Type a player name or tag first.", "err"); return; }

      /* A player tag works on its own. */
      if (q && !exact && isTagInput(q)) {
        lock(pForm, true);
        await loadPlayer(normTag(q));
        lock(pForm, false);
        return;
      }

      /* A name needs a clan to search in. */
      const clan = normTag(clanRaw);
      if (!validTag(clan)) {
        crit("cxPCrit", true);
        out.innerHTML = "";
        say(clanRaw
          ? "That clan tag doesn't look right. Clan tags look like #2PP."
          : "To search by name, add the clan tag under Criteria. Supercell's API can't search every player by name. Have the player tag? Type it above instead.", "err");
        $("#cxPClan", box).focus();
        return;
      }
      lock(pForm, true);
      out.innerHTML = "";
      say("Searching clan members…");
      try {
        const data = await api("/clans/" + encodeURIComponent(clan) + "/members");
        const items = data.items || [];
        const hasTH = items.some(m => m.townHallLevel != null);
        const useTH = !!thv && hasTH;
        const ql = q.toLowerCase();
        const hits = items.filter(m => {
          const n = String(m.name || "").toLowerCase();
          const okName = !ql || (exact ? n === ql : n.indexOf(ql) !== -1);
          return okName && (!useTH || String(m.townHallLevel) === thv);
        });
        if (!hits.length) say("No member matched. Check the spelling, the Town Hall filter or the clan tag.", "err");
        else if (hits.length === 1 && ql) await loadPlayer(hits[0].tag);
        else {
          out.innerHTML = '<div class="cx-list">' + hits.map(memberRow).join("") + "</div>";
          say(hits.length + (ql ? " players match." : " players in this clan.") + " Tap View on the right one. Town Hall and trophies help you tell them apart." +
            (thv && !hasTH ? " (This clan's data has no Town Hall levels, so that filter was skipped.)" : ""), "ok");
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
        $("#cxPClan", box).value = m.dataset.members;
        $("#cxPQ", box).value = "";
        crit("cxPCrit", true);
        $("#cxPQ", box).focus();
        say("Clan " + m.dataset.members + " is filled in under Criteria. Type the player name and search, or just search to list the members.");
      }
    });

    swapIn(sec, box);
    setHeading(sec, null, "Search players and clans by name or tag, then narrow it down with criteria.");
  }

  /* ============ 8. Base + troop library ============ */
  const isImg = s => typeof s === "string" &&
    (/^https:\/\/[^\s"'<>]+$/.test(s) || /^(?!.*\.\.)[\w\-./]+\.(png|jpe?g|webp|gif|avif)$/i.test(s));

  function cleanLayout(x) {
    if (!x || typeof x !== "object") return null;
    const kind = x.kind === "army" ? "army" : "base";
    const th = parseInt(x.th, 10);
    const name = String(x.name || "").trim().slice(0, 60);
    if (!name || !(th >= 1 && th <= 99)) return null;
    return {
      kind: kind, th: th, name: name,
      cat: String(x.cat || (kind === "army" ? "Ground" : "War")).slice(0, 24),
      tag: String(x.tag || "").slice(0, 40),
      icon: String(x.icon || (kind === "army" ? "⚔️" : "🏰")).slice(0, 8),
      note: String(x.note || "").slice(0, 140),
      link: isGameLink(x.link) ? x.link : "",
      image: isImg(x.image) ? x.image : "",
      views: Math.max(0, Number(x.views) || 0),
      rating: Math.max(0, Math.min(5, Number(x.rating) || 0)),
      added: String(x.added || ""),
      updated: String(x.updated || "")
    };
  }

  /* Optional: layouts.json next to index.html replaces the sample cards. */
  async function loadLayoutsFile() {
    if (!SETTINGS.LAYOUTS_URL) return null;
    try {
      const r = await fetch(SETTINGS.LAYOUTS_URL, { cache: "no-store" });
      if (!r.ok) return null;
      const raw = await r.json();
      const list = (Array.isArray(raw) ? raw : (raw && raw.layouts)) || [];
      const clean = list.map(cleanLayout).filter(Boolean);
      return clean.length ? clean : null;
    } catch (_) { return null; }
  }

  function buildLibrary() {
    const sec = $("#bases");
    if (!sec) return;
    let kind = "base", cat = "All", th = "", tag = "", sort = "date", shown = [];
    const CAT_ORDER = ["War", "Farming", "Defence", "Trophy", "Hybrid", "Troll / Funny", "Air", "Ground"];
    const SORTS = [["date", "Date"], ["views", "Views"], ["rating", "Rating"], ["updated", "Updated"]];
    const ts = s => { const t = Date.parse(s); return isNaN(t) ? 0 : t; };
    const CMP = {
      date: (a, b) => ts(b.added) - ts(a.added),
      views: (a, b) => (b.views || 0) - (a.views || 0),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      updated: (a, b) => ts(b.updated || b.added) - ts(a.updated || a.added)
    };

    const box = div("cx-panel cx-app", "cxLibrary");
    box.innerHTML =
      '<div class="cx-tabs cx-tabs2" role="tablist" aria-label="Library">' +
        '<button type="button" class="cx-tab on" data-k="base" role="tab" aria-selected="true"><span aria-hidden="true">🏰</span>Base layouts</button>' +
        '<button type="button" class="cx-tab" data-k="army" role="tab" aria-selected="false"><span aria-hidden="true">⚔️</span>Troop layouts</button></div>' +
      '<span class="cx-label" id="cxThLabel">Town Hall</span>' +
      '<div class="cx-ths" id="cxThs" role="group" aria-labelledby="cxThLabel"></div>' +
      '<div class="cx-seg" id="cxCats" role="group" aria-label="Layout type"></div>' +
      '<details class="cx-more" id="cxMore"><summary>Tags &amp; sort</summary><div class="cx-more-body">' +
        '<div id="cxTagsWrap"><span class="cx-label">Tags</span><div class="cx-seg" id="cxTags" role="group" aria-label="Tags"></div></div>' +
        '<label class="cx-field"><span>Sort by</span><select id="cxSort">' +
          SORTS.map(s => '<option value="' + s[0] + '">' + s[1] + "</option>").join("") + "</select></label></div></details>" +
      '<p class="cx-count" id="cxCount" aria-live="polite"></p>' +
      '<div class="cx-grid" id="cxGrid"></div>' +
      '<p class="cx-help">Cards marked SAMPLE are placeholders. Cards marked WITH LINK copy a real in-game link for Clash of Clans.</p>';
    const grid = $("#cxGrid", box), cats = $("#cxCats", box), tags = $("#cxTags", box), ths = $("#cxThs", box), count = $("#cxCount", box);

    /* ----- small render helpers ----- */
    const stars = r => '<span class="cx-stars" style="--r:' + Math.round((r / 5) * 100) + '%" role="img" aria-label="Rated ' + r.toFixed(1) + ' out of 5">★★★★★</span>';
    const compact = n => (n >= 1000 ? (Math.round(n / 100) / 10) + "K" : String(n));
    const year = x => { const t = ts(x.added); return t ? String(new Date(t).getFullYear()) : ""; };
    const metaLine = x => (x.rating ? stars(x.rating) : "") + (x.views ? "<span>👁 " + compact(x.views) + "</span>" : "");
    const artHtml = x => (x.image
      ? '<img src="' + esc(x.image) + '" alt="" loading="lazy" decoding="async">'
      : '<span class="cx-emo" aria-hidden="true">' + esc(x.icon) + "</span>");
    const badgesHtml = x => '<span class="cx-badges">' + (isGameLink(x.link) ? '<em class="cx-bdg blue">WITH LINK</em>' : '<em class="cx-bdg">SAMPLE</em>') +
      (year(x) ? '<em class="cx-bdg orange">' + year(x) + "</em>" : "") + "</span>";
    const card = x =>
      '<article class="cx-lay"><button type="button" class="cx-art ' + x.kind + '" data-o="' + shown.indexOf(x) + '" aria-label="Open ' + esc(x.name) + '">' +
        artHtml(x) + badgesHtml(x) + "</button>" +
      '<div class="cx-lay-body"><div class="cx-lay-meta"><span class="cx-pill">TH ' + esc(x.th) + '</span><span class="cx-pill">' + esc(x.cat) + "</span></div>" +
      "<h3>" + esc(x.name) + "</h3>" + (x.note ? "<p>" + esc(x.note) + "</p>" : "") +
      (metaLine(x) ? '<div class="cx-meta2">' + metaLine(x) + "</div>" : "") +
      '<button class="cx-btn green sm" type="button" data-i="' + LAYOUTS.indexOf(x) + '">Copy link</button></div></article>';

    const markOn = (wrap, attr, val) => $$("[" + attr + "]", wrap).forEach(b => {
      const on = b.getAttribute(attr) === val;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const drawThs = () => {
      let h = '<button type="button" class="cx-thc all" data-th="" aria-pressed="false"><b>All</b></button>';
      for (let n = SETTINGS.MAX_TOWN_HALL; n >= 1; n--) {
        h += '<button type="button" class="cx-thc" data-th="' + n + '" aria-pressed="false"><small>TH</small><b>' + n + "</b></button>";
      }
      ths.innerHTML = h;
      markOn(ths, "data-th", th);
    };
    const catsFor = () => {
      const set = {};
      LAYOUTS.forEach(x => { if (x.kind === kind && x.cat) set[x.cat] = 1; });
      return ["All"].concat(CAT_ORDER.filter(c => set[c]), Object.keys(set).filter(c => CAT_ORDER.indexOf(c) === -1).sort());
    };
    const tagsFor = () => {
      const set = {};
      LAYOUTS.forEach(x => { if (x.kind === kind && x.tag) set[x.tag] = 1; });
      return Object.keys(set);
    };
    const drawCats = () => {
      const list = catsFor();
      if (list.indexOf(cat) === -1) cat = "All";
      cats.innerHTML = list.map(c => '<button type="button" class="cx-chip" data-c="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>").join("");
      markOn(cats, "data-c", cat);
    };
    const drawTags = () => {
      const list = tagsFor();
      if (list.indexOf(tag) === -1) tag = "";
      tags.innerHTML = list.map(t => '<button type="button" class="cx-chip tag" data-t="' + esc(t) + '" aria-pressed="false">◆ ' + esc(t) + "</button>").join("");
      $("#cxTagsWrap", box).hidden = !list.length;
      markOn(tags, "data-t", tag);
    };
    const draw = () => {
      shown = LAYOUTS.filter(x => x.kind === kind && (!th || String(x.th) === th) && (cat === "All" || x.cat === cat) && (!tag || x.tag === tag)).sort(CMP[sort]);
      grid.innerHTML = shown.length ? shown.map(card).join("")
        : '<p class="cx-msg" style="grid-column:1/-1">No ' + (kind === "base" ? "base" : "troop") + " layouts for this filter yet.</p>";
      count.textContent = shown.length + (shown.length === 1 ? " layout" : " layouts");
    };

    async function copyLayout(x) {
      if (!x) return;
      if (isGameLink(x.link)) {
        toast((await copyText(x.link)) ? "Link copied. Paste it in your browser to open Clash of Clans." : "Couldn't copy. Try again.");
        return;
      }
      const page = location.origin + location.pathname + "#bases";
      toast((await copyText(page)) ? "Page link copied. This sample has no in-game link yet." : "Couldn't copy the link.");
    }

    /* ----- detail sheet (tap a card picture) ----- */
    let sheet = null, at = 0, opener = null;
    const onKey = e => {
      if (e.key === "Escape") closeSheet();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    function fillSheet() {
      const x = shown[at];
      if (!x) return;
      const real = isGameLink(x.link);
      const art = $("#cxSheetArt", sheet);
      art.className = "cx-sheet-art " + x.kind;
      art.innerHTML = artHtml(x) + badgesHtml(x);
      $("#cxSheetBody", sheet).innerHTML =
        '<h3 id="cxSheetT">' + esc(x.name) + "</h3>" +
        '<div class="cx-lay-meta"><span class="cx-pill">TH ' + esc(x.th) + '</span><span class="cx-pill">' + esc(x.cat) + "</span>" +
          (x.tag ? '<span class="cx-pill">' + esc(x.tag) + "</span>" : "") + "</div>" +
        (x.note ? '<p class="cx-help" style="font-size:15px">' + esc(x.note) + "</p>" : "") +
        (metaLine(x) ? '<div class="cx-meta2" style="margin-top:8px">' + metaLine(x) + "</div>" : "") +
        '<p class="cx-help">' + (real
          ? "Copy the link and open it on the phone that has Clash of Clans, or tap Open in game."
          : "This is a sample. Add a real in-game link to this layout and the button will copy it.") + "</p>";
      $("#cxSheetCopy", sheet).textContent = x.kind === "army" ? "Copy army link" : "Copy base link";
      const open = $("#cxSheetOpen", sheet);
      open.hidden = !real;
      if (real) open.href = x.link;
      $$("[data-nav]", sheet).forEach(b => { b.disabled = shown.length < 2; });
    }
    function go(d) {
      if (!sheet || sheet.hidden || !shown.length) return;
      at = (at + d + shown.length) % shown.length;
      fillSheet();
    }
    function openSheet(i, from) {
      if (!shown[i]) return;
      if (!sheet) {
        sheet = div("cx-sheet", "cxSheet");
        sheet.hidden = true;
        sheet.setAttribute("role", "dialog");
        sheet.setAttribute("aria-modal", "true");
        sheet.setAttribute("aria-labelledby", "cxSheetT");
        sheet.innerHTML =
          '<div class="cx-sheet-card"><button type="button" class="cx-sheet-x" data-x aria-label="Close">✕</button>' +
          '<div class="cx-sheet-art" id="cxSheetArt"></div><div id="cxSheetBody"></div>' +
          '<div class="cx-sheet-nav"><button type="button" class="cx-btn blue sm" data-nav="-1">‹ Previous</button><button type="button" class="cx-btn blue sm" data-nav="1">Next ›</button></div>' +
          '<button type="button" class="cx-btn gold big" id="cxSheetCopy">Copy link</button>' +
          '<a class="cx-btn green big" id="cxSheetOpen" target="_blank" rel="noopener noreferrer" hidden>Open in game</a></div>';
        sheet.addEventListener("click", e => {
          if (e.target === sheet || e.target.closest("[data-x]")) { closeSheet(); return; }
          const n = e.target.closest("[data-nav]");
          if (n) { go(Number(n.dataset.nav)); return; }
          if (e.target.closest("#cxSheetCopy")) copyLayout(shown[at]);
        });
        document.body.appendChild(sheet);
      }
      at = i;
      opener = from || null;
      fillSheet();
      sheet.hidden = false;
      document.documentElement.classList.add("cx-lock");
      document.addEventListener("keydown", onKey);
      const x = $("[data-x]", sheet);
      if (x) x.focus();
    }
    function closeSheet() {
      if (!sheet || sheet.hidden) return;
      sheet.hidden = true;
      document.documentElement.classList.remove("cx-lock");
      document.removeEventListener("keydown", onKey);
      if (opener && opener.focus) { try { opener.focus(); } catch (_) {} }
    }

    /* ----- events ----- */
    $$(".cx-tab", box).forEach(b => b.addEventListener("click", () => {
      kind = b.dataset.k;
      cat = "All";
      tag = "";
      $$(".cx-tab", box).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      drawCats();
      drawTags();
      draw();
    }));
    ths.addEventListener("click", e => {
      const b = e.target.closest("[data-th]");
      if (!b) return;
      th = b.getAttribute("data-th");
      markOn(ths, "data-th", th);
      draw();
    });
    cats.addEventListener("click", e => {
      const b = e.target.closest("[data-c]");
      if (!b) return;
      cat = b.getAttribute("data-c");
      markOn(cats, "data-c", cat);
      draw();
    });
    tags.addEventListener("click", e => {
      const b = e.target.closest("[data-t]");
      if (!b) return;
      const t = b.getAttribute("data-t");
      tag = tag === t ? "" : t;
      markOn(tags, "data-t", tag);
      draw();
    });
    $("#cxSort", box).addEventListener("change", e => { sort = e.target.value; draw(); });
    grid.addEventListener("click", e => {
      const o = e.target.closest("[data-o]");
      if (o) { openSheet(Number(o.dataset.o), o); return; }
      const b = e.target.closest("[data-i]");
      if (b) copyLayout(LAYOUTS[Number(b.dataset.i)]);
    });

    drawThs();
    drawCats();
    drawTags();
    draw();
    swapIn(sec, box);
    setHeading(sec, null, "Pick your Town Hall, then copy a base or troop layout link.");

    loadLayoutsFile().then(list => {
      if (!list) return;
      LAYOUTS = list;
      th = "";
      cat = "All";
      tag = "";
      markOn(ths, "data-th", th);
      drawCats();
      drawTags();
      draw();
    });
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
    safe("disclaimer", addDisclaimer);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
