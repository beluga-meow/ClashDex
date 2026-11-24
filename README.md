# PekkaDex

https://beluga-meow.github.io/ClashDex/

A fan-made Clash of Clans companion: player lookup, base library, AI attack
academy, the Clash Heroes Encyclopedia and a game-verified profile.

## Structure

```
index.html                 home: players, bases, attacks, heroes, account
heroes.html                Clash Heroes Encyclopedia
profile.html               your profile (stats, ranked / classic history)
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

## Dropping in art

`assets/skins/`, `assets/sceneries/` and `assets/equipment/` are drop-in
folders: name the file after the item (lower-case, words joined with `-`,
`.webp` / `.png` / `.jpg` / `.svg`), then run
`python3 tools/build-art-manifest.py` to refresh the index. Each folder has a
README with the exact names. Without a file the drawn portrait, gradient or
emoji stays, so nothing ever shows a broken image.
