#!/usr/bin/env node
/* Re-points every catalog entry at art that is actually in the repo.

   Why this exists: the catalogs (skins.json, sceneries.json, equipment.json,
   pets.json) were generated from folders that have since been reorganised
   (assets/sceneries, assets/equipment and the old lowercase skin names are
   gone), so every card requested a 404 and the browser painted alt text.

   Matching is name-based but forgiving in the ways real file names are messy:

   - CamelCase and joined words are split, so "DarkAges_23" gives dark + ages
     and "ClashARama" gives clash + a + rama.
   - Plurals, one-letter typos, prefixes and words embedded in a longer word
     ("king" in "barbarianking") count as a match.
   - A joined spelling is checked as a whole, so "Frost Age" finds
     "FrostAge_25_Scenery".
   - File names with spaces or "&" are included; the stored path is
     URL-encoded so it stays valid in src and url().

   It is still conservative about identity: a file that carries the marker of
   a different hero is never used for a hero skin or equipment (so an Archer
   Queen item can never borrow a Barbarian King picture). When nothing matches,
   the path is null and the UI draws the themed silhouette instead of
   inventing a picture. Run it after adding new art:

     node tools/rebuild-art-paths.mjs [--dry] [--verbose]

   `--dry` prints the report without writing; `--verbose` also lists which
   file each entry resolved to. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry");
const verbose = process.argv.includes("--verbose");
const SKIP_DIRS = new Set([".git", "node_modules", "docs", "shots", "supabase", "tools", "assets/icons"]);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(rel) || SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), acc);
    } else if (/\.(webp|png|jpg|jpeg)$/i.test(entry.name)) {
      acc.push(rel);
    }
  }
  return acc;
}

/* Every picture on disk, including names with spaces and punctuation. */
const images = walk(root);

/* Paths are stored ready for an <img src> or url(): each segment encoded. */
const urlFor = rel => "./" + rel.split("/").map(encodeURIComponent).join("/");

/* ------------------------------------------------------------ words */

/* Split on separators, CamelCase boundaries and letter/digit boundaries.
   "HeroEquipment_MP_IronPants" -> hero equipment mp iron pants
   "ClashARama"                 -> clash a rama
   "Scenery_Fire_&_Ice"         -> scenery fire ice                    */
function words(value) {
  return String(value)
    .replace(/\.(webp|png|jpe?g)$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

const compact = value => words(value).join("");

/* Filler words the catalog itself uses (they say nothing about which skin or
   scenery it is). Deliberately short: words like "shadow" are a kind of skin
   and must still count when the entry name asks for one. */
const NAME_STOP = new Set(["the", "a", "an", "of", "and", "with", "hero", "skin", "scenery", "icon", "ingame", "equipment", "hv", "coc"]);

/* Filler words in file names, and numbers that are pose/size markers. */
const STOP = new Set([
  "the", "a", "an", "of", "and", "with", "no", "without", "final", "new", "full",
  "hero", "skin", "scenery", "icon", "icons", "ingame", "screenshot", "equipment",
  "equipement", "gear", "hg", "hvg", "fbx", "bg", "pose", "posing", "render",
  "shadow", "shadows", "noshadow", "noshadows", "grass", "ground", "grounds",
  "groundshadow", "groundshadows", "nogroundshadow", "nogroundshadows",
  "hv", "coc", "heroic", "hd", "xl", "clean", "original", "overview", "showcase",
  "central", "area", "teaser", "complete", "recreation", "poster", "reference",
  "2k", "3k", "4k", "6k", "min", "max", "px",
]);

const isMeta = token => STOP.has(token) || /^\d+$/.test(token);

/* Names whose catalog spelling differs from the art file's spelling. Only
   pairs that name the same object are listed, and the hero guard still has to
   agree. */
const NAME_ALIASES = {
  metal: ["iron"],
  henchmen: ["henchman"],
  macha: ["mecha"],
};

/* Hero identity markers. Short in-game codes and full names are decisive;
   role words are only used when a file has no code at all, because
   "champion" appears in several heroes' skin names. */
const HERO_CODES = {
  "barbarian-king": ["bk", "barbarianking", "barbarian"],
  "archer-queen": ["aq", "bq", "archerqueen", "archer"],
  "grand-warden": ["gw", "grandwarden"],
  "royal-champion": ["rc", "royalchampion"],
  "minion-prince": ["mp", "minionprince"],
  "dragon-duke": ["dd", "dragonduke", "draganduke"],
};
const HERO_ROLES = {
  "barbarian-king": ["king"],
  "archer-queen": ["queen"],
  "grand-warden": ["warden"],
  "royal-champion": [],
  "minion-prince": ["prince"],
  "dragon-duke": ["duke", "dragon"],
};

const fileTokens = new Map();
const fileInfo = file => {
  let info = fileTokens.get(file);
  if (!info) {
    /* "NoShadow" / "withShadow" describe how the render was made, so they
       must not make a file look like a shadow-themed skin. */
    const base = path.basename(file).replace(/(?:no|without|with)[ _-]?shadows?/gi, " ");
    const primary = words(base);
    const primarySet = new Set(primary);
    const codes = new Set();
    for (const [heroId, list] of Object.entries(HERO_CODES)) {
      if (list.some(marker => primarySet.has(marker))) codes.add(heroId);
    }
    if (!codes.size) {
      for (const [heroId, list] of Object.entries(HERO_ROLES)) {
        if (list.some(marker => primarySet.has(marker))) codes.add(heroId);
      }
    }
    /* A render suffix at the very end ("_shadow", "_grass") describes the
       export, not the skin's name, so hero items ignore that last word. The
       same word in the middle ("Shadow_King") is part of the name. */
    const RENDER = /^(?:shadows?|grass|groundshadows?)$/;
    const named = primary.filter(token => !/^\d+$/.test(token) && (!STOP.has(token) || RENDER.test(token)));
    const last = named[named.length - 1];
    const trimmed = new Set(primarySet);
    if (last && RENDER.test(last)) trimmed.delete(last);
    info = { set: primarySet, trimmed, compact: primary.join(""), heroes: codes };
    fileTokens.set(file, info);
  }
  return info;
};

const heroAllowed = (file, heroId) => {
  if (!heroId) return true;
  const info = fileInfo(file);
  if (!info.heroes.size) return true;
  return info.heroes.has(heroId);
};

const singular = word => word.replace(/(?:ies|es|s)$/, match => (match === "ies" ? "y" : ""));

const editDistanceOne = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
    return diff === 1;
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0, j = 0, skipped = 0; i < long.length; i++) {
    if (short[j] === long[i]) j++;
    else if (skipped++) return false;
  }
  return true;
};

/* How well one wanted word is covered by one file word: 3 exact, then
   plurals, embedded words and prefixes, down to 1 for a near miss. */
function wordQuality(wanted, have, variants) {
  if (wanted === have) return 3;
  if (variants && variants.includes(have)) return 2.6;
  const ws = singular(wanted), hs = singular(have);
  if (ws === hs && ws.length >= 4) return 2.5;
  /* "noshadow" is a render note, not a shadow-themed skin. */
  if (have === "no" + wanted || have === "no" + wanted + "s") return 0;
  if (have.length > wanted.length && have.includes(wanted) && wanted.length >= 4) return 2.2;
  /* A shorter file word inside a longer wanted word only counts when they are
     nearly the same word ("portal" in "portalpanic"), never for a short stem
     that merely starts the name ("pose" in "poseidon"). */
  if (wanted.length > have.length && wanted.includes(have) && have.length >= 5 &&
      have.length >= wanted.length * 0.75) return 2;
  if (have.startsWith(wanted) && wanted.length >= 5) return 2;
  if (wanted.length >= 6 && editDistanceOne(wanted, have)) return 1.5;
  return 0;
}

function find(name, { pool = images, heroId = null, prefer = [], avoid = ["icon"], keepRenderWords = false } = {}) {
  const raw = words(name);
  if (!raw.length) return null;
  let wanted = raw.filter(word => !NAME_STOP.has(word));
  if (!wanted.length) wanted = raw;
  if (!wanted.length) return null;
  const joined = wanted.join("");
  const variantsOf = word => NAME_ALIASES[word] || [];

  const scored = [];
  for (const file of pool) {
    if (!heroAllowed(file, heroId)) continue;
    const info = fileInfo(file);
    const tokensInFile = keepRenderWords ? info.set : info.trimmed;
    let score = 0;
    let matchedAll = true;
    for (const word of wanted) {
      let best = 0;
      for (const have of tokensInFile) best = Math.max(best, wordQuality(word, have, variantsOf(word)));
      if (!best) matchedAll = false;
      score += best;
    }
    /* Joined spellings cover the whole name even when the file writes it as
       one word ("FrostAge", "ClashARama"). */
    if (!matchedAll && joined.length >= 4 && info.compact.includes(joined)) {
      matchedAll = true;
      score += wanted.length * 2.6;
    }
    if (!matchedAll) continue;

    const extras = [...tokensInFile].filter(token => !isMeta(token) &&
      !wanted.some(word => wordQuality(word, token, variantsOf(word)) > 0));
    score -= Math.min(extras.length, 6) * 0.35;

    const basename = path.basename(file).toLowerCase();
    const preferred = prefer.filter(word => basename.includes(word)).length;
    score += preferred * 0.8;
    if (avoid.some(word => basename.includes(word))) score -= 1.2;
    /* Root-level promo art is usually the cleanest 4k render; a modest bump
       keeps it ahead of a near-duplicate in a subfolder. */
    if (!file.includes("/")) score += 0.3;

    scored.push({ file, score, extras: extras.length });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score || a.extras - b.extras ||
    a.file.length - b.file.length || a.file.localeCompare(b.file));
  return urlFor(scored[0].file);
}

/* Pools keep a picture of the right kind from being picked just because a
   meme or a scene happens to share a word with the entry name. */
const skinPool = images.filter(file => file.startsWith("assets/skins/") ||
  /(^|\/)(AQ|BK|GW|RC|DD|MP|Hero_Skin|ArcherQueen|BarbarianKing|GrandWarden|RoyalChampion|Royal_Champion|MinionPrince|DragonDuke|AnimeFury|Anime_)/i.test(file));
const sceneryPool = images.filter(file => /scenery/i.test(file));

const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const write = (file, data) => {
  if (dry) return;
  fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + "\n");
};
const report = { skins: [0, 0], sceneries: [0, 0], equipment: [0, 0], pets: [0, 0] };
const changes = [];

const assign = (label, entry, art) => {
  if (art && entry.art !== art) changes.push(`${label}: ${entry.name} -> ${art}`);
  entry.art = art;
  entry.artMissing = !art;
};

/* ---------------------------------------------------------------- skins */
const skinsFile = "assets/data/skins.json";
const skins = read(skinsFile);
for (const skin of skins.skins) {
  const art = find(skin.name, { pool: skinPool, heroId: skin.hero });
  assign("skin", skin, art);
  skin.thumb = art;
  report.skins[art ? 0 : 1]++;
}
write(skinsFile, skins);

/* ------------------------------------------------------------ sceneries */
const sceneriesFile = "assets/data/sceneries.json";
const sceneries = read(sceneriesFile);
for (const scenery of sceneries.sceneries) {
  const pool = sceneryPool.length ? sceneryPool : images;
  const thumb = find(scenery.name, { pool, prefer: ["icon"], keepRenderWords: true });
  /* Full art prefers the in-game screenshot; the icon is only a fallback,
     because an icon blown up to a lightbox looks broken even when it loads. */
  const full = find(scenery.name, { pool, prefer: ["ingame", "screenshot"], avoid: [], keepRenderWords: true });
  const fullIsIcon = full && /icon/i.test(full.split("/").pop() || "");
  assign("scenery", scenery, full && !fullIsIcon ? full : (thumb || full));
  scenery.thumb = thumb;
  report.sceneries[scenery.art ? 0 : 1]++;
}
write(sceneriesFile, sceneries);

/* ------------------------------------------------------------ equipment */
const equipmentFile = "assets/data/equipment.json";
const equipment = read(equipmentFile);
const gearPool = images.filter(file => file.startsWith("assets/coc/hero-equipment/") || /equipment|gearg|hg_/i.test(path.basename(file)));
for (const item of equipment.equipment) {
  const art = find(item.name, { pool: gearPool.length ? gearPool : images, heroId: item.hero, prefer: ["equipment", "gearg", "hg"] });
  assign("gear", item, art);
  report.equipment[art ? 0 : 1]++;
}
write(equipmentFile, equipment);

/* ----------------------------------------------------------------- pets */
const petsFile = "assets/data/pets.json";
const pets = read(petsFile);
const petPool = images.filter(file => /pet_|pet[ _-]|HV_/i.test(path.basename(file)));
for (const pet of pets.pets) {
  const name = pet.name.replace(/L\.A\.S\.S\.I/i, "LASSI");
  assign("pet", pet, find(name, { pool: petPool.length ? petPool : images, avoid: [] }));
  report.pets[pet.art ? 0 : 1]++;
}
if (pets.featured) pets.featured.art = (pets.pets.find(pet => pet.id === pets.featured.id) || {}).art || null;
write(petsFile, pets);

/* ------------------------------------------------------------ art-data.js
   The homepage used to load a generated window.PDX_ART map of paths that no
   longer exist. Regenerate it from the same mapping so it can be used as a
   lookup, and keep every value path-relative to the site root. */
const artData = {
  heroes: Object.fromEntries(read("assets/data/heroes.json").heroes.map(hero => [hero.id, hero.art])),
  skins: Object.fromEntries(skins.skins.map(skin => [skin.id, skin.art])),
  sceneries: Object.fromEntries(sceneries.sceneries.map(scenery => [scenery.id, scenery.art])),
  equipment: Object.fromEntries(equipment.equipment.map(item => [item.id, item.art])),
  pets: Object.fromEntries(pets.pets.map(pet => [pet.id, pet.art])),
};
if (!dry) {
  fs.writeFileSync(path.join(root, "assets/js/art-data.js"),
    "/* Generated by tools/rebuild-art-paths.mjs — do not edit by hand.\n" +
    "   Every value is a path that exists in this repo, or null when the art\n" +
    "   is not on file yet (the UI draws a silhouette for null). */\n" +
    "window.PDX_ART = " + JSON.stringify(artData, null, 2) + ";\n");
}

const line = (label, [ok, missing]) =>
  `  ${label.padEnd(10)} ${String(ok).padStart(4)} matched   ${String(missing).padStart(4)} without art`;
console.log(`Art paths ${dry ? "(dry run)" : "rewritten"} from ${images.length} images on disk:`);
for (const [label, stats] of Object.entries(report)) console.log(line(label, stats));
if (verbose) {
  console.log(`\n${changes.length} assignment${changes.length === 1 ? "" : "s"} differ from the catalogs:`);
  for (const change of changes) console.log("  " + change);
}
