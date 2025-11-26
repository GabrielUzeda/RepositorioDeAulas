---
marp: true
theme: default
paginate: true
math: katex
style: |
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');
  section {
    font-family: 'Roboto', sans-serif;
    background-color: #f4f6fb;
    color: #2b2b2b;
    font-size: 26px;
    line-height: 1.4;
  }
  h1, h2, h3 {
    font-family: 'Roboto Slab', serif;
    color: #1a3a6e;
  }
  h2 {
    border-bottom: 2px solid #1a3a6e;
    padding-bottom: 5px;
    margin-bottom: 20px;
  }
  strong {
    color: #d62828;
    font-weight: 700;
  }
  code {
    background: #e0e0e0;
    color: #d63384;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .callout {
    background-color: #e3f2fd;
    border-left: 5px solid #1a3a6e;
    padding: 15px;
    margin-top: 10px;
    border-radius: 4px;
  }
---

# <i class="fa-solid fa-rocket"></i> Hackathon do Terceirão
## Construindo Soluções Reais com Backend Robusto

---

## <i class="fa-solid fa-bullseye"></i> Objetivos da Missão

* **Identificar** um problema real no cotidiano escolar (foco em qualidade de vida e aprendizado).
* **Prototipar** uma solução completa, com ênfase na arquitetura de dados e lógica de servidor.
* **Implementar** uma API funcional utilizando Python (hospedagem sugerida: PythonAnywhere).
* **Justificar** as escolhas técnicas e o uso de Inteligência Artificial no processo.

---

## <i class="fa-solid fa-diagram-project"></i> O Desafio Técnico

Vocês não farão apenas uma "tela bonita". Vocês construirão o cérebro do sistema.

<div class="mermaid">
graph LR;
    A[Aluno/Usuário] -->|Acessa| B(Frontend JS/HTML);
    B -->|Requisição HTTP| C{API Python};
    C -->|Lógica de Negócio| D[Processamento];
    D -->|SQL/ORM| E[(Banco de Dados)];
    E -->|Dados Persistidos| D;
    D -->|Resposta JSON| B;
</div>

* **Frontend:** Pode ser simples (Single Page Application).
* **Backend:** É a estrela do show. Deve gerenciar autenticação, rotas e regras de negócio (ex: salvar preferências de acessibilidade do aluno).

---

## <i class="fa-solid fa-triangle-exclamation"></i> Erros Comuns (Educação Preventiva)

Evitem cair nestas armadilhas clássicas durante o Hackathon:

* **A Ilusão do Design:** Gastar 80% do tempo escolhendo cores no CSS e deixar o banco de dados para a última hora.
* **O "Copiloto" no Comando:** Usar IA para gerar código inteiro sem entender o fluxo. 
    * *Risco:* Se o código quebrar (e vai), você não saberá consertar.
* **Banco de Dados "Planilha":** Criar uma tabela única gigante para tudo. Lembrem-se da normalização (Tabelas Relacionais).

---

## <i class="fa-solid fa-robot"></i> Uso Ético da IA

A Inteligência Artificial é permitida e encorajada, mas com regras:

1.  **Explicação Obrigatória:** Se o ChatGPT gerou a rota, você deve saber explicar linha por linha.
2.  **Documentação:** Indique no código onde a IA ajudou (ex: comentários).
3.  **Refatoração Humana:** O código da IA nem sempre segue as melhores práticas de segurança. Revise-o.

> "A IA é o motor, mas vocês são o volante e o GPS."

---

## <i class="fa-solid fa-laptop-code"></i> Dicas de Infraestrutura

Para que seu projeto seja funcional e acessível:

* **Hospedagem:** Utilizem o **PythonAnywhere** (gratuito e fácil configuração para Flask/Django).
* **Frontend:** Mantenham simples. HTML, CSS e JS em arquivos estáticos servidos pelo Python ou em página única.
* **Dados:** SQLite é suficiente para o protótipo, mas modelem pensando em escalabilidade.

---

## Modelo de Apresentação (Template)
### <i class="fa-solid fa-chalkboard-user"></i> Como vender seu peixe

Ao final, a apresentação do grupo deve seguir este roteiro lógico:

1.  **A Dor:** Qual problema do estudante vocês estão resolvendo?
2.  **A Solução:** Demo rápida do produto funcionando.
3.  **Sob o Capô (Backend):**
    * *"Criamos a tabela **X** para armazenar **Y**..."*
    * *"Usamos a rota **/login** para validar as credenciais..."*
    * *"A lógica de cálculo de nota acontece no servidor para evitar fraudes..."*
4.  **O Papel da IA:** Onde ela acelerou o processo?

---

## <i class="fa-solid fa-magnifying-glass"></i> Reflexão Final

Pensem no minigame da nave. Ele atira em meteoros, mas não sabe **quem** atirou ou **se** o piloto melhorou sua mira ao longo do tempo.

O projeto de vocês deve preencher essa lacuna. O Backend é o que transforma um "jogo" em uma "ferramenta de evolução".

* **Próximo Passo:** Reúnam os grupos, definam a "Dor" do usuário e desenhem o diagrama do banco de dados (DER) antes de digitar qualquer código.

---

## Referências e Material de Apoio

* **Documentação Python:** Referência oficial da linguagem e bibliotecas padrão. [docs.python.org](https://docs.python.org/pt-br/3/)
* **Flask / Django Docs:** Escolham seu framework e sigam os tutoriais de "First App".
* **PythonAnywhere Help:** Guias para deploy de aplicações web. [help.pythonanywhere.com](https://help.pythonanywhere.com/)
* **SQLAlchemy / ORM:** Para manipulação eficiente de banco de dados.
---
marp: true
theme: default
paginate: true
math: katex
style: |
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');
  section {
    font-family: 'Roboto', sans-serif;
    background-color: #f4f6fb;
    color: #2b2b2b;
    font-size: 26px;
    line-height: 1.4;
  }
  h1, h2, h3 {
    font-family: 'Roboto Slab', serif;
    color: #1a3a6e;
  }
  h2 {
    border-bottom: 2px solid #1a3a6e;
    padding-bottom: 5px;
    margin-bottom: 20px;
  }
  strong {
    color: #d62828;
    font-weight: 700;
  }
  code {
    background: #e0e0e0;
    color: #d63384;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .callout {
    background-color: #e3f2fd;
    border-left: 5px solid #1a3a6e;
    padding: 15px;
    margin-top: 10px;
    border-radius: 4px;
  }
---

# <i class="fa-solid fa-rocket"></i> Hackathon do Terceirão
## Construindo Soluções Reais com Backend Robusto

---

## <i class="fa-solid fa-bullseye"></i> Objetivos da Missão

* **Identificar** um problema real no cotidiano escolar (foco em qualidade de vida e aprendizado).
* **Prototipar** uma solução completa, com ênfase na arquitetura de dados e lógica de servidor.
* **Implementar** uma API funcional utilizando Python (hospedagem sugerida: PythonAnywhere).
* **Justificar** as escolhas técnicas e o uso de Inteligência Artificial no processo.

---

## <i class="fa-solid fa-diagram-project"></i> O Desafio Técnico

Vocês não farão apenas uma "tela bonita". Vocês construirão o cérebro do sistema.

<div class="mermaid">
graph LR;
    A[Aluno/Usuário] -->|Acessa| B(Frontend JS/HTML);
    B -->|Requisição HTTP| C{API Python};
    C -->|Lógica de Negócio| D[Processamento];
    D -->|SQL/ORM| E[(Banco de Dados)];
    E -->|Dados Persistidos| D;
    D -->|Resposta JSON| B;
</div>

* **Frontend:** Pode ser simples (Single Page Application).
* **Backend:** É a estrela do show. Deve gerenciar autenticação, rotas e regras de negócio (ex: salvar preferências de acessibilidade do aluno).

---

## <i class="fa-solid fa-triangle-exclamation"></i> Erros Comuns (Educação Preventiva)

Evitem cair nestas armadilhas clássicas durante o Hackathon:

* **A Ilusão do Design:** Gastar 80% do tempo escolhendo cores no CSS e deixar o banco de dados para a última hora.
* **O "Copiloto" no Comando:** Usar IA para gerar código inteiro sem entender o fluxo. 
    * *Risco:* Se o código quebrar (e vai), você não saberá consertar.
* **Banco de Dados "Planilha":** Criar uma tabela única gigante para tudo. Lembrem-se da normalização (Tabelas Relacionais).

---

## <i class="fa-solid fa-robot"></i> Uso Ético da IA

A Inteligência Artificial é permitida e encorajada, mas com regras:

1.  **Explicação Obrigatória:** Se o ChatGPT gerou a rota, você deve saber explicar linha por linha.
2.  **Documentação:** Indique no código onde a IA ajudou (ex: comentários).
3.  **Refatoração Humana:** O código da IA nem sempre segue as melhores práticas de segurança. Revise-o.

> "A IA é o motor, mas vocês são o volante e o GPS."

---

## <i class="fa-solid fa-laptop-code"></i> Dicas de Infraestrutura

Para que seu projeto seja funcional e acessível:

* **Hospedagem:** Utilizem o **PythonAnywhere** (gratuito e fácil configuração para Flask/Django).
* **Frontend:** Mantenham simples. HTML, CSS e JS em arquivos estáticos servidos pelo Python ou em página única.
* **Dados:** SQLite é suficiente para o protótipo, mas modelem pensando em escalabilidade.

---

## Modelo de Apresentação (Template)
### <i class="fa-solid fa-chalkboard-user"></i> Como vender seu peixe

Ao final, a apresentação do grupo deve seguir este roteiro lógico:

1.  **A Dor:** Qual problema do estudante vocês estão resolvendo?
2.  **A Solução:** Demo rápida do produto funcionando.
3.  **Sob o Capô (Backend):**
    * *"Criamos a tabela **X** para armazenar **Y**..."*
    * *"Usamos a rota **/login** para validar as credenciais..."*
    * *"A lógica de cálculo de nota acontece no servidor para evitar fraudes..."*
4.  **O Papel da IA:** Onde ela acelerou o processo?

---

## <i class="fa-solid fa-magnifying-glass"></i> Reflexão Final

Pensem no minigame da nave. Ele atira em meteoros, mas não sabe **quem** atirou ou **se** o piloto melhorou sua mira ao longo do tempo.

O projeto de vocês deve preencher essa lacuna. O Backend é o que transforma um "jogo" em uma "ferramenta de evolução".

* **Próximo Passo:** Reúnam os grupos, definam a "Dor" do usuário e desenhem o diagrama do banturma: minha turma de backend do terceiro ano 

tema: Hackathon sobre educação 

contexto: Usando os conhecimentos dados em sala voces tem que pensar em um produto que melhora a qualidade de vida do estudante facilitando o aprendizado 

tenho um minigame localizado em www.uzedasolucoes.com.br/efg/minigame.html mas ele tem um problema: falta recursos do backend. Ele e um jogo de naves bem retro que atiram em meteteoros se a pessoa acerta corretamente o quiz, como ele so tem um sistema de rankeamento nao tem um backend muito complexo, mas a materia e de backend entao ai esta o erro do meu projeto: focado no  frontend, entao serve como um bom exemplo de ferramenta didatica mas nao serve como exemplo pra turma em si 

regras: pode usar IA a vontade! mas tem que me explicar o que voces fizeram por exemplo: criamos uma tabela de usuarios para aramzenar um sistema de professores e alunos num sistema de aprendizado para disponiblizar aulas para o backend usamos as rotas X Y Z para fazer as operacoes A B C e assim vai , seria interessante montar um template para ajudar no dialogo / apresentacao dos alunos 


objetivo: o hackaton precisa necessariamente resolver um problema de mundo real 

dicas: usar o pythonanywhere para subir o banco de dados e o frontend pode ficar em uma unica pagina o js e o css, desta forma sites como co de dados (DER) antes de digitar qualquer código.

---

## Referências e Material de Apoio

* **Documentação Python:** Referência oficial da linguagem e bibliotecas padrão. [docs.python.org](https://docs.python.org/pt-br/3/)
* **Flask / Django Docs:** Escolham seu framework e sigam os tutoriais de "First App".
* **PythonAnywhere Help:** Guias para deploy de aplicações web. [help.pythonanywhere.com](https://help.pythonanywhere.com/)
* **SQLAlchemy / ORM:** Para manipulação eficiente de banco de dados.
