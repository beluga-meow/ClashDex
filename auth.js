
(() => {
  const client = window.supabaseClient;

  if (!client) {
    console.error("Supabase client missing. Check supabase-config.js.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  const methodScreen = $("authMethodScreen");
  const emailScreen = $("authEmailScreen");
  const otpScreen = $("authOtpScreen");
  const loggedIn = $("authLoggedIn");
  const message = $("authMessage");

  let otpSent = false;
  let pendingEmail = "";
  let mode = "signup";

  function showMessage(text) {
    if (message) message.textContent = text;
  }

  function showScreen(screen) {
    if (methodScreen) methodScreen.hidden = screen !== "method";
    if (emailScreen) emailScreen.hidden = screen !== "email";
    if (otpScreen) otpScreen.hidden = screen !== "otp";
    if (loggedIn) loggedIn.hidden = screen !== "loggedIn";
  }

  function resetOtp() {
    otpSent = false;
    pendingEmail = "";

    if ($("authOtp")) $("authOtp").value = "";
    if ($("authEmail")) $("authEmail").disabled = false;

    showScreen("email");
  }

  async function createProfile(user) {
    const { error } = await client
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name:
            user.email?.split("@")[0] || "ClashVault Member"
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Profile setup:", error);
    }
  }

  async function loadPlayerProfile(user) {
    const { data, error } = await client
      .from("profiles")
      .select("player_tag, player_name, player_tag_verified")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Player profile:", error);
      return;
    }

    if ($("authPlayerTag")) {
      $("authPlayerTag").value = data?.player_tag || "";
    }

    if ($("authPlayerStatus")) {
      if (data?.player_name && data?.player_tag_verified) {
        $("authPlayerStatus").textContent =
          `Connected player: ${data.player_name}`;
      } else if (data?.player_tag) {
        $("authPlayerStatus").textContent =
          `Player Tag saved: ${data.player_tag}. In-game name verification is not connected yet.`;
      } else {
        $("authPlayerStatus").textContent =
          "Enter your Player Tag to save your Clash of Clans profile.";
      }
    }
  }

  function updateSession(session) {
    const user = session?.user;

    if (!user) {
      showScreen("method");
      return;
    }

    showScreen("loggedIn");

    if ($("authUserEmail")) {
      $("authUserEmail").textContent =
        `Signed in as ${user.email}`;
    }

    if ($("authUserName")) {
      $("authUserName").textContent = "Welcome to ClashVault!";
    }

    loadPlayerProfile(user);
  }

  // OPEN WITH A GAME
  $("authGameButton")?.addEventListener("click", () => {
    showMessage(
      "Game sign-in is coming soon. For now, use your email to access ClashVault."
    );
  });

  // EMAIL LOGIN SCREEN
  $("authEmailButton")?.addEventListener("click", () => {
    showScreen("email");
    showMessage("");
  });

  $("authEmailBack")?.addEventListener("click", () => {
    showScreen("method");
    showMessage("");
  });

  $("authModeToggle")?.addEventListener("click", () => {
    mode = mode === "signup" ? "login" : "signup";

    $("authTitle").textContent =
      mode === "signup" ? "Create your account" : "Welcome back!";

    $("authModeToggle").textContent =
      mode === "signup"
        ? "Already have an account? Sign in"
        : "New here? Create an account";

    showMessage("");
  });

  // SEND EMAIL CODE
  $("authEmailForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("authEmail")?.value.trim().toLowerCase();
    const button = $("authEmailSubmit");

    if (!email || !/^[^\s@]+@gmail\.com$/i.test(email)) {
      showMessage("Please enter a valid Gmail address ending in @gmail.com.");
      return;
    }

    try {
      if (button) button.disabled = true;

      showMessage("Sending your verification code...");

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "signup"
        }
      });

      if (error) throw error;

      pendingEmail = email;
      otpSent = true;

      $("authPendingEmail").textContent = email;
      $("authEmail").disabled = true;
      $("authOtp").value = "";

      showScreen("otp");
      showMessage("Verification code sent. Check your Gmail inbox and spam folder.");
    } catch (error) {
      console.error("Email OTP:", error);
      showMessage(error.message || "Unable to send verification code.");
    } finally {
      if (button) button.disabled = false;
    }
  });

  // VERIFY OTP
  $("authOtpForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = $("authOtp")?.value.trim();
    const button = $("authVerifyButton");

    if (!pendingEmail || !/^\d{6}$/.test(token || "")) {
      showMessage("Please enter the 6-digit verification code.");
      return;
    }

    try {
      if (button) button.disabled = true;

      showMessage("Verifying your code...");

      const { data, error } = await client.auth.verifyOtp({
        email: pendingEmail,
        token,
        type: "email"
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Verification succeeded, but no user was returned.");
      }

      await createProfile(data.user);

      otpSent = false;
      pendingEmail = "";

      showMessage("Email verified! Welcome to ClashVault.");
      updateSession(data.session);
    } catch (error) {
      console.error("OTP verification:", error);
      showMessage(error.message || "Verification failed. Please try again.");
    } finally {
      if (button) button.disabled = false;
    }
  });

  // GO BACK TO EMAIL
  $("authOtpBack")?.addEventListener("click", () => {
    showScreen("email");
    showMessage("You can change your email address or request another code.");
    $("authEmail").disabled = false;
  });

  // RESEND OTP
  $("authResend")?.addEventListener("click", async () => {
    if (!pendingEmail) {
      showMessage("Please enter your email address again.");
      showScreen("email");
      return;
    }

    try {
      const button = $("authResend");
      if (button) button.disabled = true;

      showMessage("Sending another verification code...");

      const { error } = await client.auth.signInWithOtp({
        email: pendingEmail,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) throw error;

      showMessage("A new verification code has been sent.");
    } catch (error) {
      console.error("Resend OTP:", error);
      showMessage(error.message || "Unable to resend code.");
    } finally {
      if ($("authResend")) $("authResend").disabled = false;
    }
  });

  // SAVE PLAYER TAG
  $("playerLinkForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      showMessage("Please sign in first.");
      return;
    }

    const tag = $("authPlayerTag")?.value
      .trim()
      .toUpperCase()
      .replace(/\s/g, "");

    if (!tag || !/^#?[0289PYLQGRJCUV]{3,15}$/.test(tag)) {
      $("authPlayerStatus").textContent =
        "Please enter a valid-looking Clash of Clans Player Tag.";
      return;
    }

    const playerTag = tag.startsWith("#") ? tag : `#${tag}`;
    const button = $("authLinkPlayer");

    try {
      if (button) button.disabled = true;

      $("authPlayerStatus").textContent = "Saving Player Tag...";

      const { error } = await client
        .from("profiles")
        .upsert(
          {
            id: user.id,
            player_tag: playerTag,
            player_name: null,
            player_tag_verified: false
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      $("authPlayerStatus").textContent =
        `Player Tag ${playerTag} saved. In-game name verification will be available after API integration.`;
    } catch (error) {
      console.error("Player Tag save:", error);

      $("authPlayerStatus").textContent =
        error.message || "Unable to save Player Tag.";
    } finally {
      if (button) button.disabled = false;
    }
  });

  // SIGN OUT
  $("authLogout")?.addEventListener("click", async () => {
    try {
      const { error } = await client.auth.signOut();

      if (error) throw error;

      showMessage("You have signed out.");
      showScreen("method");
    } catch (error) {
      showMessage(error.message || "Unable to sign out.");
    }
  });

  // AUTH STATE
  client.auth.onAuthStateChange((_event, session) => {
    updateSession(session);
  });

  async function initializeAuth() {
    const { data, error } = await client.auth.getSession();

    if (error) {
      showMessage(error.message);
      return;
    }

    updateSession(data.session);
  }

  initializeAuth();

  console.log("ClashVault authentication initialized.");
})();
