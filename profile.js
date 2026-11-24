/* PekkaDex — profile page
   Reads the signed-in identity, pulls live Clash of Clans stats through the
   "coc" Edge Function, and keeps ranked / classic battle history per tag. */
(() => {
  "use strict";
  if (window.__pdxProfile) return;
  window.__pdxProfile = true;

  const sb = window.supabaseClient || null;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => (typeof n === "number" ? n.toLocaleString() : "—");
  const initial = name => {
    const clean = String(name || "").trim();
    const ch = clean.replace(/[^\p{L}\p{N}]/gu, "").charAt(0);
    return ch ? ch.toUpperCase() : "P";
  };
  const normTag = raw => {
    const t = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!t) return "";
    return t.startsWith("#") ? t : "#" + t;
  };
  const validTag = tag => /^#[0289PYLQGRJCUV]{3,15}$/.test(tag);

  let identity = window.PDXIdentity ? window.PDXIdentity.read() : null;
  let user = null;
  let profileRow = null;
  let player = null;
  let loadError = "";
  let activeTab = "overview";
  let busy = false;

  /* ------------------------------------------------------------- storage */
  const battleKey = tag => "pdx.battles." + String(tag || "").replace(/[^#0-9A-Z]/gi, "");
  function battles(tag) {
    try {
      const list = JSON.parse(localStorage.getItem(battleKey(tag)) || "[]");
      return Array.isArray(list) ? list.filter(b => b && b.mode && b.result) : [];
    } catch (_) { return []; }
  }
  function saveBattles(tag, list) {
    try { localStorage.setItem(battleKey(tag), JSON.stringify(list.slice(0, 200))); } catch (_) {}
  }

  /* --------------------------------------------------------------- API */
  async function coc(path) {
    if (!sb || !sb.functions) throw new Error("The Clash of Clans service is not connected on this page.");
    const res = await sb.functions.invoke("coc", { body: { path } });
    if (res.error || !res.data) throw new Error("Couldn't reach the Clash of Clans service. Try again in a moment.");
    if (res.data.status === 404) throw new Error("No player found with that tag.");
    if (res.data.status === 403 || res.data.status === 500) throw new Error("The Clash of Clans API key isn't accepted right now.");
    if (res.data.status !== 200 || !res.data.data) throw new Error("Clash of Clans returned an error (" + res.data.status + ").");
    return res.data.data;
  }

  /* ------------------------------------------------------------- views */
  function showGate(message) {
    $("#profileGate").hidden = false;
    $("#profileMain").hidden = true;
    const status = $("#gateStatus");
    if (status) status.textContent = message || "";
  }

  function stateLabel() {
    if (player) return { text: identity && identity.kind === "local" ? "Live · unverified" : "Live stats", cls: identity && identity.kind === "local" ? "unverified" : "" };
    if (identity && identity.kind === "verified") return { text: "Verified", cls: "" };
    if (identity && identity.kind === "local") return { text: "Unverified", cls: "unverified" };
    return { text: "Email account", cls: "unverified" };
  }

  function paintHead() {
    const name = (player && player.name) || (identity && identity.name) || "Chief";
    $("#profileAvatar").textContent = initial(name);
    $("#profileName").textContent = name;
    $("#profileTag").textContent = (player && player.tag) || (identity && identity.tag) || "No player tag";
    $("#profileTH").textContent = "TH " + ((player && player.townHallLevel) || (identity && identity.townHall) || "?");
    const state = stateLabel();
    const badge = $("#profileState");
    badge.textContent = state.text;
    badge.className = "profile-state" + (state.cls ? " " + state.cls : "");
    const bits = [];
    if (player && player.clan && player.clan.name) bits.push(player.clan.name + " · " + (player.clan.tag || ""));
    if (player && player.leagueTier && player.leagueTier.name) bits.push(player.leagueTier.name);
    if (!player && loadError) bits.push(loadError);
    else if (!player) bits.push("Loading live Clash of Clans stats…");
    if (identity && identity.kind === "local") bits.push("Saved on this device — open with a game to verify ownership.");
    $("#profileSub").textContent = bits.join(" · ");
  }

  const statTile = (label, value, extra) =>
    `<div class="stat-tile${extra ? " " + extra : ""}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;

  function renderOverview() {
    const grid = $("#statGrid");
    if (!player) {
      grid.innerHTML = `<div class="empty-box" style="grid-column:1/-1">${loadError ? esc(loadError) : "Live stats are not loaded yet."}<br>Use <b>Refresh stats</b> to try again, or change the tag in the Account tab.</div>`;
      $("#heroProgress").innerHTML = "";
      $("#equipmentOwned").innerHTML = "";
      $("#clanBox").innerHTML = "";
      $("#profileNote").textContent = "";
      return;
    }
    grid.innerHTML = [
      statTile("Trophies", num(player.trophies), "accent"),
      statTile("Best trophies", num(player.bestTrophies)),
      statTile("Builder trophies", num(player.builderBaseTrophies)),
      statTile("War stars", num(player.warStars)),
      statTile("Attack wins", num(player.attackWins)),
      statTile("Defence wins", num(player.defenseWins)),
      statTile("Experience", "Lv " + num(player.expLevel)),
      statTile("Donated", num(player.donations)),
      statTile("Received", num(player.donationsReceived)),
      statTile("Clan capital", num(player.clanCapitalContributions))
    ].join("");

    const heroes = (player.heroes || []).filter(h => !h.village || h.village === "home");
    $("#heroProgress").innerHTML = heroes.length ? heroes.map(h => {
      const max = h.maxLevel || h.level || 1;
      const pct = Math.max(4, Math.min(100, Math.round((h.level / max) * 100)));
      return `<div class="row"><div><span>${esc(h.name)}</span><span>Lv ${esc(h.level)} / ${esc(max)}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join("") : `<div class="empty-box">No hero data returned for this player yet.</div>`;

    const gear = player.heroEquipment || [];
    $("#equipmentOwned").innerHTML = gear.length
      ? gear.map(e => `<div class="eq"><span>${esc(e.name)}</span><small>Lv ${esc(e.level)}</small></div>`).join("")
      : `<div class="empty-box">No equipment data returned for this account.</div>`;

    const clan = player.clan;
    $("#clanBox").innerHTML = clan ? `<div class="clan-row">
        ${clan.badgeUrls && clan.badgeUrls.small ? `<img src="${esc(clan.badgeUrls.small)}" alt="" loading="lazy">` : ""}
        <div><b>${esc(clan.name || "Clan")}</b><small>${esc(clan.tag || "")} · Level ${esc(clan.clanLevel == null ? "?" : clan.clanLevel)}${player.role ? " · " + esc(player.role) : ""}</small></div>
      </div>` : `<div class="empty-box">This account is not in a clan right now.</div>`;
    $("#profileNote").textContent = "Stats come from the official Clash of Clans API each time you open or refresh this page.";
  }

  function legendSeasons() {
    const ls = (player && player.legendStatistics) || null;
    if (!ls) return "";
    const season = (label, data) => {
      if (!data) return "";
      return `<div class="season"><b>${esc(label)}</b><span>Rank ${num(data.rank)}</span><small>${num(data.trophies)} trophies</small></div>`;
    };
    const blocks = [season("This season", ls.currentSeason), season("Previous season", ls.previousSeason), season("Best season", ls.bestSeason)].filter(Boolean);
    return blocks.length ? `<div class="legend-season">${blocks.join("")}</div>` : "";
  }

  function battleSummary(list) {
    const wins = list.filter(b => b.result === "win").length;
    const losses = list.filter(b => b.result === "loss").length;
    const draws = list.filter(b => b.result === "draw").length;
    const stars = list.reduce((sum, b) => sum + (Number(b.stars) || 0), 0);
    const destr = list.reduce((sum, b) => sum + (Number(b.destruction) || 0), 0);
    let streak = 0;
    for (const b of list) { if (b.result === "win") streak++; else break; }
    return [
      statTile("Logged", list.length),
      statTile("Wins", wins, "accent"),
      statTile("Losses", losses),
      statTile("Draws", draws),
      statTile("Average stars", list.length ? (stars / list.length).toFixed(1) : "0.0"),
      statTile("Average destruction", list.length ? Math.round(destr / list.length) + "%" : "0%"),
      statTile("Win streak", streak)
    ].join("");
  }

  function battleForm(mode) {
    return `<form class="battle-form" data-battle-form="${mode}" novalidate>
      <label>Result
        <select name="result"><option value="win">Win</option><option value="loss">Loss</option><option value="draw">Draw</option></select>
      </label>
      <label>Stars
        <select name="stars"><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option><option value="0">0 ★</option></select>
      </label>
      <label>Destruction %
        <input name="destruction" type="number" min="0" max="100" step="1" placeholder="85">
      </label>
      <label>Opponent <span style="font-weight:600">(optional)</span>
        <input name="opponent" type="text" maxlength="24" placeholder="Name or clan" autocomplete="off">
      </label>
      <button type="submit">Add battle</button>
    </form>`;
  }

  function battleList(list, mode) {
    const rows = list.filter(b => b.mode === mode);
    if (!rows.length) {
      return `<div class="empty-box">No ${mode} battles logged yet. Add one above and this record fills itself in.</div>`;
    }
    return `<div class="battle-list">${rows.map(b => {
      const icon = b.result === "win" ? "✔" : b.result === "loss" ? "✖" : "=";
      const stars = "★".repeat(Number(b.stars) || 0) + "☆".repeat(3 - (Number(b.stars) || 0));
      const when = b.at ? new Date(b.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
      return `<div class="battle">
        <span class="battle-result ${esc(b.result)}" aria-label="${esc(b.result)}">${icon}</span>
        <span class="battle-main"><b>${esc(b.opponent || "Unknown opponent")}</b><small>${when} · ${Number(b.destruction) || 0}% destruction</small></span>
        <span class="battle-stars" aria-label="${esc(String(b.stars || 0))} stars">${stars}</span>
        <button class="battle-del" type="button" data-del-battle="${esc(b.id)}" data-mode="${esc(mode)}" aria-label="Delete battle">×</button>
      </div>`;
    }).join("")}</div>`;
  }

  function renderRanked() {
    if (!player) {
      $("#rankedStats").innerHTML = `<div class="empty-box" style="grid-column:1/-1">Live stats are not loaded yet.</div>`;
      $("#rankedSeasons").innerHTML = "";
    } else {
      const ls = player.legendStatistics || {};
      const league = (player.leagueTier && player.leagueTier.name) || "Unranked";
      $("#rankedStats").innerHTML = [
        statTile("League", league, "accent"),
        statTile("Current trophies", num(player.trophies)),
        statTile("Best trophies", num(player.bestTrophies)),
        statTile("Legend rank", ls.currentSeason ? "#" + num(ls.currentSeason.rank) : "—"),
        statTile("Season trophies", ls.currentSeason ? num(ls.currentSeason.trophies) : "—")
      ].join("");
      $("#rankedSeasons").innerHTML = legendSeasons() ||
        `<div class="empty-box" style="margin-top:10px">Legend League season data appears once the account finishes a Legend League season. Classic progress is on the Classic tab.</div>`;
    }
    const list = battles(identity && identity.tag);
    $("#rankedHistory").innerHTML =
      `<div class="stat-grid" style="margin-bottom:12px">${battleSummary(list.filter(b => b.mode === "ranked"))}</div>` +
      battleForm("ranked") + battleList(list, "ranked");
  }

  function renderClassic() {
    if (!player) {
      $("#classicStats").innerHTML = `<div class="empty-box" style="grid-column:1/-1">Live stats are not loaded yet.</div>`;
    } else {
      $("#classicStats").innerHTML = [
        statTile("Trophies", num(player.trophies), "accent"),
        statTile("Best trophies", num(player.bestTrophies)),
        statTile("Attack wins", num(player.attackWins)),
        statTile("Defence wins", num(player.defenseWins)),
        statTile("War stars", num(player.warStars)),
        statTile("Town Hall", "TH " + num(player.townHallLevel))
      ].join("");
    }
    const list = battles(identity && identity.tag);
    $("#classicHistory").innerHTML =
      `<div class="stat-grid" style="margin-bottom:12px">${battleSummary(list.filter(b => b.mode === "classic"))}</div>` +
      battleForm("classic") + battleList(list, "classic");
  }

  function renderAccount() {
    const clashEmail = user && /@players\.clashvault\.app$/i.test(user.email || "");
    const rows = [
      ["Email sign-in", user ? (clashEmail ? "Signed in with Clash of Clans" : esc(user.email || "Signed in")) : "Not signed in with email"],
      ["Player tag", identity && identity.tag ? esc(identity.tag) : "Not linked"],
      ["Account type", identity ? (identity.kind === "verified" ? "Verified Clash of Clans account" : identity.kind === "local" ? "Local profile (unverified)" : "Email account") : "—"],
      ["Profile name", profileRow && profileRow.display_name ? esc(profileRow.display_name) : esc((identity && identity.name) || "—")]
    ];
    if (profileRow && profileRow.created_at) rows.push(["PekkaDex member since", esc(new Date(profileRow.created_at).toLocaleDateString())]);
    $("#accountRows").innerHTML = rows.map(([k, v]) => `<div class="account-row"><b>${k}</b><span>${v}</span></div>`).join("");
  }

  function renderAll() {
    paintHead();
    renderOverview();
    renderRanked();
    renderClassic();
    renderAccount();
  }

  async function loadPlayer(silent) {
    if (!identity || !identity.tag || busy) { if (!identity || !identity.tag) { player = null; loadError = ""; } return; }
    busy = true;
    const button = $("#refreshProfile");
    if (button && !silent) { button.disabled = true; button.textContent = "↻ Loading…"; }
    loadError = "";
    try {
      const data = await coc("/players/" + encodeURIComponent(identity.tag));
      player = data;
      if (window.PDXIdentity) {
        window.PDXIdentity.write({
          tag: data.tag || identity.tag,
          name: data.name || identity.name,
          kind: identity.kind || "local",
          townHall: data.townHallLevel || identity.townHall
        });
        identity = window.PDXIdentity.read() || identity;
      }
    } catch (error) {
      player = null;
      loadError = error.message || "Could not load this player.";
    } finally {
      busy = false;
      if (button) { button.disabled = false; button.textContent = "↻ Refresh stats"; }
    }
  }

  /* ------------------------------------------------------------- events */
  function switchTab(tab) {
    activeTab = tab;
    $$("[data-atab]").forEach(b => {
      const on = b.dataset.atab === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    [["overview", "#tabOverview"], ["ranked", "#tabRanked"], ["classic", "#tabClassic"], ["account", "#tabAccount"]].forEach(([id, sel]) => {
      const panel = $(sel);
      if (panel) panel.hidden = id !== tab;
    });
  }

  function addBattle(form) {
    const mode = form.dataset.battleForm;
    if (!identity || !identity.tag) return;
    const list = battles(identity.tag);
    list.unshift({
      id: String(Date.now()),
      mode,
      result: form.result.value,
      stars: Math.max(0, Math.min(3, Number(form.stars.value) || 0)),
      destruction: Math.max(0, Math.min(100, Number(form.destruction.value) || 0)),
      opponent: form.opponent.value.trim(),
      at: new Date().toISOString()
    });
    saveBattles(identity.tag, list);
    if (mode === "ranked") renderRanked(); else renderClassic();
  }

  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-atab]");
    if (tab) { switchTab(tab.dataset.atab); return; }
    const del = event.target.closest("[data-del-battle]");
    if (del && identity && identity.tag) {
      const list = battles(identity.tag).filter(b => String(b.id) !== String(del.dataset.delBattle));
      saveBattles(identity.tag, list);
      if (del.dataset.mode === "ranked") renderRanked(); else renderClassic();
    }
  });

  document.addEventListener("submit", event => {
    const form = event.target;
    if (form && form.matches("[data-battle-form]")) {
      event.preventDefault();
      addBattle(form);
    }
  });

  $("#gateTagForm").addEventListener("submit", async event => {
    event.preventDefault();
    const tag = normTag($("#gateTag").value);
    if (!validTag(tag)) { showGate("Enter a valid player tag, for example #2PP."); return; }
    const button = $("#gateTagGo");
    button.disabled = true;
    showGate("Looking up " + tag + "…");
    try {
      const data = await coc("/players/" + encodeURIComponent(tag));
      window.PDXIdentity.write({ tag: data.tag || tag, name: data.name || tag, kind: "local", townHall: data.townHallLevel });
      identity = window.PDXIdentity.read();
      $("#profileGate").hidden = true;
      $("#profileMain").hidden = false;
      player = data;
      renderAll();
    } catch (error) {
      showGate(error.message || "Could not load that player.");
    } finally {
      button.disabled = false;
    }
  });

  $("#tagForm").addEventListener("submit", async event => {
    event.preventDefault();
    const status = $("#accountStatus");
    const tag = normTag($("#newTag").value);
    if (!validTag(tag)) { status.textContent = "Enter a valid player tag."; return; }
    const button = $("#tagSave");
    button.disabled = true;
    status.className = "gate-status";
    status.textContent = "Checking " + tag + "…";
    try {
      const data = await coc("/players/" + encodeURIComponent(tag));
      if (user) {
        const { error } = await sb.from("profiles").upsert({
          id: user.id, display_name: data.name, player_tag: data.tag, player_name: data.name, player_tag_verified: true
        }, { onConflict: "id" });
        if (error) throw error;
      }
      window.PDXIdentity.write({ tag: data.tag || tag, name: data.name || tag, kind: user ? "verified" : "local", townHall: data.townHallLevel });
      identity = window.PDXIdentity.read();
      player = data;
      $("#newTag").value = "";
      status.className = "gate-status ok";
      status.textContent = "Linked " + data.name + " (" + data.tag + ").";
      renderAll();
    } catch (error) {
      status.className = "gate-status";
      status.textContent = error.message || "Couldn't link that tag.";
    } finally {
      button.disabled = false;
    }
  });

  $("#refreshProfile").addEventListener("click", async () => {
    await loadPlayer();
    renderAll();
  });

  $("#signOut").addEventListener("click", async () => {
    if (sb && sb.auth && user) { try { await sb.auth.signOut(); } catch (_) {} }
    if (window.PDXIdentity) window.PDXIdentity.clear();
    location.href = "./index.html";
  });

  /* ---------------------------------------------------------------- boot */
  async function boot() {
    if (sb && sb.auth) {
      try {
        const { data } = await sb.auth.getSession();
        user = (data && data.session && data.session.user) || null;
        if (user) {
          const { data: rows } = await sb.from("profiles")
            .select("id,display_name,player_tag,player_name,player_tag_verified,created_at")
            .eq("id", user.id).limit(1);
          profileRow = (rows && rows[0]) || null;
          if (!identity && profileRow && profileRow.player_tag) {
            window.PDXIdentity.write({ tag: profileRow.player_tag, name: profileRow.player_name || profileRow.display_name, kind: "verified" });
            identity = window.PDXIdentity.read();
          }
        }
      } catch (_) { /* offline or table missing: local identity still works */ }
    }

    if (!identity) {
      showGate(user ? "You're signed in — add your Player Tag below to load your stats." : "");
      return;
    }
    $("#profileGate").hidden = true;
    $("#profileMain").hidden = false;
    renderAll();
    if (identity.tag) {
      await loadPlayer(true);
      renderAll();
    } else {
      loadError = "Link a Player Tag in the Account tab to load Clash of Clans stats.";
      renderAll();
    }
    switchTab(activeTab);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
