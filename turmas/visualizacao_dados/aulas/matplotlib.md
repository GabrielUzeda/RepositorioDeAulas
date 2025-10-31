---
marp: true
theme: default
paginate: true
style: |
    @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap');
    section{font-family:'Roboto',sans-serif;background-color:#f4f6fb;color:#2b2b2b;font-size:28px;line-height:1.5}
    h1,h2,h3{font-family:'Roboto Slab',serif;color:#1a3a6e}
    h2{border-bottom:2px solid #1a3a6e;padding-bottom:5px}
    strong{color:#d62828;font-weight:700}
---

# Matplotlib: Seus Primeiros Passos na Visualização de Dados

Uma introdução simples e direta aos gráficos mais importantes.

---

## Objetivos da Aula

Ao final desta apresentação, você será capaz de:

* **Identificar** os quatro tipos de gráficos mais comuns para análise de dados.
* **Compreender** o propósito de cada gráfico com exemplos do dia a dia.
* **Escrever** o código Python básico para criar cada um desses gráficos.
* **Escolher** o visual certo para contar a história dos seus dados.

---

## A Caixa de Ferramentas dos Dados

Imagine que seus dados são peças de madeira e você é um carpinteiro. O **Matplotlib** é sua caixa de ferramentas.

Para cada trabalho, você precisa da ferramenta certa: um serrote não serve para pregar um prego.

Da mesma forma, para cada tipo de pergunta que você faz aos seus dados, existe um tipo de gráfico ideal para revelar a resposta de forma clara. Vamos conhecer as ferramentas essenciais.

---

## 1. Gráfico de Linha: Contando Histórias ao Longo do Tempo

O gráfico de linha (`plt.plot`) é perfeito para mostrar como algo **muda com o tempo**.

Pense nele como o trajeto de um carro em um mapa, conectando pontos para mostrar a jornada.

* **Quando usar?** Para ver a evolução das vendas mensais, a variação da temperatura durante a semana ou o crescimento de seguidores em uma rede social.

---

### Exemplo: Gráfico de Linha

Vamos visualizar a temperatura em uma cidade ao longo de 5 dias.

```python
import matplotlib.pyplot as plt

dias = [1, 2, 3, 4, 5]
temperaturas = [22, 24, 23, 25, 26]

# Adicionando título e rótulos
plt.title('Temperatura ao Longo dos Dias')
plt.xlabel('Dia')
plt.ylabel('Temperatura (°C)')

plt.plot(dias, temperaturas)
plt.show()
```

O código une os pontos, mostrando claramente a tendência de aquecimento ao longo dos dias.

---

## 2. Gráfico de Barras: Comparando Categorias

O gráfico de barras (`plt.bar`) é a melhor ferramenta para **comparar quantidades** entre diferentes grupos ou categorias.

É como organizar prateleiras em um supermercado: você vê rapidamente qual produto tem mais estoque.

* **Quando usar?** Para comparar o número de alunos por turma, as vendas por produto ou a fruta favorita em uma pesquisa.

---

### Exemplo: Gráfico de Barras

Vamos comparar a quantidade de frutas vendidas em um dia.

```python
import matplotlib.pyplot as plt

frutas = ['Maçã', 'Banana', 'Laranja']
quantidade = [15, 25, 10]

# Adicionando título e rótulos
plt.title('Quantidade de Frutas Vendidas')
plt.xlabel('Fruta')
plt.ylabel('Quantidade')


plt.bar(frutas, quantidade)
plt.show()
```

As barras mostram de forma imediata que a banana foi a fruta mais vendida.

---

## 3. Gráfico de Dispersão: Encontrando Relações

O gráfico de dispersão (`plt.scatter`) nos ajuda a ver se existe uma **relação entre duas variáveis** numéricas.

Imagine jogar grãos de areia num tabuleiro: o padrão que eles formam pode revelar algo. Se os pontos se alinham, há uma conexão.

* **Quando usar?** Para ver se a altura de uma pessoa está relacionada ao seu peso ou se o tempo de estudo influencia a nota na prova.

---

### Exemplo: Gráfico de Dispersão

Vamos analisar a relação entre horas de estudo e nota em um exame.

```python
import matplotlib.pyplot as plt

horas_estudo = [1, 2, 3, 4, 5]
notas = [6, 7, 7.5, 8.5, 9]

# Adicionando título e rótulos
plt.title('Relação entre Horas de Estudo e Nota')
plt.xlabel('Horas de Estudo')
plt.ylabel('Nota no Exame')

plt.scatter(horas_estudo, notas)
plt.show()
```

Os pontos sobem juntos, sugerindo que quanto mais se estuda, maior tende a ser a nota.

---

## 4. Histograma: Entendendo a Distribuição

O histograma (`plt.hist`) mostra a **frequência** com que os valores aparecem em um conjunto de dados. Ele agrupa os dados em "caixas" (bins) e conta quantos valores caem em cada uma.

É como organizar as alturas dos jogadores de um time de basquete: você vê quantos são "baixos", "médios" ou "altos".

* **Quando usar?** Para entender a distribuição de idades de clientes ou as notas de uma turma inteira.

---

### Exemplo: Histograma

Vamos visualizar a distribuição das idades de um grupo de pessoas.

```python
import matplotlib.pyplot as plt

idades = [18, 22, 25, 25, 31, 34, 38, 45, 50, 51]

# Adicionando título e rótulos
plt.title('Distribuição de Idades')
plt.xlabel('Idade')
plt.ylabel('Frequência')

plt.hist(idades)
plt.show()
```

O gráfico mostra que a maioria das pessoas no grupo tem entre 20 e 40 anos.

---

## 5. Gráfico de Pizza: Mostrando Proporções

O gráfico de pizza (`plt.pie`) é usado para mostrar **como um todo se divide em partes**.

Pense em uma pizza de verdade: cada fatia representa uma categoria e o tamanho da fatia mostra sua proporção dentro do total.

* **Quando usar?** Para visualizar a distribuição percentual de categorias — por exemplo, a participação de mercado de empresas, a origem do tráfego em um site ou os gastos mensais por categoria.

---

### Exemplo: Gráfico de Pizza

Vamos visualizar a distribuição dos gastos mensais de uma pessoa.

```python
import matplotlib.pyplot as plt

categorias = ['Aluguel', 'Comida', 'Transporte', 'Lazer', 'Outros']
gastos = [1200, 600, 300, 200, 100]

plt.title('Distribuição dos Gastos Mensais')

# Criação do gráfico de pizza
plt.pie(gastos, labels=categorias, autopct='%1.1f%%', startangle=90)

plt.show()
```

---

## A Ferramenta Errada para o Trabalho Certo

Um erro comum é usar um gráfico de linha para comparar categorias que não têm uma ordem natural.

Imagine que um analista usou `plt.plot()` com os dados das frutas:

```python
# O que NÃO fazer
plt.plot(['Maçã', 'Banana', 'Laranja'], [15, 25, 10])
plt.show()
```

A linha conecta "Maçã" a "Banana", como se houvesse uma "jornada" entre elas. Isso não faz sentido e confunde a análise. Para comparar categorias, o gráfico de barras é sempre a escolha correta.

---

## Atividade Prática: Qual Gráfico Usar?

Pense em um pequeno negócio que vende cafés. Para cada pergunta abaixo, qual gráfico você escolheria?

1.  Como as vendas de café variaram nos últimos 12 meses?
    * *Resposta: Gráfico de Linha.*

2.  Qual é o sabor de café mais vendido (Expresso, Cappuccino, Latte)?
    * *Resposta: Gráfico de Barras.*

3.  Os clientes que gastam mais tempo na loja também gastam mais dinheiro?
    * *Resposta: Gráfico de Dispersão.*

4.  Qual é a faixa de preço mais comum dos produtos que vendemos?
    * *Resposta: Histograma.*

---

## Aplicação no Mundo Real

Visualizar dados não é apenas para cientistas. É uma habilidade para todos.

* **Finanças Pessoais:** Use um gráfico de barras para ver para onde seu dinheiro está indo a cada mês (moradia, comida, lazer).
* **Saúde e Fitness:** Acompanhe seu peso ou tempo de corrida ao longo do tempo com um gráfico de linha.
* **Negócios:** Um histograma pode mostrar os horários de pico de clientes em uma loja, ajudando a organizar a equipe.

---

## Reflexão: Conte a Sua História

Agora, pense nos seus próprios interesses. Pode ser um jogo, um hobby, ou até mesmo suas notas na escola.

* **O que aconteceu?** Revimos os quatro gráficos essenciais e vimos exemplos simples.
* **O que eu senti?** Algum gráfico pareceu mais útil ou interessante para você? Por quê?
* **O que aprendi?** Qual a principal diferença entre um gráfico de barras e um histograma?
* **O que farei a seguir?** Que dados do seu dia a dia você poderia visualizar com uma dessas ferramentas para descobrir algo novo?

---

## Conclusão

Hoje, abrimos a caixa de ferramentas do Matplotlib e aprendemos a usar quatro ferramentas fundamentais:

* **Linha (`plot`):** Para ver **evolução**.
* **Barras (`bar`):** Para **comparar** categorias.
* **Dispersão (`scatter`):** Para encontrar **relações**.
* **Histograma (`hist`):** Para entender a **distribuição**.
* **Pizza (`hist`):** Para entender a **porcentagem**.

Dominar o básico é o passo mais importante. Com essas ferramentas, você já pode transformar números em histórias claras e impactantes.

---

## Material Complementar

* **Documentação Oficial do Matplotlib:** A galeria de exemplos é um ótimo lugar para se inspirar e aprender mais.
    * https://matplotlib.org/stable/gallery/index.html
* **W3Schools - Matplotlib Tutorial:** Um guia com exemplos interativos, perfeito para praticar o que aprendeu.
    * https://www.w3schools.com/python/matplotlib_intro.asp

---

## Referências

[1] Mueller, J. P. *Beginning programming with Python for dummies*. John Wiley and Sons, 2018.

[2] Downey, A. B. *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media, 2011.