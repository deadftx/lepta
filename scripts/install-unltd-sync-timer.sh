#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www/lepta"
SERVICE_FILE="/etc/systemd/system/lepta-unltd-sync.service"
TIMER_FILE="/etc/systemd/system/lepta-unltd-sync.timer"

if [ "${EUID}" -ne 0 ]; then
  echo "Execute este instalador como root."
  exit 1
fi

test -f "$PROJECT_DIR/database.sqlite" || {
  echo "ERRO: banco principal não encontrado em $PROJECT_DIR/database.sqlite."
  exit 1
}
test -f "$PROJECT_DIR/scripts/sync-unltd-api.js" || {
  echo "ERRO: rotina de sincronização não encontrada."
  exit 1
}
test -f "$PROJECT_DIR/.env" || {
  echo "ERRO: arquivo .env da VPS não encontrado."
  exit 1
}
grep -Eq '^UNLTD_API_TOKEN=.+' "$PROJECT_DIR/.env" || {
  echo "ERRO: UNLTD_API_TOKEN não configurado no .env da VPS."
  exit 1
}
NODE_BIN="$(command -v node)"
test -n "$NODE_BIN" || {
  echo "ERRO: Node.js não encontrado no PATH da VPS."
  exit 1
}

cat > "$SERVICE_FILE" <<SYSTEMD
[Unit]
Description=Backup diário da API UNLTD para o SQLite da LEPTA
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/var/www/lepta
EnvironmentFile=/var/www/lepta/.env
Environment=NODE_ENV=production
Environment=LEPTA_DATABASE_PATH=/var/www/lepta/database.sqlite
ExecStart=$NODE_BIN /var/www/lepta/scripts/sync-unltd-api.js --source=AGENDADO --requested-by=systemd
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=6
TimeoutStartSec=8h
StandardOutput=append:/var/www/lepta/logs/unltd-sync.log
StandardError=append:/var/www/lepta/logs/unltd-sync.log

[Install]
WantedBy=multi-user.target
SYSTEMD

cat > "$TIMER_FILE" <<'SYSTEMD'
[Unit]
Description=Agenda o backup diário da API UNLTD às 07:30

[Timer]
OnCalendar=*-*-* 07:30:00 America/Sao_Paulo
Persistent=true
AccuracySec=1min
RandomizedDelaySec=0
Unit=lepta-unltd-sync.service

[Install]
WantedBy=timers.target
SYSTEMD

mkdir -p "$PROJECT_DIR/logs"
chmod 750 "$PROJECT_DIR/logs"
systemctl daemon-reload
systemctl enable --now lepta-unltd-sync.timer

echo "Agendamento UNLTD instalado com sucesso."
systemctl list-timers lepta-unltd-sync.timer --no-pager
