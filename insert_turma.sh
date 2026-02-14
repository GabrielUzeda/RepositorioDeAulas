#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-postgres}
CONTAINER_NAME="postgres-db"

echo "Inserindo turma no banco '$DB_NAME' usando usuário '$DB_USER' no container '$CONTAINER_NAME'..."

docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO turmas (id, slug, nome, cor, icone, senha, criado_em, atualizado_em, descricao) VALUES (8, 'sistemas_de_computação', 'Sistemas de Computação', 'bg-indigo-500', 'memory', 'sc202601', '2026-02-11 19:53:57.958168+00', '2026-02-11 19:53:57.958168+00', 'A disciplina capacita o aluno a compreender a integração entre hardware, sistemas operacionais e redes, focando em como essa infraestrutura técnica sustenta e influencia o desempenho e a viabilidade de aplicações web e mobile.') ON CONFLICT (id) DO NOTHING;"
