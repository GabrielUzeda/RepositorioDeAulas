-- Add new columns to atividades table
ALTER TABLE atividades ADD COLUMN json_data TEXT;
ALTER TABLE atividades ADD COLUMN tipo TEXT DEFAULT 'normal';
ALTER TABLE atividades ADD COLUMN senha TEXT;
ALTER TABLE atividades ADD COLUMN allow_password BOOLEAN DEFAULT FALSE;
