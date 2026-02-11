-- Add descricao column to turmas
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Update existing data with some descriptions
UPDATE turmas SET descricao = 'Estudo de métricas, dispersão e probabilidade com Python.' WHERE slug = 'estatistica';
UPDATE turmas SET descricao = 'Preparatório para o ENEM com foco em Banco de Dados e IA.' WHERE slug = 'terceirao';
UPDATE turmas SET descricao = 'Fundamentos de lógica, tabelas-verdade e algoritmos.' WHERE slug = 'logica';
UPDATE turmas SET descricao = 'Visualização de dados e gráficos com Matplotlib.' WHERE slug = 'visualizacao_dados';
UPDATE turmas SET descricao = 'Engenharia de software e ciclo de vida de sistemas.' WHERE slug = 'sistemas_aplicados';
