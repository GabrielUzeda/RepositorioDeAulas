-- Seed Data

-- Estatística
WITH t AS (INSERT INTO turmas (slug, nome, cor, icone, senha) VALUES ('estatistica', 'Ciência de Dados - Estatística', 'bg-purple-500', 'bar_chart', 'legado') RETURNING id)
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem) VALUES
((SELECT id FROM t), 'Métricas Estatísticas', 'turmas/estatistica/aulas/media_moda_mediana.html', '01', 'Conceitos de média, moda e mediana', 1),
((SELECT id FROM t), 'Dispersão de Dados', 'turmas/estatistica/aulas/desviopadrao.html', '02', 'Desvio padrão e medidas de dispersão', 2),
((SELECT id FROM t), 'Introdução a Python', 'turmas/estatistica/aulas/introducao_python.html', '03', 'Uma breve introducao à linguagem Python', 3),
((SELECT id FROM t), 'Listas em Python', 'turmas/estatistica/aulas/vetores_array.html', '04', 'Conceitos e exemplos de listas em Python', 4),
((SELECT id FROM t), 'Tratamento de Erros (try/except)', 'turmas/estatistica/aulas/try_expection_python.html', '05', 'Conceitos e exemplos de try/except, else e finally', 5),
((SELECT id FROM t), 'Importando Bibliotecas (Matplotlib)', 'turmas/estatistica/aulas/importando_blibiotecas_python.html', '06', 'Como instalar e importar matplotlib; exemplo prático', 6),
((SELECT id FROM t), 'Laços de Repetição', 'turmas/estatistica/aulas/lacos_python.html', '07', 'Aula sobre laços for e while', 7),
((SELECT id FROM t), 'Listas em Python 02', 'turmas/estatistica/aulas/listas_parte02.html', '08', 'Aula sobre Listas Sort, Zip e For', 8),
((SELECT id FROM t), 'Matplotlib Parte 01', 'turmas/estatistica/aulas/matplotlib_parte01.html', '09', 'Aula prática sobre Matplotlib', 9),
((SELECT id FROM t), 'Matplotlib Parte 02', 'turmas/estatistica/aulas/matplotlib_parte02.html', '09', 'Aula prática sobre Matplotlib, segunda parte.', 10),
((SELECT id FROM t), 'União e Interseção', 'turmas/estatistica/aulas/Uniao_Intersecao.html', '10', 'Aula prática sobre conjutos: união e interseção.', 11),
((SELECT id FROM t), 'Probabilidade Condicional e Independencia', 'turmas/estatistica/aulas/Probabilidade_Condicional_Independencia.html', '11', 'Conceitos básicos de probabilidade', 12),
((SELECT id FROM t), 'Probabilidade Condicional em Python', 'turmas/estatistica/aulas/probabilidade_python.html', '12', 'Conceitos básicos de probabilidade usando python', 13),
((SELECT id FROM t), 'Probabilidade de Eventos A e B', 'turmas/estatistica/aulas/probabilidade_e_ou.html', '13', 'Conceitos de probabilidade de eventos A e B', 14),
((SELECT id FROM t), 'Quartis e Percentis', 'turmas/estatistica/aulas/quartis_percentis.html', '14', 'Medidas de posição: entendendo quartis, percentis e intervalo interquartil (IQR) para análise robusta de dados', 15),
((SELECT id FROM t), 'Covariância e Correlação Linear', 'turmas/estatistica/aulas/covariancia_correlacao_linear.html', '15', 'Conceitos de covariância e correlação linear: interpretação, cálculo e aplicações práticas', 16),
((SELECT id FROM t), 'Teste Z', 'turmas/estatistica/aulas/teste_z.html', '16', 'Teste Z: tomada de decisão com dados, hipóteses estatísticas e significância estatística', 17),
((SELECT id FROM t), 'Trabalho Final', 'turmas/estatistica/aulas/trabalho_final.html', '16', 'Apresentação do trabalho final da disciplina', 18);

INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv1', 'Introdução a estatística', 'Aplique os conceitos de média, moda e mediana e desvio padrão', 'turmas/estatistica/atividades/introducao.html', '01-02' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv2', 'Exercícios introdutórios de Python', 'Resolva os exercícios propostos sobre python', 'turmas/terceirao/atividades/introducao_python.html', '03' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv3', 'Bibliotecas & Listas & Tratamento de Erros em Python', 'Questionário sobre instalação/importação de bibliotecas e try/except', 'turmas/estatistica/atividades/try_libs_python.html', '04-06' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'lacos_python', 'Laços de Repetição em Python', 'Atividade sobre for e while', 'turmas/estatistica/atividades/laco_python.html', '07' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'matplotlib_01', 'Matplotlib 01', 'Atividade prática sobre matplotlib', 'turmas/estatistica/atividades/matplotlib01.html', '08-09' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'matplotlib_02', 'Matplotlib 02', 'Atividade prática sobre matplotlib', 'turmas/estatistica/atividades/matplotlib02.html', '09' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'provaA', 'Avaliação - Grupo A', 'Primeira Avaliação da disciplina', 'turmas/estatistica/atividades/provaA.html', 'A1' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'provaB', 'Avaliação - Grupo B', 'Primeira Avaliação da disciplina', 'turmas/estatistica/atividades/provaB.html', 'A1' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'provaC', 'Avaliação - Grupo C', 'Primeira Avaliação da disciplina', 'turmas/estatistica/atividades/provaC.html', 'A1' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'probabilidade_condicional', 'Probabilidade Condicional e Independência', 'Exercícios sobre probabilidade condicional e independência', 'turmas/estatistica/atividades/Probabilidade_Condicional_Independencia.html', '10-11' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'probabilidade_condicional2', 'Probabilidade & Python', 'Exercícios sobre probabilidade condicional e independência usando python', 'turmas/estatistica/atividades/python_probabilidade.html', '10-11' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'probabilidade_eventosA_e_B', 'Probabilidade de Eventos A e B', 'Exercícios sobre probabilidade de eventos A e B', 'turmas/estatistica/atividades/probabilidade_e_ou.html', '12-13' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'quartis_percentis', 'Quartis e Percentis', 'Exercícios sobre quartis, percentis e intervalo interquartil (IQR)', 'turmas/estatistica/atividades/quartis_percentis.html', '14' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'covariancia_correlacao_linear', 'Covariância e Correlação Linear', 'Exercícios sobre covariância, correlação de Pearson e interpretação de relações entre variáveis', 'turmas/estatistica/atividades/covariancia_correlacao_linear.html', '15' FROM turmas WHERE slug = 'estatistica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'teste_z', 'Teste Z', 'Exercícios sobre teste Z, hipóteses estatísticas e tomada de decisão com dados', 'turmas/estatistica/atividades/teste_z.html', '16' FROM turmas WHERE slug = 'estatistica';

-- Terceirão
WITH t AS (INSERT INTO turmas (slug, nome, cor, icone, senha) VALUES ('terceirao', 'Terceirão', 'bg-yellow-500', 'school', 'legado') RETURNING id)
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem) VALUES
((SELECT id FROM t), 'Introdução a Bancos de Dados', 'turmas/terceirao/aulas/banco_de_dados.html', '01', 'Aprenda sobre Bancos de Dados de forma prática e com exemplos do dia a dia. Do básico ao avançado com MySQL.', 1),
((SELECT id FROM t), 'cURL', 'turmas/terceirao/aulas/curl.html', '02', 'Introdução ao cURL e suas aplicações', 2),
((SELECT id FROM t), 'Introdução a Python', 'turmas/terceirao/aulas/introducao_python.html', '03', 'Uma breve introducao à linguagem Python', 3),
((SELECT id FROM t), 'Laços de Repetição', 'turmas/terceirao/aulas/lacos_python.html', '04', 'Aula sobre laços for e while', 4),
((SELECT id FROM t), 'Projeto Enem', 'turmas/terceirao/aulas/projeto_enem.html', '05', 'Aula sobre o projeto final do enem', 5),
((SELECT id FROM t), 'Projeto Enem: MySQL - Python', 'turmas/terceirao/aulas/projeto_enem_bd_python.html', '06', 'Aula de como estruturar o banco de dados e o backend', 6),
((SELECT id FROM t), 'Projeto Enem: JSON', 'turmas/terceirao/aulas/projeto_enem_json.html', '07', 'Aula de como estruturar o frontend', 7),
((SELECT id FROM t), 'Projeto Enem: Prompts IA', 'turmas/terceirao/aulas/projeto_enem_ia.html', '07', 'Aula de como fazer bons prompts para a IA', 8),
((SELECT id FROM t), 'Banco de Dados Parte 02', 'turmas/terceirao/aulas/banco_de_dados_parte02.html', '08', 'Aula de como gerar relacionamentos basicos em Mysql', 9),
((SELECT id FROM t), 'Projeto Enem: Melhorias', 'turmas/terceirao/aulas/refinamentosEnem.html', '09', 'Aula de segestões para melhorar o projeto ENEM', 10),
((SELECT id FROM t), 'Projeto Enem: Exposicao da API', 'turmas/terceirao/aulas/enemParte04.html', '10', 'Aula de como usar o ngrok para expor a IA', 11),
((SELECT id FROM t), 'Tokens JWT', 'turmas/terceirao/aulas/enem_parte05.html', '11', 'Entenda JSON Web Tokens (Header, Payload, Signature), o fluxo de autenticação/autorização com JWT e boas práticas para proteger APIs e ações administrativas.', 12),
((SELECT id FROM t), 'Banco de Dados Parte 03', 'turmas/terceirao/aulas/banco_de_dados_parte03.html', '12', 'Resumo das novas funcionalidades do projeto ENEM', 13),
((SELECT id FROM t), 'Projeto ENEM: Fase Final', 'turmas/terceirao/aulas/trabalho_final_enem.html', '13', 'Instruções de cada equipe para a Fase final do Projeto ENEM', 14),
((SELECT id FROM t), 'Hackathon do Terceirão', 'turmas/terceirao/aulas/hackathon.html', '14', 'Instruções para a dinâmica do Hackathon do Terceirão', 15),
((SELECT id FROM t), 'Resumo do Terceirão', 'turmas/terceirao/aulas/resumao.html', '15', 'Resumo dos conceitos gerais do curso', 16);

INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv1', 'Exercícios de BD/SGBD e cURL', 'Resolva os exercícios propostos sobre conceitos de BG SGBD e cURL', 'turmas/terceirao/atividades/bd-sgbd-curl.html', '01-02' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv2', 'Exercícios introdutórios de Python', 'Resolva os exercícios propostos sobre python', 'turmas/terceirao/atividades/introducao_python.html', '03' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'lacos_python', 'Laços de Repetição em Python', 'Atividade sobre for e while', 'turmas/terceirao/atividades/laco_python.html', '04' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'ENEM_IA', 'Projeto ENEM: Equipe Gekko', 'Instruções da equipe IA para o Projeto ENEM', 'turmas/terceirao/atividades/ENEM_IA.html', '06-09' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'ENEM_PYTHON', 'Projeto ENEM: Equipe Asuma', 'Instruções da equipe Python para o Projeto ENEM', 'turmas/terceirao/atividades/ENEM_PYTHON.html', '06-09' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'ENEM_SQL', 'Projeto ENEM: Equipe Iruka', 'Instruções da equipe SQL para o Projeto ENEM', 'turmas/terceirao/atividades/ENEM_SQL.html', '06-09' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'ENEM_JSON', 'Projeto ENEM: Equipe Anko', 'Instruções da equipe JSON para o Projeto ENEM', 'turmas/terceirao/atividades/ENEM_JSON.html', '06-09' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'ENEM_F2', 'Projeto ENEM: Fase 02', 'Instruções de cada equipe para a Fase 02 do Projeto ENEM', 'turmas/terceirao/atividades/ENEM_Fase02.html', '10-12' FROM turmas WHERE slug = 'terceirao';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atividade_extra', 'Atividade Avaliativa Extra', 'Atividade avaliativa do Projeto Gerador de Questões ENEM', 'turmas/terceirao/atividades/atividade_extra.html', '13' FROM turmas WHERE slug = 'terceirao';

-- Lógica de Programação
WITH t AS (INSERT INTO turmas (slug, nome, cor, icone, senha) VALUES ('logica', 'Lógica de Programação', 'bg-blue-500', 'code', 'legado') RETURNING id)
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem) VALUES
((SELECT id FROM t), 'Lógica de Programação: Algoritmos', 'turmas/logica/aulas/introducao_algoritmos.html', '01', 'Conceitos básicos de lógica de programação', 1),
((SELECT id FROM t), 'Lógica de Programação: Tabela-Verdade', 'turmas/logica/aulas/tabela_verdade.html', '02', 'Conceitos básicos de lógica condicional', 2),
((SELECT id FROM t), 'Lógica de Programação: Tabela-Verdade 02', 'turmas/logica/aulas/se_entao.html', '03', 'Conceitos básicos de lógica condicional: Se... Então...', 3),
((SELECT id FROM t), 'Lógica de Programação: Conectivos Lógicos', 'turmas/logica/aulas/conectivos_logicos.html', '04', 'Representação, uso e simbologia dos conectivos lógicos AND, OR, NOT e XOR', 4),
((SELECT id FROM t), 'Lógica de Programação: Leis Lógica', 'turmas/logica/aulas/leis_logica.html', '05', 'Leis da lógica proposicional e suas aplicações na programação', 5),
((SELECT id FROM t), 'Estruturas de Controle', 'turmas/logica/aulas/estrutura_controle.html', '06', 'Condicionais (if/elif/else) e estruturas de repetição (for, while) com exemplos práticos', 6),
((SELECT id FROM t), 'Compiladores e Interpretadores', 'turmas/logica/aulas/interpretador_compilador.html', '07', 'Diferenças entre compilação e interpretação, e introdução ao JIT', 7),
((SELECT id FROM t), 'Modularização na Programação', 'turmas/logica/aulas/modularizacao.html', '08', 'Como dividir código em módulos e funções: alta coesão e baixo acoplamento', 8),
((SELECT id FROM t), 'Vetores e Matrizes', 'turmas/logica/aulas/vetores_matrizes.html', '09', 'Vetores (listas) e matrizes (arrays 2D): conceitos, exemplos e cuidados', 9),
((SELECT id FROM t), 'Tipos Compostos e Estruturas de Dados', 'turmas/logica/aulas/tipos_compostos_estrutura_dados.html', '10', 'Organizando Informações no Código: Listas, Arrays e Dicionários', 10),
((SELECT id FROM t), 'Manipulação de Arquivos e Bibliotecas', 'turmas/logica/aulas/arquivos_e_blibioteca.html', '11', 'A Lógica da Manipulação de Arquivos e uso de Bibliotecas em Python', 11);

INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv1', 'Exercícios de Introdução e Algoritmos', 'Resolva os exercícios propostos sobre introdução à lógica e algoritmos', 'turmas/logica/atividades/introducao_algoritmos.html', '01' FROM turmas WHERE slug = 'logica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv2', 'Exercícios de Introdução Tabela Verdade', 'Resolva os exercícios propostos sobre Tabela Verdade', 'turmas/logica/atividades/tabela_verdade.html', '02' FROM turmas WHERE slug = 'logica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv3', 'Exercícios de Introdução Tabela Verdade 02', 'Resolva os exercícios propostos sobre Tabela Verdade: Se então', 'turmas/logica/atividades/se_entao.html', '03' FROM turmas WHERE slug = 'logica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv4', 'Exercícios de Conectivos Lógicos', 'Exercícios para exercitar o uso dos conectivos lógicos AND, OR, NOT e XOR', 'turmas/logica/atividades/conectivos_logicos.html', '04' FROM turmas WHERE slug = 'logica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'atv5', 'Leis da Lógica Proposicional', 'Exercícios para aplicar De Morgan, distributiva, contrapositiva, precedência e simplificação.', 'turmas/logica/atividades/leis_logica.html', '05' FROM turmas WHERE slug = 'logica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'estrutura_interpretador_compilador_modularizacao_vetores_matrizes', 'Atividade — Estruturas, Interpretador/Compilador, Modularização e Vetores', 'Questionário sobre interpretadores/compiladores, estruturas de controle, vetores/matrizes e modularização.', 'turmas/logica/atividades/estrutura_interpretador_compilador_modularizacao_vetores_matrizes.html', '06-09' FROM turmas WHERE slug = 'logica';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'tipos_compostos_arquivos', 'Atividade - Tipos Compostos e Manipulação de Arquivos', 'Questões sobre tipos compostos, estruturas de dados e manipulação de arquivos em Python', 'turmas/logica/atividades/tipos_compostos_arquivos.html', '10-11' FROM turmas WHERE slug = 'logica';

-- Visualização de Dados
WITH t AS (INSERT INTO turmas (slug, nome, cor, icone, senha) VALUES ('visualizacao_dados', 'Visualização de Dados', 'bg-green-500', 'bar_chart', 'legado') RETURNING id)
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem) VALUES
((SELECT id FROM t), 'Introdução a Python', 'turmas/visualizacao_dados/aulas/introducao_python.html', '00', 'Uma breve introducao à linguagem Python', 0),
((SELECT id FROM t), 'Listas em Python', 'turmas/visualizacao_dados/aulas/vetores_array.html', '01', 'Conceitos e exemplos de listas em Python', 1),
((SELECT id FROM t), 'Laços de Repetição', 'turmas/visualizacao_dados/aulas/lacos_python.html', '02', 'Conceitos fundamentais de laços for e while em Python', 2),
((SELECT id FROM t), 'Listas em Python 02', 'turmas/visualizacao_dados/aulas/listas_parte02.html', '03', 'Aula sobre Listas Sort, Zip e For', 3),
((SELECT id FROM t), 'Matplotlib', 'turmas/visualizacao_dados/aulas/matplotlib.html', '04', 'Aula sobre Matplotlib', 4),
((SELECT id FROM t), 'Matplotlib 02', 'turmas/visualizacao_dados/aulas/matplotlib02.html', '05', 'Aula sobre Matplotlib', 5),
((SELECT id FROM t), 'Carregando Dados CSV:', 'turmas/visualizacao_dados/aulas/csv.html', '06', 'Como carregar e manipular dados em formato CSV usando Python', 6),
((SELECT id FROM t), 'Trabalho Final', 'turmas/visualizacao_dados/aulas/trabalho_final.html', '07', 'Instruções para o trabalho final da disciplina', 7);

INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'introducao_python', 'Exercícios introdutórios de Python', 'Atividade prática sobre conceitos básicos de Python', 'turmas/visualizacao_dados/atividades/introducao_python.html', '00' FROM turmas WHERE slug = 'visualizacao_dados';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'listas_python', 'Listas em Python', 'Exercícios sobre listas e manipulação de dados', 'turmas/visualizacao_dados/atividades/vetores_array.html', '01' FROM turmas WHERE slug = 'visualizacao_dados';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'laco_python', 'Laços em Python', 'Exercícios sobre laços e manipulação de dados', 'turmas/visualizacao_dados/atividades/laco_python.html', '02-03' FROM turmas WHERE slug = 'visualizacao_dados';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'matplotlib_01', 'Matplotlib', 'Exercícios introdutorios sobre matplotlib', 'turmas/visualizacao_dados/atividades/matplotlib.html', '04' FROM turmas WHERE slug = 'visualizacao_dados';
INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone)
SELECT id, 'matplotlib_02', 'Matplotlib 02', 'Exercícios intermediarios sobre matplotlib', 'turmas/visualizacao_dados/atividades/matplotlib02.html', '05' FROM turmas WHERE slug = 'visualizacao_dados';

-- Sistemas Aplicados
INSERT INTO turmas (slug, nome, cor, icone, senha) VALUES ('sistemas_aplicados', 'Sistemas Aplicados', 'bg-pink-500', 'computer', 'legado');
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Versionamento', 'turmas/sistemas_aplicados/aulas/versionamento.html', '01', 'Introdução ao versionamento de código com Git e o comando diff', 1 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Mapeando a Dor do Usuário', 'turmas/sistemas_aplicados/aulas/dor_historia_usuario.html', '02', 'Como identificar e traduzir dores do usuário em Histórias de Usuário acionáveis; técnicas de Personas e Jornada do Usuário.', 2 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'APIs: O Que São e Sua Importância', 'turmas/sistemas_aplicados/aulas/apis.html', '03', 'Conceitos fundamentais de APIs: o que são, como funcionam (requisição/resposta), endpoints, JSON e exemplos práticos.', 3 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Fundamentos da Engenharia de Software', 'turmas/sistemas_aplicados/aulas/fundamentos_engenharia _software.html', '04', 'Conceitos fundamentais de Engenharia de Software: como funciona o ciclo de um software?', 4 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Software Development Life Cycle', 'turmas/sistemas_aplicados/aulas/SDLC_fase_3.html', '05', 'Fase 3: Design (Arquitetura e Modelagem)', 5 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Software Development Life Cycle Parte 02', 'turmas/sistemas_aplicados/aulas/SDLC_fase_4.html', '06', 'Fase 4: Implementação (Codificação)', 6 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Dicionário GIT', 'turmas/sistemas_aplicados/aulas/dicionario_git.html', '07', 'Termos e comandos essenciais do Git para controle de versão eficaz', 7 FROM turmas WHERE slug = 'sistemas_aplicados';
INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem)
SELECT id, 'Trabalho Final', 'turmas/sistemas_aplicados/aulas/trabalho_final.html', '08', 'Trabalho final da disciplina de Sistemas Aplicados: Engenharia Reversa', 8 FROM turmas WHERE slug = 'sistemas_aplicados';
