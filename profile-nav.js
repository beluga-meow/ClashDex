/* PekkaDex — shared profile button + local identity helpers.
   Replaces the old green "Sign in" button with a round 👤 profile button
   on every page and remembers who is signed in on this device. */
(() => {
  "use strict";
  if (window.__pdxProfileNav) return;
  window.__pdxProfileNav = true;

  const KEY = "pdx.identity";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || !data.tag) return null;
      return data;
    } catch (_) { return null; }
  }
  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
    document.dispatchEvent(new CustomEvent("pdx:identity", { detail: read() }));
    paint();
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (_) {}
    document.dispatchEvent(new CustomEvent("pdx:identity", { detail: null }));
    paint();
  }
  window.PDXIdentity = { read, write, clear };

  const CSS = `
  /* round profile button in the top bar */
  html.cx a.header-cta.cx-profile{
    display:inline-flex!important;align-items:center;justify-content:center;gap:0;
    width:46px!important;height:46px;min-height:46px;padding:0!important;border-radius:50%!important;
    background:#fff;border:3px solid #5a3300;color:#4a2c12;font-size:21px;line-height:1;
    text-shadow:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08),0 3px 0 var(--cx-w4,#34190a);
    overflow:hidden;
  }
  html.cx a.header-cta.cx-profile:hover{background:#fff8e6;color:#4a2c12}
  html.cx a.header-cta.cx-profile.is-in{background:linear-gradient(#ffe778,#f5b71f);font-family:var(--cx-title);font-size:20px}
  @media(max-width:760px){
    html.cx a.header-cta.cx-profile{display:inline-flex!important;width:40px!important;height:40px;min-height:40px;font-size:18px}
  }
  .header-actions{flex:0 0 auto}
  `;

  function style() {
    if (document.getElementById("pdxProfileNavStyle")) return;
    const s = document.createElement("style");
    s.id = "pdxProfileNavStyle";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function initialOf(name) {
    const clean = String(name || "").trim();
    if (!clean) return "👤";
    const first = clean.replace(/[^\p{L}\p{N}]/gu, "").charAt(0);
    return first ? first.toUpperCase() : "👤";
  }

  function paint() {
    const data = read();
    const links = Array.from(document.querySelectorAll("[data-profile-link]"));
    links.forEach(link => {
      if (data) {
        link.textContent = initialOf(data.name);
        link.classList.add("is-in");
        link.title = (data.name ? data.name + " · " : "") + (data.tag || "") + " — open profile";
        link.setAttribute("aria-label", "Open " + (data.name || data.tag) + " profile");
      } else {
        link.textContent = "👤";
        link.classList.remove("is-in");
        link.title = "Profile — sign in";
        link.setAttribute("aria-label", "Open your profile. Sign in or log in.");
      }
      link.setAttribute("href", "./profile.html");
    });
  }

  function convert(indexCta) {
    const cta = indexCta || document.querySelector(".header-actions .header-cta");
    if (!cta || cta.dataset.pdxProfile === "1") return;
    cta.dataset.pdxProfile = "1";
    cta.href = "./profile.html";
    cta.classList.add("cx-profile");
    cta.removeAttribute("target");
    cta.setAttribute("data-profile-link", "");
    cta.setAttribute("aria-label", "Open your profile");
    paint();
  }

  function start() {
    style();
    convert();
    paint();
    /* app.js rewrites the header text after load; run again shortly after. */
    setTimeout(() => { convert(); paint(); }, 500);
    setTimeout(paint, 1600);

    if (window.supabaseClient && window.supabaseClient.auth) {
      const sb = window.supabaseClient;
      const sync = async () => {
        try {
          const { data } = await sb.auth.getSession();
          const user = data && data.session && data.session.user;
          if (!user) return;
          const existing = read();
          let name = "";
          let rowTag = "";
          let playerName = "";
          try {
            const { data: rows } = await sb.from("profiles").select("display_name,player_name,player_tag").eq("id", user.id).limit(1);
            const row = rows && rows[0];
            if (row) {
              name = row.player_name || row.display_name || "";
              playerName = row.player_name || "";
              rowTag = row.player_tag || "";
            }
          } catch (_) {}
          /* Never replace a name the player already has (like their in-game
             name) with the email prefix from the Supabase account. */
          if (!existing) {
            const fallback = name || (user.email || "").split("@")[0];
            if (fallback) write({ tag: rowTag, name: playerName || fallback, kind: "verified" });
            return;
          }
          const next = { ...existing, kind: existing.kind || "verified" };
          if (!next.tag && rowTag) next.tag = rowTag;
          if (!next.name && (name || playerName)) next.name = playerName || name;
          write(next);
        } catch (_) {}
      };
      sb.auth.onAuthStateChange((_event, session) => {
        if (!session) return;
        sync();
      });
      sync();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
