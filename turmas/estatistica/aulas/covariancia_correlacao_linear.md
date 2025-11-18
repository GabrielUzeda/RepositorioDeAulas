---
marp: true
theme: default
paginate: true
math: katex
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
    padding: 2px 5px;
    border-radius: 4px;
  }
---

# Covariância e Correlação Linear
## Entendendo a "Dança" dos Dados

---

## Objetivos da Aula

* Compreender intuitivamente o relacionamento entre duas variáveis.
* Diferenciar **Covariância** (Direção) de **Correlação** (Força).
* Identificar armadilhas comuns na interpretação de dados.
* Aplicar o conceito de "Correlação não implica Causalidade".

---

## Introdução: A Analogia do Sorvete

Imagine que você é dono de uma sorveteria. Você percebe algo curioso:
* Nos dias **muito quentes** ($X$), você vende **muitos sorvetes** ($Y$).
* Nos dias **frios** ($X$), você vende **poucos sorvetes** ($Y$).

As duas variáveis (Temperatura e Vendas) parecem "dançar" juntas. Quando uma sobe, a outra também sobe.
* Isso é o cerne da **Covariância** e da **Correlação**.
* Mas como medimos essa dança? É uma valsa lenta ou um tango sincronizado?

---

## Conceito 1: Covariância (A Direção)

A **Covariância** nos diz **se** as variáveis se movem juntas e **para onde**.

* **Covariância Positiva (> 0):** Ambas sobem juntas (Ex: Sol e Sorvete).
* **Covariância Negativa (< 0):** Uma sobe, a outra desce (Ex: Chuva e Visitantes no Parque).
* **Covariância Perto de Zero:** Elas não têm relação linear clara.

$$ Cov(X,Y) = \frac{\sum(X_i - \bar{X})(Y_i - \bar{Y})}{n-1} $$

> **O problema:** O número da covariância pode ser gigante (ex: 5000) ou pequeno (0.02) dependendo da escala (metros vs quilômetros). É difícil comparar.

---

## Conceito 2: Correlação Linear (A Força)

Para resolver o problema da escala, usamos a **Correlação (de Pearson)**. Ela "padroniza" a covariância entre **-1 e +1**.

* **+1:** Perfeita sincronia positiva.
* **-1:** Perfeita sincronia negativa (oposta).
* **0:** Nenhuma relação linear (o caos).

$$ r = \frac{Cov(X,Y)}{S_x S_y} $$

* Pense na correlação como uma "nota de 0 a 10" para o quão alinhada é a dança.

---

## Visualizando a Relação

<svg width="600" height="300" viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
  <line x1="50" y1="250" x2="550" y2="250" stroke="#1a3a6e" stroke-width="2" />
  <line x1="50" y1="250" x2="50" y2="50" stroke="#1a3a6e" stroke-width="2" />
  <text x="560" y="255" font-family="Roboto" font-size="14" fill="#1a3a6e">Temp (X)</text>
  <text x="20" y="40" font-family="Roboto" font-size="14" fill="#1a3a6e">Vendas (Y)</text>
  
  <circle cx="80" cy="220" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="120" cy="200" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="160" cy="180" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="200" cy="190" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="240" cy="150" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="280" cy="130" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="320" cy="110" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="360" cy="80" r="6" fill="#d62828" opacity="0.8" />
  <circle cx="400" cy="90" r="6" fill="#d62828" opacity="0.8" />
  
  <line x1="80" y1="230" x2="400" y2="80" stroke="#1a3a6e" stroke-width="2" stroke-dasharray="5,5" />
  
  <text x="300" y="200" font-family="Roboto" font-size="18" fill="#1a3a6e">Correlação Forte e Positiva</text>
</svg>

---

## Fluxo de Análise

<div class="mermaid">
graph LR;
    A[Dados Coletados] --> B{Calcular Covariância};
    B -->|Positiva| C[Movem-se Juntas];
    B -->|Negativa| D[Movem-se Opostas];
    C --> E{Calcular Correlação};
    D --> E;
    E -->|Perto de 1 ou -1| F[Relação Forte];
    E -->|Perto de 0| G[Relação Fraca];
</div>

---

## Erros Comuns (Educação Preventiva)

* **O Mito da Causalidade:**
    * *Erro:* "O galo canta antes do sol nascer, logo o galo **faz** o sol nascer."
    * *Correção:* Correlação apenas indica que eventos acontecem juntos, não que um causa o outro.
* **Outliers (Pontos Fora da Curva):**
    * Um único dia atípico (ex: um festival de sorvete no inverno) pode distorcer sua análise se a amostra for pequena.
* **Ignorar Relações Não-Lineares:**
    * Seus dados podem formar um "U" (parábola). A correlação linear dirá que é 0, mas a relação existe!

---

## Estudo de Caso: O Investidor Iniciante

**Cenário:** João percebe que quando as ações de guarda-chuvas sobem, as de protetor solar caem.
**Análise:**
1.  Ele calcula a **covariância** e encontra um número negativo. (Direção oposta confirmada).
2.  Ele calcula a **correlação** e encontra **-0.85**.
3.  **Decisão:** Ele usa isso para diversificar. Se o dia estiver ruim para protetor solar, o guarda-chuva compensa.

**Reflexão:** João não sabe *por que* (pode ser o clima), mas usa a métrica para proteger seu dinheiro.

---

## Aplicação no Mundo Real

* **Saúde:** Correlação entre tempo de exercício e redução da pressão arterial.
* **Marketing:** Correlação entre investimento em anúncios e número de cliques.
* **Tecnologia:** Sistemas de recomendação (Netflix) buscam correlações entre o que você assistiu e o que outros usuários parecidos assistiram.

---

## Reflexão Final

Ao olhar para dois eventos que parecem conectados:
1.  **Verifique a Direção:** Eles sobem juntos? (Covariância)
2.  **Verifique a Força:** É uma conexão sólida ou coincidência? (Correlação)
3.  **Questione a Causa:** Existe uma terceira variável (como o Clima na história do sorvete)?

> "Os números não mentem, mas mentirosos (e desatentos) usam números."


# Calculando com Python
## Bibliotecas Essenciais: NumPy e Pandas

---

## Pandas: Tabelas Organizadas

O `pandas` é ideal para tabelas de dados reais (Excel, CSV). Ele calcula a matriz de todos contra todos automaticamente.

```python
import pandas as pd

# Criando uma tabela simples
dados = pd.DataFrame({
    'Temp': [30, 32, 25, 15, 10],
    'Vendas_Sorvete': [200, 220, 150, 50, 30],
    'Vendas_Casacos': [10, 5, 20, 100, 120]
})

# Matriz de Covariância Completa
print(dados.cov()) 
# Note: Temp vs Vendas_Casacos dará negativo (Temp cai, Casaco sobe)

# Matriz de Correlação (Clean e fácil de ler)
print(dados.corr())
# Temp vs Sorvete deve ser próximo de +1.0
```

---

## Conclusão

* A **Covariância** indica o sentido da relação (positiva/negativa).
* A **Correlação** padroniza essa medida (-1 a 1) para indicar a força.
* **Lembre-se:** Correlação $\neq$ Causalidade.
* Use essas ferramentas para descrever o passado, mas investigue mais a fundo antes de prever o futuro.

---

## Material Complementar e Referências

* **Think Stats - Allen B. Downey:** Uma introdução prática à estatística para quem pensa como programador. Ótimo para ver esses conceitos em código Python.
* **Estatística II Para Leigos - Deborah Rumsey:** Explicações acessíveis e passo a passo sobre análise de dados e testes de hipótese.
* **Khan Academy (Online):** Recomendo a seção de "Dados bivariados" para exercícios interativos de plotagem.
