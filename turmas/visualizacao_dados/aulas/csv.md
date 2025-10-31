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

# Carregando Dados CSV com Python
### O Método Fácil e Profissional com `pandas`

---

## Objetivos da Aula

* Compreender o que é um arquivo CSV através de uma analogia simples.
* Aprender o método "fácil" e profissional de leitura com a biblioteca `pandas`.
* Identificar e prevenir os erros mais comuns no processo de leitura de arquivos.

---

## O que é um CSV?

Pense em um arquivo CSV (Valores Separados por Vírgula) como uma **planilha digital universal** ou uma lista de compras muito organizada.

* Cada **linha** do arquivo é um item na sua lista (um registro de dados).
* As **vírgulas** separam os detalhes desse item (as colunas).

**Exemplo (arquivo `produtos.csv`):**
```

Nome,Preco,Estoque
Caneta,1.50,100
Caderno,15.00,30
Borracha,0.75,50

```
É um formato simples, legível por humanos e (quase) todos os softwares.

---

## O Método Rápido e Poderoso: `pandas`

Esta é a resposta para "a forma muito fácil".

* **Analogia:** Usar `pandas` é como carregar sua lista de compras diretamente para um **laboratório de análise de dados completo**.
* `pandas` é a biblioteca padrão para Ciência de Dados em Python.
* O comando `read_csv()` carrega *tudo* em um objeto poderoso chamado **DataFrame**.
* Um DataFrame é como uma planilha inteligente (Excel) dentro do seu código.

---

## Exemplo: Lendo com `pandas`

Para usar `pandas`, você talvez precise instalá-lo primeiro no seu terminal:
`pip install pandas`

```python
import pandas as pd

try:
    # A "mágica" acontece aqui.
    data = pd.read_csv('produtos.csv')
    # Pandas automaticamente detecta o cabeçalho.
    print("--- Dados Carregados no DataFrame ---")
    print(df)
    print("\n--- Informações Automáticas (Tipos de Dados) ---")
    df.info()
except FileNotFoundError:
    print("Erro: Arquivo 'produtos.csv' não encontrado no diretório.")
```

---

## Análise Imediata com `pandas`

A maior vantagem do `pandas` não é apenas ler, mas o que você faz *depois* de ler.

O DataFrame `df` já está pronto para análise:

```python
# (Continuação do código anterior...)

# Calcular o preço médio
preco_medio = df['Preco'].mean()
print(f"\nO preço médio dos produtos é: R$ {preco_medio:.2f}")

# Encontrar o produto com maior estoque
mais_estoque = df.sort_values(by='Estoque', ascending=False)
print("\n--- Produto com maior estoque ---")
print(mais_estoque.head(1))
```

---

## Erros Comuns (Educação Preventiva)

Dois erros assombram 90% dos iniciantes ao ler arquivos:

* **1. `FileNotFoundError` (Arquivo Não Encontrado)**
* **Analogia:** Você diz ao Python para buscar um arquivo na "Sala A", mas o arquivo está na "Sala B" (outra pasta).
* **Solução:** Garanta que seu arquivo `.csv` está na **mesma pasta** que seu script `.py`. Se não estiver, use o caminho completo (ex: `C:/Usuarios/SeuNome/Downloads/produtos.csv`).

---

## Reflexão e Próximos Passos

Agora que você viu o método `pandas`, reflita:

* O que aconteceu quando você rodou `df.info()`? O `Preco` foi lido como número (`float64`) ou texto (`object`)?
* Se ele foi lido como texto (comum se houver "R$" no meio), a sua análise (como `.mean()`) falharia.
* **Desafio:** O que você faria se o seu arquivo CSV não usasse vírgula (`,`), mas sim ponto-e-vírgula (`;`)?
* *Dica: Pesquise o parâmetro `sep` da função `pandas.read_csv`.*

---

## Conclusão

* Carregar dados CSV é a porta de entrada para a análise de dados e automação.
* A biblioteca `pandas` oferece o método "fácil", que é também o **método profissional** padrão da indústria.
* Com uma única linha (`pd.read_csv()`), você carrega os dados em uma estrutura poderosa (DataFrame) pronta para análise imediata.

---

## Material Complementar

* **Documentação Oficial do Pandas sobre `read_csv`:**
    Um guia completo de *todos* os parâmetros que você pode usar (como `sep`, `header`, `skiprows`, `decimal`). Essencial para arquivos "difíceis".
    [https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.read_csv.html](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.read_csv.html)

* **Tutorial do Real Python sobre `read_csv`:**
    Um guia muito prático e direto ao ponto sobre como usar a função `read_csv` do pandas.
    [https://realpython.com/pandas-read-csv/](https://realpython.com/pandas-read-csv/)
