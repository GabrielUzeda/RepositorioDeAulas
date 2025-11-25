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
    background-color: #eef;
    padding: 2px 5px;
    border-radius: 4px;
    color: #d62828;
  }
---

# Teste Z: Tomada de Decisão com Dados
## Uma Abordagem Prática com Python

---

## Objetivos da Aula

* Compreender o conceito de **Inferência Estatística** através de analogias.
* Aprender a lógica do **Teste Z** para validar hipóteses.
* Aplicar o cálculo do Teste Z utilizando **Python** de forma passo a passo.
* Interpretar os resultados para tomar decisões seguras.

---

## O Dilema da Pizzaria: Uma Analogia

Imagine uma grande rede de pizzarias que promete entrega em **30 minutos** (média histórica). Esta é a nossa "verdade conhecida".

Uma nova filial abre na sua cidade. Você desconfia que eles são **mais lentos**.
Para provar isso, você não pode pedir apenas uma pizza (pode ser um dia ruim). Você anota o tempo de **50 entregas** e descobre que a média dessa filial é **32 minutos**.

* **A Pergunta:** Esses 2 minutos extras são apenas "azar" (acaso) ou a nova filial é realmente ineficiente?
* **A Ferramenta:** O Teste Z é o juiz que dirá se essa diferença é significativa.

---

## Conceitos Fundamentais: As Hipóteses

Em estatística, trabalhamos como advogados em um tribunal. Temos duas histórias concorrentes:

1.  **Hipótese Nula ($H_0$):** O "Status Quo". Diz que nada mudou.
    * *Exemplo:* A filial é igual às outras. A média é 30 min. A diferença foi sorte.
2.  **Hipótese Alternativa ($H_1$):** A "Novidade". Diz que há uma mudança real.
    * *Exemplo:* A filial é diferente (mais lenta). A média é realmente maior que 30.

Nosso objetivo é ver se temos provas (dados) suficientes para rejeitar a $H_0$.

---

## A Régua Mágica: O Escore Z

Como medimos essa diferença? Não usamos minutos, usamos **Desvios Padrão**.

O **Escore Z** nos diz quão longe a média da nossa amostra está da média esperada, ajustada pelo tamanho do grupo.

$$
Z = \frac{\bar{x} - \mu}{\sigma / \sqrt{n}}
$$

* $\bar{x}$: Média da sua amostra (32 min).
* $\mu$: Média histórica/população (30 min).
* $\sigma$: Desvio padrão da população (vamos supor 5 min).
* $\sqrt{n}$: Raiz quadrada do número de observações (50 pedidos).

---

## O que é a Distribuição Normal?

Também chamada de **Curva de Sino** (*Bell Curve*), é o desenho mais famoso da estatística. Ela nos diz como os dados se comportam na natureza.

* **O Centro (Pico):** Onde a maioria dos dados se agrupa. Representa a média.
* **As Caudas (Pontas):** Onde estão os eventos raros ou extremos.

> **Exemplo:** Pense na altura das pessoas. A maioria tem altura mediana. Pessoas muito baixas ou muito altas são raras e ficam nas "caudas" do gráfico.

---

## De onde vem o número 1.96?

Ele não é um número mágico; é uma coordenada matemática precisa.

Quando decidimos que queremos **95% de confiança** em nossa decisão:
1.  Sobram **5%** de chance de erro (chamado de nível de significância, $\alpha = 0.05$).
2.  Dividimos esse risco em dois lados da curva:
    * **2.5%** na cauda esquerda (excepcionalmente baixo).
    * **2.5%** na cauda direita (excepcionalmente alto).

---

## O Limite da Normalidade

Na tabela matemática da Distribuição Normal Padrão $N(0,1)$:

O número **Z** que deixa exatamente 2.5% dos dados para fora (na ponta) é o **1.96**.

$$
P(-1.96 < Z < 1.96) = 0.95
$$

**Traduzindo:**
* Se o seu Z está **entre -1.96 e 1.96**: Você está na zona comum (95%). **Aceita H0**.
* Se o seu Z é **maior que 1.96** (ou menor que -1.96): Você cruzou a fronteira do raro. **Rejeita H0**.

---

## Fluxo de Decisão

<div class="mermaid">
graph LR;
    A[Coletar Dados] --> B[Definir Hipóteses];
    B --> C[Calcular valor de Z];
    C --> D{Z é extremo?};
    D -->|Sim| E["Rejeitar H0<br>(A filial é diferente)"];
    D -->|Não| F["Manter H0<br>(Foi apenas acaso)"];
    </div>

* **Z Extremo:** Geralmente, se o Z for maior que **1.96** ou menor que **-1.96** (para 95% de confiança), consideramos que o evento é raro demais para ser sorte.

---

## Python: Nossa Calculadora Inteligente

Não precisamos fazer contas à mão. O Python serve como uma calculadora passo a passo. Vamos usar variáveis simples, como se estivéssemos guardando números em caixas etiquetadas.

**Cenário:**
* Média da População ($\mu$): 30
* Desvio Padrão ($\sigma$): 5
* Média da Amostra ($\bar{x}$): 32
* Tamanho da Amostra ($n$): 50

---

## Passo 1: Definindo as Variáveis no Python

Primeiro, importamos a biblioteca matemática e declaramos nossos valores.

```python
import math

# 1. Dados conhecidos (Status Quo)
media_populacao = 30
desvio_padrao_pop = 5

# 2. Dados da nossa investigação (Amostra)
media_amostra = 32
tamanho_amostra = 50
```

*Note que os nomes das variáveis são explicativos para facilitar a leitura.*

---

## Passo 2: Calculando o Z no Python

Agora, traduzimos a fórmula matemática para código.

$$
\text{Erro Padrão} = \frac{\sigma}{\sqrt{n}} \quad \rightarrow \quad Z = \frac{\text{Diferença}}{\text{Erro Padrão}}
$$

```python
# Calculando o Erro Padrão (o denominador)
# math.sqrt() calcula a raiz quadrada
erro_padrao = desvio_padrao_pop / math.sqrt(tamanho_amostra)

# Calculando o Z (o numerador dividido pelo denominador)
z_score = (media_amostra - media_populacao) / erro_padrao

print(f"O valor de Z é: {z_score:.2f}")
# Resultado esperado: 2.83
```

---

## Passo 3: Tomando a Decisão

Um Z de **2.83** significa que nosso resultado está a quase 3 desvios padrão de distância. Isso é muito longe! O limite comum é 1.96.

```python
limite_critico = 1.96

if abs(z_score) > limite_critico:
    print("Resultado: Rejeitamos a Hipótese Nula.")
    print("A filial é estatisticamente diferente (mais lenta).")
else:
    print("Resultado: Não podemos rejeitar a Hipótese Nula.")
    print("A diferença pode ser apenas acaso.")
```

*O comando `abs()` garante que olhamos o valor absoluto (positivo), seja para mais ou para menos.*

---

## Erros Comuns e Prevenção

* **Confundir População com Amostra:** O Teste Z exige que você conheça o desvio padrão da **população** ($\sigma$). Se você só tem os dados da amostra, deve usar o **Teste T** (Student).
* **Tamanho da Amostra:** O Teste Z funciona melhor com grandes amostras ($n > 30$). Para amostras pequenas, o Teste T é mais seguro.
* **Certeza Absoluta:** Estatística não é mágica. Rejeitar $H_0$ com 95% de confiança significa que ainda existe 5% de chance de estarmos errados (Erro Tipo I).

---

## Atividade Prática

Imagine que você trabalha em uma fábrica de garrafas.
* A máquina deve encher **500ml** ($\mu$).
* O desvio padrão histórico é **10ml** ($\sigma$).
* Você mediu **64 garrafas** ($n$) e a média foi **497ml** ($\bar{x}$).

**Desafio:** Use o script Python apresentado. Substitua os valores nas variáveis. O Z será maior que 1.96 (ou menor que -1.96)? A máquina está descalibrada?

---

## Conclusão

O Teste Z é uma ferramenta poderosa para separar **ruído** (variações normais do dia a dia) de **sinais** (mudanças reais).

1.  Definimos o que é "normal" ($H_0$).
2.  Calculamos o quão "estranha" é nossa amostra (Escore Z).
3.  Usamos o Python para automatizar o cálculo e evitar erros matemáticos.

Na próxima etapa, veremos como lidar com casos onde não temos informações sobre a população inteira (Teste T).

---

## Referências e Material de Apoio

* **Documentação Python (Math):** [https://docs.python.org/pt-br/3/library/math.html](https://docs.python.org/pt-br/3/library/math.html) - Para entender funções como `sqrt`.
* **Khan Academy (Estatística):** Ótimo recurso visual para entender a curva normal e o escore Z.
* **SciPy Stats:** Para quem quiser avançar, a biblioteca `scipy` possui funções que calculam o Z e o Valor-P automaticamente.
