#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
require_environment

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 email@example.com" >&2
  exit 1
fi

compose exec backend python -m app.cli.create_admin --email "$1"
