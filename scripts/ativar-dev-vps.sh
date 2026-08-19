#!/usr/bin/env bash
set -euo pipefail

DEV_HOST="dev.lepta.com.br"
DEV_PORT="3005"
NGINX_AVAILABLE="/etc/nginx/sites-available/lepta-dev"
NGINX_ENABLED="/etc/nginx/sites-enabled/lepta-dev"
AUTH_FILE="/etc/nginx/.htpasswd-lepta-dev"

if [ "${EUID}" -ne 0 ]; then
  echo "Execute este script como root."
  exit 1
fi

if ! curl --fail --silent "http://127.0.0.1:${DEV_PORT}/api/health" >/dev/null; then
  echo "O processo lepta-dev ainda nao respondeu na porta ${DEV_PORT}."
  echo "Confirme primeiro se o workflow Deploy DEV terminou com sucesso."
  exit 1
fi

read -r -p "Usuario para proteger o DEV [lepta-dev]: " DEV_USER
DEV_USER="${DEV_USER:-lepta-dev}"
read -r -s -p "Senha de acesso ao DEV: " DEV_PASSWORD
echo
read -r -s -p "Confirme a senha: " DEV_PASSWORD_CONFIRM
echo

if [ -z "$DEV_PASSWORD" ] || [ "$DEV_PASSWORD" != "$DEV_PASSWORD_CONFIRM" ]; then
  echo "As senhas nao conferem ou estao vazias."
  exit 1
fi

PASSWORD_HASH="$(printf '%s' "$DEV_PASSWORD" | openssl passwd -apr1 -stdin)"
printf '%s:%s\n' "$DEV_USER" "$PASSWORD_HASH" > "$AUTH_FILE"
chmod 600 "$AUTH_FILE"
unset DEV_PASSWORD DEV_PASSWORD_CONFIRM PASSWORD_HASH

cat > "$NGINX_AVAILABLE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name dev.lepta.com.br;

    client_max_body_size 25m;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    location / {
        auth_basic "LEPTA DEV";
        auth_basic_user_file /etc/nginx/.htpasswd-lepta-dev;

        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX

ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

certbot --nginx \
  --domain "$DEV_HOST" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect

bash /var/www/lepta-dev/scripts/configurar-dev-cloudflare-flexible.sh

nginx -t
systemctl reload nginx

echo
echo "DEV ativo e protegido em https://${DEV_HOST}"
