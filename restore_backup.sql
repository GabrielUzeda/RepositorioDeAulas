--
-- PostgreSQL database dump
--

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgresEFG
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: public; Owner: postgresEFG
--

CREATE TABLE IF NOT EXISTS public._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


ALTER TABLE public._sqlx_migrations OWNER TO "postgres";

--
-- Name: atividades; Type: TABLE; Schema: public; Owner: postgresEFG
--

CREATE TABLE IF NOT EXISTS public.atividades (
    id integer NOT NULL,
    turma_id integer,
    external_id character varying(100),
    titulo character varying(255) NOT NULL,
    descricao text,
    caminho character varying(255) NOT NULL,
    icone character varying(50),
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.atividades OWNER TO "postgres";

--
-- Name: atividades_id_seq; Type: SEQUENCE; Schema: public; Owner: postgresEFG
--

CREATE SEQUENCE IF NOT EXISTS public.atividades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.atividades_id_seq OWNER TO "postgres";

--
-- Name: atividades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgresEFG
--

ALTER SEQUENCE public.atividades_id_seq OWNED BY public.atividades.id;


--
-- Name: aulas; Type: TABLE; Schema: public; Owner: postgresEFG
--

CREATE TABLE IF NOT EXISTS public.aulas (
    id integer NOT NULL,
    turma_id integer,
    titulo character varying(255) NOT NULL,
    caminho character varying(255) NOT NULL,
    icone character varying(50),
    descricao text,
    ordem integer DEFAULT 0,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.aulas OWNER TO "postgres";

--
-- Name: aulas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgresEFG
--

CREATE SEQUENCE IF NOT EXISTS public.aulas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aulas_id_seq OWNER TO "postgres";

--
-- Name: aulas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgresEFG
--

ALTER SEQUENCE public.aulas_id_seq OWNED BY public.aulas.id;


--
-- Name: turmas; Type: TABLE; Schema: public; Owner: postgresEFG
--

CREATE TABLE IF NOT EXISTS public.turmas (
    id integer NOT NULL,
    slug character varying(50) NOT NULL,
    nome character varying(100) NOT NULL,
    cor character varying(50),
    icone character varying(50),
    senha character varying(255),
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    atualizado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    descricao text
);


ALTER TABLE public.turmas OWNER TO "postgres";

--
-- Name: turmas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgresEFG
--

CREATE SEQUENCE IF NOT EXISTS public.turmas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.turmas_id_seq OWNER TO "postgres";

--
-- Name: turmas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgresEFG
--

ALTER SEQUENCE public.turmas_id_seq OWNED BY public.turmas.id;


--
-- Name: atividades id; Type: DEFAULT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.atividades ALTER COLUMN id SET DEFAULT nextval('public.atividades_id_seq'::regclass);


--
-- Name: aulas id; Type: DEFAULT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.aulas ALTER COLUMN id SET DEFAULT nextval('public.aulas_id_seq'::regclass);


--
-- Name: turmas id; Type: DEFAULT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.turmas ALTER COLUMN id SET DEFAULT nextval('public.turmas_id_seq'::regclass);


--
-- Data for Name: _sqlx_migrations; Type: TABLE DATA; Schema: public; Owner: postgresEFG
--

COPY public._sqlx_migrations (version, description, installed_on, success, checksum, execution_time) FROM stdin;
20260210000000  cleanup 2026-02-11 19:34:40.824574+00   t       \\x386b036b84f17da175fd694960b388b3e34896d7540d4e09293796fbb6f695e4c76564b5872654ed6a63e24bb63d07b6     4809126
20260211000000  init schema     2026-02-11 19:34:40.831711+00   t       \\x4011b81dd1993875fcf4b127d3c7638644adceb48a94ee11b34045a741165d20ab977f00dd857de63f2cdde8a5c73664     92453175
20260211000001  seed data       2026-02-11 19:34:40.925562+00   t       \\xa4a98303085a5ef1cc0c51a0822e07fcc989d32ca799950345ddcd6c8778df16fceee7f99b8a2c2998b4f246e22a66a4     21154509
20260211120004  add description to turmas       2026-02-11 19:34:40.94861+00    t       \\x581cc49f2de5a0c3e28a38e23df65a411ba5ee4df1c1bf246a65f5ff9d6e1ed2e6fe4d571d85cfbd9eb4b6f53bb7040f     3072662
\.


--
-- Data for Name: atividades; Type: TABLE DATA; Schema: public; Owner: postgresEFG
--

COPY public.atividades (id, turma_id, external_id, titulo, descricao, caminho, icone, criado_em, atualizado_em) FROM stdin;
1       1       atv1    Introdução a estatística        Aplique os conceitos de média, moda e mediana e desvio padrão  turmas/estatistica/atividades/introducao.html    01-02   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
2       1       atv2    Exercícios introdutórios de Python      Resolva os exercícios propostos sobre python    turmas/terceirao/atividades/introducao_python.html      03      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
3       1       atv3    Bibliotecas & Listas & Tratamento de Erros em Python    Questionário sobre instalação/importação de bibliotecas e try/except    turmas/estatistica/atividades/try_libs_python.html      04-06   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
4       1       lacos_python    Laços de Repetição em Python    Atividade sobre for e while     turmas/estatistica/atividades/laco_python.html  07      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
5       1       matplotlib_01   Matplotlib 01   Atividade prática sobre matplotlib      turmas/estatistica/atividades/matplotlib01.html 08-09   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
6       1       matplotlib_02   Matplotlib 02   Atividade prática sobre matplotlib      turmas/estatistica/atividades/matplotlib02.html 09      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
7       1       provaA  Avaliação - Grupo A     Primeira Avaliação da disciplina        turmas/estatistica/atividades/provaA.html       A1      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
8       1       provaB  Avaliação - Grupo B     Primeira Avaliação da disciplina        turmas/estatistica/atividades/provaB.html       A1      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
9       1       provaC  Avaliação - Grupo C     Primeira Avaliação da disciplina        turmas/estatistica/atividades/provaC.html       A1      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
10      1       probabilidade_condicional       Probabilidade Condicional e Independência       Exercícios sobre probabilidade condicional e independência      turmas/estatistica/atividades/Probabilidade_Condicional_Independencia.html     10-11    2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
11      1       probabilidade_condicional2      Probabilidade & Python  Exercícios sobre probabilidade condicional e independência usando python        turmas/estatistica/atividades/python_probabilidade.html 10-11   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
12      1       probabilidade_eventosA_e_B      Probabilidade de Eventos A e B  Exercícios sobre probabilidade de eventos A e B turmas/estatistica/atividades/probabilidade_e_ou.html   12-13   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
13      1       quartis_percentis       Quartis e Percentis     Exercícios sobre quartis, percentis e intervalo interquartil (IQR)      turmas/estatistica/atividades/quartis_percentis.html    14      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
14      1       covariancia_correlacao_linear   Covariância e Correlação Linear Exercícios sobre covariância, correlação de Pearson e interpretação de relações entre variáveis turmas/estatistica/atividades/covariancia_correlacao_linear.html15      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
15      1       teste_z Teste Z Exercícios sobre teste Z, hipóteses estatísticas e tomada de decisão com dados  turmas/estatistica/atividades/teste_z.html      16      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
16      2       atv1    Exercícios de BD/SGBD e cURL    Resolva os exercícios propostos sobre conceitos de BG SGBD e cURL       turmas/terceirao/atividades/bd-sgbd-curl.html   01-02   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
17      2       atv2    Exercícios introdutórios de Python      Resolva os exercícios propostos sobre python    turmas/terceirao/atividades/introducao_python.html      03      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
18      2       lacos_python    Laços de Repetição em Python    Atividade sobre for e while     turmas/terceirao/atividades/laco_python.html    04      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
19      2       ENEM_IA Projeto ENEM: Equipe Gekko      Instruções da equipe IA para o Projeto ENEM     turmas/terceirao/atividades/ENEM_IA.html        06-09   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
20      2       ENEM_PYTHON     Projeto ENEM: Equipe Asuma      Instruções da equipe Python para o Projeto ENEM turmas/terceirao/atividades/ENEM_PYTHON.html    06-09   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
21      2       ENEM_SQL        Projeto ENEM: Equipe Iruka      Instruções da equipe SQL para o Projeto ENEM    turmas/terceirao/atividades/ENEM_SQL.html       06-09   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
22      2       ENEM_JSON       Projeto ENEM: Equipe Anko       Instruções da equipe JSON para o Projeto ENEM   turmas/terceirao/atividades/ENEM_JSON.html      06-09   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
23      2       ENEM_F2 Projeto ENEM: Fase 02   Instruções de cada equipe para a Fase 02 do Projeto ENEM        turmas/terceirao/atividades/ENEM_Fase02.html    10-12   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
24      2       atividade_extra Atividade Avaliativa Extra      Atividade avaliativa do Projeto Gerador de Questões ENEMturmas/terceirao/atividades/atividade_extra.html        13      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
25      3       atv1    Exercícios de Introdução e Algoritmos   Resolva os exercícios propostos sobre introdução à lógica e algoritmos  turmas/logica/atividades/introducao_algoritmos.html     01      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
26      3       atv2    Exercícios de Introdução Tabela Verdade Resolva os exercícios propostos sobre Tabela Verdade   turmas/logica/atividades/tabela_verdade.html     02      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
27      3       atv3    Exercícios de Introdução Tabela Verdade 02      Resolva os exercícios propostos sobre Tabela Verdade: Se então  turmas/logica/atividades/se_entao.html  03      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
28      3       atv4    Exercícios de Conectivos Lógicos        Exercícios para exercitar o uso dos conectivos lógicos AND, OR, NOT e XOR       turmas/logica/atividades/conectivos_logicos.html        04      2026-02-11 19:34:40.925562+00  2026-02-11 19:34:40.925562+00
29      3       atv5    Leis da Lógica Proposicional    Exercícios para aplicar De Morgan, distributiva, contrapositiva, precedência e simplificação.   turmas/logica/atividades/leis_logica.html       05      2026-02-11 19:34:40.925562+00  2026-02-11 19:34:40.925562+00
30      3       estrutura_interpretador_compilador_modularizacao_vetores_matrizes       Atividade — Estruturas, Interpretador/Compilador, Modularização e Vetores       Questionário sobre interpretadores/compiladores, estruturas de controle, vetores/matrizes e modularização.      turmas/logica/atividades/estrutura_interpretador_compilador_modularizacao_vetores_matrizes.html 06-09   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
31      3       tipos_compostos_arquivos        Atividade - Tipos Compostos e Manipulação de Arquivos   Questões sobre tipos compostos, estruturas de dados e manipulação de arquivos em Python turmas/logica/atividades/tipos_compostos_arquivos.html  10-11   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
32      4       introducao_python       Exercícios introdutórios de Python      Atividade prática sobre conceitos básicos de Python     turmas/visualizacao_dados/atividades/introducao_python.html     00      2026-02-11 19:34:40.925562+00  2026-02-11 19:34:40.925562+00
33      4       listas_python   Listas em Python        Exercícios sobre listas e manipulação de dados  turmas/visualizacao_dados/atividades/vetores_array.html 01      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
34      4       laco_python     Laços em Python Exercícios sobre laços e manipulação de dados   turmas/visualizacao_dados/atividades/laco_python.html   02-03   2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
35      4       matplotlib_01   Matplotlib      Exercícios introdutorios sobre matplotlib       turmas/visualizacao_dados/atividades/matplotlib.html    04      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
36      4       matplotlib_02   Matplotlib 02   Exercícios intermediarios sobre matplotlib      turmas/visualizacao_dados/atividades/matplotlib02.html  05      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
\.


--
-- Data for Name: aulas; Type: TABLE DATA; Schema: public; Owner: postgresEFG
--

COPY public.aulas (id, turma_id, titulo, caminho, icone, descricao, ordem, criado_em, atualizado_em) FROM stdin;
1       1       Métricas Estatísticas   turmas/estatistica/aulas/media_moda_mediana.html        01      Conceitos de média, moda e mediana      1       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
2       1       Dispersão de Dados      turmas/estatistica/aulas/desviopadrao.html      02      Desvio padrão e medidas de dispersão    2       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
3       1       Introdução a Python     turmas/estatistica/aulas/introducao_python.html 03      Uma breve introducao à linguagem Python 3       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
4       1       Listas em Python        turmas/estatistica/aulas/vetores_array.html     04      Conceitos e exemplos de listas em Python        4       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
5       1       Tratamento de Erros (try/except)        turmas/estatistica/aulas/try_expection_python.html      05     Conceitos e exemplos de try/except, else e finally       5       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
6       1       Importando Bibliotecas (Matplotlib)     turmas/estatistica/aulas/importando_blibiotecas_python.html    06       Como instalar e importar matplotlib; exemplo prático    6       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
7       1       Laços de Repetição      turmas/estatistica/aulas/lacos_python.html      07      Aula sobre laços for e while    7       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
8       1       Listas em Python 02     turmas/estatistica/aulas/listas_parte02.html    08      Aula sobre Listas Sort, Zip e For       8       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
9       1       Matplotlib Parte 01     turmas/estatistica/aulas/matplotlib_parte01.html        09      Aula prática sobre Matplotlib   9       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
10      1       Matplotlib Parte 02     turmas/estatistica/aulas/matplotlib_parte02.html        09      Aula prática sobre Matplotlib, segunda parte.   10      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
11      1       União e Interseção      turmas/estatistica/aulas/Uniao_Intersecao.html  10      Aula prática sobre conjutos: união e interseção.        11      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
12      1       Probabilidade Condicional e Independencia       turmas/estatistica/aulas/Probabilidade_Condicional_Independencia.html   11      Conceitos básicos de probabilidade      12      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
13      1       Probabilidade Condicional em Python     turmas/estatistica/aulas/probabilidade_python.html      12     Conceitos básicos de probabilidade usando python 13      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
14      1       Probabilidade de Eventos A e B  turmas/estatistica/aulas/probabilidade_e_ou.html        13      Conceitos de probabilidade de eventos A e B     14      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
15      1       Quartis e Percentis     turmas/estatistica/aulas/quartis_percentis.html 14      Medidas de posição: entendendo quartis, percentis e intervalo interquartil (IQR) para análise robusta de dados  15      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
16      1       Covariância e Correlação Linear turmas/estatistica/aulas/covariancia_correlacao_linear.html     15     Conceitos de covariância e correlação linear: interpretação, cálculo e aplicações práticas       16      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
17      1       Teste Z turmas/estatistica/aulas/teste_z.html   16      Teste Z: tomada de decisão com dados, hipóteses estatísticas e significância estatística        17      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
18      1       Trabalho Final  turmas/estatistica/aulas/trabalho_final.html    16      Apresentação do trabalho final da disciplina    18      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
19      2       Introdução a Bancos de Dados    turmas/terceirao/aulas/banco_de_dados.html      01      Aprenda sobre Bancos de Dados de forma prática e com exemplos do dia a dia. Do básico ao avançado com MySQL.    1       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
20      2       cURL    turmas/terceirao/aulas/curl.html        02      Introdução ao cURL e suas aplicações    2      2026-02-11 19:34:40.925562+00    2026-02-11 19:34:40.925562+00
21      2       Introdução a Python     turmas/terceirao/aulas/introducao_python.html   03      Uma breve introducao à linguagem Python 3       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
22      2       Laços de Repetição      turmas/terceirao/aulas/lacos_python.html        04      Aula sobre laços for e while    4       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
23      2       Projeto Enem    turmas/terceirao/aulas/projeto_enem.html        05      Aula sobre o projeto final do enem      5       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
24      2       Projeto Enem: MySQL - Python    turmas/terceirao/aulas/projeto_enem_bd_python.html      06      Aula de como estruturar o banco de dados e o backend    6       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
25      2       Projeto Enem: JSON      turmas/terceirao/aulas/projeto_enem_json.html   07      Aula de como estruturar o frontend      7       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
26      2       Projeto Enem: Prompts IA        turmas/terceirao/aulas/projeto_enem_ia.html     07      Aula de como fazer bons prompts para a IA       8       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
27      2       Banco de Dados Parte 02 turmas/terceirao/aulas/banco_de_dados_parte02.html      08      Aula de como gerar relacionamentos basicos em Mysql     9       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
28      2       Projeto Enem: Melhorias turmas/terceirao/aulas/refinamentosEnem.html    09      Aula de segestões para melhorar o projeto ENEM  10      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
29      2       Projeto Enem: Exposicao da API  turmas/terceirao/aulas/enemParte04.html 10      Aula de como usar o ngrok para expor a IA       11      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
30      2       Tokens JWT      turmas/terceirao/aulas/enem_parte05.html        11      Entenda JSON Web Tokens (Header, Payload, Signature), o fluxo de autenticação/autorização com JWT e boas práticas para proteger APIs e ações administrativas.   12      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
31      2       Banco de Dados Parte 03 turmas/terceirao/aulas/banco_de_dados_parte03.html      12      Resumo das novas funcionalidades do projeto ENEM        13      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
32      2       Projeto ENEM: Fase Final        turmas/terceirao/aulas/trabalho_final_enem.html 13      Instruções de cada equipe para a Fase final do Projeto ENEM     14      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
33      2       Hackathon do Terceirão  turmas/terceirao/aulas/hackathon.html   14      Instruções para a dinâmica do Hackathon do Terceirão    15      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
34      2       Resumo do Terceirão     turmas/terceirao/aulas/resumao.html     15      Resumo dos conceitos gerais do curso    16      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
35      3       Lógica de Programação: Algoritmos       turmas/logica/aulas/introducao_algoritmos.html  01      Conceitos básicos de lógica de programação      1       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
36      3       Lógica de Programação: Tabela-Verdade   turmas/logica/aulas/tabela_verdade.html 02      Conceitos básicos de lógica condicional 2       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
37      3       Lógica de Programação: Tabela-Verdade 02        turmas/logica/aulas/se_entao.html       03      Conceitos básicos de lógica condicional: Se... Então... 3       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
38      3       Lógica de Programação: Conectivos Lógicos       turmas/logica/aulas/conectivos_logicos.html     04     Representação, uso e simbologia dos conectivos lógicos AND, OR, NOT e XOR        4       2026-02-11 19:34:40.925562+00  2026-02-11 19:34:40.925562+00
39      3       Lógica de Programação: Leis Lógica      turmas/logica/aulas/leis_logica.html    05      Leis da lógica proposicional e suas aplicações na programação   5       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
40      3       Estruturas de Controle  turmas/logica/aulas/estrutura_controle.html     06      Condicionais (if/elif/else) e estruturas de repetição (for, while) com exemplos práticos        6       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
41      3       Compiladores e Interpretadores  turmas/logica/aulas/interpretador_compilador.html       07      Diferenças entre compilação e interpretação, e introdução ao JIT        7       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
42      3       Modularização na Programação    turmas/logica/aulas/modularizacao.html  08      Como dividir código em módulos e funções: alta coesão e baixo acoplamento       8       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
43      3       Vetores e Matrizes      turmas/logica/aulas/vetores_matrizes.html       09      Vetores (listas) e matrizes (arrays 2D): conceitos, exemplos e cuidados 9       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
44      3       Tipos Compostos e Estruturas de Dados   turmas/logica/aulas/tipos_compostos_estrutura_dados.html       10       Organizando Informações no Código: Listas, Arrays e Dicionários 10      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
45      3       Manipulação de Arquivos e Bibliotecas   turmas/logica/aulas/arquivos_e_blibioteca.html  11      A Lógica da Manipulação de Arquivos e uso de Bibliotecas em Python      11      2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
46      4       Introdução a Python     turmas/visualizacao_dados/aulas/introducao_python.html  00      Uma breve introducao à linguagem Python 0       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
47      4       Listas em Python        turmas/visualizacao_dados/aulas/vetores_array.html      01      Conceitos e exemplos de listas em Python        1       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
48      4       Laços de Repetição      turmas/visualizacao_dados/aulas/lacos_python.html       02      Conceitos fundamentais de laços for e while em Python   2       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
49      4       Listas em Python 02     turmas/visualizacao_dados/aulas/listas_parte02.html     03      Aula sobre Listas Sort, Zip e For       3       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
50      4       Matplotlib      turmas/visualizacao_dados/aulas/matplotlib.html 04      Aula sobre Matplotlib   4      2026-02-11 19:34:40.925562+00    2026-02-11 19:34:40.925562+00
51      4       Matplotlib 02   turmas/visualizacao_dados/aulas/matplotlib02.html       05      Aula sobre Matplotlib  52026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
52      4       Carregando Dados CSV:   turmas/visualizacao_dados/aulas/csv.html        06      Como carregar e manipular dados em formato CSV usando Python    6       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
53      4       Trabalho Final  turmas/visualizacao_dados/aulas/trabalho_final.html     07      Instruções para o trabalho final da disciplina  7       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
54      5       Versionamento   turmas/sistemas_aplicados/aulas/versionamento.html      01      Introdução ao versionamento de código com Git e o comando diff  1       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
55      5       Mapeando a Dor do Usuário       turmas/sistemas_aplicados/aulas/dor_historia_usuario.html       02     Como identificar e traduzir dores do usuário em Histórias de Usuário acionáveis; técnicas de Personas e Jornada do Usuário.      2       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
56      5       APIs: O Que São e Sua Importância       turmas/sistemas_aplicados/aulas/apis.html       03      Conceitos fundamentais de APIs: o que são, como funcionam (requisição/resposta), endpoints, JSON e exemplos práticos.   3      2026-02-11 19:34:40.925562+00    2026-02-11 19:34:40.925562+00
57      5       Fundamentos da Engenharia de Software   turmas/sistemas_aplicados/aulas/fundamentos_engenharia _software.html   04      Conceitos fundamentais de Engenharia de Software: como funciona o ciclo de um software? 4       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
58      5       Software Development Life Cycle turmas/sistemas_aplicados/aulas/SDLC_fase_3.html        05      Fase 3: Design (Arquitetura e Modelagem)        5       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
59      5       Software Development Life Cycle Parte 02        turmas/sistemas_aplicados/aulas/SDLC_fase_4.html       06       Fase 4: Implementação (Codificação)     6       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
60      5       Dicionário GIT  turmas/sistemas_aplicados/aulas/dicionario_git.html     07      Termos e comandos essenciais do Git para controle de versão eficaz      7       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
61      5       Trabalho Final  turmas/sistemas_aplicados/aulas/trabalho_final.html     08      Trabalho final da disciplina de Sistemas Aplicados: Engenharia Reversa  8       2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.925562+00
63      8       Do Hardware ao Web Mobile       turmas/aulas/do_hardware_ao_web_mobile.html     00      Aula sobre Hardware vs Software e Inputs e Outputs      0       2026-02-11 20:40:27.461561+00   2026-02-11 20:40:27.461561+00
64      8       Fundamentos de Hardware turmas/aulas/fundamentos_de_hardware.html       01       CPU, Memória e Armazenamento e  as limitações físicas  1       2026-02-13 16:58:51.895522+00   2026-02-13 16:58:51.895522+00
\.


--
-- Data for Name: turmas; Type: TABLE DATA; Schema: public; Owner: postgresEFG
--

COPY public.turmas (id, slug, nome, cor, icone, senha, criado_em, atualizado_em, descricao) FROM stdin;
1       estatistica     Ciência de Dados - Estatística  bg-purple-500   bar_chart       legado  2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.94861+00    Estudo de métricas, dispersão e probabilidade com Python.
2       terceirao       Terceirão       bg-yellow-500   school  legado  2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.94861+00    Preparatório para o ENEM com foco em Banco de Dados e IA.
3       logica  Lógica de Programação   bg-blue-500     code    legado  2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.94861+00    Fundamentos de lógica, tabelas-verdade e algoritmos.
4       visualizacao_dados      Visualização de Dados   bg-green-500    bar_chart       legado  2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.94861+00    Visualização de dados e gráficos com Matplotlib.
5       sistemas_aplicados      Sistemas Aplicados      bg-pink-500     computer        legado  2026-02-11 19:34:40.925562+00   2026-02-11 19:34:40.94861+00    Engenharia de software e ciclo de vida de sistemas.
8       sistemas_de_computação  Sistemas de Computação  bg-indigo-500   memory  sc202601        2026-02-11 19:53:57.958168+00   2026-02-11 19:53:57.958168+00   A disciplina capacita o aluno a compreender a integração entre hardware, sistemas operacionais e redes, focando em como essa infraestrutura técnica sustenta e influencia o desempenho e a viabilidade de aplicações web e mobile.
\.


--
-- Name: atividades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgresEFG
--

SELECT pg_catalog.setval('public.atividades_id_seq', 36, true);


--
-- Name: aulas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgresEFG
--

SELECT pg_catalog.setval('public.aulas_id_seq', 64, true);


--
-- Name: turmas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgresEFG
--

SELECT pg_catalog.setval('public.turmas_id_seq', 8, true);


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: atividades atividades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_pkey PRIMARY KEY (id);


--
-- Name: aulas aulas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_pkey PRIMARY KEY (id);


--
-- Name: turmas turmas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_pkey PRIMARY KEY (id);


--
-- Name: turmas turmas_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_slug_key UNIQUE (slug);


--
-- Name: atividades update_atividades_updated_at; Type: TRIGGER; Schema: public; Owner: postgresEFG
--

CREATE TRIGGER update_atividades_updated_at BEFORE UPDATE ON public.atividades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: aulas update_aulas_updated_at; Type: TRIGGER; Schema: public; Owner: postgresEFG
--

CREATE TRIGGER update_aulas_updated_at BEFORE UPDATE ON public.aulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: turmas update_turmas_updated_at; Type: TRIGGER; Schema: public; Owner: postgresEFG
--

CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: atividades atividades_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;


--
-- Name: aulas aulas_turma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgresEFG
--

ALTER TABLE ONLY public.aulas
    ADD CONSTRAINT aulas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;
