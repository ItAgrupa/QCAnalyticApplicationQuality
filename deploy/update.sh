#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
require_environment

"${DEPLOY_DIR}/preflight.sh"
echo "Creating a pre-update backup..."
"${DEPLOY_DIR}/backup.sh"

echo "Building the checked-out release..."
compose build
echo "Applying database migrations and replacing services..."
compose up -d --remove-orphans

for attempt in {1..60}; do
  if compose exec -T backend curl --fail --silent http://localhost:8000/health/ready >/dev/null 2>&1; then
    compose ps
    echo "Update completed successfully."
    exit 0
  fi
  sleep 2
done

echo "Update failed its health check. The pre-update backup is available in ${BACKUP_DIR}." >&2
compose logs --tail=100 backend frontend >&2
exit 1
