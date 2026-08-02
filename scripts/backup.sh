#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# SQLite database path
DB_FILE="./backend/data/app.db"
BACKUP_DIR="./backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Timestamp for filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db"

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "❌ sqlite3 não instalado. Instale com: sudo apt install sqlite3 (ou nix shell nixpkgs#sqlite)"
    exit 1
fi

if [ ! -f "$DB_FILE" ]; then
    echo "❌ Banco de dados não encontrado em $DB_FILE. O backend precisa ter sido iniciado ao menos uma vez."
    exit 1
fi

echo "🚀 Iniciando backup do banco SQLite..."

# Hot backup seguro mesmo com WAL ativo
if sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"; then
    echo "✅ Backup concluído com sucesso: $BACKUP_FILE"
else
    echo "❌ Erro ao realizar o backup."
    exit 1
fi
