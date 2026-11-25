# PekkaDex

https://beluga-meow.github.io/ClashDex/

A fan-made Clash of Clans companion: player lookup, base library, AI attack
academy, the Clash Heroes Encyclopedia and a game-verified profile.

## Structure

```
index.html                 home: players, bases, attacks, heroes, account
heroes.html                Clash Heroes Encyclopedia
profile.html               your profile (stats, ranked / classic history)
layouts.json               real base/army share links shown in the Base Library
manifest.webmanifest       PWA manifest
service-worker.js          offline cache (must stay at the root for scope)
assets/
  css/                     style, pekka, heroes, profile
  js/                      app, attacks, auth, profile, heroes, supabase config
  heroes/                  one portrait per hero + heroes.svg archive banner
  equipment/               equipment icons (drop-in)
  skins/                   hero skin art (drop-in)
  sceneries/               scenery art (drop-in)
  townhalls/               th-2 … th-19
  builder-halls/           bh3 … bh10
  icons/                   favicon + PWA icon + UI icons
  data/                    art-manifest.json, season.json, skins.json, build-manifest.json
  js/art-data.js           generated index of the art that ships (window.PDX_ART)
tools/build-art-manifest.py  regenerates the art index after adding files
supabase/functions/coc/    deployed Clash of Clans proxy
```

## Deploying the player search function

The site calls one Supabase Edge Function, `coc`, at project
`hrloxvshgehvkmpnnbyz`. The committed version searches the shared player
index in a single SQL filter, so names match regardless of capitals,
small-caps letters, full-width letters or emoji. The currently deployed
version still walks the table and stops at 100 rows per call, which is why
the site offers **Show all matches** until this deploy is made.

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

## Dropping in art

`assets/skins/`, `assets/sceneries/` and `assets/equipment/` are drop-in
folders: name the file after the item (lower-case, words joined with `-`,
`.webp` / `.png` / `.jpg` / `.svg`), then run
`python3 tools/build-art-manifest.py` to refresh the index. Each folder has a
README with the exact names. Without a file the drawn portrait, gradient or
emoji stays, so nothing ever shows a broken image.
