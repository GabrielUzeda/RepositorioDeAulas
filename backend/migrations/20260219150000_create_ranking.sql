CREATE TABLE IF NOT EXISTS ranking (
    id SERIAL PRIMARY KEY,
    atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    nome_jogador VARCHAR(255) NOT NULL,
    pontuacao INTEGER NOT NULL,
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ranking_atividade_pontuacao ON ranking(atividade_id, pontuacao DESC);
