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
# 2. Install Terraform (~> 1.12.0, needed for infra/ and pre-commit hook)
##############################################################################
if ! terraform version &>/dev/null; then
  TERRAFORM_VERSION="1.12.2"
  curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" -o /tmp/terraform.zip
  sudo unzip -o /tmp/terraform.zip -d /usr/local/bin/
  rm /tmp/terraform.zip
fi

##############################################################################
# 3. Install GitHub CLI (needed for PR workflows)
##############################################################################
if ! gh --version &>/dev/null; then
  GH_VERSION="2.67.0"
  curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" -o /tmp/gh.tar.gz
  tar -xzf /tmp/gh.tar.gz -C /tmp
  sudo cp "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh
  rm -rf /tmp/gh.tar.gz "/tmp/gh_${GH_VERSION}_linux_amd64"
fi

##############################################################################
# 4. Install Node.js dependencies
##############################################################################
cd "$CLAUDE_PROJECT_DIR"

if [ ! -d "node_modules" ] || [ "pnpm-lock.yaml" -nt "node_modules/.pnpm/lock.yaml" ]; then
  pnpm install
fi

##############################################################################
# 5. Install Playwright browsers (needed for e2e tests)
##############################################################################
if ! npx playwright install --dry-run chromium &>/dev/null 2>&1; then
  npx playwright install chromium
fi
