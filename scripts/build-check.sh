#!/usr/bin/env bash
# Garante que o build do frontend não falhe por permissão de frontend/dist
# (problema conhecido: dist/ pode ficar com dono root após builds feitos dentro
#  de containers Docker, causando EACCES ao rodar `npm run build` no host).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
DIST_DIR="$FRONTEND_DIR/dist"

cd "$FRONTEND_DIR"

if [ -d "$DIST_DIR" ] && [ ! -w "$DIST_DIR" ]; then
  echo "[build-check] frontend/dist não gravável (provável dono root); rebuild em /tmp e sincroniza de volta."
  TMP_DIR="$(mktemp -d)"
  npx vite build --outDir "$TMP_DIR"
  rm -rf "$DIST_DIR"
  mkdir -p "$DIST_DIR"
  cp -r "$TMP_DIR"/. "$DIST_DIR"/
  rm -rf "$TMP_DIR"
else
  echo "[build-check] rodando build padrão (vue-tsc && vite build)"
  npm run build
fi

echo "[build-check] build concluído em $DIST_DIR"
