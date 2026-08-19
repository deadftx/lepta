#!/usr/bin/env bash
set -euo pipefail

NGINX_CONFIG="/etc/nginx/sites-available/lepta-dev"
NGINX_ENABLED="/etc/nginx/sites-enabled/lepta-dev"
BACKUP_CONFIG="${NGINX_CONFIG}.backup-$(date +%Y%m%d-%H%M%S)"
CERTIFICATE_DIR="/etc/letsencrypt/live/dev.lepta.com.br"

if [ "${EUID}" -ne 0 ]; then
  echo "Execute este script como root."
  exit 1
fi

test -f "$CERTIFICATE_DIR/fullchain.pem" || {
  echo "Certificado de dev.lepta.com.br nao encontrado."
  exit 1
}
test -f "$CERTIFICATE_DIR/privkey.pem" || {
  echo "Chave do certificado de dev.lepta.com.br nao encontrada."
  exit 1
}

if [ -f "$NGINX_CONFIG" ]; then
  cp -p "$NGINX_CONFIG" "$BACKUP_CONFIG"
fi

cat > "$NGINX_CONFIG" <<'NGINX'
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
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name dev.lepta.com.br;

    ssl_certificate /etc/letsencrypt/live/dev.lepta.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dev.lepta.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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

ln -sfn "$NGINX_CONFIG" "$NGINX_ENABLED"
if ! nginx -t; then
  if [ -f "$BACKUP_CONFIG" ]; then
    cp -p "$BACKUP_CONFIG" "$NGINX_CONFIG"
  fi
  echo "A configuracao anterior foi restaurada."
  exit 1
fi

systemctl reload nginx

STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' --header 'Host: dev.lepta.com.br' http://127.0.0.1/)"
if [ "$STATUS" != "401" ]; then
  echo "Aviso: o Nginx respondeu HTTP $STATUS; esperado 401 da protecao do DEV."
fi

echo "Nginx do DEV ajustado para o modo Flexible da Cloudflare."
