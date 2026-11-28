# PekkaDex engineering report — 2026-11-28

Scope of this pass: the Player Finder pipeline, its schema reproducibility, the
search UI, PWA installability, and an audit of the remaining directive phases.
Nothing was deployed and nothing was pushed; the changes are committed locally
only.

## 1. What was diagnosed

The reported symptom was:

> No players in the shared index matched "janjan".

Live calls to the deployed `coc` Edge Function (public publishable key from
`assets/js/supabase-config.js`) established the facts:

| Probe | Live result |
| --- | --- |
| `findPlayers` name `janjan` | HTTP 200, `total: 0` |
| `findPlayers` name `e` | `total: 222`, 100 rows returned, `result_limit: 100` |
| `findPlayers` name `JanJan` / `JANJAN` | 0 matches (the index simply lacks the name) |
| `findPlayers` name `jan` | 1 real match: "athenna jane" (partial) |
| blank name | HTTP 200 (repo code already returns 400; deployment is stale) |
| `getClanMembers #LPQ2VPJ2` | 35 members returned and saved |
| after that, exact search for a member | found by tag, correct |

Conclusions:

1. **Coverage was the cause, not the error message.** The live index held
   roughly 465 players and `janjan` was not among them. The official API has no
   global player-name search, so no code change can conjure an unindexed player.
2. **A whole indexing source was missing.** Players entered the index only when
   someone opened a clan's Members list (or the admin discovery script ran).
   Opening a player profile by tag — the most direct way a user contributes a
   player — never wrote that player to the index.
3. **The deployed function is older than the repository.** It caps at 100 rows,
   exposes no index coverage and no pagination cursor, ignores the exact-name
   flag, and accepts blank searches. Every repository fix below needs a deploy
   to take effect live.
4. **The repository was not reproducible.** `coc_player_index`,
   `coc_player_clan_memberships`, `coc_clan_index` and the
   `consume_coc_api_rate_limit()` function existed only in the hosted project;
   there was no base migration that could create them.

## 2. Changes implemented

### Indexing

- `indexPlayerProfile()` in `supabase/functions/coc/index.ts` upserts the
  profile returned by the official `/players/#TAG` route (name, folded search
  name, Town Hall, trophies, current clan) without wiping a role written by a
  clan-membership save.
- The player proxy path calls it after a successful response; failures are
  logged, never reported as success, and never break the profile response.
- Clan Members indexing and the admin discovery actions are unchanged and were
  verified live (50 members saved for `#Y0GQV22U`, 35 for `#LPQ2VPJ2`).

### Search correctness

- The exact-name checkbox is now enforced server-side on the folded name
  (`textKey === queryText`), not ignored.
- Added a prefix match rank between exact and contains, so ranking is exact →
  prefix → contains → similar.
- `updated_at` is returned per row; `index_total` and `newest_update` describe
  coverage; `offset` / `next_offset` paginate large result sets.
- Index statistics are cached for 60 s per isolate so typeahead does not run two
  extra count queries on every keystroke.
- SQL errors return 503 with a message the UI can distinguish from "no match".

### Schema

- `supabase/migrations/20261124000000_player_index_base.sql`: idempotent base
  schema (four tables, rate-limit function, folding helpers, trigram/prefix
  indexes, service-role-only RLS) so a fresh project can be built from the repo.
- `supabase/migrations/20261128090000_player_search_sync_fix.sql`: final
  `pdx_player_index_sync()` trigger that maintains `search_name`, plus a repair
  pass for rows written by the older function.

### UI (`assets/js/app.js`, `assets/js/player-search.js`, `assets/css/home.css`)

- Debounced (450 ms) suggestions from real index rows, min 3 characters,
  keyboard-dismissable, click to search.
- Coverage line: "Shared index: N players · newest record updated …".
- Rows show match quality (Exact name / Starts with / Contains / Similar), TH,
  clan, trophies, role and index freshness; duplicate names stay separate rows
  keyed by tag.
- Empty state explains that the player may not be indexed yet and offers
  "Search again" and "Search a clan to index its members". It no longer implies
  the player does not exist.
- Distinct failure states: offline/not-connected, rate limit, server error, 503
  index unavailable, invalid input — each with Retry where retrying helps.
- After a Member list is saved, a "Search \"…\" again" button retries the last
  failed name.
- Pagination: "Load more" via `next_offset`; Town Hall paging retained for the
  older deployment that caps at 100 rows.
- `findInIndex` passes limit/offset and maps 400/429/503 to specific messages.

### PWA

- Manifest: `id`, `scope`, `lang`, categories, 192/512 PNG icons, maskable 512
  icon, matching navy theme/background.
- New generated icons (navy shield + gold rim + geometric P) at
  `assets/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; SVG icon
  retained. `apple-touch-icon` added to `index.html`.
- Service worker cache `pekkadex-v26`; offline fallback only for navigation
  requests, so a missing image/JSON is no longer answered with HTML.
- APK: verified again that no `.apk` exists in the repository and no link
  pretends one does. The "Install app" entry offers the real PWA flow.

## 3. Bugs found and fixed

| Bug | Status |
| --- | --- |
| Profile-by-tag never added the player to the index | Fixed (needs deploy) |
| "Exact name" filter ignored by the Edge Function | Fixed (needs deploy) |
| No offset pagination; wide matches were truncated client-side | Fixed (needs deploy) |
| Empty state implied the player does not exist | Fixed (live now) |
| No visibility into index coverage/freshness | Fixed (needs deploy) |
| Base schema, rate-limit function and rate-limit table missing from migrations | Fixed |
| `search_name` not maintained by the 25 Nov trigger | Fixed |
| Manifest lacked 512/maskable icons and scope | Fixed |
| Offline fallback returned HTML for any failed GET | Fixed |
| Deployed function accepts blank search (200) | Repository already correct; live instance stale — **not fixed live** |

## 4. Tests executed and actual results

| Command | Result |
| --- | --- |
| `node --test tools/test-player-search.mjs` | 14 tests, 14 pass, 0 fail |
| `node --test tools/test-search.mjs` | 11 pass, 0 fail |
| `node tools/validate-data.mjs` | data ok — 6 heroes, 30 equipment, 173 skins, 73 sceneries, 18 bases, 22 armies, 0 warnings |
| `node tools/stamp-versions.mjs --check` | cache-busters ok |
| `node --check` on every touched JS + esbuild parse of the Edge Function | pass |
| `node tools/probe-live-search.mjs` | 1 failure, 2 warnings — all three caused by the stale deployed function (blank search 200; no `index_total`; no `next_offset`) |
| Browser (390×844, live function): search `janjan` | Correct empty state, no page errors, 0 px horizontal overflow |
| Browser: typeahead `red` | Real suggestions (`Red`, `Red`, `redhawk`) |
| Browser: suggestion → results | 3 rows, duplicate "Red" kept by tag, chips "Exact name"/"Starts with", 0 px overflow |
| Browser: clan `#Y0GQV22U` → Members | 50 members loaded and saved to the shared index |
| Browser: 1024 px layout (finder, 50 member rows) | 0 px horizontal overflow |

Image/asset integrity and the previously verified A–E features were not
re-tested here; this pass did not change them.

## 5. Player Finder coverage and limitations

- Live index at audit: **465 players**. Verification then saved 50 members of
  clan `#Y0GQV22U` (the 35-member clan probed earlier was already indexed), so
  the index grew by those players, not by a crawl.
- `janjan` is still not findable, because that player is not in the index. If
  you know the player's clan tag, search the clan (clan tab) and press
  **Members**, then retry the name; if you have the player tag, open the profile
  once and the name becomes searchable after the new function is deployed.
- No source of "every player worldwide" exists in the official API. The UI now
  states coverage instead of claiming universal discovery.
- Search results are ranked per page and deduplicated by tag; a name shared by
  several players lists each tag separately.

## 6. Remaining issues and directive phases not completed

- **Deployment blocked.** `SUPABASE_ACCESS_TOKEN` is not set in this chat, so the
  Edge Function and migrations cannot be deployed from here. Until then the live
  site uses the old function: no coverage line, no server-side exact filter, no
  offset paging (the Town Hall fallback covers that), and blank search still
  returns 200.
- **Live APK** remains impossible without an Android build pipeline; none exists
  in this repository.
- **Emotes & Memes (phase 8):** the repository contains no emote or meme
  assets (`find` for emote/meme returns nothing), so the section was not built
  rather than filled with invented images.
- **Complete UI/UX redesign (phase 8):** not attempted. A full redesign of every
  page is a separate, larger change than this repair pass and would risk the
  verified features; the current tokens already use navy/blue, gold and
  game-style panels.
- **Data accuracy (phase 4):** the existing `verified` flags and validator are
  in place; every record was not independently re-checked against Supercell
  values in this pass. Community tactics stay `verified: false`.
- **Attack Academy expansion (phase 7):** the six existing guides remain; the
  larger per-Town-Hall catalogue requested in the directive was not added.
- The wider layout was checked at 1024 px for horizontal overflow only (0 px); a
  pixel-level review at 1280 px was not taken.

## 7. Deployment status

- Local commit only; **not pushed, not deployed** (per the directive).
- Required next steps, once a token is available:
  1. `npx supabase functions deploy coc --project-ref hrloxvshgehvkmpnnbyz`
  2. `npx supabase db push --project-ref hrloxvshgehvkmpnnbyz`
  3. `node tools/probe-live-search.mjs` → expect 0 failures.
- The static site itself still deploys cleanly to GitHub Pages; no build step,
  no new dependencies, no secrets in client code.
