---
marp: true
theme: default
paginate: true
math: katex
style: |
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  section {
    font-family: 'Roboto', sans-serif;
    background-color: #f4f6fb;
    color: #2b2b2b;
    font-size: 26px;
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
  .term {
    background-color: #e0e7ff;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-weight: bold;
    color: #1a3a6e;
  }
  blockquote {
    border-left: 5px solid #d62828;
    background: #fff;
    padding: 10px;
    border-radius: 4px;
  }
---

# Dicionário do Git
## Traduzindo a Linha do Tempo do Código

<div style="text-align: center; margin-top: 50px;">
  <i class="fa-brands fa-git-alt" style="font-size: 5em; color: #f05032;"></i>
  <i class="fa-solid fa-arrow-right" style="font-size: 3em; margin: 0 20px; color: #aaa;"></i>
  <i class="fa-solid fa-book-open" style="font-size: 5em; color: #1a3a6e;"></i>
</div>

---

## Objetivos de Aprendizagem

* **Traduzir** os termos técnicos do inglês para conceitos mentais claros em português.
* **Compreender** o fluxo de trabalho do Git através de analogias do mundo real (jogos e fotografia).
* **Identificar** comandos essenciais e evitar erros comuns de sincronização.
* **Diferenciar** as ferramentas de versionamento local (Git) das plataformas de nuvem (GitHub).

---

## A Grande Analogia: O Sistema de "Save"

Imagine que você está jogando um videogame complexo ou escrevendo um livro colaborativo.

* Se você cometer um erro fatal, gostaria de poder voltar no tempo, certo?
* O **Git** é essa máquina do tempo.
* Ele permite criar **"pontos de salvamento"** (checkpoints) na história do seu projeto.

> **Conceito Chave:** O Git não salva apenas o arquivo final; ele salva as **diferenças** e a evolução de cada linha de código ao longo do tempo.

---

## Termos Fundamentais:

Vamos traduzir o vocabulário essencial para iniciar o trabalho.

* <span class="term">Repository (Repositório)</span>
    * *Tradução:* O Armazém / A Pasta do Projeto.
    * *Significado:* É o local onde vivem todos os arquivos e o histórico do seu projeto. Pode ser local (no seu PC) ou remoto (na nuvem).
* <span class="term">Commit</span>
    * *Tradução:* Ponto de Salvamento / Fotografia.
    * *Significado:* É o ato de registrar uma mudança permanente no histórico. Cada commit tem um ID único (hash) e uma mensagem explicativa.
---

## Ramificações: Universos Paralelos

Trabalhar em equipe exige criar realidades alternativas para não quebrar o projeto principal.

* <span class="term">Branch</span>
    * *Tradução:* Ramo / Linha do Tempo Alternativa.
    * *Significado:* Uma cópia do projeto onde você pode testar novas ideias sem afetar a versão principal (`main`).
* <span class="term">Merge</span>
    * *Tradução:* Fusão.
    * *Significado:* O ato de pegar a sua linha do tempo alternativa e fundi-la de volta à linha principal.

---

## Colaboração: A Nuvem (GitHub/GitLab)

Aqui o Git (ferramenta) conversa com o servidor (hospedagem).

* <span class="term">Remote</span>
    * *Tradução:* Servidor Remoto.
    * *Significado:* A versão do seu repositório hospedada na internet.
* <span class="term">Push (Empurrar)</span>
    * *Tradução:* Upload.
    * *Significado:* Enviar seus commits locais para o servidor.
* <span class="term">Pull (Puxar)</span>
    * *Tradução:* Download + Atualização.
    * *Significado:* Trazer as atualizações da nuvem para o seu computador.

---

## Educação Preventiva: Conflitos de Merge ⚠️

Um dos momentos mais temidos é o **Merge Conflict**.

* **O que é?** Dois universos colidem. Duas pessoas alteraram a **mesma linha** do **mesmo arquivo** de maneiras diferentes.
* **O que o Git faz?** Ele para tudo e pede ajuda humana: "Eu não sei qual versão está correta. Decida você."
* **Como prevenir?**
    * Faça `git pull` frequentemente para manter seu projeto atualizado.
    * Comunique-se com a equipe sobre quem está mexendo em qual arquivo.
    * Faça commits pequenos e focados.

---

## Analogia: O Diário Coletivo

Imagine uma turma escrevendo um livro de histórias.

1.  **Repo: (Repositório)** O caderno onde a história é escrita.
2.  **Clone:** Cada aluno tira uma fotocópia do caderno para levar para casa.
3.  **Branch:** O Aluno A quer escrever um final feliz; o Aluno B quer um final triste. Cada um escreve em sua cópia.
4.  **Commit:** O Aluno A termina um parágrafo e "salva".
5.  **Push:** O Aluno A cola sua folha no caderno original na escola.
6.  **Pull:** O Aluno B, antes de colar a dele, lê a do Aluno A para ver se faz sentido.

---

## Reflexão e Prática

Pense em como você organiza seus arquivos hoje (ex: `trabalho_final_v2_agora_vai.doc`).

* Como o uso de **Commits** (mensagens claras sobre o que mudou) eliminaria a necessidade de ter 10 arquivos com nomes diferentes?
* A organização semântica (por significado) substitui a organização cronológica caótica.

**Próximo Passo:** Instale o Git e crie seu primeiro repositório local. Tente criar um arquivo de texto, fazer uma mudança, adicioná-la ao palco (`add`) e tirar a foto (`commit`).

---

## Conclusão

O Git é mais do que comandos; é uma **filosofia de organização**.

* Dominar estes termos (<span class="term">Commit</span>, <span class="term">Push</span>, <span class="term">Branch</span>) é o primeiro passo para a fluência na engenharia de software moderna.
* Lembre-se: O erro é parte do processo. O Git existe justamente para que o erro não seja permanente.

---

## Material Complementar

* **Git - Documentação Oficial:** A referência completa e traduzida. [https://git-scm.com/book/pt-br/v2](https://git-scm.com/book/pt-br/v2)
* **Oh My Git!:** Um jogo open source para aprender Git visualmente. [https://ohmygit.org/](https://ohmygit.org/)
* **Pro Git (Livro):** Leitura aprofundada sobre os mecanismos internos (Scott Chacon e Ben Straub).
