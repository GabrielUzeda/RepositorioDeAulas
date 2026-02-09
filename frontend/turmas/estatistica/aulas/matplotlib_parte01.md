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
---

# **Python: Custo de Produto e Análise de Mercado com Matplotlib**

---

## Objetivos da Aula

* **Calcular** os custos diretos e indiretos de um produto usando Python.
* **Analisar** dados de mercado para entender a concorrência.
* **Visualizar** dados de forma estratégica com a biblioteca Matplotlib.
* **Capacitar** a tomada de decisão de preços com base em dados.

---

## A História do Bolo Estratégico

Imagine que você é um confeiteiro prestes a lançar um novo bolo.
Sua receita é fantástica, mas qual preço cobrar? Vender muito barato pode significar prejuízo, enquanto um preço muito alto pode afastar os clientes.

Nesta aula, vamos usar o poder do Python para transformar essa incerteza em uma **decisão estratégica**, transformando números brutos em inteligência de negócio.

---

## Passo 0: Preparando o Ambiente

Para começar nossa análise, precisamos das ferramentas certas. Em nosso "kit de confeitaria digital", as bibliotecas `matplotlib` e `numpy` são essenciais.

Se ainda não as tiver, basta abrir seu terminal e executar o comando:

```bash
pip install matplotlib numpy
```

Isso prepara nosso ambiente para calcular e, mais importante, **visualizar** nossa estratégia.

---
## Analisando o Código: Passo a Passo

Em vez de olharmos todo o código de uma vez, vamos desmontá-lo em partes. Assim como em uma receita, cada bloco tem uma função específica no resultado final.

Vamos explorar cada etapa, desde a importação das ferramentas até a geração dos nossos gráficos decisivos.

---

### Parte 1: Importando as Ferramentas

Todo projeto em Python começa chamando as "caixas de ferramentas" que vamos usar.

* **`matplotlib.pyplot as plt`**: É a nossa principal ferramenta para **desenhar gráficos**. O `as plt` é um apelido para não precisarmos escrever o nome completo toda vez.
* **`numpy as np`**: É uma poderosa calculadora para **operações matemáticas e estatísticas**, como médias e medianas.

```python
import matplotlib.pyplot as plt
import numpy as np
```

---

### Parte 2: Inserindo os Custos do Bolo

Aqui, transformamos os dados do nosso negócio em variáveis que o Python entende.

* **`custo_direto_unitario`**: O custo dos ingredientes e embalagem de **um único bolo**.
* **`custos_indiretos_mensais`**: Despesas fixas do mês, como aluguel e energia, que não dependem da quantidade de bolos.
* **`producao_mensal_unidades`**: A nossa meta de produção para o mês.

```python
# Custos do nosso bolo (Produto Exemplo)
custo_direto_unitario = 12.00  # Ingredientes, embalagem
custos_indiretos_mensais = 1700.00  # Aluguel, energia, salários
producao_mensal_unidades = 100  # Quantos bolos produzimos por mês
```

---

### Parte 3: Mapeando a Concorrência

Nesta etapa, criamos uma lista com os preços que pesquisamos no mercado. Esta lista será a base para entendermos como nossos concorrentes estão posicionados.

```python
# Preços dos concorrentes
precos_mercado = [50.00, 48.00, 55.00, 45.00, 50.00, 59.00, 70.00]
```

---

### Parte 4: Calculando o Custo Total

Agora, a mágica acontece. Usamos as variáveis que criamos para encontrar nosso custo final.

* **A grande ideia aqui é "diluir" o custo fixo mensal** pela quantidade de bolos produzidos.
* Isso nos dá a fatia de custo indireto que cada bolo deve "carregar".
* Somamos isso ao custo direto para obter o **custo total de produção** de uma unidade.

```python
# Calculando o Custo Total do Produto
custo_indireto_unitario = custos_indiretos_mensais / producao_mensal_unidades
custo_total_unitario = custo_direto_unitario + custo_indireto_unitario
```

---

### Parte 5: Analisando o Mercado com NumPy

Com a lista de preços dos concorrentes, usamos o poder do NumPy para extrair informações valiosas.

* **`np.mean`**: Calcula a média de preços.
* **`np.median`**: Encontra o valor central, que divide o mercado exatamente ao meio.
* **`min()` e `max()`**: Mostram o preço mais baixo e o mais alto praticado pela concorrência.

```python
# Analisando a Concorrência
media_mercado = np.mean(precos_mercado)
mediana_mercado = np.median(precos_mercado)
preco_min_mercado = min(precos_mercado)
preco_max_mercado = max(precos_mercado)
```

---
    
### Parte 6: Visualizando a Análise (Gráficos)

Agora, vamos transformar nossos números em insights visuais. Usaremos o `matplotlib` (`plt`) para "desenhar" nossa análise.

Vamos detalhar a criação de cada um dos três gráficos, um por um.

---

### Parte 6.1: Gráfico de Composição de Custo

**Objetivo:** Mostrar visualmente qual parte do custo total do bolo pesa mais: os ingredientes (direto) ou o aluguel e outras contas (indireto).

Usamos um **gráfico de barras** (`plt.bar`) por ser perfeito para comparar categorias.

```python
# Gráfico 1: Composição do Custo Unitário
labels_custo = ['Custo Direto', 'Custo Indireto']
valores_custo = [custo_direto_unitario, custo_indireto_unitario]
```
---
```python
plt.bar(labels_custo, valores_custo, color=['#4CAF50', '#FFC107'])
plt.title('Gráfico 1: Composição do Custo Unitário do Produto')
plt.ylabel('Valor (R$)')

# Adiciona o valor exato em cima de cada barra
for i, v in enumerate(valores_custo):
    plt.text(i, v + 0.5, f"R$ {v:.2f}", ha='center', fontweight='bold')

plt.savefig('grafico_composicao_custo.png') # Salva a imagem
plt.close() # Fecha a figura para não interferir na próxima
```

---

### Parte 6.2: Gráfico de Distribuição de Mercado

**Objetivo:** Entender a faixa de preços da concorrência de forma rápida e estatística.

O **Box Plot** (`plt.boxplot`) é a ferramenta ideal. Ele nos mostra a mediana (o centro do mercado), onde 50% dos concorrentes se concentram (a "caixa") e os preços mínimo e máximo.

```python
# Gráfico 2: Distribuição dos Preços de Mercado (Box Plot)
plt.boxplot(precos_mercado)
plt.title('Gráfico 2: Distribuição dos Preços de Mercado')
plt.xlabel('Preço (R$)')

plt.savefig('grafico_distribuicao_mercado.png')
plt.close()
```

---

### Parte 6.3: Gráfico de Posicionamento de Preço

**Objetivo:** Criar um painel de decisão final, comparando nosso custo com todos os pontos importantes do mercado.

Um **gráfico de barras horizontais** (`plt.barh`) é excelente para comparar valores e ver claramente onde nos encaixamos.

```python
# Gráfico 3: Análise Comparativa para Posicionamento
labels_comp = ['Seu Custo Total', 'Mercado (Mín)', 'Mercado (Mediana)', 'Mercado (Média)', 'Mercado (Máx)']
valores_comp = [custo_total_unitario, preco_min_mercado, mediana_mercado, media_mercado, preco_max_mercado]
```
---
```python
# Ordena os valores para melhor visualização
valores_comp_sorted, labels_comp_sorted = zip(*sorted(zip(valores_comp, labels_comp)))
```

### O zip aqui combina as duas listas, valores_comp e labels_comp, elemento a elemento.

O comando zip no Python é usado para agrupar elementos de múltiplos iteráveis (como listas, tuplas, etc.) em tuplas. Ele é muito útil quando você precisa combinar dados de diferentes sequências de forma ordenada, ou realizar a inversão da ordem das tuplas.

```
Exemplo: Se valores_comp = [30, 20, 50] e labels_comp = ['A', 'B', 'C'], o zip cria uma lista de tuplas:
[(30, 'A'), (20, 'B'), (50, 'C')].
```
---
```python

bars = plt.barh(labels_comp_sorted, valores_comp_sorted, color='#2196F3')
plt.title('Gráfico 3: Análise Comparativa para Posicionamento de Preço')
plt.xlabel('Valor (R$)')

# Adiciona o valor exato ao lado de cada barra
for bar in bars:
    width = bar.get_width()
    plt.text(width + 1, bar.get_y() + bar.get_height()/2, f'R$ {width:.2f}', va='center')

plt.savefig('grafico_analise_comparativa.png')
plt.close()
```
---
## Erros Comuns: A Armadilha dos Dados

Analisar dados é como assar um bolo: um ingrediente errado ou um passo fora de ordem pode comprometer o resultado.

* **A Falácia da Média:** A média de preços (R$ 52,86) foi influenciada por um concorrente "premium" de R$ 70,00. Usar apenas a média para definir seu preço poderia posicioná-lo acima do ponto mais comum do mercado (R$ 50,00), que é a **moda** e a **mediana**.
* **O Perigo da Amostra Pequena:** Nossa análise usou 7 concorrentes. No mundo real, uma amostra maior traria mais segurança. Uma análise com poucos dados pode levar a conclusões precipitadas.
* **Ignorar a Composição de Custo:** Sem o Gráfico 1, poderíamos não notar que os custos indiretos são a maior fatia do custo total. Focar em reduzir apenas o custo dos ingredientes seria uma otimização limitada.

---

## Atividade Prática / Estudo de Caso

**Cenário:** Você executou o código. Agora, os resultados estão à sua frente, não como meros números, mas como um mapa para sua decisão.

* **Saída do Terminal:** Seu custo é **R$ 29,00**. O centro do mercado está em **R$ 50,00**.
* **Gráfico 1:** Você percebe que o **Custo Indireto (R$ 17,00)** é o maior desafio. Isso levanta uma questão: "Como posso diluir este custo? Aumentando a produção ou renegociando o aluguel?"
* **Gráfico 2 e 3:** Você vê a "caixa" onde a maioria dos concorrentes está e a distância entre seu custo e o preço mínimo do mercado. Qual faixa de preço parece mais segura e lucrativa?

---

## Aplicação no Mundo Real

Essa análise não serve apenas para bolos. Imagine...

* **Um desenvolvedor freelancer:** calculando o custo de sua hora de trabalho (custos indiretos: internet, luz, software) e analisando o mercado para definir seu preço.
* **Uma pequena fábrica de camisetas:** usando a mesma lógica para precificar um novo design, analisando os preços de outras marcas.
* **Um restaurante:** definindo o preço de um novo prato no cardápio, comparando com itens similares na vizinhança.

A lógica é universal: **entenda seus custos, conheça seu mercado e visualize os dados** para tomar decisões inteligentes.

---

## Reflexão

Após esta análise, pense sobre as seguintes questões:

* Qual preço você definiria para o bolo e por quê?
* Que informação adicional você buscaria para ter mais confiança na sua decisão?
* Como você explicaria a um sócio por que seu preço (ex: R$ 49,90) é mais estratégico do que simplesmente copiar a média do mercado?
* O que aconteceria se, no próximo mês, os custos indiretos aumentassem? Como sua estratégia de preços precisaria se adaptar?

Este exercício transforma dados em narrativa e estratégia.

---

## Conclusão e Aplicação Real

Passamos por um processo completo que transformou uma tarefa de negócios em um projeto de análise de dados.

Com algumas linhas de Python, você não apenas calculou números, mas criou ferramentas visuais que fornecem **clareza e confiança** para a precificação.

O resultado final é uma estratégia muito mais robusta, que equilibra seus custos internos com a realidade do mercado externo, permitindo posicionar seu produto de forma competitiva e, acima de tudo, lucrativa.

---

## Referências

* [1] Downey, A. B. (2011). *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media. 
* [2] Mueller, J. P. (2018). *Beginning Programming with Python for Dummies*. John Wiley & Sons. 
* [3] Documentação Oficial do Matplotlib: Para explorar mais tipos de gráficos e personalizações. https://matplotlib.org/stable/gallery/index.html
* [4] Documentação Oficial do NumPy: Para aprofundar em funções matemáticas e estatísticas. https://numpy.org/doc/stable/reference/index.html