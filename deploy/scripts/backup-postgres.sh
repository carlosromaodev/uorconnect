#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/uorconnect}"
DEPLOY_DIR="${DEPLOY_DIR:-${APP_ROOT}/deploy}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"
BACKUP_DIR="${BACKUP_DIR:-${APP_ROOT}/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%F-%H%M%S)"

get_env_value() {
  local key="$1"
  local line

  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf '%s' "${line}"
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Ficheiro .env não encontrado em ${ENV_FILE}."
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-$(get_env_value POSTGRES_USER)}"
POSTGRES_DB="${POSTGRES_DB:-$(get_env_value POSTGRES_DB)}"

if [[ -z "${POSTGRES_USER}" || -z "${POSTGRES_DB}" ]]; then
  echo "POSTGRES_USER ou POSTGRES_DB não definidos em ${ENV_FILE}."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc \
  > "${BACKUP_DIR}/postgres-${TIMESTAMP}.dump"

find "${BACKUP_DIR}" -type f -name 'postgres-*.dump' -mtime +"${RETENTION_DAYS}" -delete

echo "Backup criado em ${BACKUP_DIR}/postgres-${TIMESTAMP}.dump"
