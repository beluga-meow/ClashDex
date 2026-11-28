# Changelog

## 2026-11-28 — Player Finder pipeline, exact matching, PWA installability

### Player Finder
- Root cause of "janjan is not found": the live shared index held about 465
  players and did not contain that name. The pipeline only indexed players
  when a clan's Members list was opened; **opening a player profile by tag
  never saved that player**, and the repository had no base schema migration.
- The `coc` Edge Function now indexes the profile returned by
  `/players/#TAG`, keeps `search_name` correct, honours the "exact name"
  filter (it was ignored before), adds `offset`/`next_offset` pagination and
  reports `index_total` + `newest_update`.
- New `supabase/migrations/20261124000000_player_index_base.sql` creates the
  four tables, the rate-limit function and indexes that only existed by hand;
  `20261128090000_player_search_sync_fix.sql` makes the trigger the final word
  on `search_name` and repairs rows missing it.
- UI: debounced suggestions from real index rows, ranked exact → prefix →
  contains and drawn from both a prefix request and a wider one, so a short
  prefix like "red" shows the Reds instead of six high-trophy names that merely
  contain it; coverage/freshness line,
  per-row match quality (Exact / Starts with / Contains / Similar), index
  freshness, distinct invalid / no-match / not-indexed / rate-limit / server
  states with Retry, and "Search a clan to index its members". After Members
  indexing, a "Search … again" button retries the failed name.
- `assets/js/player-search.js` holds the tested ranking, freshness and
  empty-state wording; `tools/test-player-search.mjs` (14 tests) and
  `tools/probe-live-search.mjs` cover it. Duplicate names stay separate by tag.

### PWA / install
- Manifest now has a stable `id`, `scope`, language, categories, 192/512 PNG
  icons and a maskable 512 icon (generated nav/gold shield artwork, not game
  art), plus an `apple-touch-icon` and a matching navy `theme-color`.
- Service worker cache bumped to `pekkadex-v26`; the offline fallback now only
  serves `index.html` for navigations, not for missing images or JSON.
- No APK exists in the repository and none is linked; the Install app entry
  keeps offering the real PWA install flow and says so.

## 2026-11-28 — Village Tools, Attack Guides, encyclopedia extras, art upscale

### Home page
- The heroes section is now a `.pdx-panel` with a new
  `assets/heroes/encyclopedia-banner.webp` (1320×480, built by
  `tools/make-banner.py` from the six portraits already in the repo), a short
  description and a centred gold “Open the Encyclopedia” button.
- New **Recurring In-Game Events** panel powered by `assets/js/timers.js`:
  Raid Weekend (Fri 07:00 → Mon 07:00 UTC), Clan Games (22nd 08:00 → 28th
  08:00 UTC), weekly League Reset (Mon 05:00 UTC) and Season End / CWL /
  Trader Refresh (1st, 08:00 UTC). Windows are computed in UTC, shown in the
  visitor's timezone, refreshed every 15 seconds, and the panel says Supercell
  can move events.
- New **Village Tools** section linking `upgrades.html`, and the Attack Academy
  heading now links **Attack Guides & Queen Walk** as well as the Army Library.

### Village Tools (`upgrades.html`, `assets/js/upgrades.js`, `assets/css/tools.css`)
- **How long to max** calculator with builders, builder/research time and cost
  boosts, an optional longest single upgrade, and add/remove rows
  (Builders | Laboratory | Other queue, d/h/m, gold, elixir, dark elixir).
  Builder work = max(total builder time × (1 − saved) ÷ builders, longest × (1 − saved));
  the lab and "Other" queues run in parallel and the finish is the slowest of
  the three. Outputs total time, finish date, per-queue times, discounted
  resources and a what-if table for 1–6 builders. “Load example numbers” is
  clearly labelled sample data; Clear resets it.
- **Upgrade Tracker** with queued/running items, progress bars, Collect,
  Start now, Remove, a greedy builder-lane planner with a timeline (one lane
  per builder plus the Laboratory), optional in-page notifications, send queue
  to the calculator, copy/restore backup JSON and a two-step Clear.
- Everything persists in `localStorage` behind try/catch. There are **no**
  built-in Town Hall costs or timers.

### Attack Guides (`attack-guides.html`, `assets/js/attack-guides.js`, `assets/data/attack-guides.json`)
- Three-part Queen Walk guide (basics, setup, running the attack) plus common
  mistakes and practice tips.
- Short guides for LavaLoon, Hog Rider Raid, Queen Charge Hybrid, Fireball
  Warden Walk and Mass Dragons. Their ids match `armies.json`; troop lists,
  spells and step plans are merged from that file so there is one source.
- Linked from `armies.html` and from the home page Attack Academy.

### Heroes Encyclopedia (`heroes.html`, `assets/js/heroes-extras.js`)
- Three new tabs routed by hash: `#loadouts/archer-queen`, `#pets`,
  `#guides/squads`. Each loads its JSON lazily.
- **Loadouts** (`loadouts.json`): 18 suggested two-piece pairs over the six
  heroes, with real `equipment.json` art and ids, a hero picker and links to
  the matching attack guide. Every card is marked as a suggestion
  (`verified: false`).
- **Pets** (`pets.json`): Pet House facts, max level by Town Hall, the full
  L.A.S.S.I stat line, the other eleven pets by name and unlock order only,
  and "which pet for which hero" suggestions. Unconfirmed records show an
  **Unverified** chip.
- **Guides** (`guides.json`): supercharge levels, squads (levels 2–5 on file,
  unknown levels left blank) and the Blacksmith / hero equipment unlock table.

### Art, tooling and housekeeping
- `tools/upscale-art.py` added. It only ships an upscale where the page really
  shows the art large: the **skin sheet** (560px, quality 82) and the
  **full-screen scenery previews** in `assets/sceneries/alternates` (800px,
  quality 86). Both use alpha bleed, light denoise, Lanczos, two unsharp
  passes and a re-thresholded alpha edge.
  Equipment cards, scenery thumbnails and hero portraits render at 140–280px,
  so those groups were reverted to their original files — upscaling them
  tripled the payload for no visible gain. The script still knows all five
  groups; its default run is the two large-display groups, and `--only all`
  remains available for a deliberate run.
  Result: `assets/` is 12 MB instead of 20 MB (the originals were 4.7 MB).
  It is idempotent and cannot add detail that the source does not have.
- `tools/make-banner.py` builds the encyclopedia banner.
- `tools/validate-data.mjs` now also checks `attack-guides.json`,
  `loadouts.json`, `pets.json` and `guides.json` (including that loadout item
  ids and guide army ids exist).
- Army Library cards now show the Town Hall artwork for the army's lowest
  Town Hall. There are still no layout screenshots in the repository, so no
  card pretends to show one.
- The home menu has an **Install app** entry (`assets/js/install.js`). There is
  no Android APK, and the sheet says so honestly; it offers the real PWA
  install route instead.
- Service worker cache bumped to `pekkadex-v25`; all new CSS/JS tags are
  cache-busted by `tools/stamp-versions.mjs`.

## 2026-11-27 — Home page and profile on the design system

### Removed the guessed coc-prime URLs
- Deleted `BASE_SOURCES` and the Town Hall browse pattern
  (`coc-prime.com/base-library/browse/hv/th{th}`) that came in from `main`. The
  pattern was never checked, so no card or empty state builds a coc-prime URL
  any more.
- The Base Library empty state and the `bases.html` note now name only
  CocBaseFinder, and say plainly that PekkaDex does not check it.

### Home page
- Deleted the injected sample base/army library from `app.js` (the fabricated
  `LAYOUTS` list, `loadLayoutsFile`, `buildLibrary` and its copy-link sheet).
  The `#bases` section is now a single panel that links to the real
  `bases.html` and `armies.html`, so nothing on the home page duplicates them.
- Rebuilt `index.html` on `tokens.css` + `components.css` with a new
  `assets/css/home.css`: wood header, sky hero, parchment panels, the account
  panel, the player/clan finder, the Attack Academy and the footer all use the
  shared tokens. The `html.cx` runtime theme and its ~420-line injected
  stylesheet are gone, as is the pre-paint spinner gate that hid the page
  until JavaScript ran.
- The Attack Academy styling moved out of `attacks.js` into `home.css`; no
  page injects CSS from JavaScript now.

### Profile page
- `profile.html` loads `tokens.css` + `components.css` and uses the shared
  `pdx-btn`, `pdx-field` and `pdx-input` components.
- `profile.css` is on the tokens. It previously referenced `--hx-title`, which
  was never defined anywhere, so every profile heading fell back to 16px body
  text; it now uses `--font-display`.

### Cleanup
- **Deleted** `assets/css/style.css` (2759 lines) and `assets/css/pekka.css`.
  No page or script references them.
- Added `pdx-btn--sky`, `pdx-btn--danger` and `pdx-btn--sm` to
  `components.css`; service worker cache bumped to `v24`.

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
