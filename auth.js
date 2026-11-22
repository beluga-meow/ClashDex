(() => {
  const client = window.supabaseClient;

  const $ = (id) => document.getElementById(id);

  const loggedOut = $("authLoggedOut");
  const loggedIn = $("authLoggedIn");
  const form = $("authForm");
  const message = $("authMessage");

  let mode = "signup";

  function showMessage(text) {
    message.textContent = text;
  }

  function updateMode() {
    const signup = mode === "signup";

    $("authTitle").textContent = signup
      ? "Create your account"
      : "Welcome back";

    $("authName").hidden = !signup;
    $("authName").required = signup;

    $("authSubmit").textContent = signup
      ? "Create account"
      : "Sign in";

    $("authToggle").textContent = signup
      ? "Already have an account? Sign in"
      : "New here? Create an account";
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

    loggedOut.hidden = !!user;
    loggedIn.hidden = !user;

    if (user) {
      $("authUserEmail").textContent =
        `Signed in as ${user.email}`;
    }
  }

  if (!client) {
    showMessage("Supabase connection could not be initialized.");
    return;
  }

  $("authToggle").addEventListener("click", () => {
    mode = mode === "signup" ? "login" : "signup";
    showMessage("");
    updateMode();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const name = $("authName").value.trim();

    $("authSubmit").disabled = true;
    showMessage("Please wait...");

    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name
            }
          }
        });

        if (error) throw error;

        if (data.session && data.user) {
          await createProfile(data.user);
          showMessage("Account created successfully!");
        } else {
          mode = "login";
          updateMode();
          showMessage(
            "Registration received! Check your email to confirm your account, then sign in."
          );
        }
      } else {
        const { data, error } =
          await client.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        if (data.user) {
          await createProfile(data.user);
        }

        showMessage("Successfully signed in!");
      }

      form.reset();
    } catch (error) {
      showMessage(error.message || "Something went wrong.");
    } finally {
      $("authSubmit").disabled = false;
    }
  });

  $("authLogout").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();

    if (error) {
      showMessage(error.message);
      return;
    }

    showMessage("You have signed out.");
  });

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

    if (data.session?.user) {
      await createProfile(data.session.user);
    }
  }

  updateMode();
  initializeAuth();
})();