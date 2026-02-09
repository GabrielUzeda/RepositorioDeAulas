---
marp: true
theme: default
paginate: true
--- 

# Matplotlib: Ferramentas Essenciais para Gráficos

Uma introdução às principais funções de visualização de dados.

---

## Objetivos de Aprendizagem

Ao final desta apresentação, você será capaz de:

* **Identificar** os tipos de gráficos mais comuns no Matplotlib.
* **Compreender** a finalidade de cada tipo de gráfico.
* **Reconhecer** a sintaxe básica para criar gráficos de linha, dispersão, histograma e pizza.
* **Aplicar** o gráfico correto para diferentes cenários de análise de dados.

---

## Sua Caixa de Lápis de Cor Digital

Pense no **Matplotlib** como sua caixa de lápis de cor para dados.

Assim como um artista escolhe a cor e o pincel certos para expressar uma ideia, um analista de dados escolhe o gráfico certo para revelar a história escondida nos números.

Cada função que veremos é uma ferramenta diferente, pronta para dar vida e clareza à sua análise.

---

## Gráfico de Linha: A Jornada dos Dados no Tempo

O comando `plt.plot()` é ideal para mostrar a **evolução** de uma variável ao longo do tempo. É como traçar o percurso de um viajante em um mapa, conectando os pontos para revelar a trajetória.

* **Uso principal:** Séries temporais, como a variação do preço de uma ação ou a temperatura ao longo de um mês.

```python
import matplotlib.pyplot as plt

dias = [1, 2, 3, 4, 5]
temperaturas = [22, 24, 23, 25, 26]

plt.plot(dias, temperaturas)
plt.title("Variação da Temperatura")
plt.xlabel("Dia")
plt.ylabel("Temperatura (°C)")
# Para salvar: plt.savefig('grafico_linha.png')
```

---

## Gráfico de Dispersão: Encontrando Relações

A função `plt.scatter()` nos ajuda a investigar se existe uma **correlação** entre duas variáveis. Cada ponto no gráfico representa um par de dados (x, y), como se estivéssemos marcando a altura e o peso de cada pessoa em uma multidão.

* **Uso principal:** Identificar se variáveis aumentam ou diminuem juntas (correlação positiva ou negativa).

```python
import matplotlib.pyplot as plt

altura = [150, 160, 170, 180, 190]
peso = [55, 65, 70, 80, 95]

plt.scatter(altura, peso)
plt.title("Relação entre Altura e Peso")
plt.xlabel("Altura (cm)")
plt.ylabel("Peso (kg)")
# Para salvar: plt.savefig('grafico_dispersao.png')
```

---

## Histograma: A Frequência dos Acontecimentos

Com `plt.hist()`, podemos visualizar a **distribuição** de uma única variável. Ele agrupa os dados em "caixas" (bins) e nos mostra quantas vezes os valores aparecem em cada faixa. É como organizar as notas de uma turma para ver quais foram mais comuns.

* **Uso principal:** Entender a frequência e a distribuição de um conjunto de dados, como preços de produtos ou notas de alunos.

```python
import matplotlib.pyplot as plt

notas_alunos = [4, 5, 5, 6, 7, 7, 7, 8, 8, 9, 10]

plt.hist(notas_alunos, bins=5)
plt.title("Distribuição das Notas da Turma")
plt.xlabel("Notas")
plt.ylabel("Frequência (Nº de Alunos)")
# Para salvar: plt.savefig('histograma.png')
```

---

## Gráfico de Pizza: A Divisão do Todo

A função `plt.pie()` mostra a **proporção** de diferentes categorias em um conjunto de dados. Cada "fatia" representa a porcentagem de uma categoria em relação ao total, como dividir uma pizza entre amigos.

* **Uso principal:** Exibir a composição de um todo, como a participação de mercado de diferentes empresas.

```python
import matplotlib.pyplot as plt

marcas = ['Empresa A', 'Empresa B', 'Empresa C']
vendas = [45, 30, 25]

plt.pie(vendas, labels=marcas, autopct='%1.1f%%')
plt.title("Participação de Mercado")
# Para salvar: plt.savefig('grafico_pizza.png')
```

---

## Erro Comum: A Pizza Indigesta

Um erro frequente é usar gráficos de pizza para muitas categorias. O resultado é um gráfico poluído e difícil de ler, onde as fatias ficam pequenas demais para serem comparadas.

Imagine tentar dividir uma única pizza para 20 pessoas. As fatias seriam tão finas que ninguém conseguiria pegá-las ou saber qual é maior.

**Prevenção:** Se você tem mais de 5 ou 6 categorias, prefira um **gráfico de barras**. Ele é muito mais claro para comparar valores.

---

## Atividade Prática: Visualizando Dados de Vendas

**Contexto:** Você recebeu dados de vendas mensais de três produtos diferentes ao longo de um semestre.

**Desafio:**
1.  Qual gráfico você usaria para mostrar a **evolução das vendas** de cada produto ao longo do tempo?
2.  E para comparar o **total de vendas** de cada produto no semestre?
3.  Como você visualizaria a **proporção de vendas** de cada produto em relação ao total do semestre?

Pense em qual ferramenta da sua "caixa de lápis de cor" seria a melhor para cada tarefa.

---

## Reflexão Final

Agora que conhece essas ferramentas, pense em como elas podem ser aplicadas em seus próprios projetos ou áreas de interesse.

* **O que aconteceu?** Revimos quatro tipos de gráficos e seus usos.
* **O que eu senti/pensei?** Algum gráfico pareceu mais intuitivo ou útil para você? Por quê?
* **O que aprendi?** Qual a principal diferença entre um histograma e um gráfico de barras? Quando usar um gráfico de pizza é uma má ideia?
* **O que farei a seguir?** Como posso usar esses gráficos para explorar um conjunto de dados que me interessa?

---

## Conclusão

Nesta apresentação, exploramos quatro funções fundamentais do Matplotlib:

* `plt.plot()` para visualizar **tendências** no tempo.
* `plt.scatter()` para investigar **relações** entre variáveis.
* `plt.hist()` para entender a **distribuição** de dados.
* `plt.pie()` para mostrar a **composição** de um todo.

Lembre-se: a escolha do gráfico correto não é apenas uma decisão técnica, mas uma forma de contar a história dos seus dados com clareza e impacto.

---

## Material Complementar

* **Documentação Oficial do Matplotlib:** Para aprofundar, explore a galeria de exemplos e tutoriais.
    `https://matplotlib.org/stable/gallery/index.html`
* **De dados para gráficos (data-to-viz):** Um ótimo recurso com exemplos para ajudar a escolher o gráfico certo para seus dados.
    `https://www.data-to-viz.com`

---

## Referências

[1] Mueller, J. P. *Beginning programming with Python for dummies*. John Wiley and Sons, 2018.

[2] Downey, A. B. *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media, 2011.