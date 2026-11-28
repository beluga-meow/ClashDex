#!/usr/bin/env node
/* Validates the PekkaDex data layer. Exits non-zero on a missing field, a
   missing image or a broken reference, so a bad data edit fails before deploy.

   Usage: node tools/validate-data.mjs
*/
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const errors = [];
const warnings = [];

const read = name => {
  try {
    return JSON.parse(readFileSync(new URL(`assets/data/${name}`, ROOT), "utf8"));
  } catch (error) {
    errors.push(`${name}: cannot be read as JSON (${error.message})`);
    return null;
  }
};

const fileExists = path => {
  if (!path) return false;
  if (/^https?:/i.test(path)) return true;
  const clean = path.replace(/^\.\//, "").split("?")[0];
  return existsSync(new URL(clean, ROOT));
};

const need = (where, obj, keys) => {
  for (const key of keys) {
    if (obj[key] === undefined) errors.push(`${where}: missing "${key}"`);
  }
};
const needImage = (where, path) => {
  if (!path) { errors.push(`${where}: missing image path`); return; }
  if (!fileExists(path)) errors.push(`${where}: image not found at ${path}`);
};
const checkMeta = (where, record) => {
  if (!("verified" in record)) errors.push(`${where}: missing "verified" flag`);
  if (record.verified === false && !record.notes && !record.unverified) {
    warnings.push(`${where}: verified:false without a note about what is unconfirmed`);
  }
};

/* ---------------------------------------------------------------- heroes */
const heroes = read("heroes.json");
const heroIds = new Set();
if (heroes) {
  if (!heroes.verifiedOn) errors.push("heroes.json: missing verifiedOn");
  if (!Array.isArray(heroes.heroes) || !heroes.heroes.length) errors.push("heroes.json: heroes[] is empty");
  for (const hero of heroes.heroes || []) {
    const where = `heroes.json/${hero.id || "?"}`;
    need(where, hero, ["id", "name", "role", "unlock", "targets", "speed", "bio", "ability", "art"]);
    if (!hero.id) continue;
    if (heroIds.has(hero.id)) errors.push(`${where}: duplicate id`);
    heroIds.add(hero.id);
    needImage(where, hero.art);
    if (hero.artSvg) needImage(where, hero.artSvg);
    if (hero.ability) need(`${where}.ability`, hero.ability, ["name", "text", "verified"]);
    checkMeta(where, hero);
  }
}

/* ------------------------------------------------------------- equipment */
const equipment = read("equipment.json");
const equipmentIds = new Set();
if (equipment) {
  if (!equipment.verifiedOn) errors.push("equipment.json: missing verifiedOn");
  for (const item of equipment.equipment || []) {
    const where = `equipment.json/${item.id || "?"}`;
    need(where, item, ["id", "name", "hero", "rarity", "maxLevel", "art", "effect"]);
    if (!equipmentIds.has(item.id)) equipmentIds.add(item.id);
    else errors.push(`${where}: duplicate id`);
    if (!heroIds.has(item.hero)) errors.push(`${where}: unknown hero "${item.hero}"`);
    if (!["Common", "Epic"].includes(item.rarity)) errors.push(`${where}: rarity must be Common or Epic`);
    if (!Number.isInteger(item.maxLevel) || item.maxLevel < 1) errors.push(`${where}: maxLevel must be a positive integer`);
    needImage(where, item.art);
    if (item.effect) need(`${where}.effect`, item.effect, ["text", "verified"]);
    checkMeta(where, item);
  }
}

/* ------------------------------------------------------------------ skins */
const skins = read("skins.json");
if (skins) {
  if (!skins.verifiedOn) errors.push("skins.json: missing verifiedOn");
  if (!Array.isArray(skins.skins)) errors.push("skins.json: skins[] must be an array");
  const seen = new Set();
  for (const skin of skins.skins || []) {
    const where = `skins.json/${skin.id || "?"}`;
    need(where, skin, ["id", "name", "hero", "season", "source", "priceTier", "art", "thumb", "obtainable", "verified"]);
    if (seen.has(skin.id)) errors.push(`${where}: duplicate id`);
    seen.add(skin.id);
    if (!heroIds.has(skin.hero)) errors.push(`${where}: unknown hero "${skin.hero}"`);
    needImage(where, skin.art);
    needImage(where, skin.thumb);
    checkMeta(where, skin);
  }
}

/* -------------------------------------------------------------- sceneries */
const sceneries = read("sceneries.json");
if (sceneries) {
  if (!sceneries.verifiedOn) errors.push("sceneries.json: missing verifiedOn");
  if (!Array.isArray(sceneries.sceneries)) errors.push("sceneries.json: sceneries[] must be an array");
  const seen = new Set();
  for (const scenery of sceneries.sceneries || []) {
    const where = `sceneries.json/${scenery.id || "?"}`;
    need(where, scenery, ["id", "name", "season", "source", "priceTier", "art", "thumb", "verified"]);
    if (seen.has(scenery.id)) errors.push(`${where}: duplicate id`);
    seen.add(scenery.id);
    needImage(where, scenery.art);
    needImage(where, scenery.thumb);
    checkMeta(where, scenery);
  }
}

/* ------------------------------------------------------ base + army library */
const bases = read("bases.json");
if (bases) {
  if (!bases.verifiedOn) errors.push("bases.json: missing verifiedOn");
  if (!Array.isArray(bases.bases)) errors.push("bases.json: bases[] must be an array");
  if (!Array.isArray(bases.categories) || !bases.categories.length) errors.push("bases.json: categories[] is empty");
  const seen = new Set();
  const links = new Set();
  for (const base of bases.bases || []) {
    const where = `bases.json/${base.id || "?"}`;
    need(where, base, ["id", "name", "th", "categories", "link", "source", "verified"]);
    if (!base.id) continue;
    if (seen.has(base.id)) errors.push(`${where}: duplicate id`);
    seen.add(base.id);
    if (!(base.th >= 1 && base.th <= 19)) errors.push(`${where}: th must be 1-19`);
    if (!Array.isArray(base.categories) || !base.categories.length) errors.push(`${where}: categories[] is empty`);
    for (const category of base.categories || []) {
      if (bases.categories && !bases.categories.includes(category)) errors.push(`${where}: unknown category "${category}"`);
    }
    if (!/^https:\/\/link\.clashofclans\.com\/[a-z]{2,}\?action=OpenLayout&id=/i.test(base.link || "")) {
      errors.push(`${where}: not a Clash of Clans Copy Base link`);
    }
    if (links.has(base.link)) errors.push(`${where}: duplicate link`);
    links.add(base.link);
    checkMeta(where, base);
  }
}

const armies = read("armies.json");
const armyIds = new Set();
if (armies) {
  if (!armies.verifiedOn) errors.push("armies.json: missing verifiedOn");
  if (!Array.isArray(armies.armies)) errors.push("armies.json: armies[] must be an array");
  if (!Array.isArray(armies.categories) || !armies.categories.length) errors.push("armies.json: categories[] is empty");
  const seen = new Set();
  for (const army of armies.armies || []) {
    const where = `armies.json/${army.id || "?"}`;
    need(where, army, ["id", "name", "minTh", "maxTh", "categories", "difficulty", "army", "spells", "heroes", "strategy", "source", "verified"]);
    if (!army.id) continue;
    if (seen.has(army.id)) errors.push(`${where}: duplicate id`);
    seen.add(army.id);
    armyIds.add(army.id);
    if (!(army.minTh >= 1 && army.minTh <= 19)) errors.push(`${where}: minTh must be 1-19`);
    if (!(army.maxTh >= army.minTh && army.maxTh <= 19)) errors.push(`${where}: maxTh must be between minTh and 19`);
    if (!Array.isArray(army.categories) || !army.categories.length) errors.push(`${where}: categories[] is empty`);
    for (const category of army.categories || []) {
      if (armies.categories && !armies.categories.includes(category)) errors.push(`${where}: unknown category "${category}"`);
    }
    if (!["Easy", "Medium", "Hard"].includes(army.difficulty)) errors.push(`${where}: difficulty must be Easy, Medium or Hard`);
    if (!Array.isArray(army.strategy) || !army.strategy.length) errors.push(`${where}: strategy[] is empty`);
    if (army.copyArmy) errors.push(`${where}: copyArmy must stay null — there is no public CopyArmy web link`);
    checkMeta(where, army);
  }
}

/* ------------------------------------------------------- attack guide hub */
const attackGuides = read("attack-guides.json");
if (attackGuides) {
  if (!attackGuides.verifiedOn) errors.push("attack-guides.json: missing verifiedOn");
  if (!Array.isArray(attackGuides.guides) || !attackGuides.guides.length) {
    errors.push("attack-guides.json: guides[] is empty");
  }
  const seen = new Set();
  for (const guide of attackGuides.guides || []) {
    const where = `attack-guides.json/${guide.id || "?"}`;
    need(where, guide, ["id", "title", "lede", "verified"]);
    if (!guide.id) continue;
    if (seen.has(guide.id)) errors.push(`${where}: duplicate id`);
    seen.add(guide.id);
    if (guide.relatedArmy && !armyIds.has(guide.relatedArmy)) {
      errors.push(`${where}: relatedArmy "${guide.relatedArmy}" is not in armies.json`);
    }
    if (guide.id === "queen-walk" && (!Array.isArray(guide.parts) || guide.parts.length < 3)) {
      errors.push(`${where}: the Queen Walk guide needs three parts`);
    }
    checkMeta(where, guide);
  }
}

/* --------------------------------------------------------------- loadouts */
const loadouts = read("loadouts.json");
if (loadouts) {
  if (!loadouts.verifiedOn) errors.push("loadouts.json: missing verifiedOn");
  const seen = new Set();
  for (const loadout of loadouts.loadouts || []) {
    const where = `loadouts.json/${loadout.id || "?"}`;
    need(where, loadout, ["id", "hero", "name", "bestFor", "reason", "items", "verified"]);
    if (!loadout.id) continue;
    if (seen.has(loadout.id)) errors.push(`${where}: duplicate id`);
    seen.add(loadout.id);
    if (!heroIds.has(loadout.hero)) errors.push(`${where}: unknown hero "${loadout.hero}"`);
    if (!Array.isArray(loadout.items) || loadout.items.length !== 2) {
      errors.push(`${where}: a loadout needs exactly two item ids`);
    }
    for (const itemId of loadout.items || []) {
      if (!equipmentIds.has(itemId)) errors.push(`${where}: "${itemId}" is not in equipment.json`);
    }
    if (loadout.guide && attackGuides) {
      const guideIds = new Set((attackGuides.guides || []).map(guide => guide.id));
      if (!guideIds.has(loadout.guide)) errors.push(`${where}: unknown guide "${loadout.guide}"`);
    }
    checkMeta(where, loadout);
  }
}

/* -------------------------------------------------------------------- pets */
const pets = read("pets.json");
if (pets) {
  if (!pets.verifiedOn) errors.push("pets.json: missing verifiedOn");
  if (!pets.petHouse) errors.push("pets.json: missing petHouse");
  if (!Array.isArray(pets.pets) || pets.pets.length !== 12) {
    errors.push(`pets.json: pets[] should list 12 pets (found ${(pets.pets || []).length})`);
  }
  if (pets.featured) need("pets.json/featured", pets.featured, ["id", "name", "facts", "verified"]);
  const petIds = new Set((pets.pets || []).map(pet => pet.id));
  for (const pet of pets.pets || []) {
    const where = `pets.json/${pet.id || "?"}`;
    need(where, pet, ["id", "name", "unlock", "order", "verified"]);
    if (pet.verified === false && !pet.notes && !pet.detail) {
      errors.push(`${where}: an unverified pet needs a note saying what is missing`);
    }
  }
  for (const pairing of pets.pairings?.items || []) {
    if (!heroIds.has(pairing.hero)) errors.push(`pets.json/pairings: unknown hero "${pairing.hero}"`);
    for (const petId of pairing.petIds || []) {
      if (!petIds.has(petId)) errors.push(`pets.json/pairings: unknown pet "${petId}"`);
    }
  }
}

/* --------------------------------------------------------- building guides */
const guides = read("guides.json");
if (guides) {
  if (!guides.verifiedOn) errors.push("guides.json: missing verifiedOn");
  if (!Array.isArray(guides.sections) || !guides.sections.length) errors.push("guides.json: sections[] is empty");
  for (const section of guides.sections || []) {
    need(`guides.json/${section.id || "?"}`, section, ["id", "name", "verified"]);
  }
}

/* ---------------------------------------------------------------- report */
for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  console.error(`\n${errors.length} data error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  `data ok — ${heroes?.heroes?.length || 0} heroes, ${equipment?.equipment?.length || 0} equipment, ` +
  `${skins?.skins?.length || 0} skins, ${sceneries?.sceneries?.length || 0} sceneries, ` +
  `${bases?.bases?.length || 0} bases, ${armies?.armies?.length || 0} armies, ` +
  `${warnings.length} warning(s)`
);
