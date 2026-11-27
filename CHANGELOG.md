# Changelog

## 2026-11-26 — Base Library, Army Library, Lady Villager guide, Scenery Shop

### Base Library (`bases.html`)
- **Added** a dedicated page with Town Hall 1–19 filter tiles, the eight requested categories (War, Farming, Trophy, Hybrid, Anti-3-Star, Anti-Air, Anti-Ground, Progress Base), search and three sort orders.
- **Added** a detail view per layout with the Copy Base link, an Open link button, the source and an explicit “what is not verified” block. Filters live in the query string; `?base=<id>` opens one layout.
- **Added** `assets/data/bases.json` and `tools/build-bases.mjs`. Only the 18 home-village rows in `layouts.json` that already carried a genuine `link.clashofclans.com` Copy Base link were imported. TH1–TH8 and TH19 have no link on file, so they show an honest empty state with links to coc-prime and CocBaseFinder instead of invented layouts.
- Each card labels its link “supplied with the project · not re-tested”; the pass did not open the game, so nothing claims to be re-verified.

### Army Library (`armies.html`)
- **Added** a page with Town Hall range filtering (1–19), all ten requested categories, search and sorting, plus a detail view listing army, spells, siege machine, heroes/equipment, the attack plan, risks and source.
- **Added** `assets/data/armies.json` and `tools/build-armies.mjs`: 17 records ported from the Attack Academy data and five classic farming archetypes (BARCH, Goblin Knife, Sneaky Goblins, Mass Miners, Super Barbarians) — 22 armies total.
- No fake CopyArmy links: the game has no public per-army web link, so “Copy army list” copies the composition and plan as text. Siege machine and equipment stay open where no recommendation is confirmed.
- Event and Challenge armies are a filter category with an honest empty state — no verified composition is on file yet.

### Lady Villager guide
- **Added** `assets/js/villager.js` and `assets/css/villager.css`: one stationary portrait with one page-aware line — greeting on the home page, “Ready for battle, Chief?” on `armies.html`, “Whoa! Look at those stats!” on `profile.html`, and the pleading farewell when sign-out is clicked (the real sign-out is never blocked or delayed).
- The guide floats above the mobile tab bar, fades in once, can be dismissed, and remembers the dismissal for the session. It never covers the header or the tab bar.
- The six `Villager_*.webp` expressions were uploaded to the repository root during this work and are now in `assets/villager/`. The guide uses `info` for the welcome, `Mad` for the Army Library, `Shocked` for the profile and `pleading` for the farewell. It deliberately does not cycle expressions every few seconds: the brief asks for a stationary guide, so the only motion is the one-time fade-in. The medallion remains as a fallback if a file goes missing.

### Home page encyclopedia cleanup
- The Clash Heroes Encyclopedia section now contains exactly a title and one “Open the Encyclopedia” button. The injected archive card, hero chips and shortcut cards are gone from `app.js`; every page and all cosmetics remain available on `heroes.html`.
- Base and Attack sections link out to the new full libraries (`bases.html`, `armies.html`) while keeping their existing teaser content.

### Skins and Scenery Shop
- Skin details now list release date and availability alongside hero, season, price tier and rarity, each saying “Not on file yet” when unknown, and include a Back to skins button. Every skin card was already clickable; the count is 173.
- The sceneries tab is presented as a Scenery Shop: “STEP 1 · PICK A SCENERY”, one card per scenery (73), a full-screen matching preview with release date and price only when known, and a Back to Scenery Shop button.
- `released` is now part of the skin/scenery schema (`null` until reviewed).

### Checks and data
- `validate-data.mjs` now also validates `bases.json` and `armies.json`: Town Hall ranges, category references, unique ids/links, real Copy Base link format, non-empty strategies, and that `copyArmy` stays null.
- New build scripts: `tools/build-bases.mjs`, `tools/build-armies.mjs`.

## 2026-11-25 — design system, data layer, heroes encyclopedia, search groundwork

### Phase 1 — design system cleanup
- **Added** `assets/css/tokens.css`: colours, an 8-point spacing scale (`--s-1` … `--s-8`), radii, shadows, rarity colours, one display font (Lilita One) and one body font (system stack). `--tap: 44px` is the minimum tap target.
- **Added** `assets/css/components.css`: one card (fixed `aspect-ratio`, lazy image, consistent frame), chip, button, tab, bottom sheet, lightbox, skeleton, field, empty state, status text and the shared `.cx-tabbar` mobile bar.
- **Added** `assets/icons/icons.svg`: a 16-symbol stroke icon sprite. No UI emoji remain on the heroes page; the brand, header buttons, stat icons, auth emblems, event symbols, modal icon and proof avatars on the home page now use the sprite. The nav PNG icons from the last change are untouched.
- **Rewrote** `assets/css/heroes.css` on top of the tokens and components. No `!important`, no second copy of the theme.
- **Earlier in the day:** removed `assets/js/clashvault.js` and `assets/js/pekka.js` — nothing referenced them (grep clean, no script tags).
- The old dark-green `style.css` theme is still loaded on `index.html` and `profile.html`. It is now layered *under* the tokens/components rather than being replaced; see “Unfinished”.

### Phase 2 — data layer
- **Added** `assets/data/heroes.json`, `equipment.json`, `skins.json`, `sceneries.json` with a schema version, `verifiedOn` date and a `verified` flag on every record.
  - 6 heroes, 30 equipment pieces (rarity, max level, owner), 173 skins, 73 sceneries.
  - Skins and sceneries are generated from the art that ships in the repo, so names and art are real; season, source, rarity, price tier and obtainability are `null` and the record is `verified: false`.
  - Hero/equipment metadata the site could not confirm (Royal Champion targets, Minion Prince unlock, Dragon Duke as a whole) is marked `verified: false` with a `notes` explanation.
- **Added** `tools/build-catalog.mjs` — regenerates `skins.json` and `sceneries.json` from `assets/skins` and `assets/sceneries` (skips alternate crops and duplicate exports).
- **Added** `tools/validate-data.mjs` — fails on a missing field, a missing image, a duplicate id or an unknown hero reference. Current run: `data ok — 6 heroes, 30 equipment, 173 skins, 73 sceneries, 0 warning(s)`.
- Prices are price tiers only (`priceTier`), never exact money.

### Phase 3 — heroes encyclopedia (`heroes.html`)
- Hero index is a uniform grid of real portraits; each card opens a detail view instead of one long page.
- Detail view: hero art, role, unlock, targets, speed, counts, an honest verified/unverified chip, and four proper tabs — Overview, Abilities, Equipment, Skins (`aria-controls`, `aria-labelledby`, roving `tabindex`, Arrow/Home/End keys, `hidden` panels).
- Deep links: `heroes.html#hero/barbarian-king`, `#hero/barbarian-king/skins`, plus legacy `#barbarian-king`. The chosen tab lives in the hash.
- Equipment cards show the rarity border, level range and a collapsed per-level wiki table (the existing `equipment-levels.js` data).
- **Loadout planner**: pick two pieces per hero, see both effects listed together. It deliberately does not add numbers — the game's stacking is not published in the archive.
- Skeletons while loading, an error state with retry, a `<noscript>` message and a static six-hero fallback list so the page is never blank.

### Phase 4 — skins and sceneries
- Uniform gallery with search, hero/source/season/rarity filters (a filter only appears when the data has values for it, and the page says so), live result count, empty state and skeletons.
- Skin tap opens a bottom sheet: large art, hero, season, how to get it, price tier, “In-game price varies by region”, no buy button, focus trap, Escape to close, focus returned to the card.
- Scenery tap opens a full-screen preview: image, title, X button, details line. No fake base overlay and no buy button.
- `supabase/migrations/20261125091000_hero_wishlist.sql` creates the per-user wishlist table with RLS policies (owner-only select/insert/update/delete). The UI is not wired to it yet.

### Phase 5 — player finder groundwork
- **Added** `supabase/migrations/20261125090000_player_name_search.sql`: `pg_trgm`, `name_raw`, `name_folded`, `name_skeleton`, `name_codepoints`, a sync trigger, GIN trigram + prefix + Town Hall indexes, and `search_players()` ranked exact → prefix → substring → fuzzy with a 3-character minimum.
- **Added** `assets/js/name-fold.js` (shared fold/skeleton/codepoint/ranking) and `tools/test-search.mjs` (11 tests, all passing). `app.js` now uses the shared folder with its old inline version as a fallback.
- **Fixed** the stale “Show all” state: every new player or clan search resets the pending page and bumps a token, so a slow “Show all” pass can never paint over a newer search.
- The new Edge Function code is still **not deployed** — see “Unfinished”.

### Phase 6 — quality
- Pinned `@supabase/supabase-js` to `2.119.2` with a verified `sha384` integrity hash on `heroes.html`.
- **Added** `tools/stamp-versions.mjs`: replaces manual `?v=N` with a content hash, `--check` mode for CI.
- Heroes page: meta description, canonical URL, Open Graph/Twitter tags, JSON-LD `WebPage`, manifest link, skip link, visible Fan Content Policy disclaimer, reduced-motion support, 44px controls.
- **Added** `docs/QA-CHECKLIST.md`.

## Unfinished / next
- Supabase Edge Function deploy, the SQL migrations and the new search columns are not applied to the project yet.
- Wishlist/collection tracker UI and the share card are not built (table + RLS only).
- `index.html` and `profile.html` still carry the older `style.css` theme; the tokens are available but those pages were not rebuilt.
- Decorative illustration emoji on the home page (castle, loot tags, army icons) are still emoji; only UI chrome was converted.
- Scenery preview has no “sample base” overlay — the reference screenshots show one, but compositing game art without a verified source was out of scope.
- Empty `assets/data/equipment-levels.json` and `season.json` were left as they were.
- `assets/js/heroes-encyclopedia.js` is still unreferenced (it was already dead before this change; it was not in the deletion list).
