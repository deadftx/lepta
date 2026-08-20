$ErrorActionPreference = 'Stop'

$Vps = 'root@179.198.126.102'
$Repository = 'https://github.com/deadftx/lepta.git'
$Branch = 'HOMOLOG'
$RemoteScript = '/tmp/lepta-blue-green-deploy.sh'
$LocalRemoteScript = Join-Path $env:TEMP 'lepta-blue-green-deploy.sh'

$DeployScript = @'
#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="__REPOSITORY__"
BRANCH="__BRANCH__"
NGINX_FILE="$(grep -RIlE 'proxy_pass[[:space:]]+http://(127\.0\.0\.1|localhost):(3004|3005)' /etc/nginx/sites-enabled | head -n 1)"
if [[ -z "$NGINX_FILE" ]]; then echo 'Configuração Nginx com porta 3004/3005 não encontrada.' >&2; exit 1; fi

if grep -Eq 'proxy_pass[[:space:]]+http://(127\.0\.0\.1|localhost):3004' "$NGINX_FILE"; then
  OLD_PORT=3004; NEW_PORT=3005; COLOR=green
else
  OLD_PORT=3005; NEW_PORT=3004; COLOR=blue
fi

RELEASE="/var/www/lepta-$COLOR"
PROCESS="lepta-homolog-$COLOR"
OLD_PROCESS="lepta-homolog-$([[ "$COLOR" == green ]] && echo blue || echo green)"
PREV_RELEASE="/var/www/lepta-$([[ "$COLOR" == green ]] && echo blue || echo green)"

if [[ "${1:-}" == "prepare" ]]; then
  pm2 delete "$PROCESS" >/dev/null 2>&1 || true
  rm -rf "$RELEASE"
  git clone --depth 1 --branch "$BRANCH" "$REPOSITORY" "$RELEASE"
  cd "$RELEASE"
  npm ci
  npm run build
  echo "PREPARE_OK release=$RELEASE porta=$NEW_PORT"
  exit 0
fi

if [[ ! -d "$RELEASE" ]]; then echo 'Release ainda não preparada.' >&2; exit 1; fi

# Preserva o banco de dados e segredos originais da VPS (nunca sobrescreve com arquivo local)
if [[ -f "$PREV_RELEASE/database.sqlite" ]]; then
  cp -p "$PREV_RELEASE/database.sqlite" "$RELEASE/database.sqlite"
  [[ -f "$PREV_RELEASE/database.sqlite-wal" ]] && cp -p "$PREV_RELEASE/database.sqlite-wal" "$RELEASE/database.sqlite-wal" || true
  [[ -f "$PREV_RELEASE/database.sqlite-shm" ]] && cp -p "$PREV_RELEASE/database.sqlite-shm" "$RELEASE/database.sqlite-shm" || true
elif [[ -f "/var/www/lepta/database.sqlite" ]]; then
  cp -p "/var/www/lepta/database.sqlite" "$RELEASE/database.sqlite"
fi

if [[ -f "$PREV_RELEASE/.auth-secret" ]]; then
  cp -p "$PREV_RELEASE/.auth-secret" "$RELEASE/.auth-secret"
elif [[ -f "/var/www/lepta/.auth-secret" ]]; then
  cp -p "/var/www/lepta/.auth-secret" "$RELEASE/.auth-secret"
fi
chmod 600 "$RELEASE/.auth-secret" 2>/dev/null || true

if [[ -f "$PREV_RELEASE/.env" ]]; then
  cp -p "$PREV_RELEASE/.env" "$RELEASE/.env"
elif [[ -f "/var/www/lepta/.env" ]]; then
  cp -p "/var/www/lepta/.env" "$RELEASE/.env"
fi
chmod 600 "$RELEASE/.env" 2>/dev/null || true

cd "$RELEASE"
PORT="$NEW_PORT" pm2 start server.js --name "$PROCESS" --cwd "$RELEASE" --time

for attempt in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$NEW_PORT/api/health" | grep -q '"status":"ok"'; then break; fi
  if [[ "$attempt" == 30 ]]; then pm2 logs "$PROCESS" --lines 80 --nostream; exit 1; fi
  sleep 1
done

cp "$NGINX_FILE" "$NGINX_FILE.backup-$(date +%Y%m%d-%H%M%S)"
sed -i -E "s#(proxy_pass[[:space:]]+http://(127\.0\.0\.1|localhost):)$OLD_PORT#\1$NEW_PORT#" "$NGINX_FILE"
nginx -t
systemctl reload nginx

pm2 delete lepta-homolog >/dev/null 2>&1 || true
pm2 delete "$OLD_PROCESS" >/dev/null 2>&1 || true
pm2 save
echo "DEPLOY_OK porta=$NEW_PORT processo=$PROCESS release=$RELEASE"
'@

$DeployScript = $DeployScript.Replace('__REPOSITORY__', $Repository).Replace('__BRANCH__', $Branch)
[System.IO.File]::WriteAllText($LocalRemoteScript, $DeployScript, [System.Text.UTF8Encoding]::new($false))

Write-Host '1/4 Enviando rotina azul/verde...'
scp $LocalRemoteScript "${Vps}:$RemoteScript"

Write-Host '2/4 Preparando e compilando a nova versão enquanto o site atual continua online...'
ssh $Vps "chmod +x $RemoteScript && $RemoteScript prepare"

Write-Host '3/4 Alternando instâncias preservando o banco de dados da VPS...'
ssh $Vps $RemoteScript

Write-Host '4/4 Validando o site publicado...'
$Health = Invoke-RestMethod 'https://lepta.com.br/api/health'
if ($Health.status -ne 'ok') { throw 'O site não respondeu saudável após a troca.' }

Remove-Item -LiteralPath $LocalRemoteScript -Force -ErrorAction SilentlyContinue
Write-Host 'Deploy concluído mantendo intactos todos os usuários e dados da VPS.' -ForegroundColor Green
