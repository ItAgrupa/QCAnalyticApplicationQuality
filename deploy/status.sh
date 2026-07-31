#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
require_environment

compose ps
echo
compose exec -T backend curl --fail --silent http://localhost:8000/health/ready
echo
