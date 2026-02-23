#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration using env vars with defaults from .env
CONTAINER_NAME="postgres-db"
DB_USER=${POSTGRES_USER:-"postgres"}
DB_NAME=${POSTGRES_DB:-"postgres"}

if [ -z "$1" ]; then
    echo "❌ Uso: $0 <arquivo_backup.sql>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

echo "🚀 Restaurando backup: $BACKUP_FILE..."

# Stream the backup file into the container's psql
cat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Restauração concluída com sucesso!"
else
    echo "❌ Erro ao restaurar o banco de dados."
    exit 1
fi
