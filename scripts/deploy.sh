#!/usr/bin/env bash
#
# deploy.sh — Deploy com backup OBRIGATORIO do banco.
#
# O ponto central: se o backup falhar, o deploy nao acontece.
# Um backup que pode ser ignorado nao protege nada.
#
# Uso:
#   ./scripts/deploy.sh            # producao (docker-compose.prod.yml, sem nginx)
#   ./scripts/deploy.sh nginx      # producao com nginx + certbot
#   ./scripts/deploy.sh dev        # ambiente de desenvolvimento
#   SKIP_GIT_PULL=1 ./scripts/deploy.sh   # nao roda git pull
#
# Variaveis: BACKUP_KEEP, BACKUP_MAX_AGE_DAYS, BACKUP_COMPRESS (ver backup-db.sh)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-prod}"
COMPOSE_FILE=""
PROFILE_ARGS=""

case "$MODE" in
prod) COMPOSE_FILE="docker-compose.prod.yml" ;;
nginx)
  COMPOSE_FILE="docker-compose.prod.yml"
  PROFILE_ARGS="with-nginx"
  ;;
dev) COMPOSE_FILE="docker-compose.yml" ;;
*)
  printf '[deploy] uso: %s [prod|nginx|dev]\n' "$0" >&2
  exit 1
  ;;
esac

log() { printf '[deploy] %s\n' "$*"; }

log "1/3 backup do banco"
if [ -f "${DATA_DIR:-$REPO_ROOT/backend/data}/app.db" ]; then
  if ! ./scripts/backup-db.sh; then
    printf '[deploy] ABORTADO: o backup falhou. Nenhuma alteracao foi feita.\n' >&2
    exit 1
  fi
else
  log "banco ainda nao existe (primeiro deploy) - backup ignorado"
fi

if [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  log "2/3 atualizando codigo"
  git pull --ff-only
else
  log "2/3 git pull ignorado (SKIP_GIT_PULL=1)"
fi

log "3/3 subindo containers ($COMPOSE_FILE)"
if [ -n "$PROFILE_ARGS" ]; then
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE_ARGS" up -d
else
  docker compose -f "$COMPOSE_FILE" up -d
fi

docker compose -f "$COMPOSE_FILE" ps
log "deploy concluido. Para reverter o banco: ./scripts/restore-db.sh"
