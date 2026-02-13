#!/bin/bash

# safeUpgrade.sh - Script de Deploy Seguro para Produção
# Autor: Antigravity (via Gemini)
# Data: $(date +%Y-%m-%d)
#
# Este script realiza o backup do banco de dados, atualiza o código fonte (templates/assets),
# solicita a confirmação do novo binário e reinicia os serviços.

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

# Definir variáveis do banco se não estiverem no .env
DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-postgres}
DB_CONTAINER="postgres-db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# 2. Verificar Pré-requisitos
command -v docker >/dev/null 2>&1 || { echo -e "${RED}[ERROR]${NC} Docker não instalado."; exit 1; }
command -v git >/dev/null 2>&1 || { echo -e "${RED}[ERROR]${NC} Git não instalado."; exit 1; }

# 3. Realizar Backup do Banco de Dados
echo -e "\n${YELLOW}>>> Passo 1: Realizando Backup do Banco de Dados...${NC}"
mkdir -p "$BACKUP_DIR"

if docker ps | grep -q "$DB_CONTAINER"; then
    echo "Container do banco ($DB_CONTAINER) encontrado. Iniciando dump..."
    if docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
        if [ -s "$BACKUP_FILE" ]; then
            echo -e "${GREEN}[OK]${NC} Backup realizado com sucesso: $BACKUP_FILE"
            echo "Tamanho do backup: $(du -h "$BACKUP_FILE" | cut -f1)"
        else
            echo -e "${RED}[ERROR]${NC} Arquivo de backup criado mas está vazio!"
            exit 1
        fi
    else
        echo -e "${RED}[ERROR]${NC} Falha ao executar pg_dump no container."
        exit 1
    fi
else
    echo -e "${YELLOW}[WARN]${NC} Container do banco não está rodando. Pulando backup (assumindo primeira execução ou parado)."
fi

# 4. Atualizar Código Fonte (Assets, Templates, etc)
echo -e "\n${YELLOW}>>> Passo 2: Atualizando Repositório Git...${NC}"
git pull || { echo -e "${RED}[ERROR]${NC} Falha no git pull"; exit 1; }
echo -e "${GREEN}[OK]${NC} Git pull concluído."

# 5. Solicitar Confirmação do Binário
echo -e "\n${YELLOW}>>> Passo 3: Verificação do Binário (rust-app)${NC}"
BIN_FILE="./bin/rust-app" # Caminho assumido baseado no docker-compose volumes

if [ -f "$BIN_FILE" ]; then
    echo "Data de modificação do binário atual: $(date -r "$BIN_FILE")"
else
    echo -e "${YELLOW}[WARN]${NC} Binário não encontrado em $BIN_FILE (pode estar em outro local ou não montado ainda)."
fi

echo -e "${YELLOW}!!! ATENÇÃO !!!${NC}"
echo "Certifique-se de que você JÁ FEZ O UPLOAD do novo binário compilado ('rust-app') para o servidor."
echo "Este script irá reiniciar o serviço para carregar o novo binário e rodar as migrações."
read -p "Você confirma que o novo binário já está no local correto e deseja prosseguir? (s/N): " confirm

if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
    echo -e "${RED}Deploy cancelado pelo usuário.${NC}"
    exit 0
fi

# 6. Reiniciar Serviços
echo -e "\n${YELLOW}>>> Passo 4: Reiniciando Serviços...${NC}"

# Derrubar containers antigos para garantir recriação limpa
docker compose -f docker-compose.prod.yml down

# Subir novamente em background
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
echo "Verifique os logs abaixo para confirmar que as migrações rodaram corretamente:"
echo "Comando sugerido: docker logs rust-server --tail 50"
