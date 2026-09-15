#!/usr/bin/env bash
#
# backup-db.sh — Snapshot consistente do SQLite para rodar ANTES do deploy.
#
# Por que "cp app.db" e errado aqui:
#   O banco roda em journal_mode=WAL. O arquivo app.db sozinho pode representar
#   um estado antigo, porque todo o historico recente vive em app.db-wal. Uma
#   copia ingenua produz um backup que PERDE registros novos e RESSUSCITA
#   registros ja excluidos (exposicao LGPD em respostas de alunos).
#   VACUUM INTO gera um snapshot atomico e consistente, incluindo o WAL.
#
# Uso:
#   ./scripts/backup-db.sh
#
# Variaveis de ambiente (todas opcionais):
#   BACKUP_KEEP=14           quantos backups manter no maximo
#   BACKUP_MAX_AGE_DAYS=365  idade maxima de um backup (alinhe com RETENTION_DAYS)
#   BACKUP_COMPRESS=1        1 = comprime com gzip, 0 = deixa o .db puro
#   BUN_IMAGE=oven/bun:1     imagem usada para o VACUUM INTO
#   DATA_DIR / DB_FILE / BACKUP_DIR
#
# Copia off-host (opcional, mas recomendada - backup no mesmo disco nao
# sobrevive a perda do disco):
#   BACKUP_REMOTE="instance-20250413-155923:/var/backups/aulas"
#   BACKUP_USE_GCLOUD=1       1 = usa 'gcloud compute ssh' como transporte (mesmo
#                              esquema do alias gcopy do .bashrc); 0 = ssh direto
#   BACKUP_SSH_KEY=~/.ssh/id_ed25519
#   BACKUP_REMOTE_STRICT=0    1 = falha do off-host aborta o deploy
#
# Ordem: o envio off-host acontece ANTES da rotacao local, para que uma falha de
# upload nunca coincida com a remocao dos backups locais antigos.
#
# ATENCAO (segredo fora do backup):
#   Este backup NAO inclui a chave de criptografia. As respostas dos alunos sao
#   cifradas com ENCRYPTION_KEY_256 (fallback JWT_SECRET). Sem essa chave o
#   backup e irrecuperavel. Guarde-a em cofre separado, nunca na mesma pasta.
#
# Saida: 0 = backup criado e VERIFICADO | !=0 = falhou (o deploy deve abortar)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/backend/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/app.db}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_MAX_AGE_DAYS="${BACKUP_MAX_AGE_DAYS:-365}"
BACKUP_COMPRESS="${BACKUP_COMPRESS:-1}"
BUN_IMAGE="${BUN_IMAGE:-oven/bun:1}"

BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_USE_GCLOUD="${BACKUP_USE_GCLOUD:-0}"
BACKUP_SSH_KEY="${BACKUP_SSH_KEY:-$HOME/.ssh/id_ed25519}"
BACKUP_REMOTE_STRICT="${BACKUP_REMOTE_STRICT:-0}"

send_remote() {
  if [ -z "$BACKUP_REMOTE" ]; then
    log "off-host: desativado (BACKUP_REMOTE vazio) - defina para copiar para outra maquina"
    return 0
  fi

  local rsh_cmd
  if [ "$BACKUP_USE_GCLOUD" = "1" ]; then
    command -v gcloud >/dev/null 2>&1 || {
      log "off-host: gcloud nao encontrado no PATH"
      return 1
    }
    rsh_cmd='sh -c '\''host="$1"; shift; exec gcloud compute ssh "$host" --ssh-key-file="'"$BACKUP_SSH_KEY"'" -- "$@"'\'' --'
  else
    rsh_cmd="ssh -i $BACKUP_SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
  fi

  log "off-host: enviando para $BACKUP_REMOTE"
  rsync -az --partial -e "$rsh_cmd" "$ACTIVE" "$BACKUP_REMOTE/"
}

log() { printf '[backup] %s\n' "$*"; }
die() {
  printf '[backup] ERRO: %s\n' "$*" >&2
  exit 1
}

[ -f "$DB_FILE" ] || die "banco nao encontrado em $DB_FILE"
command -v docker >/dev/null 2>&1 || die "docker nao encontrado no PATH"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
NAME="app.db.backup_${STAMP}"
RAW_PATH="$BACKUP_DIR/$NAME"

log "origem  : $DB_FILE"
log "destino : $RAW_PATH"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$DATA_DIR:/data" \
  -e SRC="/data/$(basename "$DB_FILE")" \
  -e DST="/data/backups/$NAME" \
  "$BUN_IMAGE" bun -e '
    const { Database } = require("bun:sqlite");
    const src = new Database(process.env.SRC, { readonly: true });
    src.run("VACUUM INTO ?", [process.env.DST]);

    const dst = new Database(process.env.DST, { readonly: true });
    const ic = dst.query("PRAGMA integrity_check").get().integrity_check;
    if (ic !== "ok") {
      console.error("[backup] integrity_check reprovou: " + ic);
      process.exit(1);
    }

    const tables = src
      .query("SELECT name FROM sqlite_master WHERE type = \"table\" AND name NOT LIKE \"sqlite_%\" ORDER BY name")
      .all();

    let divergencias = 0;
    for (const t of tables) {
      const id = t.name.replace(/"/g, "\"\"");
      const a = src.query("SELECT COUNT(*) AS c FROM \"" + id + "\"").get().c;
      const b = dst.query("SELECT COUNT(*) AS c FROM \"" + id + "\"").get().c;
      if (a !== b) {
        console.error("[backup] divergencia em " + t.name + ": origem=" + a + " backup=" + b);
        divergencias++;
      }
    }
    src.close();
    dst.close();
    if (divergencias > 0) process.exit(1);
    console.log("[backup] integridade ok | " + tables.length + " tabelas com contagens identicas");
  ' || die "VACUUM INTO / verificacao falhou - backup descartado"

ACTIVE="$RAW_PATH"
if [ "$BACKUP_COMPRESS" = "1" ]; then
  gzip -9 "$RAW_PATH" || die "gzip falhou"
  ACTIVE="$RAW_PATH.gz"
fi

BYTES="$(stat -c '%s' "$ACTIVE" 2>/dev/null || echo 0)"
[ "$BYTES" -gt 0 ] || die "backup gerado com 0 bytes - abortando"

log "ok      : $ACTIVE ($(numfmt --to=iec "$BYTES" 2>/dev/null || echo "${BYTES}B"))"

if ! send_remote; then
  if [ "$BACKUP_REMOTE_STRICT" = "1" ]; then
    die "off-host falhou e BACKUP_REMOTE_STRICT=1 - abortando sem rotacionar"
  fi
  log "AVISO: off-host falhou. O backup LOCAL esta intacto e verificado."
fi

removidos=0
while IFS= read -r old; do
  [ -n "$old" ] || continue
  rm -f "$old"
  removidos=$((removidos + 1))
done < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app.db.backup_*' -printf '%T@ %p\n' |
    sort -rn |
    awk -v keep="$BACKUP_KEEP" 'NR > keep { sub(/^[^ ]+ /, ""); print }'
)

while IFS= read -r old; do
  [ -n "$old" ] || continue
  [ "$old" = "$ACTIVE" ] && continue
  rm -f "$old"
  removidos=$((removidos + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app.db.backup_*' -mtime "+$BACKUP_MAX_AGE_DAYS")

[ "$removidos" -gt 0 ] && log "rotacao : $removidos backup(s) antigo(s) removido(s)"

log "total   : $(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app.db.backup_*' | wc -l) backup(s) em $BACKUP_DIR"
log "concluido com sucesso"
