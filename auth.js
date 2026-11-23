/* ClashVault email sign-in: sends a 6-digit code, verifies it. */
(() => {
  const client = window.supabaseClient;
  const $ = id => document.getElementById(id);
  const screens = { method: $("authMethodScreen"), email: $("authEmailScreen"), otp: $("authOtpScreen"), in: $("authLoggedIn") };
  let email = "", mode = "signup", cool = 0, timer = 0;
  const say = t => { const m = $("authMessage"); if (m) m.textContent = t || ""; };
  const show = s => Object.keys(screens).forEach(k => { if (screens[k]) screens[k].hidden = k !== s; });
  const friendly = e => {
    const m = (e && e.message) || "";
    if (/rate limit|too many|seconds/i.test(m)) return "Too many codes requested. Wait a minute and try again.";
    if (/signups? not allowed|not found/i.test(m)) return "No account with this email yet. Choose Create an account.";
    if (/expired|invalid/i.test(m)) return "That code is wrong or expired. Request a new one.";
    return m || "Something went wrong. Try again.";
  };
  if (!client) { say("Sign-in isn't connected. Check supabase-config.js."); return; }

  function session(s) {
    const u = s && s.user;
    if (!u) return show("method");
    show("in");
    $("authUserName").textContent = "Welcome to ClashVault!";
    $("authUserEmail").textContent = /@players\.clashvault\.app$/i.test(u.email || "") ? "Signed in with Clash of Clans" : "Signed in as " + u.email;
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
      if (data.user) await client.from("profiles").upsert({ id: data.user.id, display_name: email.split("@")[0] }, { onConflict: "id" });
      say("You're in. Welcome to ClashVault!"); session(data.session);
    } catch (er) { say(friendly(er)); }
    finally { b.disabled = false; }
  });
  $("authResend").addEventListener("click", () => { if (cool <= 0) send(null); });
  $("authOtpBack").addEventListener("click", () => { show("email"); say(""); });
  $("authLogout").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) return say(friendly(error));
    say("You have signed out."); show("method");
  });
  client.auth.onAuthStateChange((_e, s) => session(s));
  client.auth.getSession().then(r => session(r.data && r.data.session));
})();
