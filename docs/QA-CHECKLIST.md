# PekkaDex manual QA checklist

Run before a release. Tick what you actually checked; anything unticked is
unverified, not “probably fine”.

## Automated (run these first)

```bash
node tools/validate-data.mjs          # data layer: fields, images, references
node --test tools/test-search.mjs     # name folding + match ranking
node tools/stamp-versions.mjs --check # no stale ?v= cache busters
node --check assets/js/heroes.js      # syntax
node --check assets/js/library.js     # syntax
node --check assets/js/villager.js    # syntax
```

## Heroes page

- [ ] `heroes.html` on a 360px phone: six hero cards, two per row, no horizontal scroll.
- [ ] Bottom tab bar shows six icons, **Heroes** highlighted, and does not cover the footer.
- [ ] Tap a hero: detail view opens, URL ends `#hero/<id>`, browser back returns to the grid.
- [ ] Reload a `#hero/barbarian-king/skins` link in a fresh tab: the Skins tab is already open.
- [ ] With the keyboard: Tab to the tab strip, ArrowRight/ArrowLeft move between tabs, Home/End jump to the ends.
- [ ] Screen reader announces each tab as “selected” and each panel by its tab label.
- [ ] Equipment tab: two picks fill both slots, other buttons disable, Remove frees a slot.
- [ ] Details under each equipment card expand and the table scrolls instead of the page.
- [ ] Royal Champion / Minion Prince / Dragon Duke show the “Not verified yet” chip.
- [ ] Cosmetics: search narrows the grid, count updates, Clear filters restores it.
- [ ] “zzzz” shows the empty state, not a blank panel.
- [ ] Skin sheet: large art, “In-game price varies by region”, no buy link, Escape closes, focus returns to the card.
- [ ] Scenery preview: full-screen art, title, X closes.
- [ ] JavaScript disabled: the noscript hero list and disclaimer still read fine.
- [ ] Slow 3G: skeleton cards show while the four JSON files load.

## Home page

- [ ] Header, stat icons, auth emblems and modal icon are SVG, not emoji.
- [ ] Nav PNG icons still load at desktop, tablet and phone widths.
- [ ] Player search: search “a”, then immediately search “chief”; the result list and status belong to “chief” only.
- [ ] Player search: run a search that offers “Show all”, start a different search, then confirm the old button is gone and no old rows appear.
- [ ] Clans tab: switching tabs clears the previous result list.
- [ ] Mobile menu opens and closes, profile button lands at the right edge.

## Data

- [ ] `node tools/build-catalog.mjs` produces the same skin/scenery counts as the committed JSON.
- [ ] Every skin/scenery record you intend to publish is either `verified: true` with real season/source/price tier, or still `verified: false`.
- [ ] No exact prices anywhere in the UI.

## Deploy

- [ ] `node tools/stamp-versions.mjs` run after the last CSS/JS edit.
- [ ] Service worker still network-first (hard reload shows the new files immediately).
- [ ] Edge Function deployed and `result_limit` is `1000` for a `findPlayers` call.
- [ ] Both SQL migrations applied; `select public.search_players('pekka', false, null, 10);` returns rows.

## Base Library

- [ ] `bases.html`: 19 Town Hall tiles plus All, category chips for all eight categories, search and sort.
- [ ] TH15 shows 4 layouts; TH15 + War shows 3; TH5 shows the honest “no genuine link” empty state with the two community links.
- [ ] View details opens a layout, the URL becomes `?base=<id>`, Back and Escape close it and restore focus.
- [ ] Copy base link copies a `link.clashofclans.com` URL; the card still says it was supplied, not re-tested.
- [ ] 360px: no horizontal page scroll, TH strip scrolls on its own, one card per row, controls 44px tall.

## Army Library

- [ ] `armies.html`: 22 cards on All, TH17 shows 14, Farming shows 5.
- [ ] Search “lavaloon” finds LavaLoon; “zzzz” shows the empty state.
- [ ] Detail view lists army, spells, siege, heroes/equipment, plan, risks and source; `?army=<id>` deep link works.
- [ ] Copy army list copies text and shows the toast. No CopyArmy URL is ever produced.
- [ ] Event and Challenge Armies shows the empty state, not invented armies.

## Lady Villager and home page

- [ ] Home page shows “Hey Chief! Welcome to PekkaDex!” once; dismiss hides it for the session.
- [ ] Army Library shows “Ready for battle, Chief?”; Profile shows “Whoa! Look at those stats!”.
- [ ] Clicking Sign out shows “Leaving already, Chief? See you next time!” and the sign-out still happens immediately.
- [ ] Guide sits above the tab bar at 360px, is not clipped at the bottom and never covers the header or tab bar.
- [ ] The guide shows the real Villager art (info on home, Mad on armies, Shocked on profile, pleading on sign out) with no distortion and no 404 for `assets/villager/`.
- [ ] `index.html#heroes` contains only “Clash Heroes Encyclopedia” and “Open the Encyclopedia”; no hero chips or shortcut cards.

## Skins and Scenery Shop

- [ ] Every skin card opens the sheet with large art, release date, price and Back to skins.
- [ ] Unknown release date and price read “Not on file yet”, never a guessed value.
- [ ] Sceneries tab reads “Scenery Shop”, shows 73 unique cards and no duplicates.
- [ ] Clicking a scenery opens the matching full preview; Back to Scenery Shop and Escape close it.
