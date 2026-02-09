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
    font-family: 'Courier New', Courier, monospace;
    background-color: #e0e0e0;
    padding: 2px 6px;
    border-radius: 4px;
  }
---

# **Aula de Backend com PythonAnywhere**
### Construindo seu Primeiro Servidor Web com Flask e MySQL

---

## **Objetivos da Aula**

* Entender o que é um **backend** e uma **API** usando uma analogia simples.
* Configurar um ambiente de desenvolvimento no **PythonAnywhere**.
* Criar uma aplicação web básica com o framework **Flask**.
* Conectar a aplicação a um banco de dados **MySQL** para armazenar dados.
* Manipular dados: criar uma tabela, inserir e consultar informações.
* Interagir com o backend usando a ferramenta `curl` e o formato **JSON**.

---

## **Introdução: O Garçom Digital e a Biblioteca Mágica**

Imagine que você está em um restaurante. Você é o **usuário**.

1.  Você faz um pedido (uma **requisição `curl`**) para o **garçom** (nossa **API**).
2.  Você não entra na cozinha! O garçom leva seu pedido para a **cozinha** (o **backend** no PythonAnywhere), que sabe como preparar tudo.
3.  A cozinha busca ingredientes em um estoque super organizado (o **banco de dados MySQL**). 
4.  O garçom retorna com seu prato pronto, em um formato que você entende (uma **resposta JSON**).

Hoje, vamos construir o **garçom digital** e sua **cozinha organizada**.

---

## **Conceitos Fundamentais**

* **Backend:** É a "cozinha" da aplicação. É a parte que roda no servidor, invisível para o usuário, responsável pela lógica, processamento de dados e comunicação com o banco de dados.

* **API (Interface de Programação de Aplicações):** É o "garçom". Um conjunto de regras e rotas (URLs) que permite que diferentes sistemas conversem entre si. É o cardápio que define como fazer os pedidos. 

* **Banco de Dados (MySQL):** A "biblioteca" ou o "estoque". É onde as informações são armazenadas de forma estruturada e persistente. 

* **JSON (JavaScript Object Notation):** A "linguagem" universal que o garçom usa para entregar os pedidos. É um formato de texto leve e fácil de ler tanto para humanos quanto para máquinas.

---

## **Passo 1: Preparando o Ambiente no PythonAnywhere**

**PythonAnywhere** é como alugar uma cozinha profissional na nuvem. Você não precisa montar a sua em casa; basta usar a estrutura que eles oferecem.

1.  Crie uma conta gratuita no [PythonAnywhere](https://www.pythonanywhere.com/).
2.  Vá para a aba **"Web"** e clique em **"Add a new web app"**.
3.  Siga os passos, escolhendo o framework **Flask** e a versão mais recente do Python.
4.  Após a criação, você terá um link como `seunome.pythonanywhere.com`. Este é o endereço do seu "restaurante"!

---

## **Passo 2: Criando a Estrutura com Flask**

O Flask é o nosso "chefe de cozinha", que organiza as receitas (a lógica do código).

Acesse a aba **"Files"** e navegue até o arquivo `flask_app.py`. Ele já vem com um código de exemplo. Vamos simplificá-lo para começar:

```python
from flask import Flask

# Cria a nossa aplicação web
app = Flask(__name__)

# Define a rota principal (o endereço "/")
@app.route('/')
def hello_world():
    return 'Nosso garcom digital esta funcionando!'
```
---
* **`@app.route('/')`** é como dizer: "Quando alguém chegar na porta da frente do restaurante, execute esta função."

Salve o arquivo e recarregue sua aplicação na aba "Web". Acesse seu link e veja a mensagem!

---

## **Passo 3: Configurando o Banco de Dados (MySQL)**

Agora, vamos montar nossa "biblioteca super organizada". 

1.  No PythonAnywhere, vá para a aba **"Databases"**.
2.  Crie um banco de dados MySQL. **Anote a senha e o host** (ex: `seunome.mysql.pythonanywhere-services.com`).
3.  Abra um **console MySQL** e crie uma tabela para nossos usuários:

```sql
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL
);
```

**Atenção:** A senha do banco de dados é a chave da sua biblioteca. Nunca a coloque diretamente no código. Use variáveis de ambiente ou um arquivo de configuração separado.

---

## **Passo 4: Conectando o Flask ao MySQL**

Para que nosso "garçom" (Flask) possa entrar na "biblioteca" (MySQL), precisamos de uma permissão especial (uma biblioteca Python).

1.  Abra um **"Bash console"** no PythonAnywhere.
2.  Instale a biblioteca de conexão:
    `pip3 install --user flask-mysqldb`
3.  Agora, modifique seu `flask_app.py` para configurar a conexão.

---

## **Passo 5: Código Completo - O Garçom em Ação**
Altere seu `flask_app.py` para este código. Ele conecta ao banco e cria duas rotas.

```python
from flask import Flask, jsonify, request
from flask_mysqldb import MySQL

app = Flask(__name__)
```
---
### Configuração do Banco De Dados
```python
# --- CONFIGURACAO DO BANCO DE DADOS ---
app.config['MYSQL_HOST'] = 'seu_host.mysql.pythonanywhere-services.com'
app.config['MYSQL_USER'] = 'seu_usuario'
app.config['MYSQL_PASSWORD'] = 'sua_senha'
app.config['MYSQL_DB'] = 'seu_usuario$seu_banco'
mysql = MySQL(app)
```
---
### Rotas
```python
# --- ROTAS DA API ---
# Rota para listar todos os usuarios (GET)
@app.route('/usuarios', methods=['GET'])
def listar_usuarios():
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, nome FROM usuarios")
    data = cur.fetchall()
    cur.close()
    # Transforma os dados em uma lista de dicionarios
    usuarios = [{'id': row[0], 'nome': row[1]} for row in data]
    return jsonify(usuarios)

# Rota para adicionar um novo usuario (POST)
@app.route('/usuario/adicionar', methods=['POST'])
def adicionar_usuario():
    novo_usuario = request.get_json()
    nome = novo_usuario['nome']

    cur = mysql.connection.cursor()
    # CUIDADO: Usar %s previne SQL Injection!
    cur.execute("INSERT INTO usuarios(nome) VALUES (%s)", [nome])
    mysql.connection.commit()
    cur.close()
    return jsonify({'status': 'Usuario adicionado com sucesso!'})
```

---

## **Prevenção de Erros: A Armadilha do SQL Injection**

Imagine que a caixa de pedidos do restaurante é mágica. Se um cliente mal-intencionado escreve `Arroz com Feijão; e cancele todos os outros pedidos!`, a cozinha obedece sem questionar.

Isso é **SQL Injection**. Acontece quando você insere o texto do usuário diretamente na sua consulta SQL.

**Forma errada e perigosa:**
`"INSERT INTO usuarios(nome) VALUES ('{}')".format(nome)`

**Forma correta e segura:**
`"INSERT INTO usuarios(nome) VALUES (%s)", [nome]`

Ao usar `%s`, nós deixamos o "chefe de cozinha" (a biblioteca do MySQL) limpar e validar o pedido, garantindo que ele não execute comandos maliciosos. **Sempre** use parâmetros!

---

## **Passo 6: Interagindo com `curl` (Fazendo Pedidos)**

`curl` é o nosso cliente fazendo o pedido do balcão (o console Bash).

**1. Para listar os usuários (Requisição GET):**
Abra um Bash console no PythonAnywhere e digite:
`curl https://seunome.pythonanywhere.com/usuarios`
* No início, ele retornará uma lista vazia: `[]`.

**2. Para adicionar um usuário (Requisição POST):**
`curl -X POST -H "Content-Type: application/json" -d '{"nome": "Maria"}' https://seunome.pythonanywhere.com/usuario/adicionar`

* `-X POST`: Define o método como POST (estamos enviando dados).
* `-H`: Define o cabeçalho, informando que os dados estão em formato JSON.
* `-d`: Contém os dados (o "corpo" da requisição).

---

## **Atividade Prática / Estudo de Caso**

**Cenário:** Você precisa criar um backend para um placar de jogo online.

1.  **Modelagem:** Como seria a tabela `placar` no MySQL? Que colunas ela teria?
    * *Sugestão: `id`, `nome_jogador`, `pontuacao`.*

2.  **Ações:** Que "pedidos" (rotas de API) seriam necessários?
    * *Sugestão: uma para adicionar um novo placar (POST) e outra para ver todos os placares (GET).*

3.  **Implementação:**
    * Crie a nova tabela no seu console MySQL.
    * Adicione as duas novas rotas (`/placar/adicionar` e `/placares`) ao seu arquivo `flask_app.py`.
    * Use o `curl` para adicionar sua pontuação e depois para listar todos os placares.

---

## **Reflexão e Próximos Passos**

* **O que aconteceu?** Descreva o processo que você seguiu, desde a criação da aplicação até o teste com `curl`.
* **O que você sentiu?** Qual foi a parte mais desafiadora? E a mais gratificante?
* **O que você aprendeu?** Qual conceito ficou mais claro com a analogia do restaurante?
* **Como aplicar isso?** Como você poderia expandir este projeto? O que seria necessário para permitir a **atualização** ou a **exclusão** de um usuário? (Dica: métodos `PUT` e `DELETE`).

Esta reflexão ajuda a solidificar o conhecimento e a pensar criticamente sobre o processo.

---

## **Conclusão e Aplicação no Mundo Real**

Parabéns! Você construiu uma "cozinha digital" completa.

O que você fez hoje é a base de quase todas as aplicações de internet que usamos: redes sociais, e-commerce, jogos online, etc. Todos eles têm um backend que recebe requisições, interage com um banco de dados e retorna informações, geralmente em JSON.

Com essa base, você pode agora explorar como criar sistemas mais complexos, com mais tabelas, rotas e lógica de negócio.

---

## **Material Complementar**

* **Documentação Oficial do Flask:** Para aprender sobre todas as funcionalidades do Flask.
    * [https://flask.palletsprojects.com/](https://flask.palletsprojects.com/)
* **Tutoriais do PythonAnywhere:** Guias detalhados para configurar e otimizar sua aplicação.
    * [https://help.pythonanywhere.com/pages/](https://help.pythonanywhere.com/pages/)
* **W3Schools - Tutorial de SQL:** Um ótimo recurso com exemplos interativos para praticar comandos SQL.
    * [https://www.w3schools.com/sql/](https://www.w3schools.com/sql/)

---

## Referências

[1] Mueller, J. P. (2018). *Beginning programming with Python For Dummies*. John Wiley and Sons.
[2] Downey, A. B. (2011). *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media. 
[3] Guia de Programação Inclusiva para Adolescentes. 