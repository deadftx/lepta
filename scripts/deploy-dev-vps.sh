#!/usr/bin/env bash
set -euo pipefail

DEV_DIR="/var/www/lepta-dev"
HOMOLOG_DIR="/var/www/lepta"
REPOSITORY_URL="https://github.com/deadftx/lepta.git"
DEV_PORT="3005"
LOCK_FILE="/var/lock/lepta-dev-deploy.lock"
NGINX_CONFIG="/etc/nginx/sites-available/lepta-dev"

if [ "${EUID}" -ne 0 ]; then
  echo "Execute este script como root."
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Ja existe uma atualizacao do DEV em andamento."
  exit 0
fi

test -f "$HOMOLOG_DIR/database.sqlite" || {
  echo "ERRO: database.sqlite do homolog nao encontrado."
  exit 1
}

ensure_dev_auth_forwarding() {
  local forwarding_line='        proxy_set_header Authorization $http_x_lepta_authorization;'
  local backup_config="${NGINX_CONFIG}.auth-backup"

  if [ ! -f "$NGINX_CONFIG" ] || grep -Fq "$forwarding_line" "$NGINX_CONFIG"; then
    return
  fi

  cp -p "$NGINX_CONFIG" "$backup_config"
  sed -i "/proxy_http_version 1.1;/a\\$forwarding_line" "$NGINX_CONFIG"

  if nginx -t; then
    systemctl reload nginx
    rm -f -- "$backup_config"
    echo "Encaminhamento de autenticacao do DEV atualizado."
    return
  fi

  cp -p "$backup_config" "$NGINX_CONFIG"
  rm -f -- "$backup_config"
  echo "ERRO: nao foi possivel atualizar a autenticacao do Nginx do DEV."
  exit 1
}

ensure_dev_auth_forwarding

if [ ! -d "$DEV_DIR/.git" ]; then
  test ! -e "$DEV_DIR" || {
    echo "ERRO: $DEV_DIR existe, mas nao e um repositorio Git."
    exit 1
  }
  git clone --branch DEV --single-branch "$REPOSITORY_URL" "$DEV_DIR"
fi

cd "$DEV_DIR"
git fetch origin DEV
TARGET_SHA="$(git rev-parse origin/DEV)"
CURRENT_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
DEPLOYED_SHA="$(cat "$DEV_DIR/.deployed-sha" 2>/dev/null || true)"

if [ "$CURRENT_SHA" = "$TARGET_SHA" ] \
  && [ "$DEPLOYED_SHA" = "$TARGET_SHA" ] \
  && [ -d "$DEV_DIR/dist" ] \
  && pm2 describe lepta-dev >/dev/null 2>&1; then
  echo "DEV ja esta atualizado em $TARGET_SHA."
  exit 0
fi

git reset --hard "$TARGET_SHA"

# O banco do DEV nasce de um backup online consistente do homolog apenas uma vez.
# Os deploys seguintes preservam completamente a copia do DEV.
if [ ! -f "$DEV_DIR/database.sqlite" ]; then
  cd "$HOMOLOG_DIR"
  node --input-type=module -e "import Database from 'better-sqlite3'; const source = new Database(process.argv[1], { readonly: true, fileMustExist: true }); await source.backup(process.argv[2]); source.close();" "$HOMOLOG_DIR/database.sqlite" "$DEV_DIR/database.sqlite"
fi

# A copia do banco precisa da mesma chave para ler os campos criptografados.
if [ ! -f "$DEV_DIR/.auth-secret" ] && [ -f "$HOMOLOG_DIR/.auth-secret" ]; then
  cp -p "$HOMOLOG_DIR/.auth-secret" "$DEV_DIR/.auth-secret"
fi
if [ ! -f "$DEV_DIR/.env" ] && [ -f "$HOMOLOG_DIR/.env" ]; then
  cp -p "$HOMOLOG_DIR/.env" "$DEV_DIR/.env"
fi

touch "$DEV_DIR/.env"
chmod 600 "$DEV_DIR/.env"

if ! grep -Eq '^UNLTD_API_TOKEN=.+' "$DEV_DIR/.env"; then
  PM2_UNLTD_TOKEN="$(pm2 jlist | node -e "let input=''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { const list=JSON.parse(input); const app=list.find(item => item.name === 'lepta-homolog'); process.stdout.write(String(app?.pm2_env?.UNLTD_API_TOKEN || '')); });")"
  if [ -n "$PM2_UNLTD_TOKEN" ]; then
    sed -i '/^UNLTD_API_TOKEN=/d' "$DEV_DIR/.env"
    printf 'UNLTD_API_TOKEN=%s\n' "$PM2_UNLTD_TOKEN" >> "$DEV_DIR/.env"
  fi
  unset PM2_UNLTD_TOKEN
fi

if ! grep -Eq '^UNLTD_API_TOKEN=.+' "$DEV_DIR/.env"; then
  echo "ERRO: UNLTD_API_TOKEN nao encontrado em $DEV_DIR/.env."
  exit 1
fi

if [ ! -f "$DEV_DIR/.auth-secret" ] && ! grep -Eq '^AUTH_ENCRYPTION_KEY=.+' "$DEV_DIR/.env"; then
  PM2_AUTH_KEY="$(pm2 jlist | node -e "let input=''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { const list=JSON.parse(input); const app=list.find(item => item.name === 'lepta-homolog'); process.stdout.write(String(app?.pm2_env?.AUTH_ENCRYPTION_KEY || '')); });")"
  if [ -n "$PM2_AUTH_KEY" ]; then
    printf 'AUTH_ENCRYPTION_KEY=%s\n' "$PM2_AUTH_KEY" >> "$DEV_DIR/.env"
  fi
  unset PM2_AUTH_KEY
fi

if [ ! -f "$DEV_DIR/.auth-secret" ] && ! grep -Eq '^AUTH_ENCRYPTION_KEY=.+' "$DEV_DIR/.env"; then
  echo "ERRO: chave de criptografia do homolog nao encontrada; o banco DEV nao sera iniciado com outra chave."
  exit 1
fi

cd "$DEV_DIR"
npm ci
node --check server.js
node --check server/internal/app.js

BUILD_DIR="$DEV_DIR/.build-$TARGET_SHA"
rm -rf -- "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
npm run build -- --outDir "$BUILD_DIR/dist"

rm -rf -- "$DEV_DIR/.dist-previous"
if [ -d "$DEV_DIR/dist" ]; then
  mv "$DEV_DIR/dist" "$DEV_DIR/.dist-previous"
fi
mv "$BUILD_DIR/dist" "$DEV_DIR/dist"
rm -rf -- "$BUILD_DIR"

if pm2 describe lepta-dev >/dev/null 2>&1; then
  PORT="$DEV_PORT" NODE_ENV=production pm2 restart lepta-dev --update-env
else
  PORT="$DEV_PORT" NODE_ENV=production pm2 start server.js --name lepta-dev --time
fi
pm2 save

READY=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent "http://127.0.0.1:${DEV_PORT}/api/health" >/dev/null; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  pm2 logs lepta-dev --lines 50 --nostream
  echo "ERRO: lepta-dev nao respondeu na porta $DEV_PORT."
  exit 1
fi

printf '%s\n' "$TARGET_SHA" > "$DEV_DIR/.deployed-sha"
rm -rf -- "$DEV_DIR/.dist-previous"
echo "DEV atualizado com sucesso em $TARGET_SHA."
