#!/usr/bin/env node
/* Tests for assets/js/player-search.js: query normalization, match ranking,
   duplicate-name handling, freshness labels, coverage text and empty states.

   Run: node --test tools/test-player-search.mjs
*/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../assets/js/name-fold.js");
const search = require("../assets/js/player-search.js");

const NOW = Date.parse("2026-11-28T12:00:00Z");

test("query normalization is case-insensitive and collapses whitespace", () => {
  assert.equal(search.normalizeQuery("  JanJan  "), "janjan");
  assert.equal(search.normalizeQuery("Jan   Jan"), "jan jan");
  assert.equal(search.normalizeQuery("JANJAN"), "janjan");
});

test("small-caps and full-width letters normalize like plain letters", () => {
  assert.equal(search.normalizeQuery("ᴊᴀɴᴊᴀɴ"), "janjan");
  assert.equal(search.normalizeQuery("ＪＡＮＪＡＮ"), "janjan");
});

test("punctuation and emoji do not break the match key", () => {
  assert.equal(search.normalizeQuery("Jan-Jan!"), "jan-jan!");
  assert.equal(search.matchRank("Jan-Jan", "jan jan"), 0);
  assert.equal(search.matchRank("⚡janjan", "JANJAN"), 0);
});

test("a query without letters or numbers is invalid", () => {
  assert.equal(search.isInvalidQuery("⚡⚡"), true);
  assert.equal(search.isInvalidQuery("   "), true);
  assert.equal(search.isInvalidQuery("janjan"), false);
});

test("exact, prefix and contains matches rank in that order", () => {
  assert.equal(search.matchRank("JANJAN", "janjan"), 0);
  assert.equal(search.matchRank("janjan123", "janjan"), 1);
  assert.equal(search.matchRank("the janjan", "janjan"), 2);
  assert.equal(search.matchRank("Barbarian", "janjan"), null);
});

test("rank labels never present a fuzzy match as exact", () => {
  assert.equal(search.matchLabel(0), "Exact name");
  assert.equal(search.matchLabel(1), "Starts with");
  assert.equal(search.matchLabel(2), "Contains");
  assert.equal(search.matchLabel(3), "Similar");
  assert.notEqual(search.matchLabel(3), "Exact name");
});

test("duplicate names with different tags are both kept, tags never merged", () => {
  const rows = [
    { name: "janjan", tag: "#AAA", trophies: 100 },
    { name: "janjan", tag: "#BBB", trophies: 900 },
  ];
  const ranked = search.rankResults(rows, "janjan");
  assert.equal(ranked.length, 2);
  assert.deepEqual(new Set(ranked.map(row => row.tag)), new Set(["#AAA", "#BBB"]));
});

test("ranking orders exact before prefix before contains, then trophies", () => {
  const rows = [
    { name: "the janjan", tag: "#3", trophies: 9000 },
    { name: "janjan123", tag: "#2", trophies: 10 },
    { name: "JANJAN", tag: "#1", trophies: 5 },
    { name: "Barbarian", tag: "#4", trophies: 9999 },
  ];
  const ranked = search.rankResults(rows, "janjan");
  assert.deepEqual(ranked.map(row => row.tag), ["#1", "#2", "#3", "#4"]);
});

test("large result sets keep every row and stay ordered", () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({
    name: i % 2 ? "janjan" + i : "xjanjan" + i,
    tag: "#" + i,
    trophies: i,
  }));
  const ranked = search.rankResults(rows, "janjan");
  assert.equal(ranked.length, 250);
  assert.equal(new Set(ranked.map(row => row.tag)).size, 250);
  assert.equal(search.matchRank(ranked[0].name, "janjan"), 1);
});

test("suggestions prefer exact and prefix names over high-trophy substring hits", () => {
  const rows = [
    { name: "Redhawk", tag: "#4", trophies: 5400 },
    { name: "redemption", tag: "#3", trophies: 5200 },
    { name: "Red", tag: "#2", trophies: 100 },
    { name: "Red", tag: "#1", trophies: 50 },
    { name: "Barbarian", tag: "#5", trophies: 9999 },
  ];
  const picked = search.bestSuggestions(rows, "red", 6);
  assert.deepEqual(picked.map(row => row.name), ["Red", "Red", "Redhawk", "redemption"]);
  assert.equal(search.bestSuggestions(rows, "red", 2).length, 2);
  assert.ok(!picked.some(row => row.name === "Barbarian"));
});

test("suggestions never repeat a tag and never fill the list with non-matches", () => {
  const rows = [
    { name: "Red", tag: "#A", trophies: 10 },
    { name: "Red", tag: "#A", trophies: 10 },
    { name: "Unrelated", tag: "#B", trophies: 9000 },
  ];
  const picked = search.bestSuggestions(rows, "red", 6);
  assert.deepEqual(picked.map(row => row.tag), ["#A"]);
  assert.deepEqual(search.bestSuggestions([], "red", 6), []);
});

test("mergeHits paginates without duplicating a player tag", () => {
  const first = [{ tag: "#A", name: "one" }];
  const merged = search.mergeHits(first, [{ tag: "#A", name: "one" }, { tag: "#B", name: "two" }]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(row => row.tag), ["#A", "#B"]);
});

test("freshness describes real timestamps and stays silent when unknown", () => {
  assert.equal(search.freshness("2026-11-28T11:59:30Z", NOW), "just now");
  assert.equal(search.freshness("2026-11-28T11:40:00Z", NOW), "20 min ago");
  assert.equal(search.freshness("2026-11-28T09:00:00Z", NOW), "3 hours ago");
  assert.equal(search.freshness("2026-11-25T12:00:00Z", NOW), "3 days ago");
  assert.equal(search.freshness("", NOW), "");
  assert.equal(search.freshness("not a date", NOW), "");
});

test("coverage line shows the index size and freshness", () => {
  assert.equal(
    search.coverageLine(465, "2026-11-28T11:00:00Z", NOW),
    "Shared index: 465 players · newest record updated 1 hour ago"
  );
  assert.equal(search.coverageLine(1, null, NOW), "Shared index: 1 player");
  assert.equal(search.coverageLine(null, null, NOW), "");
});

test("empty state explains indexing instead of claiming the player does not exist", () => {
  const message = search.emptyMessage("janjan", { total: 465, newest: "2026-11-28T11:00:00Z" }, NOW);
  assert.match(message, /No indexed player name matches "janjan"/);
  assert.match(message, /465 players/);
  assert.match(message, /Members list/);
  assert.doesNotMatch(message, /does not exist/i);
});

test("empty state without coverage still gives the indexing path", () => {
  const message = search.emptyMessage("janjan", {}, NOW);
  assert.match(message, /No indexed player name matches/);
  assert.match(message, /Members list/);
});
