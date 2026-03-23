#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/uorconnect}"
SCRIPT_PATH="${APP_ROOT}/deploy/scripts/backup-postgres.sh"
CRON_FILE="/etc/cron.d/uorconnect-postgres-backup"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Executa este script com sudo."
  exit 1
fi

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 2 * * * root APP_ROOT=${APP_ROOT} ${SCRIPT_PATH} >> /var/log/uorconnect-backup.log 2>&1
EOF

chmod 644 "${CRON_FILE}"

echo "Cron de backup instalado em ${CRON_FILE}."
