#!/usr/bin/env node
/* Generates assets/data/skins.json and assets/data/sceneries.json from the art
   that actually ships in the repo. Names come from the file names; everything
   the site cannot confirm (season, source, price tier, rarity, obtainability)
   is written as null and the record is marked "verified": false so it is clear
   what still needs review.

   Usage: node tools/build-catalog.mjs
*/
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT_SKINS = new URL("assets/data/skins.json", ROOT);
const OUT_SCENERIES = new URL("assets/data/sceneries.json", ROOT);
const GENERATED_ON = "2026-11-25";

const HEROES = [
  "barbarian-king",
  "archer-queen",
  "grand-warden",
  "royal-champion",
  "minion-prince",
  "dragon-duke",
];
const SMALL_WORDS = new Set(["of", "the", "a", "an", "and", "in", "on", "to", "for", "at", "by", "vs"]);

/* Files that are alternate crops or duplicated exports of another scenery. */
const SCENERY_SKIP = new Set([
  "classic-28autumn-29",
  "classic-28winter-29",
  "clashyconstructs",
  "fireandice",
  "frostage",
  "wastelands",
]);

function titleFromSlug(slug) {
  const parts = slug.split("-").filter(Boolean);
  let out = "";
  let letters = [];
  for (const part of parts) {
    if (part.length === 1 && /^[a-z]$/i.test(part)) { letters.push(part.toUpperCase()); continue; }
    if (letters.length) { out += letters.join("") + " "; letters = []; }
    out += part + " ";
  }
  if (letters.length) out += letters.join("");

  return out
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
      if (/^[A-Z]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/\b(\w+) 2$/, "$1 (2)");
}

function webpFiles(folder) {
  return readdirSync(new URL(folder, ROOT))
    .filter(name => name.endsWith(".webp"))
    .sort();
}

/* WebP header dimensions, so the gallery can use the largest copy of a file. */
function webpSize(path) {
  const buffer = readFileSync(path);
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return { w: 0, h: 0 };
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (type === "VP8X") return { w: 1 + buffer.readUIntLE(offset + 12, 3), h: 1 + buffer.readUIntLE(offset + 15, 3) };
    if (type === "VP8 ") return { w: buffer.readUInt16LE(offset + 14) & 0x3fff, h: buffer.readUInt16LE(offset + 16) & 0x3fff };
    if (type === "VP8L") {
      const bits = buffer.readUInt32LE(offset + 9);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    offset += 8 + size + (size % 2);
  }
  return { w: 0, h: 0 };
}

/* "map-anime-fury-scenery" and "year-of-the-snake-full" both describe the
   scenery whose id is "anime-fury" / "year-of-the-snake". */
function alternateKey(fileName) {
  return fileName.replace(/\.webp$/, "").replace(/^map-/, "").replace(/-(scenery|closeup|full)$/, "");
}

const skins = [];
for (const hero of HEROES) {
  for (const file of webpFiles("assets/skins")) {
    if (!file.startsWith(hero + "-")) continue;
    const slug = file.replace(/^\.\//, "").replace(/\.webp$/, "");
    const base = slug.slice(hero.length + 1);
    skins.push({
      id: slug,
      name: titleFromSlug(base),
      hero,
      season: null,
      released: null,
      source: null,
      rarity: null,
      priceTier: null,
      obtainable: null,
      art: `./assets/skins/${file}`,
      thumb: `./assets/skins/${file}`,
      verified: false,
      unverified: ["season", "released", "source", "rarity", "priceTier", "obtainable"],
    });
  }
}

const alternateFiles = webpFiles("assets/sceneries/alternates");

const sceneries = webpFiles("assets/sceneries")
  .filter(file => !SCENERY_SKIP.has(file.replace(/\.webp$/, "")))
  .map(file => {
    const id = file.replace(/\.webp$/, "");
    const thumb = `./assets/sceneries/${file}`;
    /* Several top-level files are 70px icons; the alternates hold a larger
       crop of the same scenery. Use the biggest copy for the full-screen
       preview and keep the top-level file as the thumbnail. */
    const candidates = [thumb].concat(
      alternateFiles
        .filter(alternate => alternateKey(alternate) === id)
        .map(alternate => `./assets/sceneries/alternates/${alternate}`)
    );
    const area = path => {
      const size = webpSize(new URL(path.replace(/^\.\//, ""), ROOT));
      return size.w * size.h;
    };
    const art = candidates.reduce((best, current) => (area(current) > area(best) ? current : best), candidates[0]);
    return {
      id,
      name: titleFromSlug(id),
      season: null,
      released: null,
      source: null,
      priceTier: null,
      art,
      thumb,
      verified: false,
      unverified: ["season", "released", "source", "priceTier"],
    };
  });

const write = (url, data) => {
  writeFileSync(url, JSON.stringify(data, null, 2) + "\n");
};

write(OUT_SKINS, {
  schema: 1,
  verifiedOn: GENERATED_ON,
  generated: true,
  note: "Generated by tools/build-catalog.mjs from assets/skins. Names and art are real. Season, source, rarity, price tier and obtainability are not confirmed yet, so they are null and every record is verified:false until reviewed.",
  skins,
});

write(OUT_SCENERIES, {
  schema: 1,
  verifiedOn: GENERATED_ON,
  generated: true,
  note: "Generated by tools/build-catalog.mjs from assets/sceneries. Names and art are real. Season, source and price tier are not confirmed yet, so they are null and every record is verified:false until reviewed.",
  sceneries,
});

console.log(`skins: ${skins.length}`);
console.log(`sceneries: ${sceneries.length}`);
