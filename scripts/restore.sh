#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# SQLite database path
DB_FILE="./backend/data/app.db"

if [ -z "$1" ]; then
    echo "❌ Uso: $0 <arquivo_backup.db>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

# Se o backend estiver rodando, o arquivo pode estar travado; recomendamos parar o serviço antes.
if pgrep -f "bun run src/index.ts" >/dev/null 2>&1 || pgrep -f "bun src/index.ts" >/dev/null 2>&1; then
    echo "⚠️  O backend parece estar em execução. Pare-o antes de restaurar para evitar perda de dados."
    read -p "Deseja continuar mesmo assim? (s/N): " confirm
    if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
        echo "❌ Restauração cancelada."
        exit 1
    fi
fi

mkdir -p "$(dirname "$DB_FILE")"

echo "🚀 Restaurando backup: $BACKUP_FILE..."
if cp "$BACKUP_FILE" "$DB_FILE"; then
    echo "✅ Restauração concluída com sucesso!"
    echo "Reinicie o backend para aplicar: docker compose restart bun-server (ou docker compose -f docker-compose.prod.yml restart bun-server)"
else
    echo "❌ Erro ao restaurar o banco de dados."
    exit 1
fi
