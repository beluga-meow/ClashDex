
(() => {
  const client = window.supabaseClient;

  if (!client) {
    console.error("Supabase client missing. Check supabase-config.js.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  const loggedOut = $("authLoggedOut");
  const loggedIn = $("authLoggedIn");
  const form = $("authForm");
  const message = $("authMessage");

  let mode = "signup";
  let otpSent = false;
  let pendingEmail = "";

  function showMessage(text) {
    if (message) message.textContent = text;
  }

  function updateMode() {
    const signup = mode === "signup";

    if ($("authTitle")) {
      $("authTitle").textContent = signup
        ? "Create your ClashVault account"
        : "Welcome back, Chief";
    }

    if ($("authName")) {
      $("authName").hidden = !signup || otpSent;
      $("authName").required = signup && !otpSent;
    }

    if ($("authEmail")) {
      $("authEmail").disabled = otpSent;
    }

    if ($("authOtp")) {
      $("authOtp").hidden = !otpSent;
      $("authOtp").required = otpSent;
    }

    if ($("authSubmit")) {
      $("authSubmit").textContent = otpSent
        ? "Verify code"
        : "Send verification code";
    }

    if ($("authToggle")) {
      $("authToggle").hidden = otpSent;
      $("authToggle").textContent = signup
        ? "Already have an account? Sign in"
        : "New here? Create an account";
    }

    if ($("authResend")) {
      $("authResend").hidden = !otpSent;
    }

    if ($("authBack")) {
      $("authBack").hidden = !otpSent;
    }
  }

  function resetOtp() {
    otpSent = false;
    pendingEmail = "";

    if ($("authOtp")) $("authOtp").value = "";

    if ($("authEmail")) $("authEmail").disabled = false;

    updateMode();
  }

  async function createProfile(user) {
    const displayName =
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "ClashVault Member";

    const { error } = await client
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: displayName
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Profile setup:", error);
    }
  }

  function updateSession(session) {
    const user = session?.user;

    if (loggedOut) loggedOut.hidden = !!user;
    if (loggedIn) loggedIn.hidden = !user;

    if (user && $("authUserEmail")) {
      $("authUserEmail").textContent =
        `Signed in as ${user.email}`;
    }

    if (user && $("authUserName")) {
      $("authUserName").textContent =
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "ClashVault Member";
    }
  }

  if (!form || !loggedOut || !loggedIn) {
    showMessage("Authentication HTML elements are missing.");
    console.error("Check authentication IDs in index.html.");
    return;
  }

  if ($("authToggle")) {
    $("authToggle").addEventListener("click", () => {
      mode = mode === "signup" ? "login" : "signup";
      resetOtp();
      showMessage("");
    });
  }

  if ($("authBack")) {
    $("authBack").addEventListener("click", () => {
      resetOtp();
      showMessage("Enter your email to request a new code.");
    });
  }

  async function sendCode() {
    const email = $("authEmail")?.value.trim().toLowerCase();
    const name = $("authName")?.value.trim() || "";

    if (!email || !/^[^\s@]+@gmail\.com$/i.test(email)) {
      throw new Error("Please enter a valid Gmail address ending in @gmail.com.");
    }

    if (mode === "signup" && !name) {
      throw new Error("Please enter your display name.");
    }

    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === "signup",
        data: {
          display_name: name
        }
      }
    });

    if (error) throw error;

    pendingEmail = email;
    otpSent = true;

    if ($("authOtp")) $("authOtp").value = "";

    updateMode();

    showMessage(
      `A verification code has been sent to ${email}. Check your inbox and spam folder.`
    );
  }

  async function verifyCode() {
    const token = $("authOtp")?.value.trim();

    if (!pendingEmail || !token) {
      throw new Error("Enter the verification code sent to your Gmail.");
    }

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

    showMessage("Email verified! Welcome to ClashVault.");

    form.reset();
    resetOtp();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = $("authSubmit");

    if (submitButton) submitButton.disabled = true;

    showMessage(
      otpSent ? "Verifying your code..." : "Sending verification code..."
    );

    try {
      if (otpSent) {
        await verifyCode();
      } else {
        await sendCode();
      }
    } catch (error) {
      console.error("ClashVault authentication:", error);
      showMessage(error.message || "Something went wrong.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  if ($("authResend")) {
    $("authResend").addEventListener("click", async () => {
      try {
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
        showMessage(error.message || "Unable to resend code.");
      }
    });
  }

  if ($("authLogout")) {
    $("authLogout").addEventListener("click", async () => {
      const { error } = await client.auth.signOut();

      if (error) {
        showMessage(error.message);
        return;
      }

      resetOtp();
      showMessage("You have signed out.");
    });
  }

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

  updateMode();
  initializeAuth();

  console.log("ClashVault OTP authentication initialized.");
})();
