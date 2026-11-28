# PekkaDex

https://beluga-meow.github.io/ClashDex/

A fan-made Clash of Clans companion: player lookup, base library, AI attack
academy, the Clash Heroes Encyclopedia and a game-verified profile.

Unofficial. Not affiliated with, endorsed, sponsored or specifically approved
by Supercell. Art is used under the
[Supercell Fan Content Policy](https://www.supercell.com/fan-content-policy/);
there are no ads and no paywalls.

## Structure

```
index.html                     home: players, bases, attacks, heroes, account
bases.html                     Base Library (TH1–TH19 filters, categories, links)
armies.html                    Army Library (TH1–TH19 filters, compositions, plans)
heroes.html                    Clash Heroes Encyclopedia (skins + Scenery Shop)
upgrades.html                  Village Tools: time-to-max calculator + upgrade tracker
attack-guides.html             Attack Guides & Queen Walk hub + the six-stage Academy
troops.html                    Troop Library (elixir, dark, Super Troops, squads)
planner.html                   Attack Planner: manual grid, vision board, army fit score
memes.html                     Memes & Emotes gallery with a full-screen viewer
profile.html                   your profile (stats, ranked / classic history)
layouts.json                   real base/army share links in the Base Library
manifest.webmanifest           PWA manifest
service-worker.js              offline cache (must stay at the root for scope)
CHANGELOG.md                   what changed, phase by phase
docs/QA-CHECKLIST.md           manual release checks
assets/
  css/
    tokens.css                 colours, 8-pt spacing, radii, shadows, rarity, fonts
    components.css             card, chip, button, tabs, sheet, lightbox, skeleton
    heroes.css                 shared encyclopedia chrome (sitebar, panels)
    library.css                Base + Army Library filters, cards, detail sheet
    villager.css               Lady Villager guide bubble
    home.css                   home page layout on the tokens (hero, sections, finder, attacks)
    profile.css                profile page layout on the tokens
    tools.css                  Village Tools calculator, tracker and timeline
    guides.css                 Attack Guides layout
    academy.css                Attack Academy path and Town Hall picks
    troops.css                 Troop Library cards and squads
    planner.css                Attack Planner grid, palette and fit panel
    memes.css                  Memes & Emotes gallery and viewer
    heroes-extras.css          Loadouts, Pets and Guides tabs on heroes.html
  js/
    app.js                     home page: search, filters, theme, tab bar
    name-fold.js               shared name folding + match ranking (tested)
    heroes.js                  heroes page: routes, tabs, planner, galleries
    heroes-extras.js           heroes page: Loadouts / Pets / Guides tabs (lazy JSON)
    timers.js                  home page: recurring event countdowns (UTC -> local)
    upgrades.js                Village Tools: calculator + upgrade tracker
    attack-guides.js           Attack Guides page (merges armies.json)
    academy.js                 Attack Academy path + Town Hall army picks
    troops.js                  Troop Library ("seen in" parsed from army compositions only)
    planner.js                 Attack Planner grid, vision board and fit score
    memes.js                   Memes & Emotes gallery and viewer
    chrome.js                  one header drawer (13 destinations) + bottom tabs
    media.js                   global image-error silhouette fallback
    home.js                    homepage slider, events, daily pick, reveal
    install.js                 "Install app" menu entry (PWA install help)
    library.js                 bases.html + armies.html: filters, cards, details
    villager.js                Lady Villager guide (page-aware line, sign-out)
    art-data.js                generated index of shipped art (window.PDX_ART)
    equipment-levels.js        per-level wiki tables (window.PDX_EQ_LEVELS)
    attacks.js, auth.js, profile.js, profile-nav.js, supabase-config.js
  data/
    heroes.json                id, role, unlock, targets, speed, ability, verified
    equipment.json             hero, rarity, maxLevel, art, effect, verified
    skins.json                 hero, name, season, released, source, priceTier, art, verified
    sceneries.json             name, season, released, source, priceTier, art, verified
    bases.json                 th, categories, tags, Copy Base link, linkVerified
    armies.json                th range, categories, army, spells, strategy, verified
    attack-guides.json         Queen Walk (3 parts) + 5 short guides, merged with armies.json
    loadouts.json              suggested two-piece equipment pairs (verified: false)
    pets.json                  Pet House facts, L.A.S.S.I stats, pet list, pairings
    guides.json                supercharge, squads and Blacksmith notes
    events.json                PekkaDex news shown on the homepage
    memes.json                 meme and emote gallery index (repo art only)
    troops.json                troop roles, Super Troops, squads
    academy.json               six-stage Attack Academy path
  heroes/                      one portrait per hero (webp + svg)
  equipment/ skins/ sceneries/ drop-in art
  townhalls/ builder-halls/    town hall and builder hall art
  icons/                       favicon, PWA icon, nav-*.png, icons.svg sprite
tools/
  build-catalog.mjs            regenerates skins.json + sceneries.json from art
  build-bases.mjs              regenerates bases.json from layouts.json
  build-armies.mjs             regenerates armies.json from the attack records
  validate-data.mjs            data/image/reference check (fails the build)
  stamp-versions.mjs           content-hash cache busting for ?v=
  test-search.mjs              name folding + ranking tests (node --test)
  build-art-manifest.py        regenerates art-data.js
  make-banner.py               builds assets/heroes/encyclopedia-banner.webp from the portraits
  upscale-art.py               Lanczos/alpha-bleed upscale of the small source art (idempotent)
  fetch-equipment-levels.py    refreshes the wiki equipment tables
supabase/
  functions/coc/               deployed Clash of Clans proxy
  migrations/                  player name search + hero wishlist (RLS)
```

## Village Tools, Attack Guides and the encyclopedia extras

`upgrades.html` has two tabs and **no built-in Town Hall tables**: every time
and cost is typed in by the visitor. The calculator spreads builder work over
the builder count, runs the Laboratory and the "Other queue" rows in parallel,
and takes the slowest of the three as the finish time; the what-if table shows
the same builder total for 1–6 builders. The tracker keeps queued and running
upgrades in `localStorage`, plans queued items greedily onto the earliest free
builder lane, and draws a timeline (one lane per builder plus the Laboratory).
Notifications only fire while the page is open, and the page says so.

`attack-guides.html` holds the three-part Queen Walk guide and five shorter
guides. Troop lists, spells and step plans are read from `armies.json` by the
`relatedArmy` id, so the Army Library stays the single source for those facts.
`assets/data/attack-guides.json` is only the guide prose.

`heroes.html` has three extra tabs. Each one fetches its JSON on first open:
`loadouts.json` (2-piece pairings that reference real `equipment.json` ids),
`pets.json` (Pet House facts, the full L.A.S.S.I table, the other pets by name
and unlock order only) and `guides.json` (supercharge, squads, Blacksmith).
Unconfirmed records carry `"verified": false` and render an **Unverified** chip.

`tools/upscale-art.py` resamples small art with alpha bleed, a light denoise,
Lanczos scaling, two unsharp passes and a re-thresholded alpha edge. It only
ships an upscale where the UI really shows the art large: the skin sheet
(560px) and the full-screen scenery previews (800px). The equipment (400px),
scenery thumbnail (560px) and hero portrait (568px) groups still exist in the
script, but their cards render at 140–280px, so the repository keeps the
originals — running every group tripled `assets/` for no visible gain. The
default run is the two large-display groups; use `--only all` to upscale
everything deliberately, and `--quality` to trade size for sharpness. It is
idempotent and skips anything already at target size. **It cannot add detail
that is not in the source**; when the real high-resolution files arrive, drop
them in with the same names and the script will leave them alone.

## Checks

```bash
node tools/validate-data.mjs
node --test tools/test-search.mjs
node tools/stamp-versions.mjs --check
```

`validate-data.mjs` exits non-zero on a missing field, a missing image, a
duplicate id, an unknown hero/category reference or a base row without a real
Copy Base link. Run `node tools/stamp-versions.mjs` after editing any CSS/JS
that a page loads with `?v=`.

## Design system

Every page that opts in loads `tokens.css` then `components.css`. Nothing in
them paints a page-specific layout, and there is no `!important`.

- Spacing: `--s-1` 4px … `--s-8` 48px (8-point scale, 4px half step).
- Type: Lilita One for display, the system UI stack for body copy. One web font.
- Controls are at least `--tap` (44px) tall.
- Rarity colours: `--rarity-common/rare/epic/legendary`.
- Icons: `<svg class="pdx-ico"><use href="./assets/icons/icons.svg#i-name"></use></svg>`.

Every page is on the system: `index.html` adds `home.css`, `profile.html` adds
`heroes.css` (shared encyclopedia chrome) plus `profile.css`, and the two
libraries add `library.css`. The old `style.css` and `pekka.css` themes are
gone, and no page injects a stylesheet from JavaScript.

## Base Library and Army Library

`bases.html` and `armies.html` share `assets/js/library.js` and
`assets/css/library.css`. Both filter by Town Hall 1–19, category, search text
and sorting, and keep the filter state in the query string. A detail view opens
as `?base=<id>` or `?army=<id>`, with a Back button and Escape to close.

- **Bases** come from `layouts.json` through `node tools/build-bases.mjs`. Only
  rows that already had a Clash of Clans `link.clashofclans.com` Copy Base link
  are imported, and each card labels it “supplied with the project · not
  re-tested”. Town Halls without a genuine link show an honest empty state
  with a link to CocBaseFinder and no guessed URL pattern, never a made-up
  layout.
- **Armies** come from the Attack Academy records through
  `node tools/build-armies.mjs`, plus five classic farming archetypes. Siege
  machine and hero equipment are left open where no recommendation is
  confirmed. Clash of Clans has no public CopyArmy web link, so “Copy army
  list” copies the composition and plan as text.

## Lady Villager guide

`assets/js/villager.js` shows one page-aware line: the home greeting on
`index.html`, “Ready for battle, Chief?” on `armies.html`, and “Whoa! Look at
those stats!” on `profile.html`. Clicking sign out adds “Leaving already,
Chief? See you next time!” without touching the real sign-out handler.

The six expressions are in `assets/villager/`:
`Villager_info` (home greeting), `Villager_Mad` (Army Library),
`Villager_Shocked` (profile) and `Villager_pleading` (sign out).
`Villager_Crying` and `Villager_Scared` ship with the site but are not used by
a page yet. She stays still — no random expression cycling; the only motion is
the one-time fade-in. If a file is ever missing the guide falls back to a small
medallion instead of showing a broken image.

## Data layer

Six JSON files describe the archive. Every record has a `verified` flag and
the file has a `verifiedOn` date; anything the site could not confirm is
marked `verified: false` (and, where useful, `notes` or `unverified`) instead
of being invented.

- Heroes and equipment: hand-maintained, equipment level tables come from the
  wiki extract in `assets/js/equipment-levels.js`.
- Skins and sceneries: generated from the art folders by
  `node tools/build-catalog.mjs`. Season, release date, source, rarity, price
  tier and obtainability are `null` until someone reviews them; the UI says
  “Not on file yet” rather than guessing.
- Bases and armies: `bases.json` and `armies.json`, built from `layouts.json`
  and the attack records. Tactics are community recommendations, so army rows
  stay `verified: false`.
- Prices are tiers, never amounts, and no page links to a purchase.

## Player search

The site calls one Supabase Edge Function, `coc`, at project
`hrloxvshgehvkmpnnbyz`. Name search reads the shared `coc_player_index` table.

**What the index can and cannot do.** The official Clash of Clans API has no
global "find player by name" endpoint, so a name can only find players that are
already in the index. Players enter it from the official API when:

- a clan's **Members** list is opened (up to 50 players per clan, saved with
  their clan and role),
- a **player profile is opened by tag** (the Edge Function now saves that
  profile too — this source was missing and is why an opened player could never
  be found by name afterwards),
- the admin discovery script (`discover-clans.example.sh`, needs
  `PEKKADEX_DISCOVERY_KEY`) walks clan search or ranked clans.

The Player Finder shows how many players the index holds and when its newest
record was updated, so an empty result reads as "not indexed yet" rather than
"this player does not exist". It never presents unrelated players as exact
matches: each row is labelled Exact / Starts with / Contains / Similar, and
duplicate names are listed separately by player tag.

At the time of the 2026-11-28 audit the live index held **465 players** and the
reported name `janjan` was not one of them. Opening that player's clan Members
list (or their profile by tag) is what makes the name searchable; there is no
honest way to look up an arbitrary player name through the official API.

### What the current code does

- Case-, small-caps-, full-width-, accent-, punctuation- and emoji-insensitive
  matching, with numbers kept (`assets/js/name-fold.js`).
- Exact, prefix, contains and fuzzy ranking; exhaustive "exact name" filter.
- Up to 1000 rows per request, `offset`/`next_offset` pagination, and a
  `Show all` fallback for an older deployment that returns 100 rows.
- Debounced typeahead suggestions from real index rows, ranked exact → prefix
  → contains and merged from a `prefix` request plus a wider one, so a short
  prefix shows the names that start with it, not only high-trophy names that
  contain it. Index coverage and freshness, distinct states for invalid input, no match, rate limit, server
  error and not-connected, plus Retry.
- `tools/test-player-search.mjs` unit-tests the ranking and wording;
  `tools/probe-live-search.mjs` checks the deployed function against the real
  index and never invents test players.

### Deploying the search function

The deployed function is older than this repository (it reports
`result_limit: 100`, no index coverage and no `next_offset`, and it answers a
blank search with HTTP 200). To ship the current code you need a personal
access token from <https://supabase.com/dashboard/account/tokens> (starts with
`sbp_`), added under **Settings → Project settings → Secrets** as
`SUPABASE_ACCESS_TOKEN`. Then run, or ask the agent to run:

```bash
npx --yes supabase@latest functions deploy coc \
  --project-ref hrloxvshgehvkmpnnbyz

npx --yes supabase@latest db push --project-ref hrloxvshgehvkmpnnbyz
```

After the deploy, `node tools/probe-live-search.mjs` must report no failures:
`result_limit` 1000, `index_total`, `next_offset`, and HTTP 400 for a blank
search. The site keeps working with the older function until then.

### Database migrations

- `20261124000000_player_index_base.sql` — creates the tables that were made by
  hand in the hosted project (`coc_player_index`, memberships, clan index,
  `coc_api_rate_limit`) plus the rate-limit function, folding helpers, indexes
  and service-role-only RLS, so a fresh clone can be set up from this repo.
- `20261125090000_player_name_search.sql` — `pg_trgm`, folded/skeleton/codepoint
  columns, GIN indexes and the ranked `search_players()` function.
- `20261125091000_hero_wishlist.sql` — per-user cosmetic wishlist with RLS
  locked to the owner. No UI writes to it yet.
- `20261128090000_player_search_sync_fix.sql` — the final trigger, so
  `search_name` (the column the Edge Function filters on) is written on every
  insert/update, and repairs rows that lost it.

The Edge Function keeps using the service role, which bypasses RLS, so
service-role-only RLS does not change how the site searches. Any direct anon
read needs an explicit policy; see the notes in the migration.

## Dropping in art

`assets/skins/`, `assets/sceneries/` and `assets/equipment/` are drop-in
folders: name the file after the item (lower-case, words joined with `-`,
`.webp` / `.png` / `.jpg` / `.svg`), then run

```bash
node tools/build-catalog.mjs   # skins.json + sceneries.json
node tools/validate-data.mjs   # nothing missing
```

Each folder has a README with the exact names. Without a file the drawn
portrait, gradient or emoji stays, so nothing ever shows a broken image.
