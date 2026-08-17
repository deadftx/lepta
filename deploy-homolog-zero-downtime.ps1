$ErrorActionPreference = 'Stop'

$Vps = 'root@179.198.126.102'
$Repository = 'https://github.com/deadftx/lepta.git'
$Branch = 'HOMOLOG'
$LocalDatabase = Join-Path $PSScriptRoot 'database.sqlite'
$Snapshot = Join-Path $env:TEMP 'lepta-database-deploy.sqlite'
$LocalSecret = Join-Path $PSScriptRoot '.auth-secret'
$RemoteDatabase = '/tmp/lepta-database-deploy.sqlite'
$RemoteSecret = '/tmp/lepta-auth-secret'
$RemoteScript = '/tmp/lepta-blue-green-deploy.sh'
$LocalRemoteScript = Join-Path $env:TEMP 'lepta-blue-green-deploy.sh'

if (-not (Test-Path -LiteralPath $LocalDatabase)) { throw "database.sqlite não encontrado em $PSScriptRoot" }
if (-not (Test-Path -LiteralPath $LocalSecret)) { throw '.auth-secret não encontrado. Inicie o backend local uma vez antes do deploy.' }

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
mv /tmp/lepta-database-deploy.sqlite "$RELEASE/database.sqlite"
mv /tmp/lepta-auth-secret "$RELEASE/.auth-secret"
chmod 600 "$RELEASE/.auth-secret"

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

Write-Host '1/5 Enviando rotina azul/verde...'
scp $LocalRemoteScript "${Vps}:$RemoteScript"

Write-Host '2/5 Preparando e compilando a nova versão enquanto o site atual continua online...'
ssh $Vps "chmod +x $RemoteScript && $RemoteScript prepare"

Write-Host '3/5 Criando cópia consistente do database.sqlite (incluindo WAL)...'
node (Join-Path $PSScriptRoot 'scripts\createDatabaseSnapshot.cjs') $LocalDatabase $Snapshot

Write-Host '4/5 Enviando o banco e alternando para a instância nova...'
scp $Snapshot "${Vps}:$RemoteDatabase"
scp $LocalSecret "${Vps}:$RemoteSecret"
ssh $Vps $RemoteScript

Write-Host '5/5 Validando o site publicado...'
$Health = Invoke-RestMethod 'https://lepta.com.br/api/health'
if ($Health.status -ne 'ok') { throw 'O site não respondeu saudável após a troca.' }

Remove-Item -LiteralPath $Snapshot, $LocalRemoteScript -Force -ErrorAction SilentlyContinue
Write-Host 'Deploy concluído sem interromper o site.' -ForegroundColor Green
