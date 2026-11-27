#!/usr/bin/env node
/* Replaces every local ?v=N cache-buster in the HTML pages with a short hash of
   the file's current content, so a deploy never serves stale CSS or JS.

   Usage: node tools/stamp-versions.mjs            (checks and rewrites)
          node tools/stamp-versions.mjs --check    (exit 1 if anything is stale)
*/
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../", import.meta.url);
const CHECK_ONLY = process.argv.includes("--check");
const pages = readdirSync(ROOT).filter(name => name.endsWith(".html"));
const stale = [];
let stamped = 0;

const hashOf = relPath => {
  const url = new URL(relPath.replace(/^\.\//, "").split("?")[0], ROOT);
  if (!existsSync(url)) return null;
  return createHash("sha256").update(readFileSync(url)).digest("hex").slice(0, 8);
};

for (const page of pages) {
  const path = new URL(page, ROOT);
  const original = readFileSync(path, "utf8");
  let next = original.replace(
    /((?:href|src)="\.\/[^"?]+)\?v=[^"]*"/g,
    (match, before) => {
      const file = before.replace(/^.*="?/, "");
      const hash = hashOf(before.slice(before.indexOf("./")));
      if (!hash) return match;
      const replacement = `${before}?v=${hash}"`;
      if (replacement !== match) { stamped++; stale.push(`${page}: ${file}`); }
      return replacement;
    }
  );

  if (!CHECK_ONLY && next !== original) writeFileSync(path, next);
  if (CHECK_ONLY && next !== original) { /* recorded above */ }
}

if (CHECK_ONLY && stale.length) {
  console.error(`${stale.length} stale cache-buster(s):`);
  for (const item of stale) console.error(`  - ${item}`);
  console.error("Run: node tools/stamp-versions.mjs");
  process.exit(1);
}
console.log(CHECK_ONLY ? "cache-busters ok" : `stamped ${stamped} reference(s) across ${pages.length} page(s)`);
