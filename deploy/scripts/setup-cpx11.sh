#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Executa este script com sudo."
  exit 1
fi

SWAP_SIZE="${SWAP_SIZE:-2G}"
APP_ROOT="${APP_ROOT:-/opt/uorconnect}"

apt-get update
apt-get install -y ca-certificates curl gnupg ufw

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

if [[ ! -f /etc/apt/sources.list.d/docker.list ]]; then
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
fi

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

if ! swapon --show | grep -q "/swapfile"; then
  fallocate -l "${SWAP_SIZE}" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

cat >/etc/sysctl.d/99-uorconnect.conf <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=80
EOF
sysctl --system

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p "${APP_ROOT}"
mkdir -p "${APP_ROOT}/backups/postgres"

systemctl enable docker
systemctl restart docker

echo "Setup base concluído."
echo "Copia o projeto para ${APP_ROOT} e continua com o deploy."
