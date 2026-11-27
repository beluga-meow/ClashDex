#!/usr/bin/env node
/* Builds assets/data/armies.json for the Army Library.

   The attack records already maintained in assets/js/attacks.js are the base:
   this script reads them once and writes them as data, adds library
   categories, and appends a small set of classic farming armies. Tactics and
   popularity are community recommendations, so every row is written with
   "verified": false instead of pretending to be official.

   CopyArmy links are never generated: Clash of Clans does not publish a web
   link per army, so the library copies the army list as text instead.

   Usage: node tools/build-armies.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

const CATEGORIES = [
  "Most Popular",
  "War Armies",
  "Trophy Pushing",
  "Farming",
  "Legend League",
  "Air Attacks",
  "Ground Attacks",
  "Hybrid Attacks",
  "Beginner-Friendly",
  "Event and Challenge Armies"
];

const TROPHY_PUSH = new Set([
  "mass-dragons", "hog-raid", "edrag-rush", "qc-hybrid", "root-smash", "minion-air", "hydra-root", "dragon-blimp"
]);

/* ------------------------------------------------------- read attacks.js */
const source = readFileSync(new URL("assets/js/attacks.js", ROOT), "utf8");
const start = source.indexOf("const ARMIES = [");
const end = source.indexOf("const TRAITS =", start);
if (start < 0 || end < 0) throw new Error("Could not find the ARMIES list in assets/js/attacks.js");
const listText = source.slice(source.indexOf("[", start), source.lastIndexOf("];", end) + 1);
const attacks = new Function(`"use strict"; return ${listText};`)();

const slug = value =>
  String(value || "army")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const categoriesFor = army => {
  const out = [];
  if (army.type === "Air") out.push("Air Attacks");
  if (army.type === "Ground") out.push("Ground Attacks");
  if (army.type === "Hybrid") out.push("Hybrid Attacks");
  if (army.difficulty === "Easy") out.push("Beginner-Friendly");
  if ((army.popularity || 0) >= 70) out.push("Most Popular");
  if ((army.minTh || 0) >= 12) out.push("War Armies");
  if ((army.minTh || 0) >= 14 && (army.power || 0) >= 85) out.push("Legend League");
  if (TROPHY_PUSH.has(army.id)) out.push("Trophy Pushing");
  return CATEGORIES.filter(category => out.includes(category));
};

const armies = attacks.map(army => ({
  id: army.id,
  name: army.name,
  minTh: army.minTh,
  maxTh: army.maxTh,
  categories: categoriesFor(army),
  difficulty: army.difficulty,
  type: army.type,
  army: army.comp,
  spells: army.spells,
  siege: null,
  equipment: null,
  heroes: army.heroes,
  strategy: army.plan.slice(),
  risks: army.risks.slice(),
  tags: army.tags.slice(),
  popularity: army.popularity,
  power: army.power,
  copyArmy: null,
  source: "PekkaDex Attack Academy — community recommendation",
  updated: null,
  verified: false,
  unverified: ["composition checked against the current balance", "CopyArmy link", "last-updated date"]
}));

/* --------------------------------------------------- classic farm armies */
const farming = [
  {
    id: "barch-farming",
    name: "BARCH Farming",
    minTh: 3,
    maxTh: 19,
    categories: ["Farming", "Beginner-Friendly", "Ground Attacks", "Most Popular"],
    difficulty: "Easy",
    type: "Ground",
    army: "About 50 Barbarians + 50 Archers (fill every army camp)",
    spells: "None needed; bring Lightning if you want a free storage",
    heroes: "No heroes required. Add the Barbarian King and Archer Queen once unlocked.",
    strategy: [
      "Pick a dead base with full collectors and drop Barbarians around the outside.",
      "Send Archers behind them so they reach the loot without walking through defences.",
      "End the raid as soon as the collectors are empty — trophies are not the goal."
    ],
    risks: ["Splash defences wipe the whole wave.", "Shielded bases show loot you cannot take."],
    tags: ["Farming", "Cheap"],
    popularity: 82,
    power: 40
  },
  {
    id: "goblin-knife",
    name: "Goblin Knife",
    minTh: 7,
    maxTh: 11,
    categories: ["Farming", "Ground Attacks"],
    difficulty: "Medium",
    type: "Ground",
    army: "About 80 Goblins + 8 Wall Breakers + 4 Giants",
    spells: "Jump x2, Heal x1, Rage x1",
    heroes: "Use the Barbarian King to tank the first splash defence.",
    strategy: [
      "Open the wall next to the Town Hall or the biggest storage.",
      "Jump the Goblins straight into the core — they target loot buildings first.",
      "Heal through splash and Rage the storage cluster."
    ],
    risks: ["Dies badly if the jump misses.", "Multi-target Infernos shred the pack."],
    tags: ["Farming", "Core dive"],
    popularity: 61,
    power: 52
  },
  {
    id: "sneaky-goblin-farming",
    name: "Sneaky Goblin Raid",
    minTh: 11,
    maxTh: 19,
    categories: ["Farming", "Most Popular", "Ground Attacks"],
    difficulty: "Easy",
    type: "Ground",
    army: "Sneaky Goblins filling the camps + 4 Wall Breakers",
    spells: "Jump x2, Invisibility x1",
    heroes: "Heroes stay home unless you are also going for trophies.",
    strategy: [
      "Deploy Sneaky Goblins on the storage side of the base while they are invisible.",
      "Use a Jump to reach the core storage, then Invisibility over the splash.",
      "Leave as soon as the storages are down to keep the army cheap."
    ],
    risks: ["Splash defences still catch them once visible.", "Needs the Super Troop slot free."],
    tags: ["Farming", "Super Troop"],
    popularity: 78,
    power: 55
  },
  {
    id: "miner-farming",
    name: "Mass Miner Farm",
    minTh: 10,
    maxTh: 16,
    categories: ["Farming", "Ground Attacks", "Beginner-Friendly"],
    difficulty: "Easy",
    type: "Ground",
    army: "Mass Miners (fill every camp) + 4 Wall Breakers",
    spells: "Heal x4, Rage x1",
    heroes: "Queen Walk on one side if you want the Town Hall too.",
    strategy: [
      "Send the Miners in a line so they burrow past the outer walls.",
      "Heal on top of the splash defences as the pack passes them.",
      "Rage the core if you are also chasing the Town Hall."
    ],
    risks: ["Single-target defences stall the pack.", "Bomb Towers punish the clump."],
    tags: ["Farming", "Simple"],
    popularity: 64,
    power: 60
  },
  {
    id: "super-barb-farming",
    name: "Super Barbarian Farm",
    minTh: 11,
    maxTh: 19,
    categories: ["Farming", "Ground Attacks"],
    difficulty: "Easy",
    type: "Ground",
    army: "Super Barbarians filling the camps + 8 Wall Breakers",
    spells: "Jump x2, Rage x1, Heal x1",
    heroes: "King and Queen clear one edge so the wave stays on target.",
    strategy: [
      "Funnel one edge with the heroes, then release the Super Barbarians.",
      "Jump into the storage compartment and Rage the pack.",
      "Take the 50% star and leave if the loot is already collected."
    ],
    risks: ["Splash defences end the wave quickly.", "Needs the Super Troop slot free."],
    tags: ["Farming", "Super Troop"],
    popularity: 57,
    power: 58
  }
].map(army => ({
  ...army,
  siege: null,
  equipment: null,
  copyArmy: null,
  source: "Community farming archetype — editorial",
  updated: null,
  verified: false,
  unverified: ["composition checked against the current balance", "CopyArmy link", "last-updated date"]
}));

const all = armies.concat(farming);
if (new Set(all.map(a => a.id)).size !== all.length) throw new Error("Duplicate army id");

const out = {
  schema: 1,
  verifiedOn: "2026-11-25",
  note:
    "Compositions and tactics are community recommendations, not official data. Siege machines and hero equipment are " +
    "deliberately left unset where no recommendation is confirmed. Clash of Clans has no public CopyArmy web link, " +
    "so the library copies the army as text for clan chat instead.",
  categories: CATEGORIES,
  armies: all
};

writeFileSync(new URL("assets/data/armies.json", ROOT), JSON.stringify(out, null, 2) + "\n");
console.log(`armies.json — ${all.length} armies (${farming.length} farming entries added)`);
