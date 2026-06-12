#!/usr/bin/env bash
# Provision a throwaway native PostgreSQL on a GitHub macOS runner
# (SPEC-013 / ADR 060 — no Docker on macOS runners, so the web app's
# Testcontainers pattern can't apply here; the seam with every other
# environment is simply "a POSTGRES_URL exists").
#
# Strategy (epic Q2): prefer the runner image's preinstalled Homebrew
# PostgreSQL (newest major present); fall back to `brew install
# postgresql@16` if the image ever drops it. Data dir lives in
# $RUNNER_TEMP — trust auth, loopback only, destroyed with the runner.
#
# Outputs (appended to $GITHUB_ENV when set, else exported/printed):
#   POSTGRES_URL — connection string for migrate/seed/server steps.
set -euo pipefail

DB_NAME="travel_planner_e2e"
PG_PORT="${PG_PORT:-5432}"
PGDATA_DIR="${RUNNER_TEMP:-/tmp}/pgdata"

find_pg_prefix() {
  # Newest preinstalled postgresql@N keg first.
  local prefix
  for formula in $(brew list --formula 2>/dev/null | grep -E '^postgresql(@[0-9]+)?$' | sort -t@ -k2 -rn); do
    prefix="$(brew --prefix "$formula" 2>/dev/null || true)"
    if [ -n "$prefix" ] && [ -x "$prefix/bin/initdb" ]; then
      echo "$prefix"
      return 0
    fi
  done
  return 1
}

PG_PREFIX="$(find_pg_prefix || true)"
if [ -z "$PG_PREFIX" ]; then
  echo "No preinstalled PostgreSQL keg found — installing postgresql@16 via Homebrew"
  brew install postgresql@16
  PG_PREFIX="$(brew --prefix postgresql@16)"
fi
echo "Using PostgreSQL at $PG_PREFIX"
export PATH="$PG_PREFIX/bin:$PATH"

"$PG_PREFIX/bin/initdb" --pgdata="$PGDATA_DIR" --auth=trust --username="$(whoami)" >/dev/null

"$PG_PREFIX/bin/pg_ctl" \
  --pgdata="$PGDATA_DIR" \
  --log="$PGDATA_DIR/postgres.log" \
  -o "-p $PG_PORT -c listen_addresses=127.0.0.1" \
  start

"$PG_PREFIX/bin/createdb" --port="$PG_PORT" "$DB_NAME"

POSTGRES_URL="postgresql://$(whoami)@127.0.0.1:$PG_PORT/$DB_NAME"
echo "PostgreSQL ready: $POSTGRES_URL"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "POSTGRES_URL=$POSTGRES_URL" >>"$GITHUB_ENV"
  # Migrations/seed run from the repo root via pnpm; PATH for psql tools
  # isn't needed downstream, only the URL is.
fi
