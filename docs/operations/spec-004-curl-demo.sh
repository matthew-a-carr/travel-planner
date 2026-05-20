#!/usr/bin/env bash
# SPEC-004 demo — drive the four /api/v1/auth/mobile/* endpoints with
# curl + a couple of openssl one-liners. Captures the §4 walkthrough
# as runnable shell so the operator (or a future automation pass) can
# reproduce it.
#
# Prereqs:
#   - The web server is running (pnpm dev) and reachable.
#   - One approved user exists in the database (pnpm auth:bootstrap-admin
#     against your local dev DB if you don't already have one).
#   - The Google Cloud Console redirect URI for AUTH_GOOGLE_ID includes
#     ${BASE_URL}/api/v1/auth/mobile/callback.
#
# Usage:
#   BASE_URL=http://localhost:3000 ./docs/operations/spec-004-curl-demo.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "→ Generate PKCE code_verifier + code_challenge"
CODE_VERIFIER="$(openssl rand -base64 32 | tr '/+' '_-' | tr -d '=')"
CODE_CHALLENGE="$(printf '%s' "$CODE_VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr '/+' '_-' | tr -d '=')"
echo "  verifier:  $CODE_VERIFIER"
echo "  challenge: $CODE_CHALLENGE"
echo

echo "→ POST /api/v1/auth/mobile/start"
START_RES="$(curl -s -X POST "$BASE_URL/api/v1/auth/mobile/start" \
  -H 'Content-Type: application/json' \
  -d "{\"code_challenge\":\"$CODE_CHALLENGE\"}")"
echo "  $START_RES"
AUTH_URL="$(printf '%s' "$START_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["authorise_url"])')"
echo
echo "→ Open this URL in a browser and sign in with an approved Google account:"
echo "  $AUTH_URL"
echo
echo "  After consent Google will redirect to:"
echo "    $BASE_URL/api/v1/auth/mobile/callback?code=…&state=…"
echo "  which 302s to: travelplanner://auth?code=<one-time-code>"
echo
echo "  In a real device flow the iOS app receives the deep link. For this"
echo "  demo, copy the one-time code from the browser address bar after"
echo "  the redirect and paste it below."
echo
read -r -p "  one-time code: " ONE_TIME

echo
echo "→ POST /api/v1/auth/mobile/exchange"
EXCHANGE_RES="$(curl -s -X POST "$BASE_URL/api/v1/auth/mobile/exchange" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$ONE_TIME\",\"code_verifier\":\"$CODE_VERIFIER\"}")"
echo "  $EXCHANGE_RES"
ACCESS_TOKEN="$(printf '%s' "$EXCHANGE_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')"
REFRESH_TOKEN="$(printf '%s' "$EXCHANGE_RES" | python3 -c 'import json,sys; print(json.load(sys.stdin)["refresh_token"])')"
echo

echo "→ GET /api/v1/me with the access token (proves SPEC-001 + SPEC-002 integration)"
curl -s "$BASE_URL/api/v1/me" -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
echo

echo "→ POST /api/v1/auth/mobile/refresh"
REFRESH_RES="$(curl -s -X POST "$BASE_URL/api/v1/auth/mobile/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")"
echo "  $REFRESH_RES"
echo

echo "→ Reuse the old refresh — should 401 refresh_reused AND revoke the chain"
curl -s -X POST "$BASE_URL/api/v1/auth/mobile/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | python3 -m json.tool
echo
echo "Done."
