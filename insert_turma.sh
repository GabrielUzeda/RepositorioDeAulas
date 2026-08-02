#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

DB_FILE="./backend/data/app.db"

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "❌ sqlite3 não instalado. Instale com: sudo apt install sqlite3 (ou nix shell nixpkgs#sqlite)"
    exit 1
fi

if [ ! -f "$DB_FILE" ]; then
    echo "❌ Banco de dados não encontrado em $DB_FILE. O backend precisa ter sido iniciado ao menos uma vez."
    exit 1
fi

echo "Inserindo turma no banco SQLite ($DB_FILE)..."

sqlite3 "$DB_FILE" "INSERT OR IGNORE INTO turmas (id, slug, nome, cor, icone, senha, criado_em, atualizado_em, descricao) VALUES (8, 'sistemas_de_computação', 'Sistemas de Computação', 'bg-indigo-500', 'memory', 'sc202601', '2026-02-11 19:53:57.958168+00', '2026-02-11 19:53:57.958168+00', 'A disciplina capacita o aluno a compreender a integração entre hardware, sistemas operacionais e redes, focando em como essa infraestrutura técnica sustenta e influencia o desempenho e a viabilidade de aplicações web e mobile.');"

if [ $? -eq 0 ]; then
    echo "✅ Turma inserida (ou já existia)."
else
    echo "❌ Erro ao inserir a turma."
    exit 1
fi
