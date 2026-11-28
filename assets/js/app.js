
/* =====================================================================
   PekkaDex: player/clan finder, Town Hall library and Clash Heroes encyclopedia
   File name: app.js   (version 5)

   INSTALL: Upload app.js and the assets/townhalls folder to the repository
   root. The page keeps its auth.js and supabase-config.js files.

   Integration notes
   - All page styling lives in assets/css/home.css on top of tokens.css and
     components.css; this file no longer injects a stylesheet.
   - Existing auth.js and Supabase configuration remain separate.
   - The Builder Tracker has been removed from the active page and navigation.
   ===================================================================== */
(() => {
  "use strict";
  if (window.__cxLoaded || window.__clashVaultRedesignLoaded) return;
  window.__cxLoaded = true;
  window.__clashVaultRedesignLoaded = true;

  /* ============ 1. SETTINGS you may edit ============ */
  const SETTINGS = {
    EDGE_FUNCTION: "coc",           // name of your Supabase Edge Function (see coc-edge-function.ts)
    PROXY_BASE: "",                 // optional: your own proxy URL ending in /v1 ("" = not used)
    MAX_TOWN_HALL: 19,              // raise this when Supercell releases a new Town Hall
  };

  /* ============ 2. Small helpers ============ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => (typeof n === "number" ? n.toLocaleString() : "-");
  const div = (cls, id) => { const d = document.createElement("div"); d.className = cls; if (id) d.id = id; return d; };
  const safe = (where, fn) => { try { fn(); } catch (e) { try { console.warn("[PekkaDex]", where, "skipped:", e); } catch (_) {} } };

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

  async function callEdge(body) {
    if (SETTINGS.PROXY_BASE) {
      throw new ApiError("no-index", "Name search without a clan tag needs the Supabase Edge Function. Add a clan tag to search live clan members.");
    }
    const sb = sbClient();
    if (!sb || !sb.functions || !sb.functions.invoke) {
      throw new ApiError("not-connected", "The Supabase client wasn't found. Check the Supabase setup.");
    }
    let res;
    try {
      res = await sb.functions.invoke(SETTINGS.EDGE_FUNCTION, { body: body });
    } catch (_) {
      throw new ApiError("offline", "Couldn't reach the search service. Check your connection and try again.");
    }
    if (res.error || !res.data) {
      throw new ApiError("not-connected", "The search service didn't return a valid response. Check the coc Edge Function.");
    }
    if (typeof res.data.status !== "number") {
      /* Rate limits and configuration errors come back as { error } with an
         HTTP status the client cannot read, so keep the server's wording. */
      const message = typeof res.data.error === "string" && res.data.error
        ? res.data.error
        : "The search service didn't return a valid response. Check the coc Edge Function.";
      throw new ApiError("server", message);
    }
    return res.data;
  }

  /* Full-width letters and small-caps "fonts" are common in game names. Fold
     them on this side too, so a search works even if the deployed search
     function is older than the normalization below. */
  const SMALL_CAPS = "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢꜰꜱ";
  const SMALL_CAPS_PLAIN = "abcdefghijklmnopqrstuvwxyzfs";
  /* assets/js/name-fold.js holds the shared implementation; the inline version
     stays as a fallback in case that file fails to load. */
  function foldName(value) {
    if (window.PDXName && window.PDXName.foldValue) return window.PDXName.foldValue(value);
    const chars = Array.from(String(value == null ? "" : value), ch => {
      const i = SMALL_CAPS.indexOf(ch);
      return i === -1 ? ch : SMALL_CAPS_PLAIN.charAt(i);
    }).join("");
    return chars.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  }
  function normalizeNameQuery(value) {
    if (window.PDXName && window.PDXName.foldValue) {
      return window.PDXName.foldValue(value).normalize("NFKC").trim().replace(/\s+/g, " ");
    }
    const converted = Array.from(String(value == null ? "" : value), ch => {
      const i = SMALL_CAPS.indexOf(ch);
      return i === -1 ? ch : SMALL_CAPS_PLAIN.charAt(i);
    }).join("");
    return converted.normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  async function findInIndex(name, exact, th, options) {
    const opts = options || {};
    const r = await callEdge({
      action: "findPlayers",
      name: name,
      exact: !!exact,
      th: th ? Number(th) : null,
      limit: opts.limit || 1000,
      offset: opts.offset || 0,
      prefix: !!opts.prefix
    });
    if (r.status === 200 && r.data) return r.data;
    if (r.status === 429) {
      throw new ApiError("rate-limit", "Too many searches at once. Wait a minute, then search again.");
    }
    if (r.status === 503) {
      throw new ApiError("no-index", "The saved player index is not available right now. This is a server problem, not a missing player. Try again shortly.");
    }
    if (r.status === 400) {
      const message = r.data && typeof r.data.message === "string" ? r.data.message : "";
      throw new ApiError("input", message || "That search isn't valid. Use at least one letter or number.");
    }
    throw new ApiError("http-" + r.status, "Player name search failed. This is a server problem, not a missing player. Try again in a moment.");
  }

  async function api(path) {
    const r = await rawGet(path);
    if (r.status >= 200 && r.status < 300 && r.data) return r.data;
    const map = {
      400: "That search isn't valid. Check the tag or name.",
      403: "Supercell rejected the API key. Create the key with the proxy IP 45.79.218.79 (see README-SETUP.md).",
      404: "Not found. Double-check the tag.",
      429: "Too many searches at once. Wait a few seconds and try again.",
      500: "PekkaDex's API key isn't set up yet. Add the COC_API_TOKEN secret to the Edge Function.",
      502: "Couldn't reach the Clash of Clans API. Try again in a moment.",
      503: "The Clash of Clans API is in maintenance. Try again later."
    };
    throw new ApiError("http-" + r.status, map[r.status] || "The Clash of Clans API had a problem (" + r.status + "). Try again in a moment.");
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

  /* Keep site text short and clear. */
  /* The page carries its own copy. Keep only the quick-stat shortcuts wired,
     so a stat tile scrolls to its section. */
  function plainCopy() {
    const quickStats = $(".quick-stats");
    if (!quickStats || quickStats.dataset.cxWired) return;
    quickStats.dataset.cxWired = "1";
    const go = event => {
      const item = event.target.closest("[data-go]");
      const target = item && document.querySelector(item.dataset.go);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    quickStats.addEventListener("click", go);
    quickStats.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!event.target.closest("[data-go]")) return;
      event.preventDefault();
      go(event);
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

  /* The query the visible list belongs to, so each row can say how it matched. */
  let listingQuery = "";
  const playerRow = p => {
    const rank = listingQuery && window.PDXSearch ? window.PDXSearch.matchRank(p.name, listingQuery) : null;
    const label = rank == null || !window.PDXSearch ? "" : window.PDXSearch.matchLabel(rank);
    const fresh = p.updated_at && window.PDXSearch ? window.PDXSearch.freshness(p.updated_at) : "";
    return '<div class="cx-row"><div class="grow"><strong>' + esc(p.name) + "</strong><small>" + esc(p.tag) +
    (p.clan ? " · " + esc(p.clan) : "") + (p.role ? " · " + esc(roleName(p.role)) : "") +
    " · 🏆 " + num(p.trophies) + (fresh ? " · indexed " + esc(fresh) : "") +
    '</small></div><span class="cx-pill">TH ' + esc(p.th == null ? "?" : p.th) + "</span>" +
    (label ? '<span class="cx-match">' + esc(label) + "</span>" : "") +
    '<button class="cx-btn blue sm" type="button" data-view="' + esc(p.tag) + '">View</button></div>';
  };

  function clanRow(c) {
    const type = ({ open: "Open", inviteOnly: "Invite only", closed: "Closed" }[c.type]) || "";
    const req = c.requiredTownhallLevel ? " · needs TH " + c.requiredTownhallLevel + "+" : "";
    return '<div class="cx-row">' + badge(c) + '<div class="grow"><strong>' + esc(c.name) + "</strong><small>" + esc(c.tag) +
      " · Level " + esc(c.clanLevel == null ? "?" : c.clanLevel) + " · " + esc(c.members == null ? "?" : c.members) + "/50 members" +
      (type ? " · " + type : "") + esc(req) + "</small></div>" +
      '<button class="cx-btn blue sm" type="button" data-members="' + esc(c.tag) + '">Members</button>' +
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
          '<input id="cxPQ" type="search" maxlength="30" enterkeyhint="search" placeholder="Find a Player (enter Name or #Tag)" autocomplete="off" autocapitalize="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="cxSuggest" aria-expanded="false"></label>' +
        '<ul class="cx-suggest" id="cxSuggest" role="listbox" aria-label="Player suggestions" hidden></ul>' +
        '<div class="cx-actions-row"><button type="button" class="cx-add" data-crit="cxPCrit" aria-expanded="false" aria-controls="cxPCrit"><b aria-hidden="true">+</b>Add criteria</button></div>' +
        '<div class="cx-crit" id="cxPCrit" hidden>' +
          '<label class="cx-check"><input type="checkbox" id="cxExact"><span>Only players with that exact name</span></label>' +
          '<label class="cx-field"><span>Town Hall</span><select id="cxPTH">' + th + "</select></label>" +
          '<p class="cx-help">Searches every player saved in the PekkaDex index. A player enters the index when a clan&rsquo;s Members list or their profile is opened. Use a player tag to open an exact live profile.</p>' +
          '<button type="button" class="cx-close" data-crit-close="cxPCrit">Close</button></div>' +
        '<button class="cx-btn green cx-go" type="submit">Search player</button></form>' +
      '<form id="cxClanForm" novalidate hidden>' +
        '<label class="cx-search"><span class="cx-sr">Clan name or tag</span><i aria-hidden="true">🔍</i>' +
          '<input id="cxCName" type="search" maxlength="40" enterkeyhint="search" placeholder="Find a Clan (enter Name or #Tag)" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="cx-actions-row"><button type="button" class="cx-add" data-crit="cxCCrit" aria-expanded="false" aria-controls="cxCCrit"><b aria-hidden="true">+</b>Add criteria</button></div>' +
        '<div class="cx-crit" id="cxCCrit" hidden><div class="cx-two">' +
          '<label class="cx-field"><span>Min clan level (optional)</span><input id="cxCLvl" type="number" inputmode="numeric" min="1" max="50" placeholder="Any level"></label>' +
          '<label class="cx-field"><span>Min members (optional)</span><input id="cxCMin" type="number" inputmode="numeric" min="1" max="50" placeholder="Any number"></label></div>' +
          '<label class="cx-field"><span>Clans I can join with</span><select id="cxCTH">' + th + "</select></label>" +
          '<button type="button" class="cx-close" data-crit-close="cxCCrit">Close</button></div>' +
        '<button class="cx-btn green cx-go" type="submit">Search clan</button></form>' +
      '<p class="cx-coverage" id="cxCoverage" hidden></p>' +
      '<p class="cx-msg" id="cxMsg" aria-live="polite">Type a player name or tag. Add criteria to narrow it down.</p>' +
      '<div class="cx-results" id="cxOut"></div>';

    const msg = $("#cxMsg", box), out = $("#cxOut", box);
    const coverage = $("#cxCoverage", box), suggest = $("#cxSuggest", box);
    const pForm = $("#cxPlayerForm", box), cForm = $("#cxClanForm", box);
    const input = $("#cxPQ", box);
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
    const searchHelpers = () => window.PDXSearch || null;

    /* ---- index coverage + state ---- */
    const setCoverage = data => {
      const api = searchHelpers();
      if (!api || !data) { coverage.hidden = true; return; }
      const text = api.coverageLine(data.index_total, data.newest_update);
      coverage.textContent = text;
      coverage.hidden = !text;
    };

    /* ---- shared result helpers: one search can span several index pages ---- */
    const toHits = items => (items || []).map(i => ({
      tag: i.tag, name: i.name, th: i.th, trophies: i.trophies,
      role: i.role || "", match: i.match_type || "", updated_at: i.updated_at || "",
      clan: (i.clan_memberships || []).map(c => c.clan_name || c.clan_tag).filter(Boolean).join(", ") || i.clan_name || i.clan_tag || ""
    }));
    const paintHits = (hits, q, note) => {
      const api = searchHelpers();
      listingQuery = q;
      const list = api ? api.rankResults(hits, q) : hits;
      out.innerHTML = '<div class="cx-list">' + list.map(playerRow).join("") + "</div>" + (note || "");
      return list;
    };
    const moreNote = (found, shown, mode) =>
      '<div class="cx-more-results"><p>' + found + " players match; showing " + shown + ".</p>" +
      '<button class="cx-btn green sm" type="button" data-load-rest>' +
      (mode === "offset" ? "Load more" : "Show all " + found + " matches") + "</button></div>";

    const showEmpty = (query, data) => {
      const api = searchHelpers();
      listingQuery = "";
      out.innerHTML = "";
      const panel = div("cx-empty");
      const text = document.createElement("p");
      text.textContent = api
        ? api.emptyMessage(query, { total: data && data.index_total, newest: data && data.newest_update })
        : 'No indexed player name matches "' + query + '". Players become searchable after a clan\u2019s Members list is opened.';
      const actions = div("cx-empty__actions");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "cx-btn gold sm";
      retry.setAttribute("data-retry-search", "");
      retry.textContent = "Search again";
      const clans = document.createElement("button");
      clans.type = "button";
      clans.className = "cx-btn green sm";
      clans.setAttribute("data-goto-clans", "");
      clans.textContent = "Search a clan to index its members";
      actions.append(retry, clans);
      panel.append(text, actions);
      out.append(panel);
    };

    const showFailure = err => {
      listingQuery = "";
      out.innerHTML = "";
      const panel = div("cx-empty cx-empty--error");
      const text = document.createElement("p");
      text.textContent = errText(err);
      const actions = div("cx-empty__actions");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "cx-btn gold sm";
      retry.setAttribute("data-retry-search", "");
      retry.textContent = "Try again";
      actions.append(retry);
      panel.append(text, actions);
      out.append(panel);
      say(errText(err), "err");
    };

    let pending = null;
    let searchToken = 0;
    let lastQuery = "";
    let lastEmpty = "";

    async function loadRemaining() {
      if (!pending) return;
      const token = searchToken;
      const job = pending;
      const btn = $("[data-load-rest]", out);
      if (btn) { btn.disabled = true; btn.textContent = "Loading more…"; }
      try {
        if (job.mode === "offset") {
          const page = await findInIndex(job.q, job.exact, job.th, { offset: job.offset });
          if (token !== searchToken) return;
          const merged = window.PDXSearch.mergeHits(job.hits, toHits(page.items || []));
          job.hits = merged;
          job.offset = page.next_offset || 0;
          job.found = Number(page.total) || merged.length;
          pending = page.next_offset ? job : null;
          const list = paintHits(merged, job.q, pending ? moreNote(job.found, merged.length, "offset") : "");
          say(list.length + " of " + job.found + " matching players shown." + (pending ? "" : " All matches loaded."), "ok");
          return;
        }
        /* Older deployments cap one response at 100 rows. Finish the search
           with one request per Town Hall instead of dead-ending the list. */
        const merged = job.hits.slice();
        const seen = job.seen;
        for (let thv = 1; thv <= SETTINGS.MAX_TOWN_HALL && merged.length < job.found; thv++) {
          say("Loading Town Hall " + thv + " of " + SETTINGS.MAX_TOWN_HALL + "…");
          try {
            const page = await findInIndex(job.q, job.exact, thv);
            for (const item of (page && page.items) || []) {
              const tag = item && item.tag;
              if (!tag || seen.has(tag)) continue;
              seen.add(tag);
              merged.push(item);
            }
          } catch (_) { /* one Town Hall failing must not end the search */ }
        }
        if (token !== searchToken) return;
        pending = null;
        const list = paintHits(toHits(merged), job.q, "");
        say(list.length + (list.length === 1 ? " matching player found." : " matching players found.") + " All matches loaded.", "ok");
      } catch (err) {
        if (token === searchToken) {
          say(errText(err), "err");
          if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = job.mode === "offset" ? "Load more" : "Show all matches"; }
        }
      }
    }

    async function runPlayerSearch(override) {
      const typed = String(override == null ? input.value : override).trim();
      const q = searchHelpers() ? searchHelpers().normalizeQuery(typed) : normalizeNameQuery(typed);
      const exact = $("#cxExact", box).checked;
      const thv = $("#cxPTH", box).value;

      if (!q) { say("Enter a player name or player tag.", "err"); return; }

      if (isTagInput(q)) {
        lock(pForm, true);
        hideSuggest();
        await loadPlayer(normTag(q));
        lock(pForm, false);
        return;
      }
      if (q.startsWith("#")) {
        say("That player tag doesn't look right. Check the tag and try again.", "err");
        return;
      }
      const invalid = searchHelpers() ? searchHelpers().isInvalidQuery(q) : !foldName(q).replace(/[^\p{L}\p{N}]/gu, "");
      if (invalid) {
        say("That search has no letters or numbers. Add the player name or a player tag.", "err");
        return;
      }

      lastQuery = typed;
      lock(pForm, true);
      hideSuggest();
      pending = null;
      searchToken++;
      out.innerHTML = "";
      try {
        say("Searching every player record in the shared index…");
        const data = await findInIndex(q, exact, thv);
        const items = (data && data.items) || [];
        const total = Number(data && data.total);
        const found = Number.isFinite(total) ? total : items.length;
        setCoverage(data || {});

        if (!items.length) {
          lastEmpty = typed;
          showEmpty(q, data || {});
          say('No indexed player matched "' + q + '". The player may not be indexed yet — this is not the same as the player not existing.', "err");
          return;
        }

        lastEmpty = "";
        const hits = window.PDXSearch ? window.PDXSearch.rankResults(toHits(items), q) : toHits(items);
        const perCall = Number(data && data.result_limit) || 0;
        const hasOffset = data && data.next_offset != null && Number(data.next_offset) > 0;
        const leftover = Math.max(0, found - hits.length);
        pending = hasOffset && leftover > 0
          ? { mode: "offset", q: q, exact: exact, th: thv, hits: toHits(items), offset: Number(data.next_offset), found: found }
          : (perCall > 0 && perCall < 1000 && leftover > 0
            ? { mode: "th", q: q, exact: exact, th: thv, hits: items, found: found, seen: new Set(items.map(i => i.tag).filter(Boolean)) }
            : null);

        const note = pending
          ? moreNote(found, hits.length, pending.mode)
          : (leftover > 0
            ? '<div class="cx-more-results"><p>' + found + ' players match; the search service returns one page at a time.</p><p class="cx-help">Add a letter or pick a Town Hall to narrow it down.</p></div>'
            : "");
        paintHits(hits, q, note);

        const shown = pending ? "Showing " + hits.length + " of " + found : String(found);
        say(shown + (found === 1 ? " matching player found." : " matching players found.") +
          " Matches ignore capitals, small-caps fonts, punctuation, spaces and emoji; numbers still count." +
          (pending ? " Load more to see the rest." : (leftover > 0 ? " Narrow the search to see the rest." : "")), "ok");
      } catch (err) {
        showFailure(err);
      } finally {
        lock(pForm, false);
      }
    }

    pForm.addEventListener("submit", event => {
      event.preventDefault();
      runPlayerSearch();
    });

    /* ---- suggestions: real index rows, debounced ---- */
    let suggestTimer = 0, suggestToken = 0;
    function hideSuggest() {
      suggest.hidden = true;
      suggest.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
    }
    input.addEventListener("input", () => {
      clearTimeout(suggestTimer);
      const typed = input.value.trim();
      const q = searchHelpers() ? searchHelpers().normalizeQuery(typed) : normalizeNameQuery(typed);
      const invalid = searchHelpers() ? searchHelpers().isInvalidQuery(q) : !q;
      if (invalid || q.length < 3 || isTagInput(q)) { hideSuggest(); return; }
      const token = ++suggestToken;
      suggestTimer = setTimeout(async () => {
        try {
          /* Two windows: one restricted to names that start with the query
             (so "red" shows the Reds, not high-trophy names that merely
             contain it) and a wider one for names that only contain it. */
          const [wide, prefixed] = await Promise.all([
            findInIndex(q, false, "", { limit: 24 }),
            findInIndex(q, false, "", { limit: 24, prefix: true }).catch(() => null)
          ]);
          if (token !== suggestToken) return;
          const candidates = ((wide && wide.items) || []).concat((prefixed && prefixed.items) || []);
          const rows = window.PDXSearch
            ? window.PDXSearch.bestSuggestions(candidates, q, 6)
            : candidates.slice(0, 6);
          if (!rows.length) { hideSuggest(); return; }
          suggest.innerHTML = rows.map(row =>
            '<li role="option"><button type="button" data-suggest="' + esc(row.name) + '"><strong>' + esc(row.name) +
            "</strong><small>" + esc(row.tag) + " · TH " + esc(row.th == null ? "?" : row.th) +
            (row.clan_name ? " · " + esc(row.clan_name) : "") + "</small></button></li>").join("");
          suggest.hidden = false;
          input.setAttribute("aria-expanded", "true");
        } catch (_) { if (token === suggestToken) hideSuggest(); }
      }, 450);
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") hideSuggest();
    });
    suggest.addEventListener("click", event => {
      const button = event.target.closest("[data-suggest]");
      if (!button) return;
      input.value = button.dataset.suggest;
      hideSuggest();
      runPlayerSearch(button.dataset.suggest);
    });
    document.addEventListener("click", event => {
      if (!box.contains(event.target)) hideSuggest();
    });

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

    const switchTab = name => {
      const tab = $('.cx-tab[data-tab="' + name + '"]', box);
      if (tab) tab.click();
    };

    $$(".cx-tab", box).forEach(b => b.addEventListener("click", () => {
      $$(".cx-tab", box).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      const players = b.dataset.tab === "players";
      pForm.hidden = !players;
      cForm.hidden = players;
      pending = null;
      searchToken++;
      hideSuggest();
      out.innerHTML = "";
      say(players ? "Type a player name or tag. Add criteria to narrow it down." : "Type a clan name (3+ letters) or tag. Add criteria to narrow it down.");
    }));

    async function loadPlayer(tag) {
      say("Loading profile…");
      try {
        const p = await api("/players/" + encodeURIComponent(normTag(tag)));
        out.innerHTML = playerCard(p);
        say("Found " + (p.name || "player") + ".", "ok");
        try { out.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (_) {}
      } catch (e) {
        out.innerHTML = "";
        say(errText(e), "err");
      }
    }

    cForm.addEventListener("submit", async e => {
      e.preventDefault();
      const raw = $("#cxCName", box).value.trim();
      if (!raw) { say("Enter a clan name (3+ letters) or a clan tag.", "err"); return; }
      lock(cForm, true);
      pending = null;
      searchToken++;
      out.innerHTML = "";
      say("Searching clans…");
      try {
        const lvlRaw = $("#cxCLvl", box).value.trim();
        const memRaw = $("#cxCMin", box).value.trim();
        const lvl = lvlRaw ? Number(lvlRaw) : 0;
        const mem = memRaw ? Number(memRaw) : 0;
        if ((lvlRaw && (!Number.isInteger(lvl) || lvl < 1 || lvl > 50)) ||
            (memRaw && (!Number.isInteger(mem) || mem < 1 || mem > 50))) {
          say("Clan level and member filters must be whole numbers from 1 to 50.", "err");
          lock(cForm, false);
          return;
        }
        const thv = parseInt($("#cxCTH", box).value, 10) || 0;
        let items;
        if (isTagInput(raw)) {
          items = [await api("/clans/" + encodeURIComponent(normTag(raw)))];
        } else {
          if (raw.length < 3) throw new ApiError("input", "Clan names need at least 3 letters.");
          const result = await callEdge({
            action: "findClans", name: raw, limit: 50,
            minClanLevel: lvl || null, minMembers: mem || null
          });
          if (result.status < 200 || result.status >= 300) {
            throw new ApiError("http-" + result.status, "Clan search failed. Try another name or search again shortly.");
          }
          items = result.data && Array.isArray(result.data.items) ? result.data.items : [];
        }
        items = items.filter(c => (!lvl || c.clanLevel >= lvl) && (!mem || c.members >= mem) &&
          (!thv || !c.requiredTownhallLevel || c.requiredTownhallLevel <= thv));
        if (!items.length) say("No clans matched. Try another name or loosen the criteria.", "err");
        else {
          out.innerHTML = '<div class="cx-list">' + items.map(clanRow).join("") + "</div>" +
            '<p class="cx-help">Open Members on a clan to save its players to the shared index, then search any of their names.</p>';
          say(items.length + (items.length === 1 ? " clan found." : " clans found."), "ok");
        }
      } catch (err) {
        say(errText(err), "err");
      }
      lock(cForm, false);
    });

    out.addEventListener("click", async e => {
      if (e.target.closest("[data-load-rest]")) { loadRemaining(); return; }
      if (e.target.closest("[data-retry-search]")) {
        if (lastQuery) runPlayerSearch(lastQuery);
        else input.focus();
        return;
      }
      if (e.target.closest("[data-goto-clans]")) { switchTab("clans"); return; }
      const memberButton = e.target.closest("[data-members]");
      if (memberButton) {
        const clanTag = memberButton.dataset.members;
        say("Loading clan members and updating the shared index…");
        try {
          const result = await callEdge({ action: "getClanMembers", clanTag: clanTag });
          if (result.status < 200 || result.status >= 300) {
            throw new ApiError("http-" + result.status, "Could not load this clan's members. Try again in a moment.");
          }
          const members = result.data && Array.isArray(result.data.items) ? result.data.items : [];
          if (!members.length) {
            out.innerHTML = "";
            say("No members were returned for this clan.", "err");
          } else {
            const retry = lastEmpty
              ? '<div class="cx-more-results"><p>' + esc(members.length) + ' players were saved to the shared index.</p>' +
                '<button class="cx-btn green sm" type="button" data-retry-search>Search "' + esc(lastEmpty) + '" again</button></div>'
              : '<p class="cx-help">' + esc(members.length) + " players were saved to the shared index.</p>";
            out.innerHTML = '<div class="cx-list">' + members.map(memberRow).join("") + "</div>" + retry;
            say(members.length + " clan members loaded and saved to the shared index.", "ok");
          }
        } catch (err) {
          say(errText(err), "err");
        }
        return;
      }
      const c = e.target.closest("[data-copy]");
      if (c) { toast((await copyText(c.dataset.copy)) ? "Copied " + c.dataset.copy : "Couldn't copy. Copy it by hand."); return; }
      const v = e.target.closest("[data-view]");
      if (v) { loadPlayer(v.dataset.view); return; }
    });

    swapIn(sec, box);
    setHeading(sec, null, "Search every player saved in the shared index, or open a profile by player tag. Opening a clan's Members list or a player profile adds that player to the index for everyone.");
  }

  /* ============ 9. Clash Heroes Encyclopedia ============ */
  /* The homepage now keeps only the section title and the single link to the
     dedicated archive (static markup in index.html). The full encyclopedia
     lives on heroes.html, so nothing is injected here. */
  function buildHeroes() {}
  void buildHeroes;

  /* ============ 10. Mobile bottom menu (game style) ============ */
  function buildTabbar() {
    if ($(".cx-tabbar")) return;
    const items = [["home", "home", "Home"], ["player-finder", "players", "Players"], ["bases", "bases", "Bases"],
      ["attacks", "attack", "Attack"], ["heroes", "heroes", "Heroes"], ["account", "account", "Account"]];
    const nav = document.createElement("nav");
    nav.className = "cx-tabbar";
    nav.setAttribute("aria-label", "Quick navigation");
    nav.innerHTML = items.map(i => '<a href="#' + i[0] + '" data-s="' + i[0] + '"><img class="tab-ico" src="./assets/icons/nav-' + i[1] + '.png" alt="" width="28" height="28">' + i[2] + "</a>").join("");
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
  function start(){
    // Shared site interactions
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    $("#closeAnnouncement")?.addEventListener("click", () => $("#announcement")?.remove());

    const mobileMenu = $("#mobileMenu");
    const mainNav = $("#mainNav");
    const menuIsOpen = () => !!mainNav && (mainNav.classList.contains("open") || mainNav.classList.contains("active"));
    const setMenuOpen = open => {
      if (!mainNav || !mobileMenu) return;
      mainNav.classList.toggle("open", !!open);
      mainNav.classList.toggle("active", !!open);
      mobileMenu.textContent = open ? "×" : "☰";
      mobileMenu.setAttribute("aria-expanded", open ? "true" : "false");
      mobileMenu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    };
    mobileMenu?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(!menuIsOpen());
    });
    $$("#mainNav a").forEach(link => link.addEventListener("click", () => setMenuOpen(false)));
    document.addEventListener("click", event => {
      if (menuIsOpen() && !mainNav.contains(event.target) && !mobileMenu?.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menuIsOpen()) setMenuOpen(false);
    });
    if (mobileMenu && mainNav) setMenuOpen(menuIsOpen());

    const modal = $("#modalBackdrop");
    const closeModal = () => { if (modal) modal.hidden = true; };
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modalOk")?.addEventListener("click", closeModal);
    modal?.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

    // Seasonal appearance is controlled centrally by the developer theme module.
    const themeButton = $("#themeButton");
    if (themeButton) themeButton.hidden = true;
    const seasonPreview = $("#previewSeason");
    if (seasonPreview) seasonPreview.hidden = true;

    safe("hero", decorateHero);
    safe("finder", buildFinder);
    safe("heroes", buildHeroes);
    safe("tabbar", buildTabbar);
    safe("copy", plainCopy);
    safe("disclaimer", addDisclaimer);
    /* Other page scripts can ask for the same toast with a pdx:toast event. */
    document.addEventListener("pdx:toast", event => toast(String((event && event.detail) || "")));
    console.info("PekkaDex app.js loaded. Authentication and Supabase configuration were not changed.");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
