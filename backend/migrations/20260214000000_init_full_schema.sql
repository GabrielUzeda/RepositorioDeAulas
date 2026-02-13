-- Consolidated migration: init_full_schema
-- Combines initial schema, turmas description, aulas conteudo_md, and atividades new columns

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create Tables with all current columns

CREATE TABLE IF NOT EXISTS turmas (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cor VARCHAR(50),
    icone VARCHAR(50),
    senha VARCHAR(255),
    descricao TEXT, -- Added from 20260211120004
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aulas (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    caminho VARCHAR(255) NOT NULL,
    icone VARCHAR(50),
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    conteudo_md TEXT, -- Added from 20260213120000
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS atividades (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
    external_id VARCHAR(100),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    caminho VARCHAR(255) NOT NULL,
    icone VARCHAR(50),
    json_data TEXT, -- Added from 20260213000000
    tipo TEXT DEFAULT 'normal', -- Added from 20260213000000
    senha TEXT, -- Added from 20260213000000
    allow_password BOOLEAN DEFAULT FALSE, -- Added from 20260213000000
    ordem INTEGER DEFAULT 0, -- Added from 20260213150000
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Triggers

DROP TRIGGER IF EXISTS update_turmas_updated_at ON turmas;
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON turmas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_aulas_updated_at ON aulas;
CREATE TRIGGER update_aulas_updated_at BEFORE UPDATE ON aulas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_atividades_updated_at ON atividades;
CREATE TRIGGER update_atividades_updated_at BEFORE UPDATE ON atividades FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
