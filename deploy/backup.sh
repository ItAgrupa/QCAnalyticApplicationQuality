#!/usr/bin/env bash
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
require_environment
require_command gzip
require_command sha256sum

STAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
DESTINATION="${BACKUP_DIR}/${STAMP}"
mkdir -p "${DESTINATION}"
chmod 700 "${BACKUP_DIR}" "${DESTINATION}"

echo "Backing up PostgreSQL..."
compose exec -T db sh -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "${DESTINATION}/database.sql.gz"

echo "Backing up uploaded and exported files..."
compose exec -T backend tar -C /app/storage -czf - uploads exports > "${DESTINATION}/files.tar.gz"

(
  cd "${DESTINATION}"
  sha256sum database.sql.gz files.tar.gz > SHA256SUMS
)

echo "Backup completed: ${DESTINATION}"
