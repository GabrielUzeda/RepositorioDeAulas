#!/usr/bin/env bash
#
# install.sh — Instala o timer de backup diario como servico de usuario systemd.
#
# Gera as units com o caminho REAL deste clone (em vez de assumir ~/RepositorioDeAulas_new),
# evitando o ExecStart apontar para um caminho inexistente.
#
# Uso:
#   ./scripts/systemd/install.sh          # instala e habilita
#   ./scripts/systemd/install.sh --remove # remove
#
# Para rodar sem usuario logado: sudo loginctl enable-linger "$USER"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
TEMPLATE_DIR="$REPO_ROOT/scripts/systemd"

log() { printf '[install] %s\n' "$*"; }
die() {
  printf '[install] ERRO: %s\n' "$*" >&2
  exit 1
}

command -v systemctl >/dev/null 2>&1 || die "systemctl nao encontrado (sistema sem systemd?)"

if [ "${1:-}" = "--remove" ]; then
  systemctl --user disable --now aulas-backup.timer 2>/dev/null || true
  rm -f "$UNIT_DIR/aulas-backup.timer" "$UNIT_DIR/aulas-backup.service"
  systemctl --user daemon-reload
  log "removido"
  exit 0
fi

[ -x "$REPO_ROOT/scripts/backup-db.sh" ] || die "scripts/backup-db.sh nao existe ou nao e executavel"

mkdir -p "$UNIT_DIR"

for unit in aulas-backup.service aulas-backup.timer; do
  sed "s|%h/RepositorioDeAulas_new|$REPO_ROOT|g" "$TEMPLATE_DIR/$unit" >"$UNIT_DIR/$unit"
  log "gerado $UNIT_DIR/$unit -> $REPO_ROOT"
done

systemctl --user daemon-reload
systemctl --user enable --now aulas-backup.timer

log "instalado. Proxima execucao:"
systemctl --user list-timers aulas-backup.timer --no-pager || true
log "teste imediato: systemctl --user start aulas-backup.service"
