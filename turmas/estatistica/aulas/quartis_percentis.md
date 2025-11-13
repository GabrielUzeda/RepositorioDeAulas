---
marp: true
theme: default
paginate: true
math: katex
style: |
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
  @import 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css';
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
  .fas, .fab, .fa-solid {
    margin-right: 8px;
  }
  .smalltext {
    font-size: 0.8em;
  }

---

# <i class="fa-solid fa-layer-group"></i> Além das Médias: Entendendo Quartis e Percentis

### Medidas de Posição e Sua Importância na Análise de Dados

---

## <i class="fa-solid fa-bullseye"></i> Objetivos de Aprendizagem

Ao final desta aula, você será capaz de:

* **Definir** o que são percentis e quartis e como eles medem a posição nos dados.
* **Calcular** os quartis (Q1, Q2, Q3) de um conjunto de dados.
* **Interpretar** o significado de um percentil (ex: P90) em um contexto real.
* **Explicar** por que quartis são mais **robustos** a outliers do que a média.
* **Aplicar** o Intervalo Interquartil (IQR) como uma medida de dispersão.

---

## <i class="fa-solid fa-water"></i> O Problema da Média (Média Aritmética)

Imagine que lhe dizem que um rio tem, **em média**, 1 metro de profundidade. Você se sentiria seguro para atravessá-lo a pé?

* Provavelmente não.
* A média pode ser **enganosa**. O rio pode ter 10cm de profundidade nas margens e 5 metros no meio. A média de 1m não conta a história completa.
* A média é muito sensível a valores extremos (outliers).

Precisamos de ferramentas que descrevam a **distribuição** e a **posição** dos dados, não apenas o "centro" calculado.

---

## <i class="fa-solid fa-chart-pie"></i> O que são Percentis?

Percentis são medidas que dividem um conjunto de dados **ordenados** em 100 partes iguais.

* Um percentil $P_k$ é o valor abaixo do qual $k\%$ dos dados se encontram.

**Analogia:** Pense em 100 pessoas em uma fila, ordenadas da mais baixa para a mais alta.
* A pessoa na 10ª posição da fila representa o **Percentil 10 (P10)**. 10% das pessoas são mais baixas que ela.
* A pessoa na 90ª posição é o **Percentil 90 (P90)**. 90% das pessoas são mais baixas.
* O **Percentil 50 (P50)** é o valor central. 50% dos dados estão abaixo dele. Este é o valor mais famoso de todos...

---

## <i class="fa-solid fa-star"></i> O Percentil Mais Famoso: A Mediana

O **Percentil 50 (P50)** é a **MEDIANA**.

* É o ponto exato no meio dos dados.
* Metade (50%) dos dados está abaixo da mediana.
* Metade (50%) dos dados está acima da mediana.

A mediana é o pilar central das medidas de posição.

---

## <i class="fa-solid fa-th-large"></i> O que são Quartis?
Quartis são apenas os percentis **mais importantes**. Eles dividem o conjunto de dados em **quatro** partes iguais (ou "quartos").
Existem três pontos de quartil:
* <i class="fa-solid fa-Q"></i> **Q1 (Primeiro Quartil):**
    * Corresponde ao **Percentil 25 (P25)**.
    * 25% dos dados estão abaixo dele.
    * *É a mediana da metade inferior dos dados.*
* <i class="fa-solid fa-Q"></i> **Q2 (Segundo Quartil):**
    * Corresponde ao **Percentil 50 (P50)**.
    * É a própria **Mediana**.
* <i class="fa-solid fa-Q"></i> **Q3 (Terceiro Quartil):**
    * Corresponde ao **Percentil 75 (P75)**.
    * 75% dos dados estão abaixo dele.
    * *É a mediana da metade superior dos dados.*

---

## <i class="fa-solid fa-magnifying-glass-chart"></i> O que é um Outlier (Valor Discrepante)?

Um **outlier** é um valor de dados que se **distancia significativamente** dos outros valores no conjunto.
Imagine as idades em uma sala de aula:
`[ 22, 25, 27, 28, 30, 31, 33 ]`
Agora, se um professor de 95 anos entrar:
`[ 22, 25, 27, 28, 30, 31, 33,` **`95`** `]`
* O valor **95** é um outlier.
* Outliers podem ser **erros de digitação** (ex: 950 em vez de 95) ou **eventos reais e raros** (ex: o salário de um CEO comparado ao dos outros funcionários).
---

## <i class="fa-solid fa-user-shield"></i> Importância 1: Robustez contra Outliers

**Outlier:** Um valor extremo que "puxa" a média.
**Analogia:** O Salário Médio
* Imagine uma sala com 5 professores, ganhando:
    `[ R$ 5.000, R$ 5.200, R$ 5.500, R$ 5.800, R$ 6.000 ]`
* **Média:** R$ 5.500
* **Mediana (Q2):** R$ 5.500 (descreve bem o grupo)

* Agora, Bill Gates (salário: R$ 10.000.000) entra na sala.
    `[ 5.000, 5.200, 5.500, 5.800, 6.000, 10.000.000 ]`
* **Nova Média:** R$ 1.670.416 (Não descreve ninguém na sala!)
* **Nova Mediana (Q2):** (5.500 + 5.800) / 2 = R$ 5.650

**Conclusão:** A média foi destruída pelo outlier. A mediana (Q2) quase não mudou. Quartis e percentis são **robustos**.

---

## <i class="fa-solid fa-ruler-combined"></i> Importância 2: Medindo a Dispersão Robusta

A média usa o *desvio padrão* para medir a dispersão.
A mediana usa o **Intervalo Interquartil (IQR)**.

**$IQR = Q3 - Q1$**

* O IQR representa a **amplitude (range) dos 50% centrais** dos dados.
* Ele mede a dispersão ignorando os 25% mais baixos e os 25% mais altos (onde geralmente estão os outliers).
* É a medida de dispersão **mais importante** para dados assimétricos ou com outliers.

---

## <i class="fa-solid fa-triangle-exclamation"></i> Educação Preventiva: Um Erro Comum

Um erro comum é confundir o **quartil** (um ponto) com um **quarto** (um grupo).

* **Errado:** "Meu dado está no Q1."
* **Correto:** "Meu dado está *abaixo* do Q1" (no primeiro quarto).
* **Correto:** "Meu dado está *entre* Q1 e Q2." (no segundo quarto).

**Analogia:** Pense nos quartis como **cercas** que separam quatro campos.
* Q1, Q2 e Q3 são as **cercas**.
* Os "quartos" são os **campos** onde os dados vivem.

---

## <i class="fa-solid fa-box-archive"></i> A Aplicação Visual: O Box Plot

Quartis são a base do **Box Plot** (Diagrama de Caixa). Ele resume visualmente 5 números: Mínimo, Q1, Q2 (Mediana), Q3, Máximo.

O "corpo" da caixa é formado pelo $IQR$ (de Q1 a Q3).

<div class="mermaid">
graph TD
    subgraph Resumo de 5 Números
        Min(Mínimo) --"Bigode (Whisker)"--> Q1(Q1)
        Q1 --"Início da Caixa (IQR)"--> Q2(Mediana)
        Q2 --"Metade da Caixa"--> Q3(Q3)
        Q3 --"Fim da Caixa (IQR)"--> Max(Máximo)
    end
    style Min fill:#f4f6fb,stroke:#1a3a6e,stroke-width:2px
    style Q1 fill:#bde0fe,stroke:#1a3a6e,stroke-width:3px
    style Q2 fill:#ffb703,stroke:#1a3a6e,stroke-width:4px
    style Q3 fill:#bde0fe,stroke:#1a3a6e,stroke-width:3px
    style Max fill:#f4f6fb,stroke:#1a3a6e,stroke-width:2px
</div>

---

## <i class="fa-solid fa-briefcase"></i> Estudo de Caso: Salários de Duas Empresas

Qual empresa oferece um salário mais "padronizado"?

| Empresa A (Média: R$ 6.000) | Empresa B (Média: R$ 5.900) |
| :--- | :--- |
| R$ 3.000 | R$ 5.000 |
| R$ 4.000 | R$ 5.500 |
| **R$ 5.000 (Mediana/Q2)** | **R$ 6.000 (Mediana/Q2)** |
| R$ 6.000 | R$ 6.500 |
| R$ 12.000 (Outlier) | R$ 6.600 |

---

## <i class="fa-solid fa-briefcase"></i> Estudo de Caso: Salários de Duas Empresas


* A **Média** sugere que a Empresa A paga mais.
* A **Mediana (Q2)** mostra que o funcionário *típico* da Empresa B (R$ 6.000) ganha mais que o *típico* da Empresa A (R$ 5.000).
* O $IQR$ da Empresa B é muito menor, indicando salários mais consistentes.
* **A análise de quartis (Mediana e IQR) contou a história real.**

---

## <i class="fa-solid fa-brain"></i> Reflexão: Quando usar Quartis?

Quando você recebe um conjunto de dados, a primeira pergunta não deve ser "Qual a média?", mas sim:

**"Qual é o formato destes dados?"**

* **Se os dados forem simétricos** (como uma curva de sino), a **Média** e o **Desvio Padrão** funcionam muito bem.
* **Se os dados forem assimétricos** (ex: salários, preços de imóveis) ou **contiverem outliers**, a Média é enganosa.
* Nesses casos, use sempre a **Mediana (Q2)** para encontrar o centro e o **IQR (Q3-Q1)** para medir a dispersão.

---

## <i class="fa-solid fa-clipboard-check"></i> Conclusão

* **Percentis** e **Quartis** são medidas de **posição** que ordenam e fatiam os dados.
* Eles não são influenciados por valores extremos (outliers), o que os torna **robustos**.
* O **Q2** é a **Mediana**, a medida de centro mais confiável para dados assimétricos.
* O **Intervalo Interquartil ($IQR = Q3 - Q1$)** é a medida de dispersão mais confiável para dados assimétricos.
* Eles formam a base do **Box Plot**, uma das ferramentas visuais mais poderosas da estatística.

---

## <i class="fa-solid fa-calculator"></i> Como Calcular um Percentil
1.  **Ordene** seus $N$ dados (de $x_1$ a $x_N$).
2.  Calcule a **Posição (R)** do percentil $P$ desejado.
    * Fórmula da Posição: $R = \frac{P}{100} \times (N + 1)$
3.  **Encontre o valor:**
    * Se $R$ for **inteiro** (ex: 4), o valor é o $R$-ésimo dado ($x_4$).
    * Se $R$ for **decimal** (ex: 4.25), interpole entre $x_4$ e $x_5$.
**Exemplo Rápido:** Achar o P25 (Percentil 25) do conjunto `[10, 20, 30, 40, 50]`
* $N = 5$.
* $R = (25 / 100) \times (5 + 1) = 0.25 \times 6 = 1.5$ (Posição 1.5)
* Valor: Metade do caminho entre $x_1$ (10) e $x_2$ (20).
* Valor = $10 + 0.5 \times (20 - 10) = 15$.
* **P25 = 15**
---

## <i class="fa-solid fa-book"></i> Material Complementar

* **Khan Academy (Português):** Vídeos excelentes e interativos sobre "Diagrama de caixa (box plot)" e "Intervalo interquartil (IIQ)".
* **Livro:** "Estatística Para Leigos" por Deborah Rumsey. [cite_start]Aborda esses conceitos de forma muito acessível. [cite: 2639, 2793]
* **Calculadora Online de Quartis:** Pratique com seus próprios números em sites de estatística (como o *Calculator.net*) para verificar seus cálculos manuais.