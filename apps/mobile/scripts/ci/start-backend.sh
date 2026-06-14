#!/usr/bin/env bash
# Boot the real Next.js production server in the background for the
# mobile-e2e job (SPEC-013 / ADR 060). Assumes:
#   - POSTGRES_URL points at the migrated + seeded database
#     (start-postgres.sh, then pnpm db:migrate / db:seed / seed:e2e).
#   - `pnpm build` already ran (ADR 010 dummy-URL build).
#   - Auth env (AUTH_SECRET etc.) is set at the job level, mirroring the
#     web e2e job — next-auth needs it at boot.
#
# Binds `-H 0.0.0.0` (all interfaces, not just loopback) so the iOS
# Simulator can reach the server via the runner's LAN IP — the sim cannot
# reach the host's 127.0.0.1 on the GitHub macOS runner (proven by
# SPEC-014's on-device reachability probe). The app's
# EXPO_PUBLIC_API_BASE_URL points at that LAN IP (HOST_IP).
#
# The server is intentionally NOT awaited here: the canary step curls it
# after xcodebuild, by which point the ~5s boot is long done — same
# overlap trick as the background simulator boot (ADR 055).
#
# Outputs:
#   $RUNNER_TEMP/backend.log — server stdout/stderr (uploaded on failure).
#   BACKEND_PID in $GITHUB_ENV — recorded for debuggability.
set -euo pipefail

: "${POSTGRES_URL:?POSTGRES_URL must be set (run start-postgres.sh first)}"

LOG_FILE="${RUNNER_TEMP:-/tmp}/backend.log"

# Call the web app's `next start` directly with -H 0.0.0.0 — forwarding the
# flag cleanly through the nested root→web pnpm `start` scripts is fragile.
nohup pnpm --filter @travel-planner/web exec next start -H 0.0.0.0 >"$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "Backend starting (pid $BACKEND_PID) bound to 0.0.0.0, log: $LOG_FILE"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "BACKEND_PID=$BACKEND_PID" >>"$GITHUB_ENV"
fi
