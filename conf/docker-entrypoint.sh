#!/bin/sh
set -e

echo "==> SERVER_NAME: $SERVER_NAME"

if [ -z "$SERVER_NAME" ]; then
  echo "❌ ERROR: SERVER_NAME is not set. Exiting."
  exit 1
fi

echo "==> Rendering nginx.conf..."
envsubst '${SERVER_NAME}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

CERT_DIR="/etc/letsencrypt/live/${SERVER_NAME}"
CERT_FILE="${CERT_DIR}/fullchain.pem"

# Espera pelo certificado (opcional, evita crash inicial)
MAX_WAIT=300
WAITED=0
SLEEP=5

echo "==> Waiting for certificate to appear at $CERT_FILE ..."
while [ ! -f "$CERT_FILE" ] && [ $WAITED -lt $MAX_WAIT ]; do
  echo "   ... not found yet (${WAITED}s elapsed)"
  sleep $SLEEP
  WAITED=$((WAITED + SLEEP))
done

if [ ! -f "$CERT_FILE" ]; then
  echo "⚠️ WARNING: Certificate not found after ${WAITED}s. Starting Nginx anyway."
else
  echo "✅ Certificate found. Starting Nginx..."
fi

exec nginx -g 'daemon off;'
