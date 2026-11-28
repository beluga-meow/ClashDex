/* PekkaDex player search helpers.

   Shared by the site (app.js) and by tools/test-player-search.mjs, so the
   ranking, the freshness labels and the empty-state wording are tested exactly
   as they are rendered. Name folding itself lives in name-fold.js. */
(function (root, factory) {
  const names =
    root.PDXName ||
    (typeof require === "function" ? require("./name-fold.js") : null);

  const api = factory(names);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PDXSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (names) {
  "use strict";

  const hasNames = !!(names && names.foldValue && names.rankScore);
  const foldValue = value => (hasNames ? names.foldValue(value) : String(value == null ? "" : value).toLocaleLowerCase());
  const foldName = value => (hasNames ? names.foldName(value) : foldValue(value).replace(/[^\p{L}\p{N}]/gu, ""));

  /* What the user typed, ready to send to the Edge Function. */
  function normalizeQuery(value) {
    return foldValue(value).normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  function isInvalidQuery(query) {
    return !foldName(query);
  }

  /* 0 exact · 1 prefix · 2 contains · 3 letters-only (fuzzy) · null no match. */
  function matchRank(name, query) {
    if (!foldName(query)) return null;
    const rank = hasNames ? names.rankScore(name, query) : 3;
    return rank === 4 ? null : rank;
  }

  const LABELS = ["Exact name", "Starts with", "Contains", "Similar"];
  function matchLabel(rank) {
    return rank == null ? "" : LABELS[rank] || "";
  }

  /* Exact, then prefix, then contains, then fuzzy; ties by trophies, name, tag. */
  function rankResults(rows, query) {
    return rows.slice().sort((a, b) => {
      const ra = matchRank(a.name, query);
      const rb = matchRank(b.name, query);
      const sa = ra == null ? 9 : ra;
      const sb = rb == null ? 9 : rb;
      if (sa !== sb) return sa - sb;
      const ta = Number.isFinite(a.trophies) ? a.trophies : -1;
      const tb = Number.isFinite(b.trophies) ? b.trophies : -1;
      if (ta !== tb) return tb - ta;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }) ||
        String(a.tag || "").localeCompare(String(b.tag || ""));
    });
  }

  /* The six typeahead rows that best match what was typed: exact, then prefix,
     then contains, then similar. Rows whose name does not match at all are
     dropped rather than filling the list, and tags are never duplicated. */
  function bestSuggestions(rows, query, limit) {
    const max = Math.max(1, Number(limit) || 6);
    const seen = new Set();
    const out = [];
    for (const row of rankResults(rows || [], query)) {
      if (!row || !row.tag || !row.name) continue;
      if (seen.has(row.tag)) continue;
      if (matchRank(row.name, query) == null) continue;
      seen.add(row.tag);
      out.push(row);
      if (out.length === max) break;
    }
    return out;
  }

  /* "just now", "12 min ago", "3 h ago", "5 days ago", or "" when unknown. */
  function freshness(value, now) {
    const then = Date.parse(String(value || ""));
    if (!Number.isFinite(then)) return "";
    const seconds = Math.max(0, Math.round(((now || Date.now()) - then) / 1000));
    if (seconds < 90) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + " min ago";
    const hours = Math.round(minutes / 60);
    if (hours < 36) return hours + (hours === 1 ? " hour ago" : " hours ago");
    const days = Math.round(hours / 24);
    if (days < 60) return days + (days === 1 ? " day ago" : " days ago");
    try {
      return "on " + new Date(then).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (_) {
      return "";
    }
  }

  function formatCount(value) {
    if (value == null || value === "") return "";
    const count = Number(value);
    return Number.isFinite(count) ? count.toLocaleString() : "";
  }

  function coverageLine(total, newest, now) {
    const count = formatCount(total);
    if (!count) return "";
    const fresh = freshness(newest, now);
    return "Shared index: " + count + (Number(total) === 1 ? " player" : " players") +
      (fresh ? " · newest record updated " + fresh : "");
  }

  /* The empty state explains coverage instead of implying the player does not exist. */
  function emptyMessage(query, info, now) {
    const total = info && Number(info.total);
    const count = formatCount(total);
    const fresh = info ? freshness(info.newest, now) : "";
    const coverage = count
      ? " The shared index currently holds " + count + (total === 1 ? " player" : " players") +
        (fresh ? " (newest record updated " + fresh + ")" : "") + "."
      : "";
    return 'No indexed player name matches "' + query + '".' + coverage +
      " Players become searchable after a clan's Members list is opened: search the clan,\n" +
      "press Members, then search the name again — or open a profile by player tag.";
  }

  /* Merges another result page without ever duplicating a player tag. */
  function mergeHits(existing, incoming) {
    const seen = new Set(existing.map(row => row.tag).filter(Boolean));
    const merged = existing.slice();
    for (const row of incoming || []) {
      if (!row || !row.tag || seen.has(row.tag)) continue;
      seen.add(row.tag);
      merged.push(row);
    }
    return merged;
  }

  return {
    normalizeQuery,
    isInvalidQuery,
    matchRank,
    matchLabel,
    rankResults,
    bestSuggestions,
    freshness,
    coverageLine,
    emptyMessage,
    mergeHits,
  };
});
