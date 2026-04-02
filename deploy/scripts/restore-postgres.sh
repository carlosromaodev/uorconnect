#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/uorconnect}"
DEPLOY_DIR="${DEPLOY_DIR:-${APP_ROOT}/deploy}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"

get_env_value() {
  local key="$1"
  local line

  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf '%s' "${line}"
}

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 /caminho/do/backup.dump"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

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

docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";"

docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres psql -U "${POSTGRES_USER}" -d postgres -c \
  "CREATE DATABASE \"${POSTGRES_DB}\";"

cat "${BACKUP_FILE}" | docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}" exec -T \
  postgres pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists --no-owner

echo "Restore concluído."
