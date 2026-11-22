# ClashDex

A responsive, installable-PWA starter for a Clash of Clans companion website.

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a browser for the basic preview.
3. For PWA/service-worker testing, serve the folder from `localhost` or deploy it to HTTPS hosting.

## Included in this starter
- Responsive Clash-inspired homepage
- Player tag format validation (not live API lookup yet)
- Base category filters
- Manual builder upgrade countdowns saved in localStorage
- Seasonal theme preview and automatic calendar theme selection
- Reduced-motion support for seasonal particles
- PWA manifest and basic offline shell cache

## Important integrations still needed
- **Live player profiles:** Create a secure backend endpoint that calls the official Clash of Clans API. Keep the API token on the server; never put it in browser JavaScript.
- **Account age:** The official player profile endpoint does not provide a verified account creation date. Any age estimate needs a reliable historical data source and must be labeled as an estimate.
- **Live builder timers:** The game API does not expose live building upgrade countdowns. The included tracker is manual and browser-local.
- **Bases, ratings and attack guides:** Add a database, moderation and current Town Hall metadata. Keep content updated as game balance changes.
- **YouTube:** Add curated, attributed video IDs/links; confirm each creator/video is relevant to the selected Town Hall and strategy.
- **Store:** The store button links to the official Supercell Store. Do not collect payment or credentials for game purchases on this fan site.
- **Events:** Connect an official news source or maintain an admin-managed event calendar. The current theme engine uses calendar dates as a demo, not a live Supercell event feed.

## Suggested next build phase
1. Backend/API proxy and real player lookup.
2. Supabase tables for user accounts, saved bases, ratings and event content.
3. Town Hall filters and verified layout detail pages.
4. Admin dashboard for event schedules and seasonal theme assets.
5. User sign-in, cloud-synced builder tracker and push notifications.

## Fan project notice
ClashDex is an independent fan-made project and is not affiliated with, endorsed, sponsored or specifically approved by Supercell. Clash of Clans and related marks are owned by Supercell.
