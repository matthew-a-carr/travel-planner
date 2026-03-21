#!/bin/bash
set -euo pipefail

# Only run in remote/web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

##############################################################################
# 1. Start Docker daemon (needed for Testcontainers — integration/e2e tests)
##############################################################################
if ! docker info &>/dev/null; then
  sudo dockerd &>/tmp/dockerd.log &

  # Wait up to 30 seconds for the daemon to be ready
  for i in $(seq 1 30); do
    if docker info &>/dev/null; then
      break
    fi
    sleep 1
  done

  if ! docker info &>/dev/null; then
    echo "WARNING: Docker daemon failed to start within 30 seconds" >&2
  fi
fi

##############################################################################
# 2. Install Node.js dependencies
##############################################################################
cd "$CLAUDE_PROJECT_DIR"

if [ ! -d "node_modules" ] || [ "pnpm-lock.yaml" -nt "node_modules/.pnpm/lock.yaml" ]; then
  pnpm install
fi

##############################################################################
# 3. Install Playwright browsers (needed for e2e tests)
##############################################################################
if ! npx playwright install --dry-run chromium &>/dev/null 2>&1; then
  npx playwright install chromium
fi
