#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
require_environment
require_command sha256sum

if [[ $# -ne 2 || "$2" != "--confirm-data-replacement" ]]; then
  echo "Usage: $0 /absolute/path/to/backup --confirm-data-replacement" >&2
  echo "This replaces the production database and stored files." >&2
  exit 1
fi

SOURCE_DIR="$(cd "$1" && pwd)"
for required in database.sql.gz files.tar.gz SHA256SUMS; do
  [[ -f "${SOURCE_DIR}/${required}" ]] || { echo "Missing backup file: ${required}" >&2; exit 1; }
done

(cd "${SOURCE_DIR}" && sha256sum --check SHA256SUMS)

echo "Stopping application services during restore..."
compose stop frontend worker backend
compose up -d db redis

echo "Restoring database..."
gzip -dc "${SOURCE_DIR}/database.sql.gz" \
  | compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "Restoring stored files..."
compose run --rm --no-deps -T backend tar -C /app/storage -xzf - < "${SOURCE_DIR}/files.tar.gz"

compose up -d
echo "Restore completed. Run ./deploy/status.sh to verify health."
