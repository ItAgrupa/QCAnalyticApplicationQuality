#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

"${DEPLOY_DIR}/preflight.sh"

echo "Building production images..."
compose build --pull
echo "Starting the production stack..."
compose up -d --remove-orphans

echo "Waiting for the application to become healthy..."
for attempt in {1..60}; do
  if compose exec -T frontend wget --quiet --tries=1 --spider http://localhost:8080/health 2>/dev/null; then
    compose ps
    echo
    echo "Production installation is healthy."
    echo "Create the first administrator with:"
    echo "  ./deploy/create-admin.sh admin@your-company.com"
    exit 0
  fi
  sleep 2
done

echo "Application did not become healthy. Recent service logs:" >&2
compose ps >&2
compose logs --tail=100 backend frontend db redis >&2
exit 1
