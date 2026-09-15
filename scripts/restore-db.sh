#!/usr/bin/env bash
#
# restore-db.sh — Restaura um backup gerado por scripts/backup-db.sh.
#
# Um backup nunca testado nao e um backup. Este script existe para tornar a
# restauracao uma operacao verificada e segura:
#   1. valida a integridade do arquivo de backup ANTES de tocar no banco atual;
#   2. recusa rodar com o bun-server no ar (evita corromper o banco em uso);
#   3. guarda uma copia de seguranca do banco atual antes de sobrescrever.
#
# Uso:
#   ./scripts/restore-db.sh                 # restaura o backup mais recente
#   ./scripts/restore-db.sh <arquivo.gz>    # restaura um backup especifico
#
# Variaveis de ambiente (opcionais):
#   DATA_DIR, DB_FILE, BACKUP_DIR, BUN_IMAGE
#   FORCE=1   permite rodar com o servidor no ar (nao recomendado)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/backend/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/app.db}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
BUN_IMAGE="${BUN_IMAGE:-oven/bun:1}"
FORCE="${FORCE:-0}"

log() { printf '[restore] %s\n' "$*"; }
die() {
  printf '[restore] ERRO: %s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "docker nao encontrado no PATH"

BACKUP_ARG="${1:-}"
if [ -z "$BACKUP_ARG" ]; then
  BACKUP_ARG="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app.db.backup_*' -printf '%T@ %p\n' |
    sort -rn | head -1 | sed 's/^[^ ]* //')"
  [ -n "$BACKUP_ARG" ] || die "nenhum backup encontrado em $BACKUP_DIR"
  log "nenhum arquivo informado - usando o mais recente"
fi
[ -f "$BACKUP_ARG" ] || die "backup nao encontrado: $BACKUP_ARG"
log "backup  : $BACKUP_ARG"

if [ "$FORCE" != "1" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'bun-server'; then
  die "bun-server esta no ar. Pare antes: docker compose stop bun-server (ou FORCE=1)"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

CANDIDATE="$WORK/candidate.db"
case "$BACKUP_ARG" in
*.gz)
  gzip -dc "$BACKUP_ARG" >"$CANDIDATE" || die "falha ao descomprimir (arquivo corrompido?)"
  ;;
*)
  cp "$BACKUP_ARG" "$CANDIDATE"
  ;;
esac

[ -s "$CANDIDATE" ] || die "backup vazio - nada a restaurar"

cp "$CANDIDATE" "$WORK/verify-src.db"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$WORK:/work" \
  "$BUN_IMAGE" bun -e '
    const { Database } = require("bun:sqlite");
    const db = new Database("/work/verify-src.db", { readonly: true });

    const ic = db.query("PRAGMA integrity_check").get().integrity_check;
    if (ic !== "ok") {
      console.error("[restore] integrity_check reprovou: " + ic);
      process.exit(1);
    }

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type = \"table\" AND name NOT LIKE \"sqlite_%\" ORDER BY name")
      .all();

    const esperadas = ["cursos", "disciplinas", "aulas", "atividades", "respostas_alunos", "professores"];
    const faltando = esperadas.filter((e) => !tables.some((t) => t.name === e));
    if (faltando.length > 0) {
      console.error("[restore] tabelas essenciais ausentes: " + faltando.join(", "));
      process.exit(1);
    }

    const resumo = tables
      .map((t) => {
        const id = t.name.replace(/"/g, "\"\"");
        return t.name + "=" + db.query("SELECT COUNT(*) AS c FROM \"" + id + "\"").get().c;
      })
      .join(" ");
    console.log("[restore] integridade ok | " + tables.length + " tabelas");
    console.log("[restore] registros  : " + resumo);
    db.close();
  ' || die "backup reprovado na verificacao - nada foi alterado"

PRE_RESTORE="$BACKUP_DIR/app.db.prerestore_$(date +%Y%m%d_%H%M%S)"
if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$PRE_RESTORE"
  [ -s "$PRE_RESTORE" ] || die "falha ao salvar copia do banco atual"
  log "banco atual salvo em: $PRE_RESTORE"
fi

cp "$CANDIDATE" "$DB_FILE"
rm -f "$DB_FILE-wal" "$DB_FILE-shm"

log "restaurado: $DB_FILE"
log "arquivos -wal/-shm antigos removidos"
log "concluido. Suba o servico: docker compose up -d"
