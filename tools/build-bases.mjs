#!/usr/bin/env node
/* Builds assets/data/bases.json from the project's layouts.json.

   Only home-village layouts that already carry a real in-game link are
   imported. Nothing is invented: missing Town Halls simply have no entries
   and the Base Library says so instead of filling the gap with sample cards.

   Usage: node tools/build-bases.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const source = JSON.parse(readFileSync(new URL("layouts.json", ROOT), "utf8"));
const rows = Array.isArray(source) ? source : source.layouts || [];

const CATEGORY_LABELS = {
  "War": "War",
  "Farming": "Farming",
  "Trophy": "Trophy",
  "Hybrid": "Hybrid",
  "Anti-3-Star": "Anti-3-Star",
  "Anti-Air": "Anti-Air",
  "Anti-Ground": "Anti-Ground",
  "Progress Base": "Progress Base"
};

const slug = (value, fallback) => {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
};

const isCopyLink = link =>
  /^https:\/\/link\.clashofclans\.com\/[a-z]{2,}\?action=OpenLayout&id=/i.test(String(link || ""));

const used = new Set();
const bases = [];

for (const row of rows) {
  if (!row || row.kind !== "base") continue;
  const th = Number(row.th);
  if (!(th >= 1 && th <= 19)) continue; /* Builder Hall and Capital layouts are not TH bases */
  if (!isCopyLink(row.link)) continue; /* never import a card without a real link */

  const tag = String(row.tag || "").trim();
  const categories = [];
  const main = CATEGORY_LABELS[row.cat];
  if (main) categories.push(main);
  if (/anti[- ]?3|anti 3 stars/i.test(tag) && !categories.includes("Anti-3-Star")) categories.push("Anti-3-Star");
  if (/anti[- ]?air|lavaloon|anti air/i.test(tag) && !categories.includes("Anti-Air")) categories.push("Anti-Air");
  if (/anti[- ]?ground/i.test(tag) && !categories.includes("Anti-Ground")) categories.push("Anti-Ground");
  if (/legend/i.test(tag) && !categories.includes("Trophy")) categories.push("Trophy");
  if (!categories.length) categories.push("War");

  let id = slug(`${row.name}-th${th}`, `base-th${th}`);
  if (used.has(id)) id += "-" + (used.size + 1);
  used.add(id);

  bases.push({
    id,
    name: String(row.name || `TH${th} layout`).trim(),
    th,
    categories,
    tags: tag ? [tag] : [],
    note: String(row.note || "").trim() || null,
    link: row.link,
    linkType: "copy-base",
    /* The link shipped with the project, but this pass did not open it in the
       game, so the card must not claim it was re-tested. */
    linkVerified: false,
    source: "Project layouts.json",
    added: row.added ? String(row.added) : null,
    updated: row.updated ? String(row.updated) : null,
    verified: false,
    unverified: ["link tested in game", "layout screenshot", "release notes"]
  });
}

bases.sort((a, b) => b.th - a.th || a.name.localeCompare(b.name));

const out = {
  schema: 1,
  verifiedOn: "2026-11-25",
  note:
    "Imported from layouts.json. Each entry keeps the in-game Copy Base link that shipped with the project; " +
    "this archive cannot open the game, so links are labelled as supplied rather than re-tested. Town Halls with " +
    "no genuine link stay empty on purpose.",
  categories: [
    "War",
    "Farming",
    "Trophy",
    "Hybrid",
    "Anti-3-Star",
    "Anti-Air",
    "Anti-Ground",
    "Progress Base"
  ],
  bases
};

writeFileSync(new URL("assets/data/bases.json", ROOT), JSON.stringify(out, null, 2) + "\n");
console.log(`bases.json — ${bases.length} layouts across ${new Set(bases.map(b => b.th)).size} Town Halls`);
