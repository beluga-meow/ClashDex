/* ClashVault - app.js (single consolidated file)
   Needs: supabase-config.js (window.supabaseClient), Edge Functions "coc" and "game-login".
   Does not touch auth.js. Uses your style.css palette (forest / gold / paper). */
(() => {
  "use strict";
  if (window.__clashVaultApp) return;
  window.__clashVaultApp = true;

  const CFG = { FN: "coc", GAME_FN: "game-login", MAX_TH: 19 };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => (typeof n === "number" ? n.toLocaleString() : "-");
  const sb = () => window.supabaseClient || null;

  /* ---------- helpers ---------- */
  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "cv-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("on"), 2400);
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (_) {}
    try {
      const a = document.createElement("textarea");
      a.value = t; a.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(a); a.select();
      const ok = document.execCommand("copy"); a.remove(); return ok;
    } catch (_) { return false; }
  }
  const normTag = t => "#" + String(t || "").trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "").replace(/O/g, "0");
  const validTag = t => /^#[0289PYLQGRJCUV]{3,15}$/.test(t);
  const looksLikeTag = s => { const t = normTag(s); return validTag(t) && (/^\s*#/.test(s) || /\d/.test(t)); };
  const gameLink = (action, tag) => "https://link.clashofclans.com/en?action=" + action + "&tag=" + encodeURIComponent(String(tag).replace(/^#/, ""));
  const isHttps = u => typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u);
  function validLayoutLink(u, kind) {
    try {
      const x = new URL(u);
      if (x.protocol !== "https:" || x.hostname !== "link.clashofclans.com") return false;
      const a = x.searchParams.get("action");
      return kind === "army" ? a === "CopyArmy" && !!x.searchParams.get("army") : a === "OpenLayout" && !!x.searchParams.get("id");
    } catch (_) { return false; }
  }
  /* keep a section's heading, drop everything else, return the section */
  function reset(sec) {
    $$(":scope > :not(.section-heading):not(h2)", sec).forEach(n => n.remove());
    return sec;
  }

  /* ---------- Clash API (via Supabase Edge Function "coc") ---------- */
  const ERR = {
    400: "That search isn't valid. Check the tag or name.",
    403: "Supercell rejected the API key. Check the key's allowed IP.",
    404: "Not found. Double-check the tag.",
    429: "Too many searches. Wait a few seconds and try again.",
    500: "The API key isn't set up in the Edge Function yet.",
    502: "Couldn't reach Clash of Clans. Try again in a moment.",
    503: "Clash of Clans is in maintenance. Try again later."
  };
  async function edge(body) {
    const c = sb();
    if (!c || !c.functions) throw new Error("Supabase isn't connected. Check supabase-config.js.");
    let r;
    try { r = await c.functions.invoke(CFG.FN, { body }); } catch (_) { throw new Error("Can't reach the server. Check your connection."); }
    if (r.error || !r.data || typeof r.data.status !== "number") throw new Error('The "' + CFG.FN + '" function gave no valid response.');
    return r.data;
  }
  async function api(path) {
    const d = await edge({ path });
    if (d.status >= 200 && d.status < 300 && d.data) return d.data;
    throw new Error(ERR[d.status] || "Clash API error (" + d.status + ").");
  }
  async function findPlayers(name) {
    const d = await edge({ action: "findPlayers", name, exact: false, th: null });
    if (d.status === 200 && d.data) return d.data.items || [];
    if (d.status === 503 || d.status === 400) throw new Error("Name search isn't set up yet. Search by player tag, or search a clan and pick a member.");
    throw new Error("Player name search failed. Try again.");
  }

  /* =====================================================
     PLAYER + CLAN FINDER
     ===================================================== */
  const HOME_HEROES = ["Barbarian King", "Archer Queen", "Grand Warden", "Royal Champion", "Minion Prince"];
  let lastPlayer = null;

  function initFinder() {
    const sec = $("#player-finder");
    if (!sec) return;
    reset(sec);
    sec.insertAdjacentHTML("beforeend",
      '<form id="playerSearchForm" class="search-form cv-search">' +
      '<select id="searchMode" aria-label="Search type"><option value="player">Player</option><option value="clan">Clan</option></select>' +
      '<label class="sr-only" for="playerTag">Tag or name</label>' +
      '<input id="playerTag" placeholder="Tag (#2PP) or name" autocomplete="off">' +
      '<button type="submit" class="button button-green" id="searchBtn">Search</button></form>' +
      '<p id="playerSearchMessage" class="cv-msg" aria-live="polite"></p>' +
      '<div id="playerResult"></div>');
    const form = $("#playerSearchForm"), msg = $("#playerSearchMessage"), out = $("#playerResult"), btn = $("#searchBtn");
    let busy = false;

    const say = (t, err) => { msg.textContent = t; msg.classList.toggle("err", !!err); };

    async function run(mode, q) {
      if (busy) return;
      q = q.trim();
      if (!q) { say("Type a tag or a name first.", true); return; }
      busy = true; btn.disabled = true; out.innerHTML = "";
      try {
        if (looksLikeTag(q)) {
          const tag = normTag(q);
          say("Looking up " + tag + "…");
          if (mode === "clan") showClan(await api("/clans/" + encodeURIComponent(tag)));
          else showPlayer(await api("/players/" + encodeURIComponent(tag)));
          say("");
        } else {
          if (q.length < 3) throw new Error("Names need at least 3 characters.");
          say("Searching “" + q + "”…");
          let items;
          if (mode === "clan") {
            items = (await api("/clans?name=" + encodeURIComponent(q) + "&limit=12")).items || [];
          } else {
            items = await findPlayers(q);
          }
          if (!items.length) { say(""); out.innerHTML = '<div class="empty-state">No ' + mode + 's found for “' + esc(q) + '”. Check the spelling or try a tag.</div>'; return; }
          say(items.length + " result" + (items.length > 1 ? "s" : "") + ". Tap one to open it.");
          out.innerHTML = '<div class="cv-list">' + items.map(it =>
            '<button type="button" class="cv-row" data-load="' + mode + '" data-tag="' + esc(it.tag) + '">' +
            (it.badgeUrls ? '<img src="' + esc(it.badgeUrls.small) + '" alt="" width="36" height="36">' : "") +
            "<span><b>" + esc(it.name) + "</b><small>" + esc(it.tag) +
            (mode === "clan" ? " · Lv " + (it.clanLevel || "-") + " · " + (it.members || 0) + "/50" : (it.townHallLevel || it.th ? " · TH" + (it.townHallLevel || it.th) : "")) +
            "</small></span></button>").join("") + "</div>";
        }
      } catch (e) { say(e.message, true); }
      finally { busy = false; btn.disabled = false; }
    }

    form.addEventListener("submit", e => { e.preventDefault(); run($("#searchMode").value, $("#playerTag").value); });

    function showPlayer(p) {
      lastPlayer = p;
      document.dispatchEvent(new CustomEvent("cv:player", { detail: p }));
      const heroes = (p.heroes || []).filter(h => h.village === "home");
      out.innerHTML = '<article class="player-result cv-card">' +
        "<h3>" + esc(p.name) + ' <small>' + esc(p.tag) + "</small></h3>" +
        '<p class="cv-sub">' + (p.clan ? "Clan: " + esc(p.clan.name) + " · " : "") + "Town Hall " + num(p.townHallLevel) + "</p>" +
        '<div class="cv-stats">' + [
          ["XP level", p.expLevel], ["Trophies", p.trophies], ["War stars", p.warStars],
          ["Donated", p.donations], ["Received", p.donationsReceived], ["Best trophies", p.bestTrophies]
        ].map(s => "<div><b>" + num(s[1]) + "</b><small>" + s[0] + "</small></div>").join("") + "</div>" +
        (heroes.length ? '<h4>Heroes</h4><div class="cv-chips">' + heroes.map(h => "<span>" + esc(h.name) + " " + h.level + "/" + h.maxLevel + "</span>").join("") + "</div>" : "") +
        '<div class="cv-actions"><button type="button" class="small-action" data-copy="' + esc(p.tag) + '">Copy tag</button>' +
        '<a class="small-action" href="' + gameLink("OpenPlayerProfile", p.tag) + '" target="_blank" rel="noopener noreferrer">Open in game</a>' +
        (p.clan ? '<button type="button" class="small-action" data-load="clan" data-tag="' + esc(p.clan.tag) + '">View clan</button>' : "") +
        "</div></article>";
    }

    function showClan(c) {
      const members = c.memberList || [];
      out.innerHTML = '<article class="player-result cv-card">' +
        '<div class="cv-head">' + (c.badgeUrls ? '<img src="' + esc(c.badgeUrls.medium) + '" alt="" width="64" height="64">' : "") +
        "<div><h3>" + esc(c.name) + " <small>" + esc(c.tag) + "</small></h3>" +
        '<p class="cv-sub">' + esc(c.description || "").slice(0, 140) + "</p></div></div>" +
        '<div class="cv-stats">' + [
          ["Level", c.clanLevel], ["Members", c.members + "/50"], ["Type", ({ open: "Open", inviteOnly: "Invite only", closed: "Closed" })[c.type] || c.type],
          ["Required TH", c.requiredTownhallLevel || "Any"], ["War wins", c.warWins], ["Points", c.clanPoints]
        ].map(s => "<div><b>" + (typeof s[1] === "number" ? num(s[1]) : esc(s[1])) + "</b><small>" + s[0] + "</small></div>").join("") + "</div>" +
        '<div class="cv-actions"><button type="button" class="small-action" data-copy="' + esc(c.tag) + '">Copy tag</button>' +
        '<a class="small-action" href="' + gameLink("OpenClanProfile", c.tag) + '" target="_blank" rel="noopener noreferrer">Open in game</a></div>' +
        '<h4>Find a member</h4><input id="memberFilter" class="cv-input" placeholder="Search members in this clan" autocomplete="off">' +
        '<div class="cv-list" id="memberList"></div></article>';
      const list = $("#memberList");
      const draw = f => {
        const m = members.filter(x => !f || x.name.toLowerCase().includes(f));
        list.innerHTML = m.length ? m.map(x =>
          '<button type="button" class="cv-row" data-load="player" data-tag="' + esc(x.tag) + '"><span><b>' + esc(x.name) + "</b><small>" +
          esc(x.tag) + " · TH" + (x.townHallLevel || "?") + " · " + num(x.trophies) + " 🏆</small></span></button>").join("") :
          '<div class="empty-state">No member matches.</div>';
      };
      draw("");
      $("#memberFilter").addEventListener("input", e => draw(e.target.value.trim().toLowerCase()));
    }

    out.addEventListener("click", e => {
      const cp = e.target.closest("[data-copy]");
      if (cp) { copyText(cp.dataset.copy).then(ok => toast(ok ? "Tag copied" : "Couldn't copy")); return; }
      const ld = e.target.closest("[data-load]");
      if (ld) {
        $("#searchMode").value = ld.dataset.load;
        $("#playerTag").value = ld.dataset.tag;
        run(ld.dataset.load, ld.dataset.tag);
      }
    });
  }

  /* =====================================================
     BASE LIBRARY (Supabase table "layouts")
     ===================================================== */
  const KINDS = {
    base:    { tab: "Base",         icon: "🏰", lvl: "Town Hall",    short: "TH", max: 19, cats: ["War", "Farming", "Trophy", "Hybrid", "Defence", "Troll / Funny"], hint: "Game: open your base → Edit → Share → copy link." },
    army:    { tab: "Army",         icon: "⚔️", lvl: "Town Hall",    short: "TH", max: 19, cats: ["Air", "Ground", "Hybrid", "Hero Push"], hint: "Game: army screen → save army → Share → copy link." },
    builder: { tab: "Builder Hall", icon: "🔨", lvl: "Builder Hall", short: "BH", max: 10, cats: ["Trophy", "Defence", "Farming"], hint: "Game: Builder Base edit mode → Share → copy link." },
    capital: { tab: "Clan Capital", icon: "🏛️", lvl: "Capital Hall", short: "CH", max: 10, cats: ["Defence", "Raid Defence"], hint: "Game: Capital District edit mode → Share → copy link." }
  };

  function initLibrary() {
    const sec = $("#bases");
    if (!sec) return;
    reset(sec);
    let kind = "base", level = "", cat = "", sort = "new", items = [], state = "loading", uid = null, saving = false;

    sec.insertAdjacentHTML("beforeend",
      '<div class="cv-tabs" id="cvTabs" role="tablist">' + Object.keys(KINDS).map(k =>
        '<button type="button" class="filter-chip' + (k === kind ? " active" : "") + '" data-k="' + k + '">' + KINDS[k].icon + " " + KINDS[k].tab + "</button>").join("") + "</div>" +
      '<div class="cv-filters"><select id="fLevel" aria-label="Level"></select><select id="fCat" aria-label="Type"></select>' +
      '<select id="fSort" aria-label="Sort"><option value="new">Newest</option><option value="copies">Most copied</option></select>' +
      '<button type="button" class="button button-green" id="addBtn">+ Add layout</button></div>' +
      '<form id="addForm" class="cv-form" hidden novalidate></form>' +
      '<p class="cv-msg" id="libMsg" aria-live="polite"></p><div class="card-grid" id="baseGrid"></div>');

    const grid = $("#baseGrid"), form = $("#addForm"), msg = $("#libMsg");
    const K = () => KINDS[kind];
    const lvlOpts = (first) => '<option value="">' + first + "</option>" + Array.from({ length: K().max }, (_, i) => K().max - i).map(n => '<option value="' + n + '">' + K().lvl + " " + n + "</option>").join("");

    function filters() {
      $("#fLevel").innerHTML = lvlOpts("All " + K().lvl + "s");
      $("#fCat").innerHTML = '<option value="">All types</option>' + K().cats.map(c => "<option>" + esc(c) + "</option>").join("");
      $("#fLevel").value = level; $("#fCat").value = cat;
    }

    function card(x) {
      const k = KINDS[x.kind] || K();
      const ok = validLayoutLink(x.link, x.kind);
      const mine = uid && x.user_id === uid;
      const tags = (Array.isArray(x.tags) ? x.tags : String(x.tags || "").split(",")).map(t => t.trim()).filter(Boolean);
      const date = x.created_at ? new Date(x.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
      return '<article class="content-card"><div class="card-art">' +
        (isHttps(x.image_url) ? '<img class="cv-img" src="' + esc(x.image_url) + '" alt="" loading="lazy">' : "<span>" + k.icon + "</span>") + "</div>" +
        '<div class="card-body"><h3>' + esc(x.name) + "</h3>" + (x.note ? "<p>" + esc(x.note) + "</p>" : "") +
        '<div class="card-meta"><span>' + k.short + " " + esc(x.level) + "</span>" + (x.cat ? "<span>" + esc(x.cat) + "</span>" : "") +
        tags.slice(0, 3).map(t => "<span>#" + esc(t) + "</span>").join("") +
        (x.views ? "<span>👁 " + num(x.views) + "</span>" : "") + (x.rating ? "<span>★ " + esc(x.rating) + "</span>" : "") +
        (date ? "<span>" + date + "</span>" : "") + (x.copies ? "<span>📋 " + x.copies + "</span>" : "") + "</div>" +
        '<div class="card-footer">' + (ok
          ? '<button type="button" class="small-action" data-copy="' + esc(x.link) + '" data-id="' + esc(x.id) + '">Copy link</button><a class="small-action" href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer">Open in game</a>'
          : '<span class="cv-sample">Sample · no official link</span>') +
        (mine ? '<button type="button" class="small-action cv-danger" data-del="' + esc(x.id) + '">Delete</button>' : "") +
        "</div></div></article>";
    }

    function draw() {
      if (state === "loading") { grid.innerHTML = '<p class="cv-msg">Loading layouts…</p>'; return; }
      if (state === "error") { grid.innerHTML = '<div class="empty-state">Couldn\'t load layouts. Check the "layouts" table and its read policy in Supabase.</div>'; return; }
      const list = items.filter(x => x.kind === kind && (!level || String(x.level) === level) && (!cat || x.cat === cat))
        .sort((a, b) => sort === "copies" ? (b.copies || 0) - (a.copies || 0) : Date.parse(b.created_at) - Date.parse(a.created_at));
      msg.textContent = list.length + (list.length === 1 ? " layout" : " layouts");
      grid.innerHTML = list.length ? list.map(card).join("") : '<div class="empty-state">No ' + esc(K().tab.toLowerCase()) + " layouts here yet. Be the first to add one.</div>";
    }

    async function load() {
      const c = sb();
      if (!c) { state = "error"; draw(); return; }
      try {
        const s = await c.auth.getSession(); uid = s.data.session?.user?.id || null;
        const { data, error } = await c.from("layouts").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        items = data || []; state = "ok";
      } catch (e) { console.warn("layouts:", e); state = "error"; }
      draw();
    }

    function fillForm() {
      form.innerHTML = "<h4>Add a " + esc(K().tab.toLowerCase()) + " layout</h4>" +
        '<label>' + K().lvl + '<select id="aLvl">' + lvlOpts("Choose…") + "</select></label>" +
        '<label>Type<select id="aCat">' + K().cats.map(c => "<option>" + esc(c) + "</option>").join("") + "</select></label>" +
        '<label>Name<input id="aName" maxlength="60" placeholder="e.g. Anti 3-Star Fortress"></label>' +
        '<label>Short description <em>(optional)</em><input id="aNote" maxlength="140"></label>' +
        '<label>Official game link<input id="aLink" inputmode="url" placeholder="https://link.clashofclans.com/en?action=' + (kind === "army" ? "CopyArmy&army=…" : "OpenLayout&id=…") + '"></label>' +
        '<small class="cv-hint">' + esc(K().hint) + "</small>" +
        '<label>Screenshot <em>(optional, max 2 MB)</em><input id="aImg" type="file" accept="image/png,image/jpeg,image/webp"></label>' +
        '<p class="cv-msg err" id="aErr"></p><div class="cv-actions"><button type="submit" class="button button-green" id="aSave">Submit layout</button>' +
        '<button type="button" class="button button-ghost cv-cancel" id="aCancel">Cancel</button></div>';
      $("#aCancel").onclick = () => { form.hidden = true; };
    }

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (saving) return;
      const err = t => { $("#aErr").textContent = t; };
      const v = id => $("#" + id).value.trim();
      const c = sb();
      const s = c && (await c.auth.getSession()).data.session;
      if (!s) { err("Please sign in first (Account section)."); return; }
      if (!v("aLvl")) return err("Choose a " + K().lvl.toLowerCase() + ".");
      if (v("aName").length < 3) return err("Give the layout a name (3+ characters).");
      if (!validLayoutLink(v("aLink"), kind)) return err("Paste the official link copied from the game (link.clashofclans.com).");
      const file = $("#aImg").files[0];
      if (file && (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024)) return err("Screenshot must be PNG, JPG or WebP, under 2 MB.");
      saving = true; $("#aSave").disabled = true; err("");
      try {
        let image_url = null;
        if (file) {
          const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
          const path = s.user.id + "/" + Date.now() + "." + ext;
          const up = await c.storage.from("layout-images").upload(path, file, { contentType: file.type });
          if (up.error) throw up.error;
          image_url = c.storage.from("layout-images").getPublicUrl(path).data.publicUrl;
        }
        const { data, error } = await c.from("layouts").insert({
          kind, level: Number(v("aLvl")), cat: v("aCat"), name: v("aName"), note: v("aNote") || null,
          link: v("aLink"), image_url, user_id: s.user.id
        }).select().single();
        if (error) throw error;
        items.unshift(data); state = "ok"; level = ""; cat = ""; filters();
        form.hidden = true; toast("Layout published"); draw();
      } catch (ex) { console.warn(ex); err(ex.message || "Couldn't save. Try again."); }
      finally { saving = false; $("#aSave").disabled = false; }
    });

    $("#cvTabs").addEventListener("click", e => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      kind = b.dataset.k; level = ""; cat = "";
      $$("#cvTabs .filter-chip").forEach(x => x.classList.toggle("active", x === b));
      filters(); fillForm(); draw();
    });
    $("#fLevel").onchange = e => { level = e.target.value; draw(); };
    $("#fCat").onchange = e => { cat = e.target.value; draw(); };
    $("#fSort").onchange = e => { sort = e.target.value; draw(); };
    $("#addBtn").onclick = () => { fillForm(); form.hidden = !form.hidden; if (!form.hidden) form.scrollIntoView({ block: "nearest" }); };
    grid.addEventListener("click", async e => {
      const cp = e.target.closest("[data-copy]");
      if (cp) {
        const ok = await copyText(cp.dataset.copy);
        toast(ok ? "Link copied. Open it on the phone that has Clash of Clans." : "Couldn't copy");
        const it = ok && items.find(i => String(i.id) === cp.dataset.id);
        if (it) { it.copies = (it.copies || 0) + 1; draw(); try { sb().rpc("bump_layout_copies", { p_id: it.id }).then(() => {}, () => {}); } catch (_) {} }
        return;
      }
      const d = e.target.closest("[data-del]");
      if (d && confirm("Delete your layout?")) {
        const { error } = await sb().from("layouts").delete().eq("id", d.dataset.del);
        if (error) toast("Couldn't delete"); else { toast("Deleted"); load(); }
      }
    });
    filters(); fillForm(); load();
    const c = sb();
    if (c) c.auth.onAuthStateChange((_ev, ses) => { uid = ses?.user?.id || null; draw(); });
  }

  /* =====================================================
     HERO VAULT (replaces Builder Tracker)
     ===================================================== */
  const HEROES = [
    { n: "Barbarian King", i: "👑", v: "Home Village", c: "Ground tank", u: "TH7" },
    { n: "Archer Queen", i: "🏹", v: "Home Village", c: "Ranged DPS", u: "TH9" },
    { n: "Minion Prince", i: "🦇", v: "Home Village", c: "Air DPS", u: "TH9" },
    { n: "Grand Warden", i: "📖", v: "Home Village", c: "Support", u: "TH11" },
    { n: "Royal Champion", i: "🛡️", v: "Home Village", c: "Ground tank", u: "TH13" },
    { n: "Battle Machine", i: "⚙️", v: "Builder Base", c: "Ground tank", u: "BH5" },
    { n: "Battle Copter", i: "🚁", v: "Builder Base", c: "Air support", u: "BH8" }
  ];

  function initHeroVault() {
    const sec = $("#tracker");
    if (!sec) return;
    reset(sec);
    const h2 = $(".section-heading h2", sec) || $("h2", sec);
    if (h2) h2.textContent = "Hero Vault";
    const sub = $(".section-subtitle", sec); if (sub) sub.textContent = "Every hero in the game. Search a player to see their real levels.";
    $$('a[href="#tracker"]').forEach(a => { a.textContent = a.textContent.match(/tracker/i) ? "Hero Vault" : a.textContent; });
    sec.insertAdjacentHTML("beforeend", '<div class="cv-actions"><button type="button" class="small-action" id="myHeroes">Load my linked player</button></div><p class="cv-msg" id="heroMsg" aria-live="polite">Showing hero info only. Levels appear after you load a player.</p><div class="card-grid" id="heroGrid"></div>');
    const grid = $("#heroGrid"), hm = $("#heroMsg");

    function draw(player) {
      const own = {};
      (player?.heroes || []).forEach(h => { own[h.name] = h; });
      grid.innerHTML = HEROES.map(h => {
        const o = own[h.n];
        return '<article class="content-card"><div class="card-body"><div class="cv-hero"><span class="cv-ico" aria-hidden="true">' + h.i + "</span><div><h3>" + h.n + "</h3><small>" + h.v + " · " + h.c + "</small></div></div>" +
          '<div class="card-meta"><span>Unlocks ' + h.u + "</span>" + (o ? "<span>Lv " + o.level + " / " + o.maxLevel + "</span>" : "") + "</div>" +
          (o ? '<div class="cv-bar" role="img" aria-label="Level ' + o.level + " of " + o.maxLevel + '"><i style="width:' + Math.min(100, Math.round(o.level / o.maxLevel * 100)) + '%"></i></div>' : "") +
          "</div></article>";
      }).join("");
      if (player) hm.textContent = "Heroes for " + player.name + " (" + player.tag + ").";
    }
    draw(lastPlayer);
    document.addEventListener("cv:player", e => draw(e.detail));
    $("#myHeroes").onclick = async () => {
      const c = sb();
      try {
        const s = c && (await c.auth.getSession()).data.session;
        if (!s) throw new Error("Sign in and save your player tag first.");
        const { data } = await c.from("profiles").select("player_tag").eq("id", s.user.id).maybeSingle();
        if (!data?.player_tag) throw new Error("Save your player tag in the Account section first.");
        hm.textContent = "Loading…";
        draw(await api("/players/" + encodeURIComponent(normTag(data.player_tag))));
      } catch (e) { hm.textContent = e.message; }
    };
  }

  /* =====================================================
     OPEN WITH A GAME (sign-in)
     ===================================================== */
  function initGameLogin() {
    const old = $("#authGameButton"), box = $("#authMethodScreen");
    if (!old || !box || $("#cvGameBtn")) return;
    old.hidden = true; old.style.display = "none";
    box.insertAdjacentHTML("beforeend", '<button type="button" class="button button-gold" id="cvGameBtn">Open with a game</button>' +
      '<form id="cvGameForm" hidden><p class="cv-sub">In Clash of Clans: Settings → More Settings → API Token. Copy it, come back and paste it with your player tag.</p>' +
      '<input id="cvGTag" placeholder="Player tag (#2PP...)" autocomplete="off"><input id="cvGTok" placeholder="API token" autocomplete="off" autocapitalize="off">' +
      '<button type="submit" class="button button-green" id="cvGGo">Verify and sign in</button></form>');
    const f = $("#cvGameForm"), am = $("#authMessage");
    const say = t => { if (am) am.textContent = t; };
    $("#cvGameBtn").onclick = () => {
      f.hidden = false;
      window.location.href = "https://link.clashofclans.com/en?action=OpenMoreSettings"; /* opens the game straight to More Settings */
    };
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const tag = normTag($("#cvGTag").value), token = $("#cvGTok").value.trim();
      if (!validTag(tag)) return say("Enter a valid player tag.");
      if (token.length < 8) return say("Paste the API token from the game.");
      const c = sb(), b = $("#cvGGo");
      b.disabled = true; say("Verifying with Supercell…");
      try {
        const { data, error } = await c.functions.invoke(CFG.GAME_FN, { body: { tag, token } });
        if (error || !data) throw new Error('Game sign-in isn\'t connected yet. Deploy the "' + CFG.GAME_FN + '" Edge Function.');
        if (!data.ok) throw new Error(data.error || "Verification failed. Check the tag and token.");
        const r = await c.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
        if (r.error) throw r.error;
        say("Welcome, " + (data.name || "Chief") + "!"); $("#cvGTok").value = "";
      } catch (er) { say(er.message || "Game sign-in failed."); }
      finally { b.disabled = false; }
    });
  }

  /* =====================================================
     MOBILE BOTTOM NAV
     ===================================================== */
  function initNav() {
    $$(".bottom-nav,.mobile-nav,.mobile-bottom-nav").forEach(n => n.remove());
    if ($("#cvNav")) return;
    const items = [["home", "🏠", "Home"], ["player-finder", "🔎", "Players"], ["bases", "🏰", "Bases"], ["attacks", "⚔️", "Attack"], ["tracker", "🦸", "Heroes"], ["account", "👤", "Account"]];
    const nav = document.createElement("nav");
    nav.id = "cvNav"; nav.setAttribute("aria-label", "Main");
    nav.innerHTML = items.map(i => '<a href="#' + i[0] + '" data-s="' + i[0] + '"><span aria-hidden="true">' + i[1] + "</span>" + i[2] + "</a>").join("");
    document.body.appendChild(nav);
    const mark = id => $$("a", nav).forEach(a => a.classList.toggle("on", a.dataset.s === id));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) mark(en.target.id); }), { rootMargin: "-40% 0px -50% 0px" });
      items.forEach(i => { const s = document.getElementById(i[0]); if (s) io.observe(s); });
    }
    mark("home");
  }

  /* =====================================================
     STYLE (only what style.css doesn't have; uses its variables)
     ===================================================== */
  function injectCss() {
    if ($("#cv-css")) return;
    const s = document.createElement("style");
    s.id = "cv-css";
    s.textContent = `
.hero-orbit,.hero-sun,.floating-tag,.hero-spark,.lobby-troops{display:none!important}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.cv-search select,.cv-filters select,.cv-form input,.cv-form select,.cv-input,#cvGameForm input{min-height:44px;padding:8px 12px;border:1px solid var(--stone);border-radius:11px;background:var(--paper);color:var(--ink);width:100%}
.cv-search select{width:auto}.cv-search{flex-wrap:wrap}.cv-search input{min-width:140px}
.cv-msg{min-height:20px;margin:10px 0;color:var(--muted);font-size:13px}.cv-msg.err{color:var(--danger)}
.cv-card{margin-top:14px}.cv-card h3{margin:0;color:var(--forest)}.cv-card h3 small{color:var(--muted);font-weight:700;font-size:12px}
.cv-card h4{margin:16px 0 8px;color:var(--forest)}.cv-sub{margin:4px 0 0;color:var(--muted);font-size:13px}
.cv-head{display:flex;gap:14px;align-items:center}
.cv-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin:14px 0}
.cv-stats div{padding:10px;border:1px solid var(--stone);border-radius:11px;background:var(--paper);text-align:center}
.cv-stats b{display:block;color:var(--forest)}.cv-stats small{color:var(--muted);font-size:11px}
.cv-chips{display:flex;flex-wrap:wrap;gap:6px}.cv-chips span{padding:5px 9px;border-radius:8px;background:var(--green-light);color:var(--forest);font-size:12px;font-weight:800}
.cv-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.cv-list{display:grid;gap:8px;margin-top:10px;max-height:340px;overflow:auto}
.cv-row{display:flex;align-items:center;gap:10px;min-height:48px;padding:8px 12px;border:1px solid var(--stone);border-radius:12px;background:var(--paper);color:var(--ink);text-align:left}
.cv-row:hover{border-color:var(--green)}.cv-row span{display:flex;flex-direction:column}.cv-row small{color:var(--muted)}
.cv-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px}.cv-tabs .filter-chip{white-space:nowrap;min-height:40px}
.cv-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-items:center;margin-bottom:12px}
.cv-form{display:grid;gap:10px;margin-bottom:14px;padding:16px;border:1px solid var(--stone);border-radius:16px;background:var(--paper)}
.cv-form label{display:grid;gap:4px;font-size:12px;font-weight:800;color:var(--forest)}.cv-form em{font-weight:500;color:var(--muted)}
.cv-hint{color:var(--muted)}.cv-sample{font-size:11px;font-weight:800;color:var(--muted)}
.cv-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.card-art span{position:relative;z-index:1}
.cv-danger{border-color:var(--danger);color:var(--danger);background:transparent}.cv-cancel{color:var(--forest);border-color:var(--stone)}
.cv-hero{display:flex;align-items:center;gap:12px}.cv-hero small{color:var(--muted)}
.cv-ico{display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:var(--green-light);font-size:24px}
.cv-bar{height:8px;margin-top:12px;border-radius:6px;background:var(--paper-dark);overflow:hidden}.cv-bar i{display:block;height:100%;background:var(--green)}
#cvGameForm{display:grid;gap:10px;margin-top:12px}#cvGameBtn{margin-top:10px}
.cv-toast{position:fixed;left:50%;bottom:84px;z-index:300;transform:translate(-50%,20px);padding:10px 16px;border-radius:12px;background:var(--forest);color:#fff;font-size:13px;font-weight:800;opacity:0;pointer-events:none;transition:.2s}
.cv-toast.on{opacity:1;transform:translate(-50%,0)}
#cvNav{display:none}
@media(max-width:820px){
body{padding-bottom:68px}
#cvNav{display:grid;grid-template-columns:repeat(6,1fr);position:fixed;left:0;right:0;bottom:0;z-index:200;background:var(--paper);border-top:1px solid var(--stone);padding-bottom:env(safe-area-inset-bottom)}
#cvNav a{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;font-size:10px;font-weight:800;color:var(--muted)}
#cvNav a span{font-size:19px}#cvNav a.on{color:var(--green)}
.card-grid{grid-template-columns:1fr!important}}
`;
    document.head.appendChild(s);
  }

  /* seasons: set by you in season.json (mode: "auto" | "off" | season name). Text only, no theme changes. */
  const SEASONS = {
    christmas: { start: "12-01", end: "12-31", message: "🎄 Winter Festival is here! Happy holidays, Chiefs!", title: "Winter Festival", text: "Enjoy the holidays and good luck with your attacks!" },
    newyear: { start: "01-01", end: "01-03", message: "🎆 Happy New Year, Chiefs!", title: "New Year", text: "A new year, new upgrades." },
    valentine: { start: "02-07", end: "02-14", message: "💖 Happy Valentine's Day from ClashVault!", title: "Valentine's Week", text: "Show some love to your clanmates." },
    lunar: { start: "2027-02-06", end: "2027-02-20", message: "🏮 Happy Lunar New Year, Chiefs!", title: "Lunar New Year", text: "Wishing you luck in every battle." },
    summer: { start: "07-01", end: "08-15", message: "☀️ Summer is here, Chiefs!", title: "Summer Kingdom", text: "Time to push those trophies." },
    halloween: { start: "10-18", end: "11-01", message: "🎃 Spooky season has arrived!", title: "Haunted Kingdom", text: "Happy Halloween, Chiefs!" }
  };
  async function initSeason() {
    let cfg = { mode: "auto", seasons: SEASONS };
    try { const r = await fetch("./season.json", { cache: "no-store" }); if (r.ok) { const j = await r.json(); if (j && typeof j === "object") cfg = j; } } catch (_) {}
    const seasons = cfg.seasons || SEASONS, pad = n => String(n).padStart(2, "0"), d = new Date();
    const full = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()), md = full.slice(5);
    const inR = x => {
      const a = String(x.start || ""), b = String(x.end || "");
      if (/^\d{4}-/.test(a) && /^\d{4}-/.test(b)) return full >= a && full <= b;
      return a <= b ? md >= a && md <= b : md >= a || md <= b;
    };
    let id = null;
    if (cfg.mode === "off") id = null;
    else if (cfg.mode && cfg.mode !== "auto") id = seasons[cfg.mode] ? cfg.mode : null;
    else id = Object.keys(seasons).sort((x, y) => /^\d{4}-/.test(seasons[y].start) - /^\d{4}-/.test(seasons[x].start)).find(k => seasons[k].enabled !== false && inR(seasons[k])) || null;
    const def = id && seasons[id];
    if (!def) return;
    const t = $("#announcementText"); if (t && def.message) t.textContent = String(def.message).slice(0, 140);
    const card = $("#events .event-season");
    if (card) { const h = $("h3", card), p = $("p", card); if (h && def.title) h.textContent = def.title; if (p && def.text) p.textContent = def.text; }
  }
  function fixGameEmail() {
    const m = $("#authUserEmail");
    if (!m || !("MutationObserver" in window)) return;
    const fix = () => { if (/@players\.clashvault\.app/i.test(m.textContent)) m.textContent = "Signed in with Clash of Clans"; };
    new MutationObserver(fix).observe(m, { childList: true, characterData: true, subtree: true }); fix();
  }

  function init() {
    injectCss();
    initSeason().catch(() => {}); fixGameEmail();
    [initFinder, initLibrary, initHeroVault, initGameLogin, initNav].forEach(fn => {
      try { fn(); } catch (e) { console.warn("[ClashVault]", fn.name, e); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
