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
    background-color: #f9fbfd;
    color: #2b2b2b;
    font-size: 26px;
    line-height: 1.5;
  }
  h1, h2, h3 {
    font-family: 'Roboto Slab', serif;
    color: #0d47a1;
  }
  h2 {
    border-bottom: 2px solid #0d47a1;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  strong {
    color: #d32f2f;
    font-weight: 700;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  .box {
    background: #e3f2fd;
    padding: 15px;
    border-radius: 8px;
    border-left: 5px solid #0d47a1;
  }
---

# Fundamentos de Desenvolvimento Web e Cibersegurança
## Um Resumo Técnico Estruturado

---

## Objetivos de Aprendizagem

* <i class="fa-solid fa-layer-group"></i> Compreender a arquitetura **Full Stack** (Front-end, Back-end e Banco de Dados).
* <i class="fa-solid fa-cloud"></i> Diferenciar modelos de **Computação em Nuvem** e ambientes de virtualização.
* <i class="fa-solid fa-shield-halved"></i> Identificar pilares de **Cibersegurança**, defesa de redes e ética profissional.
* <i class="fa-solid fa-code"></i> Relacionar lógica de programação, APIs e metodologias ágeis.

---

## 1. Arquitetura de Software: O Todo e as Partes

Para entender como sistemas complexos funcionam, utilizamos a analogia de uma **construção civil**:

* **Front-end (A Fachada e o Interiores):** É a parte visual com a qual o usuário interage. Foca em experiência (UX) e interface (UI).
    * *Ex:* HTML, CSS, JavaScript.
* **Back-end (A Estrutura Interna):** É a lógica "invisível", o encanamento e a elétrica. Processa regras de negócio e gerencia dados no servidor.
* **Full Stack:** A integração completa. O profissional que compreende tanto a interface quanto a lógica e o banco de dados.

---

## 2. Infraestrutura e Nuvem

A "Nuvem" não é etérea; são data centers físicos massivos que oferecem serviços sob demanda.

### Modelos de Serviço (A Pirâmide da Nuvem)
* **IaaS (Infraestrutura):** Você aluga o hardware (servidores, redes). *Ex: AWS EC2.*
* **PaaS (Plataforma):** Você aluga o ambiente para desenvolver (bancos de dados, sistemas operacionais). *Ex: Heroku.*
* **SaaS (Software):** Você usa o software pronto. *Ex: Gmail, Google Drive.*

> **Conceito Chave: Virtualização e Sandbox**
> Para testar códigos perigosos ou novas configurações sem risco, usamos ambientes isolados chamados **Sandboxes** (caixas de areia).

---

## 3. Lógica e Conectividade

Como os sistemas "pensam" e "conversam"?

<div class="columns">
<div>

### Algoritmos
A base de tudo. São sequências lógicas de "Se... Então... Senão" (Tomada de Decisão).
* Permitem prever comportamentos e automatizar respostas baseadas em dados de entrada.

</div>
<div>

### APIs (Interfaces)
São as pontes que permitem que dois sistemas diferentes troquem dados.
* *Analogia:* Um garçom (API) que leva o pedido da mesa (Cliente) para a cozinha (Servidor) e traz o prato.

</div>
</div>

---

## 4. Cibersegurança Defensiva

A segurança da informação não é apenas sobre "atacar", mas principalmente sobre proteger a integridade, confidencialidade e disponibilidade.

* **Firewalls e IDS:** Atuam como porteiros e sistemas de alarme. Monitoram o tráfego de rede e bloqueiam anomalias ou intrusos.
* **Ethical Hacking (White Hat):** Profissionais contratados para encontrar falhas de segurança *antes* que criminosos o façam. O objetivo é a **correção** e fortalecimento do sistema.
* **Black Hat vs. White Hat:** A diferença fundamental é a **permissão** e a **intenção**.

---

## 5. Ética e Gestão de Projetos

A tecnologia não existe no vácuo; ela impacta pessoas e precisa ser gerenciada.

* **Cidadania Digital e Privacidade:** Com o poder de coletar dados, surge a responsabilidade. Discutir o uso ético da IA e a proteção de dados pessoais (LGPD) é obrigatório para qualquer profissional de TI.
* **Metodologias Ágeis (Scrum/Kanban):**
    * Ao contrário do modelo antigo (Cascata), que era rígido.
    * O Ágil divide projetos complexos em ciclos curtos de entrega (Sprints), permitindo adaptação rápida a mudanças.

---

## Visão Sistêmica: O Fluxo de Dados

Visualizando a integração dos conceitos (Questão 10 do questionário):

<div class="mermaid">
graph LR;
    A[Usuário/Front-end] -->|Requisição via API| B[Back-end/Servidor];
    B -->|Lógica de Segurança| C{Firewall};
    C -->|Aprovado| D[Banco de Dados];
    C -->|Bloqueado| E[Log de Erro];
    D -->|Dados Brutos| B;
    B -->|Dados Processados| A;
    style A fill:#e3f2fd,stroke:#0d47a1,stroke-width:2px
    style B fill:#fff9c4,stroke:#fbc02d,stroke-width:2px
    style C fill:#ffebee,stroke:#c62828,stroke-width:2px
</div>

---

## Reflexão e Prática

Ao analisar o desenvolvimento de sistemas seguros, percebemos que a **habilidade técnica** (codificar) é indissociável da **responsabilidade ética** (proteger).

### Para Refletir:
1.  Como a escolha de uma arquitetura (Nuvem vs. Local) impacta a segurança?
2.  Por que a documentação e a metodologia ágil são vitais para a manutenção de sistemas a longo prazo?

---

## Conclusão

O questionário aborda o ciclo completo de vida de um sistema digital seguro:

1.  **Construção:** Front-end, Back-end e Lógica.
2.  **Hospedagem:** Nuvem (IaaS/PaaS/SaaS).
3.  **Proteção:** Firewalls, Ethical Hacking e Virtualização.
4.  **Integração:** APIs.
5.  **Humanização:** Ética, Privacidade e Gestão Ágil.

---

## Material Complementar

* **MDN Web Docs:** Referência completa para Front e Back-end. [https://developer.mozilla.org/pt-BR/](https://developer.mozilla.org/pt-BR/)
* **OWASP Top 10:** Padrão global para segurança de aplicações web. [https://owasp.org/](https://owasp.org/)
* **Agile Alliance:** Guia sobre metodologias ágeis. [https://www.agilealliance.org/](https://www.agilealliance.org/)
* **AWS Training:** Conceitos fundamentais de Nuvem. [https://aws.amazon.com/pt/training/](https://aws.amazon.com/pt/training/)
