#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration using env vars with defaults from .env
CONTAINER_NAME="postgres-db"
DB_USER=${POSTGRES_USER:-"postgres"}
DB_NAME=${POSTGRES_DB:-"postgres"}
BACKUP_DIR="./backups"
INIT_DB_DIR="./init-db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$INIT_DB_DIR"

# Timestamp for filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "🚀 Iniciando backup do banco de dados..."

# Run pg_dump inside the container
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup concluído com sucesso: $BACKUP_FILE"
    
    # Copy to init-db for automatic restoration on next fresh start
    cp "$BACKUP_FILE" "$INIT_DB_DIR/01_latest_backup.sql"
    echo "📌 Cópia preparada em $INIT_DB_DIR/01_latest_backup.sql para restauração automática."
else
    echo "❌ Erro ao realizar o backup."
    exit 1
fi
