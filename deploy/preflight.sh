#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_command docker
require_environment

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but the current user cannot access the Docker daemon." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required." >&2
  exit 1
fi

if [[ "$(stat -c '%a' "${ENV_FILE}")" != "600" ]]; then
  echo "Warning: correcting permissions on .env.production to 600."
  chmod 600 "${ENV_FILE}"
fi

compose config --quiet
echo "Preflight checks passed."
