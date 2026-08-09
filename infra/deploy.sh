#!/usr/bin/env bash
# Deploys the current branch to the self-hosted Proxmox stack. Run this from
# the repo checkout on the host (not locally) — it pulls the latest commit,
# rebuilds the api/web images, and restarts the docker-compose.prod.yml stack.
#
# Usage: infra/deploy.sh

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Running from $(pwd)"

if [ ! -f .env.production ]; then
  echo "error: .env.production not found in $(pwd) — required by docker-compose.prod.yml" >&2
  exit 1
fi

echo "==> Using env file $(pwd)/.env.production"

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree has uncommitted changes — commit, stash, or discard before deploying" >&2
  git status --short
  exit 1
fi

echo "==> Pulling latest changes"
git pull --ff-only

echo "==> Validating env interpolation"
if ! docker compose -f docker-compose.prod.yml --env-file .env.production config >/dev/null; then
  echo "error: docker compose could not resolve .env.production — see errors above" >&2
  exit 1
fi

echo "==> Rebuilding and restarting stack"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo "==> Status"
docker compose -f docker-compose.prod.yml --env-file .env.production ps
