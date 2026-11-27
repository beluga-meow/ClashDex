#!/usr/bin/env node
/* Tests for the shared name folding and match ranking in
   assets/js/name-fold.js — the same rules the site and the SQL migration use.

   Run: node --test tools/test-search.mjs
*/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const name = require("../assets/js/name-fold.js");

test("small-caps letters fold to plain letters", () => {
  assert.equal(name.foldName("ᴘᴇᴋᴋᴀ"), "pekka");
  assert.equal(name.foldName("ᴄʜɪᴇꜰ"), "chief");
});

test("full-width letters fold to plain letters", () => {
  assert.equal(name.foldName("ＰＥＫＫＡ"), "pekka");
});

test("accents and combining marks are removed", () => {
  assert.equal(name.foldName("Máximo"), "maximo");
  assert.equal(name.foldName("M\u0301aximo"), "maximo");
});

test("emoji, punctuation and spaces are removed from the match key", () => {
  assert.equal(name.foldName("⚡ ᴄʜɪᴇꜰ!"), "chief");
  assert.equal(name.foldName("P.E.K.K.A"), "pekka");
});

test("numbers survive folding because they are part of the name", () => {
  assert.equal(name.foldName("PEKKA 99"), "pekka99");
  assert.notEqual(name.foldName("PEKKA99"), name.foldName("PEKKA"));
});

test("skeleton keeps letters only and codepoints describe the raw name", () => {
  assert.equal(name.skeleton("PEKKA 99"), "pekka");
  assert.equal(name.codepoints("A⚡"), "65 9889");
});

test("ranking puts exact before prefix before contains", () => {
  const query = "pekka";
  assert.equal(name.rankScore("PEKKA", query), 0);
  assert.equal(name.rankScore("Pekka Jr", query), 1);
  assert.equal(name.rankScore("The Pekka", query), 2);
  assert.equal(name.rankScore("Pekka99", query), 1);
  assert.equal(name.rankScore("Barbarian", query), 4);
});

test("skeleton-only matches rank after substring matches", () => {
  assert.equal(name.rankScore("PEKKA99", "PEKKA"), 1);
  assert.equal(name.rankScore("PEKKA99", "99"), 2);
});

test("rankMatches orders exact, prefix, contains, then no match", () => {
  const rows = [
    { name: "Barbarian", tag: "#1" },
    { name: "My Pekka", tag: "#2" },
    { name: "Pekka Jr", tag: "#3" },
    { name: "PEKKA", tag: "#4" },
  ];
  assert.deepEqual(
    name.rankMatches(rows, "pekka").map(row => row.tag),
    ["#4", "#3", "#2", "#1"]
  );
});

test("rankMatches sorts equal ranks alphabetically and then by tag", () => {
  const rows = [
    { name: "Pekka B", tag: "#20" },
    { name: "Pekka A", tag: "#11" },
    { name: "Pekka A", tag: "#10" },
  ];
  assert.deepEqual(
    name.rankMatches(rows, "pekka").map(row => row.tag),
    ["#10", "#11", "#20"]
  );
});

test("an empty query never matches", () => {
  assert.equal(name.rankScore("PEKKA", "   "), 4);
  assert.deepEqual(name.rankMatches([{ name: "PEKKA", tag: "#1" }], "⚡").map(row => row.tag), ["#1"]);
});
