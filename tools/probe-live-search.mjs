#!/usr/bin/env node
/* Live probe of the deployed `coc` Edge Function.

   It does not invent data: it reads the real shared index through the same
   public key the site uses and checks the invariants the UI depends on.

   Checks
   - an invalid (blank) search is rejected with 400;
   - every returned name really matches the query (no fabricated matches);
   - "exact" only returns players whose folded name equals the query;
   - a second page never repeats a player tag;
   - the response exposes index coverage and paging fields.

   The last two need the current Edge Function deployment; on an older
   deployment they are reported as WARN (stale function) instead of FAIL.

   Run: node tools/probe-live-search.mjs
*/
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../assets/js/name-fold.js");
const search = require("../assets/js/player-search.js");

const config = readFileSync(new URL("../assets/js/supabase-config.js", import.meta.url), "utf8");
const url = config.match(/createClient\(\s*"([^"]+)"/)?.[1];
const key = config.match(/createClient\(\s*"[^"]+",\s*"([^"]+)"/)?.[1];

if (!url || !key) {
  console.error("Could not read the Supabase URL/key from assets/js/supabase-config.js");
  process.exit(1);
}

const endpoint = url.replace(/\/$/, "") + "/functions/v1/coc";
let failures = 0;
let warnings = 0;

const pass = text => console.log("  PASS  " + text);
const warn = text => { warnings++; console.log("  WARN  " + text); };
const fail = text => { failures++; console.log("  FAIL  " + text); };

async function call(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key, authorization: "Bearer " + key },
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  return { http: response.status, payload };
}

async function find(name, extra) {
  const res = await call({ action: "findPlayers", name, limit: 1000, ...extra });
  const data = res.payload?.data || {};
  return { http: res.http, status: res.payload?.status, data, items: Array.isArray(data.items) ? data.items : [] };
}

console.log("PekkaDex live player-search probe — " + new Date().toISOString());

const blank = await call({ action: "findPlayers", name: "   " });
if (blank.http === 400) pass("blank search rejected with HTTP 400");
else fail("blank search returned HTTP " + blank.http + " instead of 400");

const broad = await find("a", { limit: 25 });
if (broad.http === 200 && broad.items.length) pass("broad search returned " + broad.items.length + " rows");
else fail("broad search did not return rows (HTTP " + broad.http + ")");

const query = "a";
const mismatched = broad.items.filter(row => search.matchRank(row.name, query) == null);
if (!mismatched.length) pass("every returned row really matches the query");
else fail("returned rows that do not match: " + mismatched.map(row => row.name).join(", "));

const exactName = broad.items.find(row => search.normalizeQuery(row.name).length >= 3)?.name || "";
if (exactName) {
  const exact = await find(exactName, { exact: true, limit: 50 });
  const wrong = exact.items.filter(row => search.matchRank(row.name, exactName) !== 0);
  if (exact.http === 200 && exact.items.length && !wrong.length) {
    pass("exact search for " + JSON.stringify(exactName) + " returned " + exact.items.length + " exact row(s)");
  } else if (exact.http === 200 && !exact.items.length) {
    warn("exact search returned no rows for a row in the index (older function ignores exact?)");
  } else {
    fail("exact search returned rows that are not exact: " + wrong.map(row => row.name).join(", "));
  }
} else {
  warn("index had no usable sample name for the exact-match check");
}

if (typeof broad.data.index_total === "number") {
  pass("index coverage reported: " + broad.data.index_total + " players, newest " + (broad.data.newest_update || "unknown"));
} else {
  warn("response has no index_total — the deployed Edge Function is older than this repository");
}

if (broad.data.next_offset != null) {
  const second = await find(query, { limit: 25, offset: broad.data.next_offset });
  const firstTags = new Set(broad.items.map(row => row.tag));
  const overlap = second.items.filter(row => firstTags.has(row.tag));
  if (!overlap.length) pass("second page contains no duplicate player tags");
  else fail("pagination repeated " + overlap.length + " player tag(s)");
} else {
  warn("response has no next_offset — pagination needs the current Edge Function");
}

const janjan = await find("janjan");
console.log("\nReported query \"janjan\": " + janjan.items.length + " match(es)" +
  (typeof janjan.data.index_total === "number" ? " in an index of " + janjan.data.index_total : ""));
console.log("  Scope note: the official API has no global name search, so only indexed players can be found.");

console.log("\n" + (failures ? "FAILED" : "OK") + " — " + failures + " failure(s), " + warnings + " warning(s)");
process.exit(failures ? 1 : 0);
