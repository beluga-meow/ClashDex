#!/usr/bin/env bash
# Run from a trusted computer only. Keep the discovery key private.
# Set these environment variables in your terminal first:
#   export PEKKADEX_FUNCTION_URL="https://YOUR_PROJECT_REF.supabase.co/functions/v1/coc"
#   export PEKKADEX_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
#   export PEKKADEX_DISCOVERY_KEY="THE_SECRET_CONFIGURED_IN_EDGE_FUNCTION_SECRETS"

curl -sS -X POST "$PEKKADEX_FUNCTION_URL" \
  -H "Authorization: Bearer $PEKKADEX_ANON_KEY" \
  -H "apikey: $PEKKADEX_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-pekka-discovery-key: $PEKKADEX_DISCOVERY_KEY" \
  --data '{"action":"discoverClans","queries":["Filipino Warriors","Clash PH","Town Hall 18"]}'

# Alternative: seed a small batch from global clan rankings.
curl -sS -X POST "$PEKKADEX_FUNCTION_URL" \
  -H "Authorization: Bearer $PEKKADEX_ANON_KEY" \
  -H "apikey: $PEKKADEX_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-pekka-discovery-key: $PEKKADEX_DISCOVERY_KEY" \
  --data '{"action":"discoverRankedClans","locationId":"global","limit":10}'
