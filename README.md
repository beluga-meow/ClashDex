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
    style.css, pekka.css       the older home-page theme (still in use there)
    profile.css                profile page
  js/
    app.js                     home page: search, filters, theme, tab bar
    name-fold.js               shared name folding + match ranking (tested)
    heroes.js                  heroes page: routes, tabs, planner, galleries
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
  fetch-equipment-levels.py    refreshes the wiki equipment tables
supabase/
  functions/coc/               deployed Clash of Clans proxy
  migrations/                  player name search + hero wishlist (RLS)
```

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

`heroes.html` is fully on the system. `index.html` and `profile.html` load the
tokens but still carry the older `style.css` theme.

## Base Library and Army Library

`bases.html` and `armies.html` share `assets/js/library.js` and
`assets/css/library.css`. Both filter by Town Hall 1–19, category, search text
and sorting, and keep the filter state in the query string. A detail view opens
as `?base=<id>` or `?army=<id>`, with a Back button and Escape to close.

- **Bases** come from `layouts.json` through `node tools/build-bases.mjs`. Only
  rows that already had a Clash of Clans `link.clashofclans.com` Copy Base link
  are imported, and each card labels it “supplied with the project · not
  re-tested”. Town Halls without a genuine link show an honest empty state
  that points at coc-prime and CocBaseFinder, never a made-up layout.
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
`hrloxvshgehvkmpnnbyz`. The committed version searches the shared player index
in a single SQL filter, so names match regardless of capitals, small-caps
letters, full-width letters or emoji. The currently deployed version still
walks the table and stops at 100 rows per call, which is why the site offered
**Show all matches** until this deploy is made.

You need a personal access token from
<https://supabase.com/dashboard/account/tokens> (starts with `sbp_`).

1. In this project: **Settings → Project settings → Secrets**, add
   `SUPABASE_ACCESS_TOKEN` with that token. Then ask the agent to deploy, or
   run the commands below yourself.
2. Locally, with the token in your shell (never commit it):

   ```bash
   npx --yes supabase@latest functions deploy coc \
     --project-ref hrloxvshgehvkmpnnbyz
   ```

   The CLI asks for the token the first time; or pass it non-interactively
   with `SUPABASE_ACCESS_TOKEN` set in the environment.
3. Check the function's JWT setting before trusting a change: the site calls
   it with the publishable key, which needs JWT verification left as it is
   now (default). If the deploy is followed by `401` responses, redeploy the
   same code with `--no-verify-jwt`.
4. Verify the deploy from any terminal:

   ```bash
   curl -s -X POST \
     "https://hrloxvshgehvkmpnnbyz.supabase.co/functions/v1/coc" \
     -H "apikey: <publishable key from assets/js/supabase-config.js>" \
     -H "Authorization: Bearer <publishable key>" \
     -H "content-type: application/json" \
     -d '{"action":"findPlayers","name":"ᴘᴇᴋᴋᴀ","limit":1000}'
   ```

   `result_limit` must read `1000` (not `100`) and the items must include the
   P.E.K.K.A player. Until then the site keeps searching through the older
   function with client-side folding and Town Hall paging.

### Database migrations

```bash
npx supabase db push --project-ref hrloxvshgehvkmpnnbyz
```

- `20261125090000_player_name_search.sql` — `pg_trgm`, `name_raw`,
  `name_folded`, `name_skeleton`, `name_codepoints`, sync trigger, GIN
  indexes and the ranked `search_players()` function (exact > prefix >
  substring > fuzzy, 3-character minimum).
- `20261125091000_hero_wishlist.sql` — per-user cosmetic wishlist with RLS
  locked to the owner. No UI writes to it yet.

The Edge Function keeps using the service role, which bypasses RLS, so
enabling RLS on the player index does not change how the site searches. Any
direct anon read needs an explicit policy; see the notes at the end of the
migration.

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
