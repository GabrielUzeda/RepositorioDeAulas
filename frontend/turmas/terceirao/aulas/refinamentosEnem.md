---
marp: true
theme: default
paginate: true
style: |
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  section {
    font-family: 'Roboto', sans-serif;
    background-color: #f4f6fb;
    color: #2b2b2b;
    font-size: 28px;
    line-height: 1.5;
  }
  h1, h2, h3 {
    font-family: 'Roboto Slab', serif;
    color: #1a3a6e;
  }
  h2 {
    border-bottom: 2px solid #1a3a6e;
    padding-bottom: 5px;
  }
  strong {
    color: #d62828;
    font-weight: 700;
  }
  code {
    background-color: #e0e0e0;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
  }
  pre code {
    padding: 1em;
    display: block;
    width: 100%;
  }
---

# 📘 Modelagem de Dados para Questões do ENEM com SQL

---

## Objetivos da Aula

* Compreender a estrutura de um banco de dados relacional para armazenar questões.
* Analisar um esquema SQL, entendendo cada tipo de dado e restrição.
* Conectar a modelagem do banco de dados com a implementação em uma aplicação real (Python/Flask).
* Identificar pontos de melhoria em um código funcional, focando em segurança e boas práticas.

---

## A Arquitetura de um Banco de Questões

Imagine que precisamos construir um sistema para gerenciar milhares de questões do ENEM. Não podemos simplesmente jogar tudo em uma planilha. Precisamos de **organização** e **integridade**.

Pense em uma biblioteca [1]. Cada questão é um livro, e cada alternativa é uma página dentro desse livro. O sistema de banco de dados (SQL) é como o bibliotecário [1]: ele sabe exatamente onde encontrar cada informação, garante que nenhum livro tenha o mesmo número de identificação e mantém tudo em ordem.

Nossa "biblioteca" terá duas estantes principais:
* `questoes`: Para armazenar as informações gerais de cada questão.
* `alternativas`: Para guardar as opções de cada questão, vinculadas à questão correta.

---

## Estrutura da Tabela `questoes`

```sql
CREATE TABLE questoes (
  id BIGSERIAL PRIMARY KEY,
  area VARCHAR(50) NOT NULL,
  materia VARCHAR(50) NOT NULL,
  enunciado TEXT NOT NULL,
  pontuacao INT NOT NULL DEFAULT 1,
  ano SMALLINT,
  criado_em TIMESTAMP DEFAULT now()
);
````

  * Esta tabela é o coração do nosso sistema. Cada linha representa uma única questão do ENEM.
  * Vamos analisar os detalhes...

-----

## A Tabela `questoes`: Linha por Linha

  * **`id BIGSERIAL PRIMARY KEY`**:

      * `id`: O "RG" único de cada questão.
      * `BIGSERIAL`: Um número que é gerado **automaticamente** e nunca se repete. Ideal para identificadores únicos [2].
      * `PRIMARY KEY`: Garante que não teremos duas questões com o mesmo `id`. É a regra de ouro da organização.

  * **`area VARCHAR(50) NOT NULL`**:

      * `VARCHAR(50)`: Um campo de texto para a área do conhecimento (Ciências Humanas, etc.), com limite de 50 caracteres.
      * `NOT NULL`: Toda questão **precisa** ter uma área definida.

-----

## A Tabela `questoes`: Continuação

  * **`enunciado TEXT NOT NULL`**:

      * `TEXT`: Permite armazenar textos longos, sem um limite fixo, ideal para os enunciados complexos do ENEM.
      * `NOT NULL`: Uma questão sem enunciado não faz sentido, por isso é obrigatório.

  * **`pontuacao INT NOT NULL DEFAULT 1`**:

      * `INT`: Armazena um número inteiro.
      * `DEFAULT 1`: Se nenhuma pontuação for definida ao criar a questão, o sistema assume que ela vale **1 ponto**.

  * **`ano SMALLINT`**:

      * `SMALLINT`: Um número inteiro "pequeno", perfeito e mais econômico para armazenar o ano da prova.

-----

## Estrutura da Tabela `alternativas`

```sql
CREATE TABLE alternativas (
  id BIGSERIAL PRIMARY KEY,
  questao_id BIGINT NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
  letra CHAR(1) NOT NULL CHECK (letra IN ('A','B','C','D','E')),
  conteudo TEXT NOT NULL,
  correta BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT unica_letra_por_questao UNIQUE (questao_id, letra)
);
```

  * Esta tabela depende diretamente da `questoes`. Uma alternativa não existe sozinha; ela sempre pertence a uma questão.

-----

## A Tabela `alternativas`: A Conexão Essencial

  * **`questao_id BIGINT NOT NULL REFERENCES questoes(id)`**:

      * Esta é a **chave estrangeira**: a "cola" que liga cada alternativa à sua questão correspondente.
      * `REFERENCES questoes(id)`: Garante que toda alternativa esteja ligada a um `id` de questão que **realmente existe**, mantendo a integridade referencial.

  * **`ON DELETE CASCADE`**:

      * **Educação Preventiva**: Imagine apagar uma questão. O que acontece com as alternativas? Elas ficariam "órfãs" no banco de dados.
      * Esta regra poderosa instrui o banco a **apagar automaticamente** todas as alternativas associadas se a questão "mãe" for deletada, mantendo a consistência dos dados.

-----

## A Tabela `alternativas`: Regras de Negócio

  * **`letra CHAR(1) NOT NULL CHECK (letra IN ('A','B','C','D','E'))`**:

      * `CHAR(1)`: Armazena exatamente um caractere.
      * `CHECK (...)`: Uma restrição que só permite que as letras 'A', 'B', 'C', 'D', ou 'E' sejam inseridas. Impede erros de digitação.

  * **`correta BOOLEAN NOT NULL DEFAULT FALSE`**:

      * `BOOLEAN`: Armazena `TRUE` ou `FALSE`.
      * `DEFAULT FALSE`: Por padrão, toda nova alternativa é considerada errada, a menos que seja especificado.

  * **`CONSTRAINT unica_letra_por_questao UNIQUE (questao_id, letra)`**:

      * Garante que a **combinação** de `questao_id` e `letra` seja única. Ou seja, uma questão não pode ter duas alternativas "A".

-----

## Do Modelo à Realidade: Código Python e Melhorias

O código que vocês implementaram em Python (Flask) e SQL (MySQL) já funciona\! Ele cria as tabelas e permite inserir e consultar questões.

Agora, vamos pensar como engenheiros de software e aprimorá-lo. Um sistema funcional é ótimo, mas um sistema **robusto**, **seguro** e **profissional** é o objetivo final.

-----

## Melhoria 1: Segurança das Credenciais

**O que foi feito:**
```python
def get\_db\_connection():
return mysql.connector.connect(
host="gsuzeda.mysql.pythonanywhere-services.com",
user="gsuzeda",
password="melhorturma\!",
database="gsuzeda$default"
)
```

**O Risco:** Manter senhas diretamente no código é uma falha de segurança grave. Se o código for compartilhado ou exposto, a senha do banco de dados fica vulnerável.

**A Melhoria:** Use **Variáveis de Ambiente**.

  * **O que são?** São variáveis configuradas fora do código, no sistema operacional do servidor. A aplicação lê essas variáveis para obter as credenciais.
  * **Vantagem:** O código pode ser público sem expor informações sensíveis.

-----

## Melhoria 2: Validação de Dados na API

**O que foi feito:** O código já possui validações importantes, como verificar se o enunciado não é nulo e se há exatamente uma alternativa correta.

```python
if not enunciado:
return jsonify({"erro": "Campo 'enunciado' é obrigatório"}), 400
if correta\_count \!= 1:
return jsonify({"erro": "Marque exatamente uma alternativa correta"}), 400
```

**A Melhoria:** Padronizar e enriquecer as validações.

  * **Tipos de Dados:** Verificar se `ano` e `pontuacao` são realmente números.
  * **Limites:** Garantir que `area` e `materia` não excedam os 50 caracteres definidos no banco.
  * **Estrutura do JSON:** Ter um tratamento de erro mais robusto para campos ausentes ou mal formatados.

-----

## Melhoria 3: Tratamento de Erros de Banco de Dados

**O que foi feito:** O código utiliza um bloco `try...except` para capturar erros de conexão.

```python
try:
conn = get\_db\_connection()
\# ... operações no banco ...
except Error as e:
return jsonify({"erro": f"Erro ao acessar o banco de dados: {str(e)}"}), 500
```

**A Melhoria:** Seja mais específico e seguro.

  * **Log de Erros:** Em vez de apenas retornar a mensagem de erro ao usuário (o que pode expor detalhes do sistema), grave o erro completo em um arquivo de log para análise do desenvolvedor.
  * **Mensagens Genéricas:** Para o usuário, retorne uma mensagem genérica, como `"Ocorreu um erro interno no servidor."`, e um código de erro (HTTP 500).

-----

## Reflexão e Próximos Passos

1.  **O que aconteceu?** Analisamos um esquema de banco de dados e um código de API que o utiliza.
2.  **O que aprendemos?** Vimos a importância de tipos de dados, chaves, restrições e como elas se traduzem em regras de negócio. Identificamos melhorias cruciais em segurança, validação e tratamento de erros.
3.  **O que podemos fazer diferente?**
      * Implementar o uso de variáveis de ambiente para as credenciais.
      * Adicionar validações mais rigorosas nos dados recebidos pela API.
      * Melhorar o sistema de logs de erro.

-----

## Conclusão

Construir software é um processo contínuo de aprimoramento. O código de vocês já é um excelente ponto de partida\!

Ao aplicar estas melhorias, vocês transformarão um projeto funcional em uma aplicação mais **segura**, **confiável** e **profissional**, pronta para crescer e ser mantida a longo prazo.

-----

## Material Complementar

  * **Documentação Oficial do MySQL sobre `CREATE TABLE`**: Para aprofundar nos tipos de dados e restrições. `https://dev.mysql.com/doc/refman/8.0/en/create-table.html`
  * **The Flask Mega-Tutorial by Miguel Grinberg**: Um recurso fantástico com exemplos práticos sobre boas práticas em Flask, incluindo o uso de variáveis de ambiente. `https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world`

-----

## Referências

[1] Guia para aulas de programação inclusivas. (s.d.).
[2] Mueller, J. P. (2018). *Beginning programming with Python*. John Wiley and Sons.
[3] Downey, A. B. (2011). *Think Stats*. O'Reilly Media.
[4] Guia de Programação Inclusiva para Adolescentes. (s.d.).
