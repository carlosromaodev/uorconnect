#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/uorconnect}"
DEPLOY_DIR="${DEPLOY_DIR:-${APP_ROOT}/deploy}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 /caminho/do/backup.dump"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";"

docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "CREATE DATABASE \"${POSTGRES_DB}\";"

cat "${BACKUP_FILE}" | docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner

echo "Restore concluído."
