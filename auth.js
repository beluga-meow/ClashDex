
(() => {
  const SUPABASE_URL =
    "https://hrloxvshgehvkmpnnbyz.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_eIE7cZwu8FE1727c-Vd1KA_v2CRIYX2";

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  window.supabaseClient = client;

  const $ = (id) => document.getElementById(id);

  const loggedOut = $("authLoggedOut");
  const loggedIn = $("authLoggedIn");
  const form = $("authForm");
  const message = $("authMessage");

  let mode = "signup";

  function showMessage(text) {
    if (message) message.textContent = text;
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

    if (loggedOut) loggedOut.hidden = !!user;
    if (loggedIn) loggedIn.hidden = !user;

    if (user && $("authUserEmail")) {
      $("authUserEmail").textContent =
        `Signed in as ${user.email}`;
    }
  }

  if (!form || !loggedOut || !loggedIn) {
    showMessage("Authentication HTML elements are missing.");
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
      console.error("Authentication error:", error);
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

  console.log("ClashVault authentication initialized.");
})();
