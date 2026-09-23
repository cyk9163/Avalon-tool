#!/usr/bin/env bash
# Writes ready=true and CLOUDFLARE_API_TOKEN into the job environment.
# Prefers a long-lived API token. Otherwise exchanges the Wrangler refresh token.
set -euo pipefail
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "::add-mask::$CLOUDFLARE_API_TOKEN"
  echo "CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN" >> "$GITHUB_ENV"
  echo "ready=true" >> "$GITHUB_OUTPUT"
  exit 0
fi
if [ -z "${CLOUDFLARE_OAUTH_REFRESH_TOKEN:-}" ]; then
  echo "ready=false" >> "$GITHUB_OUTPUT"
  echo "No Cloudflare credential is configured; deploy skipped."
  exit 0
fi
response=$(curl -sS -X POST https://dash.cloudflare.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "client_id=54d11594-84e4-41aa-b438-e81b8fa78ee7" \
  --data-urlencode "refresh_token=$CLOUDFLARE_OAUTH_REFRESH_TOKEN")
token=$(printf '%s' "$response" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); if(!j.access_token){console.error(j.error||'token refresh failed'); process.exit(1)} process.stdout.write(j.access_token)})")
echo "::add-mask::$token"
echo "CLOUDFLARE_API_TOKEN=$token" >> "$GITHUB_ENV"
echo "ready=true" >> "$GITHUB_OUTPUT"
