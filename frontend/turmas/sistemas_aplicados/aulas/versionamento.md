---
marp: true
theme: default
paginate: true
---

# Versionamento de Código
A História, o "Diff" e a Importância do Versionamento de Software

---

## Objetivos da Aula

Ao final desta sessão, você será capaz de:

* **Definir** o que é Controle de Versão (Versionamento).
* **Compreender** o conceito de "Diff" (Diferença).
* **Narrar** a história e a motivação por trás da criação do Git.
* **Justificar** por que o versionamento é crucial para o desenvolvimento de software moderno.

---

## A Origem do Caos

Imagine que você e mais quatro pessoas precisam escrever um roteiro de filme juntos.

* Pessoa 1 envia: `roteiro_v1.doc`
* Pessoa 2 edita e envia: `roteiro_v1_editado.doc`
* Pessoa 3 revisa e envia: `roteiro_v2_final.doc`
* Pessoa 1 faz outra mudança: `roteiro_v2_final_AGORA_VAI.doc`

**Pergunta:** Qual versão contém o quê? Quem mudou o final? Como recuperar a cena deletada do Ato 1?

Isso é o desenvolvimento de software sem **controle de versão**.

---

## O Conceito Fundamental: Versionamento

**Controle de Versão** é um sistema que registra mudanças em um arquivo (ou conjunto de arquivos) ao longo do tempo, permitindo que você recupere versões específicas posteriormente.

* É uma "máquina do tempo" para o seu projeto.
* Funciona como um sistema de "checkpoints" em um jogo. Você pode salvar seu progresso e, se algo der errado, pode voltar ao último ponto seguro.

O versionamento nos dá:
* **Histórico:** O que mudou?
* **Autoria:** Quem mudou?
* **Contexto:** Por que mudou?
* **Segurança:** Posso reverter mudanças que quebraram o projeto.
* **Colaboração:** Múltiplas pessoas podem trabalhar no mesmo projeto sem sobrescrever o trabalho umas das outras.

---

## O "Jogo dos 7 Erros": O que é um "Diff"?

O "Diff" (abreviação de *difference*) é o coração do versionamento. Ele é, literalmente, "o jogo dos 7 erros" entre duas versões de um arquivo.

Um "diff" não armazena o arquivo inteiro novamente; ele armazena **apenas as linhas que foram adicionadas, modificadas ou removidas**.

<div class="mermaid">
graph LR;
    A[Versão 1 <br><br>1. Maçã <br>2. Banana <br>3. Uva] -->|Diff| B[Versão 2 <br><br>1. Maçã <br>2. Laranja <br>3. Uva];
    subgraph "Relatório do Diff"
        direction LR
        C('Removido: Linha 2 \'Banana\'')
        D('Adicionado: Linha 2 \'Laranja\'')
    end
    B --> C;
    B --> D;
</div>

---

## A História: O Nascimento do Git (2005)

A necessidade do Git nasceu de um conflito.

* **O Protagonista:** Linus Torvalds (criador do Linux).
* **O Desafio:** O Kernel do Linux era (e é) um projeto gigantesco, com milhares de colaboradores globais.
* **A Ferramenta Antiga:** Eles usavam um sistema proprietário (pago e fechado) chamado BitKeeper.
* **A Crise (2005):** A empresa dona do BitKeeper revogou o acesso gratuito da equipe do Linux, alegando que um dos desenvolvedores tentou fazer engenharia reversa no software.
* **A Fúria e a Criação:** Linus Torvalds, frustrado com a situação e descontente com todas as outras ferramentas da época (que ele achava lentas e inadequadas), decidiu criar a sua.

Ele escreveu o **Git** em cerca de duas semanas.

---

## Os Pilares do Git

Linus projetou o Git com três objetivos principais, baseados em sua frustração:

1.  **Velocidade:** O Git é incrivelmente rápido porque a maioria das operações é local.
2.  **Modelo Distribuído (DVCS):** Diferente de sistemas antigos (centralizados), cada desenvolvedor tem uma **cópia completa** do histórico do projeto. Você pode trabalhar offline e ter backups em todos os lugares.
3.  **Integridade:** Cada mudança (um "commit") é registrada com um código único (hash SHA-1). É matematicamente impossível alterar o histórico sem que o Git perceba.

O Git não foi feito para ser "amigável"; ele foi feito para ser **eficiente** e **seguro** para o maior projeto de software do mundo.

---

## Erro Comum (Educação Preventiva)

**A Armadilha:** Tratar `git commit` como se fosse um "Salvar".

* **O Erro:** Fazer um único "commit" gigante no final do dia com a mensagem: `git commit -m "fiz coisas"`
* **A Analogia:** Isso é como salvar seu jogo apenas uma vez a cada 8 horas. Se você precisar voltar 10 minutos, você não pode. Você só pode voltar 8 horas, perdendo todo o trabalho intermediário.
* **A Solução:** Um "commit" não é "Salvar". É um **"checkpoint" lógico**.
    * Cada commit deve ser **atômico**: focado em uma única tarefa (Ex: "Corrige bug no login", "Adiciona botão de 'contato'").
    * A mensagem deve explicar **o porquê** da mudança.
    * Isso torna o "diff" útil e o histórico legível.

---

## Estudo de Caso: O "Merge Conflict"

O Git é fantástico para colaboração, mas ele não faz milagres. Ele é um gerente de logística, não um vidente.

* **Cenário:**
    1.  Você baixa a `Versão A` do código.
    2.  Seu colega baixa a `Versão A` do código.
    3.  Você edita a Linha 10 para: `cor = "azul"`
    4.  Seu colega edita a **mesma** Linha 10 para: `cor = "vermelho"`
    5.  Seu colega envia a mudança dele.
    6.  Você tenta enviar a sua mudança.

---

* **O Resultado (Conflito de Merge):** O Git para e diz: "Eu não posso decidir. A Linha 10 deve ser 'azul' ou 'vermelha'? **Resolva isso humanamente**."

* **Lição:** Isso não é um erro do Git. É uma **salvaguarda crucial**. O Git força os humanos a comunicarem e decidirem qual é a versão correta da verdade, impedindo que um sobrescreva o trabalho do outro silenciosamente.

---

## Aplicação no Mundo Real

A importância do Git vai muito além do código:

* **Software (O óbvio):** Permite que empresas como Google, Microsoft e milhares de startups gerenciem projetos massivos.
* **DevOps (Infraestrutura):** Arquivos de configuração de servidores (Infra-as-Code) são versionados. Se um servidor cair, é possível reverter a configuração.
* **Ciência de Dados:** Rastreamento de scripts de análise, modelos de machine learning e datasets.
* **Escrita:** Autores usam Git para escrever livros, permitindo reverter capítulos inteiros ou colaborar com editores.
* **Design:** Versionamento de arquivos de UI/UX.

---

## Reflexão

Pense no seu fluxo de trabalho atual, mesmo fora da programação.

* Quantas vezes você já teve um arquivo `Trabalho_Final_v2_revisado.docx`?
* Quantas vezes você quis testar uma ideia nova, mas teve medo de "estragar" o que já funcionava? (O Git resolve isso com "Branches").
* O versionamento não é apenas sobre *código*; é sobre gerenciar a **complexidade** e proteger o **histórico** de qualquer trabalho criativo.

---

## Conclusão: A Importância do Git

* O Git não é apenas uma ferramenta; é o **sistema operacional fundamental** da colaboração de software moderna.
* Ele nos dá **segurança** para reverter erros (como uma rede de segurança) e **liberdade** para experimentar (através de *branches*).
* Dominar o Git é entender como o software é construído, revisado e mantido no mundo real. É a diferença entre caos e coordenação.

---

## Material Complementar

* **Livro Pro Git (Gratuito e Oficial):** A referência definitiva para tudo sobre Git.
    [https://git-scm.com/book/pt-br/v2](https://git-scm.com/book/pt-br/v2)

* **Documentação Oficial do Git:** Excelente para consultas rápidas sobre comandos.
    [https://git-scm.com/doc](https://git-scm.com/doc)

* **Atlassian Git Tutorial:** Ótimos guias conceituais (não apenas sobre a ferramenta deles).
    [https://www.atlassian.com/git/tutorials/what-is-git](https://www.atlassian.com/git/tutorials/what-is-git)