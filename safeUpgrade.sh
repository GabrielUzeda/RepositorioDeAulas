#!/bin/bash

# safeUpgrade.sh - Script de Deploy Seguro para Produção
# Autor: Antigravity (via Gemini)
# Data: $(date +%Y-%m-%d)
#
# Este script atualiza o código fonte (templates/assets), realiza o backup do
# banco SQLite, e reinicia os serviços.

set -e # Aborta se ocorrer qualquer erro

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Iniciando Processo de Deploy Seguro ===${NC}"

# 1. Carregar variáveis de ambiente (se existirem)
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo -e "${GREEN}[OK]${NC} Variáveis de ambiente carregadas."
else
    echo -e "${RED}[ERROR]${NC} Arquivo .env não encontrado. Abortando deploy."
    exit 1
fi

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="./backend/data/app.db"

# 2. Verificar Pré-requisitos
command -v docker >/dev/null 2>&1 || { echo -e "${RED}[ERROR]${NC} Docker não instalado."; exit 1; }
command -v git >/dev/null 2>&1 || { echo -e "${RED}[ERROR]${NC} Git não instalado."; exit 1; }

# 3. Atualizar Código Fonte (Assets, Templates, etc)
echo -e "\n${YELLOW}>>> Passo 1: Atualizando Repositório Git...${NC}"
git pull || { echo -e "${RED}[ERROR]${NC} Falha no git pull"; exit 1; }
echo -e "${GREEN}[OK]${NC} Git pull concluído."

# 4. Derrubar containers antes do backup (cópia segura do SQLite)
echo -e "\n${YELLOW}>>> Passo 2: Derrubando serviços...${NC}"
docker compose -f docker-compose.prod.yml down

# 5. Realizar Backup do Banco de Dados SQLite
echo -e "\n${YELLOW}>>> Passo 3: Realizando Backup do Banco de Dados...${NC}"
mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
    BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.db"
    if cp "$DB_FILE" "$BACKUP_FILE"; then
        echo -e "${GREEN}[OK]${NC} Backup realizado com sucesso: $BACKUP_FILE"
        echo "Tamanho do backup: $(du -h "$BACKUP_FILE" | cut -f1)"
    else
        echo -e "${RED}[ERROR]${NC} Falha ao copiar o banco de dados."
        exit 1
    fi
else
    echo -e "${YELLOW}[WARN]${NC} Banco de dados não encontrado em $DB_FILE. Pulando backup (assumindo primeira execução)."
fi

# 6. Subir os serviços
echo -e "\n${YELLOW}>>> Passo 4: Subindo serviços...${NC}"

if docker compose -f docker-compose.prod.yml up -d; then
    echo -e "${GREEN}[OK]${NC} Containers iniciados."
else
    echo -e "${RED}[ERROR]${NC} Falha ao subir containers."
    exit 1
fi

# 7. Verificação Final e Logs
echo -e "\n${YELLOW}>>> Passo 5: Verificando status...${NC}"
sleep 5 # Aguardar um pouco para o startup inicial
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n${GREEN}=== Deploy Concluído! ===${NC}"
echo "Verifique os logs abaixo para confirmar que o backend subiu corretamente:"
echo "Comando sugerido: docker logs bun-server --tail 50"
