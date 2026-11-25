/* PekkaDex sign-in: Clash of Clans account sign-in + email code sign-in. */
(() => {
  "use strict";
  const client = window.supabaseClient;
  const $ = id => document.getElementById(id);
  const screens = { method: $("authMethodScreen"), email: $("authEmailScreen"), otp: $("authOtpScreen"), in: $("authLoggedIn") };
  const panel = document.querySelector("#account .auth-panel");
  let email = "", mode = "signup", cool = 0, timer = 0;
  const say = t => { const m = $("authMessage"); if (m) m.textContent = t || ""; };
  const show = s => {
    Object.keys(screens).forEach(k => { if (screens[k]) screens[k].hidden = k !== s; });
    const game = $("authGameScreen");
    if (game) game.hidden = s !== "game";
  };
  const friendly = e => {
    const m = (e && e.message) || "";
    if (/rate limit|too many|seconds/i.test(m)) return "Too many codes requested. Wait a minute and try again.";
    if (/signups? not allowed|not found/i.test(m)) return "No account with this email yet. Choose Create an account.";
    if (/expired|invalid/i.test(m)) return "That code is wrong or expired. Request a new one.";
    return m || "Something went wrong. Try again.";
  };
  const normTag = raw => {
    let t = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!t) return "";
    return t.startsWith("#") ? t : "#" + t;
  };
  const validTag = tag => /^#[0289PYLQGRJCUV]{3,15}$/.test(tag);
  /* Edge Functions can cold-start or stall; a stuck request must never leave
     the form locked on "Checking…" with the button disabled. */
  const withTimeout = (work, ms, message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(work).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });

  if (!client) {
    say("Sign-in isn't connected. Check supabase-config.js.");
    return;
  }

  /* ------------------------------------------------------------ game UI */
  const GAME_LOGIN = "https://id.supercell.com/";
  /* The official in-game share link: opens Clash of Clans on the phone that
     has the game, straight on that player's profile. */
  const playerLink = tag => "https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=" +
    encodeURIComponent(normTag(tag).replace(/^#/, ""));

  function buildGameScreen() {
    if (!panel || $("authGameScreen")) return;
    const s = document.createElement("div");
    s.id = "authGameScreen";
    s.hidden = true;
    s.innerHTML =
      '<button class="small-action" id="gameBack" type="button">← Back</button>' +
      '<h3>Open with a game</h3>' +
      '<p>Clash of Clans has no sign-in for fan sites, so PekkaDex links your village with your Player Tag. The button opens that profile inside the game, and PekkaDex saves the same tag to your account.</p>' +
      '<div class="game-hero" aria-hidden="true">🎮</div>' +
      '<label class="cx-field"><span>Player Tag</span>' +
        '<input id="gameTag" type="text" maxlength="15" placeholder="#2PP" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
      '</label>' +
      '<a class="button button-green" id="gameOpen" href="' + playerLink("") + '" target="_blank" rel="noopener noreferrer">Open my profile in game ↗</a>' +
      '<p class="form-note">That is the same link the game\'s own Share button makes. It needs Clash of Clans installed on this phone.</p>' +
      '<button class="button button-gold" id="gameLink" type="button">Link this tag to PekkaDex</button>' +
      '<p class="form-note">No Supercell password and no API token: the tag is public and only says which village is yours.</p>' +
      '<p class="auth-status" id="gameStatus" aria-live="polite"></p>' +
      '<a class="small-action" id="gameProfile" href="./profile.html" hidden>Open my PekkaDex profile →</a>' +
      '<div class="auth-divider"><span>SUPERCELL ID</span></div>' +
      '<a class="small-action" id="gameSupercell" href="' + GAME_LOGIN + '" target="_blank" rel="noopener noreferrer">Open Supercell ID ↗</a>' +
      '<button class="small-action" id="gameEmail" type="button">Use an email code instead</button>';
    panel.insertBefore(s, $("authMessage") || null);

    const tagInput = $("gameTag");
    const openBtn = $("gameOpen");
    const status = $("gameStatus");
    const tagHint = "Player tags look like #2PP — letters 0289PYLQGRJCUV and numbers only.";

    function syncLink() {
      const tag = normTag(tagInput.value);
      const ok = validTag(tag);
      openBtn.href = playerLink(ok ? tag : "");
      openBtn.style.pointerEvents = ok ? "" : "none";
      openBtn.style.opacity = ok ? "" : ".55";
      openBtn.setAttribute("aria-disabled", ok ? "false" : "true");
      if (!ok && tagInput.value.trim()) status.textContent = tagHint;
      else if (status.textContent === tagHint) status.textContent = "";
    }
    tagInput.addEventListener("input", syncLink);
    openBtn.addEventListener("click", event => {
      if (openBtn.getAttribute("aria-disabled") === "true") { event.preventDefault(); tagInput.focus(); }
    });

    $("gameLink").addEventListener("click", async () => {
      const tag = normTag(tagInput.value);
      if (!validTag(tag)) { status.textContent = "Enter your Player Tag, for example #2PP."; tagInput.focus(); return; }
      const btn = $("gameLink");
      btn.disabled = true;
      status.textContent = "Checking " + tag + " in Clash of Clans…";
      try {
        const player = await playerLookup(tag);
        const { data: sessionData } = await client.auth.getSession();
        const user = sessionData && sessionData.session && sessionData.session.user;
        if (user) {
          const { error } = await client.from("profiles").upsert({
            id: user.id, display_name: player.name || "Chief", player_tag: player.tag,
            player_name: player.name, player_tag_verified: true
          }, { onConflict: "id" });
          if (error) throw error;
        }
        window.PDXIdentity.write({ tag: player.tag, name: player.name, kind: user ? "verified" : "local", townHall: player.townHallLevel });
        tagInput.value = player.tag;
        syncLink();
        status.textContent = "Linked " + player.name + " (" + player.tag + ") · Town Hall " + (player.townHallLevel || "?");
        $("gameProfile").hidden = false;
      } catch (error) {
        status.textContent = error.message || "Couldn't link that Player Tag.";
      } finally {
        btn.disabled = false;
      }
    });

    $("gameBack").addEventListener("click", () => { show("method"); say(""); });
    $("gameEmail").addEventListener("click", () => { show("email"); say(""); });
    syncLink();
  }

  async function playerLookup(tag) {
    const res = await withTimeout(
      client.functions.invoke("coc", { body: { path: "/players/" + encodeURIComponent(tag) } }),
      20000,
      "Clash of Clans took too long to answer. Check your connection and try again."
    );
    if (res.error || !res.data) throw new Error("Couldn't reach the Clash of Clans service. Try again in a moment.");
    if (res.data.status !== 200 || !res.data.data) {
      if (res.data.status === 404) throw new Error("No player found with that tag. Check the tag and try again.");
      if (res.data.status === 403 || res.data.status === 500) throw new Error("The Clash of Clans API key isn't accepted right now. Try again later.");
      throw new Error("Clash of Clans returned an error (" + res.data.status + "). Try again in a moment.");
    }
    return res.data.data;
  }

  /* --------------------------------------------------------- email flow */
  function session(s) {
    const u = s && s.user;
    const local = window.PDXIdentity && window.PDXIdentity.read();
    if (!u && !local) { show("method"); return; }
    show("in");
    const name = local && local.name ? local.name : "";
    $("authUserName").textContent = name ? "Welcome, " + name + "!" : "Welcome to PekkaDex!";
    const verifiedLocal = local && local.kind === "verified";
    $("authUserEmail").textContent = u
      ? (/@players\.clashvault\.app$/i.test(u.email || "") ? "Signed in with Clash of Clans" : "Signed in as " + u.email)
      : (verifiedLocal ? "Verified Clash of Clans account" : "Profile saved on this device") + (local && local.tag ? " · " + local.tag : "");
    const tagInput = $("authPlayerTag");
    if (tagInput && local && local.tag && !tagInput.value) tagInput.value = local.tag;
    ensureProfileButton();
  }

  function ensureProfileButton() {
    const box = $("authLoggedIn");
    if (!box || $("goProfile")) return;
    const a = document.createElement("a");
    a.id = "goProfile";
    a.className = "button button-gold";
    a.href = "./profile.html";
    a.style.marginTop = "4px";
    a.textContent = "Open my profile →";
    const logout = $("authLogout");
    if (logout && logout.parentNode === box) box.insertBefore(a, logout);
    else box.appendChild(a);
  }

  function startCooldown() {
    const b = $("authResend"); cool = 45; clearInterval(timer);
    timer = setInterval(() => { cool--; b.disabled = cool > 0; b.textContent = cool > 0 ? "Resend in " + cool + "s" : "Resend code"; if (cool <= 0) clearInterval(timer); }, 1000);
    b.disabled = true;
  }
  async function send(btn) {
    if (btn) btn.disabled = true;
    say("Sending your code…");
    try {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: mode === "signup" } });
      if (error) throw error;
      $("authPendingEmail").textContent = email; $("authOtp").value = "";
      show("otp"); startCooldown();
      say("Code sent. Check your inbox and spam folder.");
    } catch (e) { say(friendly(e)); }
    finally { if (btn) btn.disabled = false; }
  }

  buildGameScreen();
  $("authGameButton").addEventListener("click", () => { show("game"); say(""); });
  $("authEmailButton").addEventListener("click", () => { show("email"); say(""); });
  $("authEmailBack").addEventListener("click", () => { show("method"); say(""); });
  $("authModeToggle").addEventListener("click", () => {
    mode = mode === "signup" ? "login" : "signup";
    $("authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back!";
    $("authModeToggle").textContent = mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account";
    say("");
  });
  $("authEmailForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("authEmail").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return say("Enter a valid email address.");
    email = v; send($("authEmailSubmit"));
  });
  $("authOtpForm").addEventListener("submit", async e => {
    e.preventDefault();
    const token = $("authOtp").value.replace(/\s/g, ""), b = $("authVerifyButton");
    if (!/^\d{6}$/.test(token)) return say("Enter the 6-digit code from your email.");
    b.disabled = true; say("Checking your code…");
    try {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
      if (data.user) {
        await client.from("profiles").upsert({ id: data.user.id, display_name: email.split("@")[0] }, { onConflict: "id" });
        const existing = window.PDXIdentity && window.PDXIdentity.read();
        if (!existing) window.PDXIdentity.write({ tag: "", name: email.split("@")[0], kind: "email" });
      }
      say("You're in. Welcome to PekkaDex!");
      session(data.session);
    } catch (er) { say(friendly(er)); }
    finally { b.disabled = false; }
  });
  $("authResend").addEventListener("click", () => { if (cool <= 0) send(null); });
  $("authOtpBack").addEventListener("click", () => { show("email"); say(""); });
  $("authLogout").addEventListener("click", async () => {
    /* Clear the device identity first so the auth-state callback below cannot
       re-show the signed-in card after the session disappears. */
    if (window.PDXIdentity) window.PDXIdentity.clear();
    const { error } = await client.auth.signOut();
    if (error) return say(friendly(error));
    const panel = $("authGameScreen"); if (panel) panel.hidden = true;
    say("You have signed out."); show("method");
  });

  /* Player tag save on the signed-in card */
  $("playerLinkForm").addEventListener("submit", async event => {
    event.preventDefault();
    const tag = normTag($("authPlayerTag").value);
    if (!validTag(tag)) { $("authPlayerStatus").textContent = "Enter a valid player tag, for example #2PP."; return; }
    $("authPlayerStatus").textContent = "Saving " + tag + "…";
    try {
      const player = await playerLookup(tag);
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData && sessionData.session && sessionData.session.user;
      if (user) {
        const { error } = await client.from("profiles").upsert({
          id: user.id, display_name: (player.name || "Chief"), player_tag: player.tag, player_name: player.name, player_tag_verified: true
        }, { onConflict: "id" });
        if (error) throw error;
      }
      window.PDXIdentity.write({ tag: player.tag, name: player.name, kind: user ? "verified" : "local", townHall: player.townHallLevel });
      $("authPlayerStatus").textContent = "Linked " + player.name + " (" + player.tag + ").";
    } catch (error) {
      $("authPlayerStatus").textContent = error.message || "Couldn't link that player tag.";
    }
  });

  client.auth.onAuthStateChange((_e, s) => session(s));
  client.auth.getSession().then(r => session(r.data && r.data.session));

  /* Profile page buttons link here with ?signin=game or ?signin=email. */
  const intent = (new URLSearchParams(location.search).get("signin") || "").toLowerCase();
  if (intent === "game" || intent === "email") {
    window.setTimeout(() => {
      if (screens.method && !screens.method.hidden) {
        show(intent === "game" ? "game" : "email");
        say("");
      }
    }, 250);
  }
})();
