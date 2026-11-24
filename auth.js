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

  if (!client) {
    say("Sign-in isn't connected. Check supabase-config.js.");
    return;
  }

  /* ------------------------------------------------------------ game UI */
  function buildGameScreen() {
    if (!panel || $("authGameScreen")) return;
    const s = document.createElement("div");
    s.id = "authGameScreen";
    s.hidden = true;
    s.innerHTML =
      '<button class="small-action" id="gameBack" type="button">← Back</button>' +
      '<h3>Open with a game</h3>' +
      '<p>Sign in with your Clash of Clans account. Your Player Tag is public; the API token is only used once to prove the account is yours.</p>' +
      '<div class="game-hero" aria-hidden="true">🎮</div>' +
      '<form id="gameForm" novalidate>' +
        '<label class="cx-field"><span>Your Player Tag</span><input id="gameTag" type="text" placeholder="#2PP..." maxlength="15" autocomplete="off" autocapitalize="characters" required></label>' +
        '<label class="cx-field"><span>API Token <em>(from the game settings)</em></span><input id="gameToken" type="password" placeholder="Paste your API token" autocomplete="off" spellcheck="false"></label>' +
        '<p class="form-note">In Clash of Clans: Settings → More Settings → API Token → Show. It is used once and never stored.</p>' +
        '<button class="button button-green" id="gameVerify" type="submit">Verify and sign in</button>' +
      '</form>' +
      '<div class="auth-divider"><span>OR</span></div>' +
      '<button class="small-action" id="gameTagOnly" type="button">Continue with Player Tag only</button>' +
      '<p class="form-note">Player Tag only creates a profile on this device. Stats stay visible, but the account is marked as unverified.</p>';
    panel.insertBefore(s, $("authMessage") || null);

    $("gameBack").addEventListener("click", () => { show("method"); say(""); });
    $("gameTagOnly").addEventListener("click", () => runTagOnly($("gameTagOnly")));
    $("gameForm").addEventListener("submit", event => {
      event.preventDefault();
      verifyGame($("gameVerify"));
    });
  }

  async function playerLookup(tag) {
    const res = await client.functions.invoke("coc", { body: { path: "/players/" + encodeURIComponent(tag) } });
    if (res.error || !res.data) throw new Error("Couldn't reach the Clash of Clans service. Try again in a moment.");
    if (res.data.status !== 200 || !res.data.data) {
      if (res.data.status === 404) throw new Error("No player found with that tag. Check the tag and try again.");
      if (res.data.status === 403 || res.data.status === 500) throw new Error("The Clash of Clans API key isn't accepted right now. Try again later.");
      throw new Error("Clash of Clans returned an error (" + res.data.status + "). Try again in a moment.");
    }
    return res.data.data;
  }

  async function runTagOnly(button) {
    const tag = normTag($("gameTag") ? $("gameTag").value : "");
    if (!tag || !validTag(tag)) { say("Enter a valid Player Tag, for example #2PP."); return; }
    if (button) button.disabled = true;
    say("Looking up " + tag + "…");
    try {
      const player = await playerLookup(tag);
      window.PDXIdentity.write({ tag: player.tag || tag, name: player.name || tag, kind: "local", townHall: player.townHallLevel || null });
      say("Profile saved on this device. Opening your profile…");
      window.setTimeout(() => { location.href = "./profile.html"; }, 450);
    } catch (error) {
      say(error.message || "Could not load that player.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function verifyGame(button) {
    const tag = normTag($("gameTag").value);
    const token = $("gameToken").value.trim();
    if (!validTag(tag)) { say("Enter a valid Player Tag, for example #2PP."); return; }
    if (!token) { say("Paste the API token from the game settings, or continue with Player Tag only."); return; }
    if (button) button.disabled = true;
    say("Checking with Clash of Clans…");
    try {
      const player = await playerLookup(tag);
      const res = await client.functions.invoke("game-login", { body: { tag: tag, token: token } });
      if (res.error || !res.data) throw new Error('Game verification is unavailable right now. Use "Continue with Player Tag only" or try again later.');
      if (!res.data.ok) throw new Error(res.data.error || "The API token didn't match that account.");

      /* The token already proved the account. Turning the server's one-time hash
         into a Supabase session is a bonus (syncing the profile), so a stale or
         already-used link must never cancel a successful verification. */
      let sessionNote = "";
      if (res.data.token_hash) {
        try {
          const verify = await client.auth.verifyOtp({ token_hash: res.data.token_hash, type: "magiclink" });
          if (verify.error) sessionNote = " Signed in on this device — the email link had expired, so cloud sync is off until you sign in again.";
        } catch (_) {
          sessionNote = " Signed in on this device — the email link had expired, so cloud sync is off until you sign in again.";
        }
      }

      $("gameToken").value = "";
      const name = player.name || res.data.name || tag;
      window.PDXIdentity.write({ tag: player.tag || tag, name: name, kind: "verified", townHall: player.townHallLevel || null });

      const { data: sessionData } = await client.auth.getSession();
      const activeSession = sessionData && sessionData.session;
      if (activeSession && activeSession.user) {
        try {
          await client.from("profiles").upsert({
            id: activeSession.user.id,
            display_name: name,
            player_tag: player.tag || tag,
            player_name: name,
            player_tag_verified: true
          }, { onConflict: "id" });
        } catch (_) { /* profile row is optional; the local identity is what the site reads */ }
      }

      say("Verified. Welcome, " + name + "!" + sessionNote);
      show("in");
      session(activeSession);
    } catch (error) {
      say(error.message || "Couldn't verify that account. Try again.");
    } finally {
      if (button) button.disabled = false;
    }
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
