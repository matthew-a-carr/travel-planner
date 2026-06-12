#!/usr/bin/env bash
# Boot the real Next.js production server in the background for the
# mobile-e2e job (SPEC-013 / ADR 060). Assumes:
#   - POSTGRES_URL points at the migrated + seeded database
#     (start-postgres.sh, then pnpm db:migrate / db:seed / seed:e2e).
#   - `pnpm build` already ran (ADR 010 dummy-URL build).
#   - Auth env (AUTH_SECRET etc.) is set at the job level, mirroring the
#     web e2e job — next-auth needs it at boot.
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

nohup pnpm start >"$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "Backend starting (pid $BACKEND_PID), log: $LOG_FILE"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "BACKEND_PID=$BACKEND_PID" >>"$GITHUB_ENV"
fi
