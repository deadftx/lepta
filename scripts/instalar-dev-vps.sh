#!/usr/bin/env bash
set -euo pipefail

DEV_DIR="/var/www/lepta-dev"
REPOSITORY_URL="https://github.com/deadftx/lepta.git"
SERVICE_FILE="/etc/systemd/system/lepta-dev-deploy.service"
TIMER_FILE="/etc/systemd/system/lepta-dev-deploy.timer"

if [ "${EUID}" -ne 0 ]; then
  echo "Execute este script como root."
  exit 1
fi

if [ ! -d "$DEV_DIR/.git" ]; then
  test ! -e "$DEV_DIR" || {
    echo "ERRO: $DEV_DIR existe, mas nao e um repositorio Git."
    exit 1
  }
  git clone --branch DEV --single-branch "$REPOSITORY_URL" "$DEV_DIR"
fi

cd "$DEV_DIR"
git fetch origin DEV
git reset --hard origin/DEV
bash "$DEV_DIR/scripts/deploy-dev-vps.sh"

cat > "$SERVICE_FILE" <<'SERVICE'
[Unit]
Description=Atualiza o ambiente LEPTA DEV pela branch DEV
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/bin/bash /var/www/lepta-dev/scripts/deploy-dev-vps.sh
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
SERVICE

cat > "$TIMER_FILE" <<'TIMER'
[Unit]
Description=Verifica atualizacoes da branch DEV do LEPTA

[Timer]
OnBootSec=45s
OnUnitActiveSec=60s
RandomizedDelaySec=10s
Persistent=true

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now lepta-dev-deploy.timer

bash "$DEV_DIR/scripts/ativar-dev-vps.sh"

echo
echo "Atualizacao automatica do DEV ativada."
systemctl list-timers lepta-dev-deploy.timer --no-pager
