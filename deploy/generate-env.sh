#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env.production"

if [[ -e "${ENV_FILE}" ]]; then
  echo "${ENV_FILE} already exists; refusing to overwrite secrets." >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate production secrets." >&2
  exit 1
fi

read -r -p "Application hostname or LAN IP [quality-app]: " APP_HOST
APP_HOST="${APP_HOST:-quality-app}"
if [[ ! "${APP_HOST}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Hostname may contain only letters, numbers, dots, and hyphens." >&2
  exit 1
fi

POSTGRES_PASSWORD="$(openssl rand -hex 24)"
SECRET_KEY="$(openssl rand -hex 64)"
umask 077

cat > "${ENV_FILE}" <<EOF
POSTGRES_DB=quality_platform
POSTGRES_USER=qp_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
SECRET_KEY=${SECRET_KEY}

ENVIRONMENT=production
DEBUG=false
APP_NAME=Quality Intelligence Platform
APP_VERSION=1.0.0
API_DOCS_ENABLED=false
BACKEND_WORKERS=2

APP_URL=http://${APP_HOST}
CORS_ORIGINS=http://${APP_HOST}
TRUSTED_HOSTS=${APP_HOST},localhost,127.0.0.1
APP_BIND_IP=0.0.0.0
HTTP_PORT=80

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
LOG_LEVEL=INFO

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=

AZURE_DI_ENDPOINT=
AZURE_DI_API_KEY=
EOF

chmod 600 "${ENV_FILE}"
echo "Created ${ENV_FILE} with generated secrets (permissions 600)."
echo "Review APP_URL, CORS_ORIGINS, TRUSTED_HOSTS, and optional SMTP settings before installation."
