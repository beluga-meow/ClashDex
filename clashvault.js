/* =====================================================================
   ClashVault v4  (file: clashvault-v4.js)
   Adds on top of your current site. It does not edit auth.js or Supabase config.
   - Live layouts: Base, Army, Builder Hall, Clan Capital (Supabase table "layouts")
   - Add layout (signed-in users), copy / open in game, delete your own
   - "Open with a game" sign-in (Supercell API token check, edge function "game-login")
   - Sign-in button is now a white circle with 👤
   - Clash character images used across the page (./images/...)
   INSTALL: add this line after your last <script> in index.html
     <script src="./clashvault-v4.js?v=4"></script>
   UNDO: remove that line.
   ===================================================================== */
(() => {
  "use strict";
  if (window.__cxV4) return;
  window.__cxV4 = true;

  const IMG = "./images/";
  const GAME_FUNCTION = "game-login";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (tag, cls, id) => { const e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; return e; };
  const client = () => window.supabaseClient || null;
  const isGameLink = u => typeof u === "string" && /^https:\/\/link\.clashofclans\.com\/[^\s"'<>]+$/.test(u);
  const isHttps = u => typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u);
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn("[ClashVault v4]", name, "skipped:", e); } };

  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el("div", "cx-toast", "cxToast4");
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 2800);
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

  /* ============ CSS ============ */
  const CSS = `
/* sign-in: white circle with a person icon */
html.cx a.header-cta.cx-circle{display:inline-flex!important;align-items:center;justify-content:center;width:46px;height:46px;min-height:46px;padding:0;border-radius:50%;background:#fff;border:3px solid #5a3300;color:#4a2c12;font-size:22px;line-height:1;text-shadow:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08),0 3px 0 var(--cx-w4,#34190a)}
html.cx a.header-cta.cx-circle:hover{background:#fff8e6}

/* hero characters */
.cx-troops{position:relative;z-index:3;display:flex;align-items:flex-end;justify-content:center;width:100%}
.cx-troops img{display:block;height:auto;filter:drop-shadow(0 8px 6px rgba(0,0,0,.35))}
.cx-t-w{width:clamp(190px,52vw,330px);position:relative;z-index:2}
.cx-t-b{width:clamp(100px,28vw,170px);margin-right:-34px;position:relative;z-index:3}
.cx-t-g{width:clamp(95px,26vw,150px);margin-left:-34px;position:relative;z-index:3}

/* section header cards with a character */
.cx-strip{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:8px 14px 8px 10px;background:linear-gradient(var(--cx-p1,#fdf1d2),var(--cx-p2,#f3dda8));border:4px solid var(--cx-w2,#8a5427);border-radius:20px;box-shadow:inset 0 3px 0 rgba(255,255,255,.65),0 5px 0 var(--cx-w4,#34190a)}
.cx-strip img{flex:none;width:92px;height:92px;object-fit:contain}
.cx-strip img.mul{mix-blend-mode:multiply}
.cx-strip h3{margin:0;font:400 22px/1.1 var(--cx-title,inherit);color:var(--cx-ink,#4a2c12)}
.cx-strip p{margin:4px 0 0;font-size:14px;line-height:1.4;color:var(--cx-ink2,#6f5130)}
.cx-ti{width:26px;height:26px;object-fit:contain;flex:none}

/* attack cards */
html.cx .attack-visual,html.cx .attack-visual.visual-ground{background:radial-gradient(circle at 50% 42%,#fff6d6,#f0d58f 80%)}
html.cx .attack-visual .attack-flame,html.cx .attack-visual .army-icons{display:none}
.cx-av{position:relative;z-index:1;height:150px;width:auto;max-width:90%;object-fit:contain}
.cx-av.mul{mix-blend-mode:multiply}

/* events + heroes banners */
.cx-banner{position:relative;margin:0 0 16px;overflow:hidden;border:4px solid var(--cx-w2,#8a5427);border-radius:22px;box-shadow:0 6px 0 var(--cx-w4,#34190a),0 16px 26px rgba(0,0,0,.3)}
.cx-banner img{display:block;width:100%;height:210px;object-fit:cover;object-position:50% 30%}
.cx-banner span{position:absolute;left:0;right:0;bottom:0;padding:26px 14px 12px;background:linear-gradient(transparent,rgba(30,14,2,.85));color:#fff;font:400 22px/1.1 var(--cx-title,inherit);text-shadow:var(--cx-ols,none)}
.cx-heroes-strip{max-width:1000px;margin:24px auto 0;padding:0 16px}
.cx-heroes-strip .cx-banner{margin:0}
.cx-heroes-strip .cx-banner img{height:auto;max-height:300px;object-position:50% 50%}
html.cx .event-symbol{overflow:hidden;padding:0}
html.cx .event-symbol img{width:100%;height:100%;object-fit:contain}
html.cx .event-symbol img.mul{mix-blend-mode:multiply}

/* layouts */
.cx-lay-empty{grid-column:1/-1;text-align:center;padding:20px 8px}
.cx-lay-empty img{width:110px;mix-blend-mode:multiply}
.cx-lay-empty h3{margin:6px 0;font:400 22px var(--cx-title,inherit);color:var(--cx-ink,#4a2c12)}
.cx-lay-empty p{margin:0 auto 12px;max-width:360px;color:var(--cx-ink2,#6f5130);font-size:15px;line-height:1.5}
.cx-toolbar{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px;margin:0 0 12px}
.cx-toolbar .cx-field{margin:0;min-width:140px}
.cx-form{margin:0 0 14px;padding:12px;border:2px dashed #b98a4e;border-radius:14px;background:rgba(255,255,255,.45)}
.cx-form h4{margin:0 0 10px;font:400 20px var(--cx-title,inherit);color:var(--cx-ink,#4a2c12)}
.cx-lay .cx-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cx-lay .cx-art{cursor:default}
.cx-lay .cx-art img.cx-hall{position:relative;inset:auto;z-index:1;width:auto;height:108px;max-width:80%;object-fit:contain;filter:drop-shadow(0 4px 3px rgba(0,0,0,.4))}
.cx-thc.hall{min-width:64px;min-height:84px;gap:2px}
.cx-thc img{display:block;width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 1px rgba(0,0,0,.4))}
.cx-thc.hall b{font-size:20px}
.cx-thc.hall small{font-size:10px}
.cx-lay-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cx-lay-actions .full{grid-column:1/-1}
.cx-copies{font-size:13px;font-weight:800;color:var(--cx-ink2,#6f5130)}
.cx-btn.red{background:linear-gradient(var(--cx-r1,#ff8068),var(--cx-r2,#dc3d2e));box-shadow:inset 0 2px 0 rgba(255,255,255,.4),0 3px 0 var(--cx-r3,#8b1e14)}

/* game sign-in */
#authGameScreen h3{margin:6px 0 8px}
#authGameScreen ol{margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.6;color:var(--cx-ink2,#6f5130)}
#authGameScreen .gm-img{display:block;width:120px;margin:0 auto 6px}
@media(max-width:520px){.cx-strip img{width:76px;height:76px}.cx-strip h3{font-size:19px}.cx-banner img{height:170px}}
`;

  function injectCss() {
    if ($("#cx-v4-style")) return;
    const s = el("style", "", "cx-v4-style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ============ Sign-in circle ============ */
  function signInCircle() {
    const a = $(".header-cta");
    if (!a) return;
    a.classList.add("cx-circle");
    a.innerHTML = '<span aria-hidden="true">👤</span>';
    a.setAttribute("aria-label", "Sign in");
    a.setAttribute("title", "Sign in");
    a.setAttribute("href", "#account");
  }

  /* ============ Images ============ */
  const strip = (file, title, text, mul) =>
    '<img class="' + (mul ? "mul" : "") + '" src="' + IMG + file + '" alt="" loading="lazy" decoding="async"><div><h3>' + esc(title) + "</h3><p>" + esc(text) + "</p></div>";

  function addStrip(secSel, file, title, text, mul, beforeSel) {
    const sec = $(secSel);
    if (!sec || $(".cx-strip", sec)) return;
    const d = el("div", "cx-strip");
    d.innerHTML = strip(file, title, text, mul);
    const ref = beforeSel ? $(beforeSel, sec) : null;
    const head = $(".section-heading", sec);
    if (ref) sec.insertBefore(d, ref);
    else if (head && head.nextSibling) sec.insertBefore(d, head.nextSibling);
    else sec.appendChild(d);
  }

  function decorateImages() {
    // Hero: Barbarian, Wizard and Goblin
    const art = $(".hero-art");
    if (art && !$(".cx-troops", art)) {
      $$(".castle,.hero-ground,.lobby-troops,.hero-spark", art).forEach(n => { n.style.display = "none"; });
      const t = el("div", "cx-troops");
      t.innerHTML =
        '<img class="cx-t-b" src="' + IMG + 'barbarian.webp" alt="Barbarian" decoding="async">' +
        '<img class="cx-t-w" src="' + IMG + 'wizard.png" alt="Wizard" decoding="async">' +
        '<img class="cx-t-g" src="' + IMG + 'goblin.png" alt="Goblin" decoding="async">';
      art.appendChild(t);
    }

    addStrip("#player-finder", "archer-queen.jpg", "Search a Chief", "Find a player by tag or saved name.", true, ".cx-panel");
    addStrip("#bases", "royal-champion.jpg", "Copy it, then play it", "Base and army links open right in Clash of Clans.", true, ".cx-panel");
    addStrip("#tracker", "builder-hut.webp", "Keep your builders busy", "Tap a builder to mark it working or available.", false, ".cx-panel");

    // Attack cards
    const vis = $$("#attacks .attack-visual");
    [["super-wizard.jpg", true], ["barbarian.webp", false]].forEach((v, i) => {
      if (vis[i] && !$(".cx-av", vis[i])) {
        const im = el("img", "cx-av" + (v[1] ? " mul" : ""));
        im.src = IMG + v[0];
        im.alt = "";
        im.loading = "lazy";
        vis[i].appendChild(im);
      }
    });

    // Events
    const grid = $("#events .event-grid");
    if (grid && !$("#events .cx-banner")) {
      const b = el("div", "cx-banner");
      b.innerHTML = '<img src="' + IMG + 'wizard-stars.jpg" alt="" loading="lazy"><span>Chase every star</span>';
      grid.parentNode.insertBefore(b, grid);
    }
    const sym = $$("#events .event-symbol");
    if (sym[0]) sym[0].innerHTML = '<img class="mul" src="' + IMG + 'walrus.jpg" alt="" loading="lazy">';
    if (sym[1]) sym[1].innerHTML = '<img src="' + IMG + 'minion-prince.webp" alt="" loading="lazy">';

    // Heroes banner before the store
    const store = $("#store");
    if (store && !$(".cx-heroes-strip")) {
      const h = el("section", "cx-heroes-strip");
      h.setAttribute("aria-label", "Clash heroes");
      h.innerHTML = '<div class="cx-banner"><img src="' + IMG + 'heroes.jpg" alt="Barbarian King, Archer Queen, Grand Warden and Royal Champion" loading="lazy"></div>';
      store.parentNode.insertBefore(h, store);
    }

    // Account: Barbarian welcome
    const panel = $("#account .auth-panel");
    if (panel && !$(".cx-strip", panel)) {
      const d = el("div", "cx-strip");
      d.innerHTML = strip("minion-prince.webp", "Welcome, Chief!", "Sign in with your game or your Gmail.", false);
      panel.insertBefore(d, panel.firstChild);
    }
  }

  /* ============ Layout library ============ */
  const KINDS = {
    base:    { tab: "Base layouts",  icon: "🏰", img: null,                lvl: "Town Hall",    short: "TH", max: 19, action: "OpenLayout", cats: ["War", "Farming", "Trophy", "Hybrid", "Defence", "Troll / Funny"], hint: "In the game: open your base, tap Edit, then Share and copy the link." },
    army:    { tab: "Army layouts",  icon: "⚔️", img: null,                lvl: "Town Hall",    short: "TH", max: 19, action: "CopyArmy",   cats: ["Air", "Ground", "Hybrid", "Hero Push"], hint: "In the game: open the army screen, save the army, tap Share and copy the link." },
    builder: { tab: "Builder Hall",  icon: "🔨", img: "builder-hut.webp",  lvl: "Builder Hall", short: "BH", max: 10, action: "OpenLayout", cats: ["Trophy", "Defence", "Farming"], hint: "In the game: open Builder Base edit mode, tap Share and copy the link." },
    capital: { tab: "Clan Capital",  icon: "🏛️", img: "clan-castle.webp",  lvl: "Capital Hall", short: "CH", max: 10, action: "OpenLayout", cats: ["Defence", "Raid Defence"], hint: "In the game: open a Capital District edit mode, tap Share and copy the link." }
  };

  /* Hall pictures in ./images/halls/ (missing levels fall back to the emoji) */
  const HALL = {
    base: ["th", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]],
    army: ["th", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]],
    builder: ["bh", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    capital: ["ch", [4, 5, 10]]
  };
  const hallImg = (kind, lvl) => {
    const h = HALL[kind];
    return h && h[1].indexOf(Number(lvl)) !== -1 ? IMG + "halls/" + h[0] + "-" + Number(lvl) + ".webp" : "";
  };

  function buildLibrary() {
    const sec = $("#bases");
    if (!sec) return;
    $("#cxLibrary")?.remove();
    $("#cxLibrary4")?.remove();

    let kind = "base", level = "", cat = "All", sort = "new";
    let items = [], uid = null, state = "loading", formOpen = false;
    const K = () => KINDS[kind];

    const box = el("div", "cx-panel cx-app", "cxLibrary4");
    box.innerHTML =
      '<div class="cx-tabs cx-tabs2" role="tablist" aria-label="Layout type">' +
      Object.keys(KINDS).map((k, i) =>
        '<button type="button" class="cx-tab' + (i === 0 ? " on" : "") + '" data-k="' + k + '" role="tab" aria-selected="' + (i === 0) + '">' +
        (KINDS[k].img ? '<img class="cx-ti" src="' + IMG + KINDS[k].img + '" alt="">' : '<span aria-hidden="true">' + KINDS[k].icon + "</span>") + KINDS[k].tab + "</button>").join("") +
      "</div>" +
      '<span class="cx-label" id="cxL4Label">Town Hall</span>' +
      '<div class="cx-ths" id="cxL4Ths" role="group" aria-labelledby="cxL4Label"></div>' +
      '<div class="cx-seg" id="cxL4Cats" role="group" aria-label="Layout type"></div>' +
      '<div class="cx-toolbar"><label class="cx-field"><span>Sort by</span><select id="cxL4Sort"><option value="new">Newest</option><option value="copies">Most copied</option></select></label>' +
      '<button type="button" class="cx-add" id="cxL4Add" aria-expanded="false"><b aria-hidden="true">+</b>Add layout</button></div>' +
      '<form class="cx-form" id="cxL4Form" novalidate hidden></form>' +
      '<p class="cx-count" id="cxL4Count" aria-live="polite"></p>' +
      '<div class="cx-grid" id="cxL4Grid"></div>';

    const ths = $("#cxL4Ths", box), cats = $("#cxL4Cats", box), grid = $("#cxL4Grid", box);
    const count = $("#cxL4Count", box), form = $("#cxL4Form", box), addBtn = $("#cxL4Add", box);

    const mark = (wrap, attr, val) => $$("[" + attr + "]", wrap).forEach(b => {
      const on = b.getAttribute(attr) === val;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    function drawFilters() {
      $("#cxL4Label", box).textContent = K().lvl;
      let h = '<button type="button" class="cx-thc all" data-l="" aria-pressed="false"><b>All</b></button>';
      for (let n = K().max; n >= 1; n--) {
        const hi = hallImg(kind, n);
        h += '<button type="button" class="cx-thc' + (hi ? " hall" : "") + '" data-l="' + n + '" aria-pressed="false" aria-label="' + K().lvl + " " + n + '">' +
          (hi ? '<img src="' + hi + '" alt="" loading="lazy" decoding="async"><b>' + n + "</b>" : "<small>" + K().short + "</small><b>" + n + "</b>") + "</button>";
      }
      ths.innerHTML = h;
      mark(ths, "data-l", level);
      cats.innerHTML = ["All"].concat(K().cats).map(c => '<button type="button" class="cx-chip" data-c="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>").join("");
      mark(cats, "data-c", cat);
    }

    function card(x) {
      const k = KINDS[x.kind] || K();
      const mine = uid && x.user_id === uid;
      const hi = hallImg(x.kind, x.level);
      const art = isHttps(x.image_url)
        ? '<img src="' + esc(x.image_url) + '" alt="" loading="lazy" decoding="async">'
        : hi ? '<img class="cx-hall" src="' + hi + '" alt="" loading="lazy" decoding="async">'
        : '<span class="cx-emo" aria-hidden="true">' + k.icon + "</span>";
      return '<article class="cx-lay"><div class="cx-art ' + (x.kind === "army" ? "army" : "") + '">' + art +
        '<span class="cx-badges"><em class="cx-bdg blue">' + k.short + " " + esc(x.level) + "</em></span></div>" +
        '<div class="cx-lay-body"><div class="cx-lay-meta"><span class="cx-pill">' + k.short + " " + esc(x.level) + "</span>" +
        (x.cat ? '<span class="cx-pill">' + esc(x.cat) + "</span>" : "") + "</div>" +
        "<h3>" + esc(x.name) + "</h3>" + (x.note ? "<p>" + esc(x.note) + "</p>" : "") +
        '<div class="cx-copies">📋 ' + (x.copies || 0) + " copied</div>" +
        '<div class="cx-lay-actions"><button class="cx-btn gold sm" type="button" data-copy="' + esc(x.id) + '">Copy link</button>' +
        '<a class="cx-btn green sm" href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer">Open in game</a>' +
        (mine ? '<button class="cx-btn red sm full" type="button" data-del="' + esc(x.id) + '">Delete my layout</button>' : "") +
        "</div></div></article>";
    }

    function draw() {
      if (state === "loading") { grid.innerHTML = '<p class="cx-msg" style="grid-column:1/-1">Loading layouts…</p>'; count.textContent = ""; return; }
      if (state === "error") { grid.innerHTML = '<p class="cx-msg err" style="grid-column:1/-1">Layouts aren\'t connected yet. Run supabase-layouts.sql in Supabase, then refresh.</p>'; count.textContent = ""; return; }
      const list = items.filter(x => x.kind === kind && (!level || String(x.level) === level) && (cat === "All" || x.cat === cat))
        .sort((a, b) => sort === "copies" ? (b.copies || 0) - (a.copies || 0) : Date.parse(b.created_at) - Date.parse(a.created_at));
      count.textContent = list.length + (list.length === 1 ? " layout" : " layouts");
      grid.innerHTML = list.length ? list.map(card).join("") :
        '<div class="cx-lay-empty"><img src="' + IMG + 'walrus.jpg" alt=""><h3>No layouts here yet</h3><p>Be the first. Paste a link from the game and everyone can copy it.</p>' +
        '<button type="button" class="cx-btn green sm" data-open-form>Add a layout</button></div>';
    }

    async function load() {
      const c = client();
      if (!c) { state = "error"; draw(); return; }
      const { data, error } = await c.from("layouts").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(500);
      if (error) { console.warn("[ClashVault v4] layouts:", error); state = "error"; }
      else { items = data || []; state = "ok"; }
      draw();
    }

    /* ----- add form ----- */
    function fillForm() {
      const k = K();
      const lvls = Array.from({ length: k.max }, (_, i) => k.max - i).map(n => '<option value="' + n + '">' + k.lvl + " " + n + "</option>").join("");
      form.innerHTML =
        "<h4>Add a " + esc(k.tab.toLowerCase()) + "</h4>" +
        '<label class="cx-field"><span>' + k.lvl + '</span><select id="cxfLvl">' + lvls + "</select></label>" +
        '<label class="cx-field"><span>Type</span><select id="cxfCat">' + k.cats.map(c => "<option>" + esc(c) + "</option>").join("") + "</select></label>" +
        '<label class="cx-field"><span>Name</span><input id="cxfName" maxlength="60" autocomplete="off" placeholder="e.g. Anti 3-Star Fortress"></label>' +
        '<label class="cx-field"><span>Short note <em>(optional)</em></span><input id="cxfNote" maxlength="140" autocomplete="off"></label>' +
        '<label class="cx-field"><span>In-game link</span><input id="cxfLink" type="url" inputmode="url" autocomplete="off" placeholder="https://link.clashofclans.com/..."></label>' +
        '<p class="cx-help">' + esc(k.hint) + "</p>" +
        '<label class="cx-field"><span>Screenshot <em>(optional, max 2 MB)</em></span><input id="cxfImg" type="file" accept="image/png,image/jpeg,image/webp"></label>' +
        '<button class="cx-btn green cx-go" type="submit">Publish layout</button>' +
        '<p class="cx-msg" id="cxfMsg" hidden></p>';
    }
    function setForm(open) {
      if (open && !uid) { toast("Sign in first to add a layout."); const a = $("#account"); if (a) a.scrollIntoView({ behavior: "smooth" }); return; }
      formOpen = open;
      if (open) fillForm();
      form.hidden = !open;
      addBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    const formMsg = (t, kind2) => { const m = $("#cxfMsg", form); if (!m) return; m.hidden = !t; m.textContent = t; m.className = "cx-msg" + (kind2 ? " " + kind2 : ""); };

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const c = client(), k = K();
      if (!c || !uid) { formMsg("Sign in first.", "err"); return; }
      const name = $("#cxfName", form).value.trim();
      const note = $("#cxfNote", form).value.trim();
      const link = $("#cxfLink", form).value.trim();
      const lvl = parseInt($("#cxfLvl", form).value, 10);
      const category = $("#cxfCat", form).value;
      const file = $("#cxfImg", form).files[0];
      if (name.length < 2) { formMsg("Enter a name for this layout.", "err"); return; }
      if (!isGameLink(link) || link.toLowerCase().indexOf("action=" + k.action.toLowerCase()) === -1) {
        formMsg("Paste the share link from the game. It should start with https://link.clashofclans.com/ and be a " + (kind === "army" ? "army" : "layout") + " link.", "err");
        return;
      }
      if (file && (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024)) { formMsg("Screenshot must be a PNG, JPG or WebP under 2 MB.", "err"); return; }
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      formMsg("Publishing…");
      try {
        let image_url = null;
        if (file) {
          const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
          const path = uid + "/" + Date.now() + "." + ext;
          const up = await c.storage.from("layout-images").upload(path, file, { contentType: file.type, upsert: false });
          if (up.error) throw up.error;
          image_url = c.storage.from("layout-images").getPublicUrl(path).data.publicUrl;
        }
        const { data, error } = await c.from("layouts").insert({ user_id: uid, kind: kind, level: lvl, cat: category, name: name, note: note, link: link, image_url: image_url }).select().single();
        if (error) throw error;
        items.unshift(data);
        state = "ok";
        level = ""; cat = "All";
        drawFilters(); draw();
        setForm(false);
        toast("Layout published!");
      } catch (err) {
        console.warn("[ClashVault v4] publish:", err);
        formMsg((err && err.message) || "Couldn't publish. Try again.", "err");
      } finally { btn.disabled = false; }
    });

    /* ----- events ----- */
    $$(".cx-tab", box).forEach(b => b.addEventListener("click", () => {
      kind = b.dataset.k; level = ""; cat = "All";
      $$(".cx-tab", box).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      drawFilters();
      if (formOpen) fillForm();
      draw();
    }));
    ths.addEventListener("click", e => { const b = e.target.closest("[data-l]"); if (!b) return; level = b.getAttribute("data-l"); mark(ths, "data-l", level); draw(); });
    cats.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; cat = b.getAttribute("data-c"); mark(cats, "data-c", cat); draw(); });
    $("#cxL4Sort", box).addEventListener("change", e => { sort = e.target.value; draw(); });
    addBtn.addEventListener("click", () => setForm(form.hidden));
    grid.addEventListener("click", async e => {
      if (e.target.closest("[data-open-form]")) { setForm(true); return; }
      const cp = e.target.closest("[data-copy]");
      if (cp) {
        const x = items.find(i => i.id === cp.dataset.copy);
        if (!x) return;
        const ok = await copyText(x.link);
        toast(ok ? "Link copied. Open it on the phone that has Clash of Clans." : "Couldn't copy. Try again.");
        if (ok) {
          x.copies = (x.copies || 0) + 1;
          draw();
          const c = client();
          if (c) { try { c.rpc("bump_layout_copies", { p_id: x.id }).then(() => {}, () => {}); } catch (_) {} }
        }
        return;
      }
      const del = e.target.closest("[data-del]");
      if (del) {
        if (!window.confirm("Delete this layout?")) return;
        const c = client();
        if (!c) return;
        const { error } = await c.from("layouts").delete().eq("id", del.dataset.del);
        if (error) { toast("Couldn't delete. Try again."); return; }
        items = items.filter(i => i.id !== del.dataset.del);
        draw();
        toast("Layout deleted.");
      }
    });

    // Add into the page (old sections stay hidden, not deleted)
    sec.appendChild(box);
    Array.from(sec.children).forEach(ch => { if (ch !== box && !ch.classList.contains("section-heading") && !ch.classList.contains("cx-strip")) ch.classList.add("cx-legacy"); });
    const sub = $(".section-subtitle", sec);
    if (sub) sub.textContent = "Choose a Town Hall, Builder Hall or Capital Hall and copy a layout into the game.";

    drawFilters();
    draw();

    const c = client();
    if (c && c.auth) {
      c.auth.getSession().then(r => { uid = r?.data?.session?.user?.id || null; load(); }).catch(load);
      c.auth.onAuthStateChange((_ev, session) => { uid = session?.user?.id || null; if (state === "ok") draw(); if (!uid) setForm(false); });
    } else load();
  }

  /* ============ Open with a game ============ */
  function buildGameLogin() {
    const panel = $("#account .auth-panel");
    const oldBtn = $("#authGameButton");
    if (!panel || !oldBtn || $("#authGameScreen")) return;

    const method = $("#authMethodScreen");
    const authMsg = $("#authMessage");
    const say = t => { if (authMsg) authMsg.textContent = t || ""; };

    const s = el("div", "", "authGameScreen");
    s.hidden = true;
    s.innerHTML =
      '<button class="small-action" id="gmBack" type="button">← Back</button>' +
      '<img class="gm-img" src="' + IMG + 'barbarian.webp" alt="">' +
      "<h3>Open with Clash of Clans</h3>" +
      "<p>Prove this is your account. Supercell checks it, ClashVault never sees your password.</p>" +
      "<ol><li>Open Clash of Clans, then Settings.</li><li>Tap More Settings and find API Token.</li><li>Tap Show, then copy the token.</li></ol>" +
      '<form id="gmForm" novalidate>' +
      '<input id="gmTag" type="text" placeholder="Player Tag (e.g. #2PP)" maxlength="15" autocomplete="off" autocapitalize="characters">' +
      '<input id="gmToken" type="password" placeholder="API Token" autocomplete="off" spellcheck="false">' +
      '<button class="button button-green" id="gmGo" type="submit">Verify and sign in</button></form>' +
      '<p class="form-note">The token is used once to check your account and is not saved.</p>';
    panel.insertBefore(s, authMsg || null);

    // Replace the old "coming soon" button (this removes its old click handler).
    const btn = oldBtn.cloneNode(true);
    const small = $("small", btn);
    if (small) small.textContent = "Verify with your Player Tag";
    oldBtn.replaceWith(btn);

    btn.addEventListener("click", () => { if (method) method.hidden = true; s.hidden = false; say(""); });
    $("#gmBack", s).addEventListener("click", () => { s.hidden = true; if (method) method.hidden = false; say(""); });

    $("#gmForm", s).addEventListener("submit", async e => {
      e.preventDefault();
      const c = client();
      const tag = $("#gmTag", s).value.trim();
      const token = $("#gmToken", s).value.trim();
      if (!c) { say("Sign-in isn't ready. Refresh the page."); return; }
      if (!tag || !token) { say("Enter your Player Tag and API Token."); return; }
      const go = $("#gmGo", s);
      go.disabled = true;
      say("Checking with Clash of Clans…");
      try {
        const { data, error } = await c.functions.invoke(GAME_FUNCTION, { body: { tag: tag, token: token } });
        if (error || !data) throw new Error('Game sign-in isn\'t connected yet. Deploy the "' + GAME_FUNCTION + '" Edge Function.');
        if (!data.ok) throw new Error(data.error || "Verification failed.");
        const r = await c.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
        if (r.error) throw r.error;
        $("#gmToken", s).value = "";
        s.hidden = true;
        say("Welcome, " + data.name + "!");
      } catch (err) {
        say((err && err.message) || "Couldn't sign in. Try again.");
      } finally { go.disabled = false; }
    });

    // Game accounts have a placeholder email. Show something friendlier.
    const mail = $("#authUserEmail");
    if (mail && "MutationObserver" in window) {
      const fix = () => { if (/@players\.clashvault\.app/i.test(mail.textContent)) mail.textContent = "Signed in with Clash of Clans"; };
      new MutationObserver(fix).observe(mail, { childList: true, characterData: true, subtree: true });
      fix();
    }
  }

  /* ============ Start ============ */
  function go() {
    safe("css", injectCss);
    safe("signin", signInCircle);
    safe("images", decorateImages);
    safe("library", buildLibrary);
    safe("game", buildGameLogin);
    // the older script rewrites some text after load, so set the icon once more
    setTimeout(() => safe("signin2", signInCircle), 400);
    console.info("ClashVault v4 loaded.");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(go, 0), { once: true });
  else setTimeout(go, 0);
})();
