#!/bin/sh
set -eu

# =============================================================================
# docker-entrypoint.sh — nginx do Repositório de Aulas (produção, Opção A)
#
# Comportamento:
#  1. Detecta se o certificado Let's Encrypt de ${SERVER_NAME} já existe.
#  2. Sem certificado -> modo HTTP-only na porta 80 (primeiro boot, pronto
#     para o desafio ACME). Com certificado -> HTTP redireciona para HTTPS e
#     sobe o server block TLS 443.
#  3. Renderiza nginx.conf e os server blocks via envsubst (só as variáveis
#     listadas são substituídas; $host, $uri etc. do nginx permanecem intactos).
# =============================================================================

: "${SERVER_NAME:=localhost}"
: "${verificationDir:=/var/www/certbot}"
export SERVER_NAME verificationDir

CERTS_DIR="/etc/letsencrypt/live/${SERVER_NAME}"
if [ -f "${CERTS_DIR}/fullchain.pem" ] && [ -f "${CERTS_DIR}/privkey.pem" ]; then
  HTTPS_MODE="true"
else
  HTTPS_MODE="false"
fi

# Limpa conf.d (diretório efêmero do container) antes de cada boot
mkdir -p /etc/nginx/conf.d
rm -f /etc/nginx/conf.d/*.conf.template /etc/nginx/conf.d/*.conf

if [ "${HTTPS_MODE}" = "true" ]; then
  echo "[entrypoint] Certificado encontrado em ${CERTS_DIR} — modo HTTPS ativado."
  cp /etc/nginx/conf.d-templates/http-redirect.conf.template /etc/nginx/conf.d/00-http.conf.template
  cp /etc/nginx/conf.d-templates/https.conf.template          /etc/nginx/conf.d/10-https.conf.template
else
  echo "[entrypoint] Certificado ausente em ${CERTS_DIR} — modo HTTP-only na porta 80 (pronto para ACME)."
  cp /etc/nginx/conf.d-templates/http-only.conf.template      /etc/nginx/conf.d/00-http.conf.template
fi

# Server blocks de aplicação são comuns aos dois modos.
# Fica FORA de conf.d/ para não ser incluído pelo nginx.conf (location só vale dentro de server).
envsubst '${SERVER_NAME} ${verificationDir}' < /etc/nginx/conf.d-templates/app-locations.conf.template > /etc/nginx/app-locations.conf

echo "[entrypoint] Aplicando substituições (SERVER_NAME, verificationDir) nos templates..."
envsubst '${SERVER_NAME} ${verificationDir}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
for f in /etc/nginx/conf.d/*.conf.template; do
  out="${f%.template}"
  envsubst '${SERVER_NAME} ${verificationDir}' < "${f}" > "${out}"
done

echo "[entrypoint] Iniciando nginx..."
exec nginx -g 'daemon off;'