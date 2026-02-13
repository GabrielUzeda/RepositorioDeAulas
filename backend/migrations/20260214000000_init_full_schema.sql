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
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure description exists (idempotent addition)
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS descricao TEXT;

CREATE TABLE IF NOT EXISTS aulas (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    caminho VARCHAR(255) NOT NULL,
    icone VARCHAR(50),
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS conteudo_md TEXT;
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS atividades (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
    external_id VARCHAR(100),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    caminho VARCHAR(255) NOT NULL,
    icone VARCHAR(50),
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS json_data TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'normal';
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS senha TEXT;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS allow_password BOOLEAN DEFAULT FALSE;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

-- Triggers

DROP TRIGGER IF EXISTS update_turmas_updated_at ON turmas;
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON turmas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_aulas_updated_at ON aulas;
CREATE TRIGGER update_aulas_updated_at BEFORE UPDATE ON aulas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_atividades_updated_at ON atividades;
CREATE TRIGGER update_atividades_updated_at BEFORE UPDATE ON atividades FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
