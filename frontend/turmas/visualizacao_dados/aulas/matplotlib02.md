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

# Matplotlib: Aprimorando Seus Gráficos

Personalizando e salvando suas visualizações para um maior impacto.

---

## Objetivos da Aula

Ao final desta apresentação, você será capaz de:

* **Adicionar legendas** para identificar múltiplos dados em um mesmo gráfico.
* **Anotar pontos específicos** para destacar informações importantes.
* **Ajustar os eixos** para focar a análise em uma área de interesse.
* **Salvar seus gráficos** como arquivos de imagem para usar em relatórios e apresentações.

---

## O Mapa do Tesouro: Adicionando Legendas

Imagine um mapa com várias rotas desenhadas, mas sem nenhuma etiqueta. Como saber qual caminho leva ao tesouro?

A função `plt.legend()` cria uma **legenda**, que funciona como a chave do mapa: ela identifica o que cada linha, cor ou símbolo no seu gráfico representa.

* **Quando usar?** Sempre que você tiver mais de um conjunto de dados no mesmo gráfico, como comparar as vendas de dois produtos diferentes ao longo do ano.

---

### Exemplo: `plt.legend()`

Vamos comparar a temperatura de duas cidades ao longo dos mesmos 5 dias.

```python
import matplotlib.pyplot as plt

dias = [1, 2, 3, 4, 5]
temp_cidade_a = [22, 24, 23, 25, 26]
temp_cidade_b = [19, 20, 22, 21, 23]

# O argumento 'label' nomeia cada linha
plt.plot(dias, temp_cidade_a, label='Cidade A')
plt.plot(dias, temp_cidade_b, label='Cidade B')

plt.title('Temperatura Comparativa')
plt.xlabel('Dia')
plt.ylabel('Temperatura (°C)')

# plt.legend() usa os 'labels' para criar a legenda
plt.legend()
plt.show()
```

Agora, fica claro qual linha corresponde a cada cidade.

---

## Marcando o "X": Anotando com `plt.text()`

Às vezes, um ponto específico no gráfico é a parte mais importante da história. Pode ser um recorde de vendas, uma queda inesperada ou um resultado surpreendente.

A função `plt.text()` permite que você **escreva um texto diretamente no gráfico**, em coordenadas específicas, para chamar a atenção para esses pontos cruciais.

É como colocar um adesivo "Você está aqui!" em um mapa.

---

### Exemplo: `plt.text()`

Vamos destacar a nota mais alta em nosso gráfico de dispersão anterior.

```python
import matplotlib.pyplot as plt

horas_estudo = [1, 2, 3, 4, 5]
notas = [6, 7, 7.5, 8.5, 9]

plt.scatter(horas_estudo, notas)
plt.title('Relação entre Horas de Estudo e Nota')
plt.xlabel('Horas de Estudo')
plt.ylabel('Nota no Exame')

# Adiciona um texto na coordenada (x=5, y=9)
plt.text(5, 9, '  Máximo!') # Adicionamos espaços para afastar o texto do ponto

plt.show()
```

A anotação direciona o olhar do leitor para a informação mais relevante.

---

## Ajustando o Foco: Controlando os Eixos com `plt.ylim()`

Imagine que você está tirando uma foto. Às vezes, você quer dar zoom para focar em um detalhe específico e cortar o que não é importante ao redor.

A função `plt.ylim()` (e `plt.xlim()`) faz exatamente isso: ela **define o intervalo visível** do eixo Y (ou X).

* **Quando usar?** Para remover espaços em branco, focar em uma faixa de valores específica ou para manter a mesma escala ao comparar vários gráficos lado a lado.

---

### Exemplo: `plt.ylim()`

Vamos focar no desempenho dos alunos que tiraram notas acima de 7.

```python
import matplotlib.pyplot as plt

horas_estudo = [1, 2, 3, 4, 5]
notas = [6, 7, 7.5, 8.5, 9]

plt.scatter(horas_estudo, notas)
plt.title('Foco em Notas Altas')
plt.xlabel('Horas de Estudo')
plt.ylabel('Nota no Exame')

# Define o limite inferior do eixo Y como 7 e o superior como 10
plt.ylim(7, 10)

plt.show()
```

O gráfico agora dá ênfase apenas ao intervalo de notas que nos interessa.

---

## Guardando a Fotografia: Salvando seu Gráfico

Depois de todo o trabalho para criar uma visualização clara e informativa, você vai querer compartilhá-la.

A função `plt.savefig()` permite **salvar seu gráfico como um arquivo de imagem** (PNG, JPG, PDF, etc.). É o equivalente a "imprimir" sua análise para usar em documentos, slides ou na web.

**Dica importante:** Use `plt.savefig()` *antes* de `plt.show()`. Chamar `plt.show()` limpa a figura da memória.

---

### Exemplo: `plt.savefig()`

Vamos salvar nosso gráfico de barras de frutas vendidas.

```python
import matplotlib.pyplot as plt

frutas = ['Maçã', 'Banana', 'Laranja']
quantidade = [15, 25, 10]

plt.bar(frutas, quantidade)
plt.title('Quantidade de Frutas Vendidas')
plt.xlabel('Fruta')
plt.ylabel('Quantidade')

# Salva o gráfico em um arquivo chamado 'vendas_frutas.png'
# O ideal é fazer isso antes de exibir o gráfico
plt.savefig('vendas_frutas.png')

plt.show()
```

Após rodar o código, você encontrará um arquivo de imagem pronto para ser usado.

---

## Atividade Prática: Juntando as Peças

Imagine que você está analisando os lucros de dois produtos, "A" e "B", durante 6 meses.

**Seu desafio:**
1.  Crie um gráfico de linha comparando os lucros.
2.  Adicione uma legenda para identificar cada produto.
3.  Destaque com um texto o mês em que o Produto A teve seu maior lucro.
4.  Ajuste o eixo Y para começar em 0.
5.  Salve o gráfico final como `relatorio_lucro.png`.

Pense em como cada função ajuda a contar uma história mais completa sobre o desempenho dos produtos.

---

## Conclusão: De Dados Brutos a Histórias Visuais

Hoje, adicionamos quatro ferramentas poderosas ao nosso kit Matplotlib:

* **`plt.legend()`:** Para dar nome aos seus dados e evitar confusão.
* **`plt.text()`:** Para apontar e explicar os pontos mais importantes.
* **`plt.ylim()`:** Para controlar a perspectiva e focar sua análise.
* **`plt.savefig()`:** Para registrar e compartilhar suas descobertas.

Com essas habilidades, seus gráficos deixam de ser apenas desenhos e se tornam argumentos visuais claros, profissionais e prontos para o mundo real.

---

## Material Complementar

* **Documentação Oficial do Matplotlib:** Explore a galeria para ver exemplos incríveis de personalização de gráficos.
    * https://matplotlib.org/stable/gallery/index.html
* **W3Schools - Matplotlib Tutorial:** Um guia com exemplos interativos, perfeito para praticar o que aprendeu.
    * https://www.w3schools.com/python/matplotlib_intro.asp

---

## Referências

[1] Mueller, J. P. *Beginning programming with Python for dummies*. John Wiley and Sons, 2018.

[2] Downey, A. B. *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media, 2011.

[3] VanderPlas, J. *Python data science handbook: essential tools for working with data*. O'Reilly Media, 2016.