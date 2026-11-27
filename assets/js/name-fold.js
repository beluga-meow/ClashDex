/* PekkaDex name folding and match ranking.
   Shared by the site (app.js) and by tools/test-search.mjs so the client and
   the tests always agree on how a name is compared.

   The same rules are mirrored in SQL by public.pdx_fold_name() in
   supabase/migrations/20261125090000_player_name_search.sql. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PDXName = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Small-caps letters plus the long-s forms that appear in player names. */
  const SMALL_CAPS = "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢꜰꜱ";
  const SMALL_CAPS_PLAIN = "abcdefghijklmnopqrstuvwxyzfs";

  function swapSmallCaps(value) {
    return Array.from(String(value == null ? "" : value), ch => {
      const index = SMALL_CAPS.indexOf(ch);
      return index === -1 ? ch : SMALL_CAPS_PLAIN.charAt(index);
    }).join("");
  }

  /* foldValue keeps spaces and punctuation (used for the typed query). */
  function foldValue(value) {
    return swapSmallCaps(value).normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  }

  /* foldName keeps only letters and numbers — the form compared in searches. */
  function foldName(value) {
    return foldValue(value).replace(/[^\p{L}\p{N}]/gu, "");
  }

  /* skeleton keeps letters only, so "PEKKA99" and "PEKKA" can still meet. */
  function skeleton(value) {
    return foldValue(value).replace(/[^\p{L}]/gu, "");
  }

  /* Decimal codepoints of the original name, space separated. */
  function codepoints(value) {
    return Array.from(String(value == null ? "" : value))
      .map(ch => ch.codePointAt(0))
      .join(" ");
  }

  /* 0 exact · 1 prefix · 2 contains · 3 skeleton-only · 4 no match. */
  function rankScore(name, query) {
    const candidate = foldName(name);
    const target = foldName(query);
    if (!target) return 4;
    if (candidate === target) return 0;
    if (candidate.startsWith(target)) return 1;
    if (candidate.includes(target)) return 2;
    if (skeleton(target) && skeleton(candidate).includes(skeleton(target))) return 3;
    return 4;
  }

  function rankMatches(list, query) {
    return list.slice().sort((a, b) =>
      rankScore(a.name, query) - rankScore(b.name, query) ||
      String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }) ||
      String(a.tag || a.player_tag || "").localeCompare(String(b.tag || b.player_tag || "")));
  }

  return { foldValue, foldName, skeleton, codepoints, rankScore, rankMatches };
});
