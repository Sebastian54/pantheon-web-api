#!/usr/bin/env bash
# Deploys the current branch to the self-hosted Proxmox stack. Run this from
# the repo checkout on the host (not locally) — it pulls the latest commit,
# rebuilds the api/web images, runs pending database migrations, and only
# then restarts the docker-compose.prod.yml stack.
#
# Build, migrate, and restart are deliberately three separate steps, in that
# order — not `up -d --build`. Migrations are baked into the api image at
# build time (see apps/api/Dockerfile: `COPY packages/db packages/db`), not
# bind-mounted, so:
#   - migrate-then-build would run migrate against the OLD image, silently
#     missing any migration added in the commit currently being deployed
#     (this happened for real: 0006/0007 were skipped this way, and the
#     rebuilt api code then 500'd on every query touching the new columns
#     until migrate was re-run manually against the already-rebuilt container)
#   - build-then-restart-then-migrate leaves a window where the new code is
#     already serving traffic against the old schema
# build-then-migrate-then-restart (via the dedicated `migrate` service,
# docker-compose.prod.yml) avoids both: the image is current when migrate
# runs, and no code that expects the new schema starts before migrate
# finishes.
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

echo "==> Building updated images"
docker compose -f docker-compose.prod.yml --env-file .env.production build

echo "==> Running database migrations against the newly-built image"
docker compose -f docker-compose.prod.yml --env-file .env.production --profile tools run --rm migrate

echo "==> Restarting stack with the newly-built images"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "==> Status"
docker compose -f docker-compose.prod.yml --env-file .env.production ps
