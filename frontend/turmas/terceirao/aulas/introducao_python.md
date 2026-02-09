---
marp: true
theme: default
paginate: true
---

# Programação em Python: Uma Conversa com os Dados

---

## Objetivos da Nossa Conversa

- Entender o que são variáveis e por que são essenciais na programação.
- Conhecer os tipos de "caixas" para guardar informações: números e textos.
- Aprender a realizar operações matemáticas básicas com o Python.
- Prevenir erros comuns ao misturar diferentes tipos de dados.

---

## Introdução: As Caixas de Memória

Imagine que você está organizando uma mudança. Você tem vários itens — livros, pratos, roupas — e precisa guardá-los em caixas para transportá-los. Para não se perder, você etiqueta cada caixa: "Livros de Ficção", "Pratos da Cozinha", "Casacos de Inverno".

Na programação, as **variáveis** são exatamente como essas caixas etiquetadas. Elas são espaços na memória do computador onde guardamos informações, e cada uma tem um nome (uma etiqueta) para que possamos encontrá-la depois.

---

## Conceitos Fundamentais: Tipos de Caixas (Variáveis)

No Python, cada "caixa" (variável) é feita para um tipo específico de item (dado). As mais comuns para iniciantes são:

* **Inteiros (`int`):** Caixas para números inteiros, sem casas decimais.
    * `idade = 30`
    * `andares_predio = 12`

* **Ponto Flutuante (`float`):** Caixas para números com casas decimais.
    * `altura = 1.75`
    * `preco_produto = 29.99`

* **Strings (`str`):** Caixas para guardar texto. O texto deve estar entre aspas.
    * `nome = "Maria"`
    * `mensagem = "Olá, mundo!"`

---

## Conceitos Fundamentais: Fazendo Contas

Assim como usamos uma calculadora, o Python pode realizar operações matemáticas. Guardamos os resultados em novas variáveis (ou atualizamos as existentes).

* **Soma (+):** `salario = 2500 + 500`
* **Subtração (-):** `divida = 1000 - 300`
* **Multiplicação (*):** `custo_total = 4 * 25.50`
* **Divisão (/):** `media = 100 / 3`

```python
# Exemplo prático
estoque_inicial = 50
vendas_dia = 12
estoque_final = estoque_inicial - vendas_dia
print(estoque_final)  # O resultado será 38
```

---

## Erros Comuns: A Confusão das Caixas

Imagine que você tenta somar o conteúdo de uma caixa de "Livros" com uma caixa de "Pratos". O que isso significaria? Não faz sentido. O computador pensa da mesma forma.

* **Erro Comum (`TypeError`):** Tentar somar um número com um texto.
    * `pontos = 100`
    * `mensagem = "Sua pontuação é: "`
    * `resultado = mensagem + pontos`  # Isso vai gerar um ERRO!

O Python nos avisa: "Não posso somar texto com número". É como tentar misturar óleo e água. A prevenção é garantir que os tipos de dados sejam compatíveis para a operação que você deseja fazer.


---

## Apresentando Melhor os Resultados: f-strings

Até agora usamos `print()` de forma simples. Mas e quando queremos misturar texto e variáveis de maneira mais clara?

No Python, usamos **f-strings** (strings formatadas):

```python
nome = "Maria"
idade = 30
print(f"Meu nome é {nome} e tenho {idade} anos.")
```

- O `f` antes das aspas indica uma **f-string**.
- As variáveis dentro de `{}` são substituídas pelos seus valores.
- É a forma mais prática de criar mensagens personalizadas.

---

## Convertendo Tipos: str(variavel)

Lembra do erro ao somar texto e número? Uma forma de resolver é **converter o número para texto** com `str()`.

```python
pontos = 100
mensagem = "Sua pontuação é: " + str(pontos)
print(mensagem)
```

- `str()` transforma o número em texto.  
- Assim, podemos juntá-lo a outras strings sem erro.

---

## Interatividade: input()

Podemos deixar nossos programas mais interativos usando `input()`.  
Ele **espera que o usuário digite algo** e guarda o valor em uma variável.

```python
nome = input("Qual é o seu nome? ")
print(f"Olá, {nome}! Bem-vindo ao Python.")
```

⚠️ Importante: o `input()` sempre retorna texto (`str`).  
Se precisar de um número, é necessário converter:

```python
idade = int(input("Qual é a sua idade? "))
print(f"No próximo ano você terá {idade + 1} anos.")
```


---


## Atividade Prática: Calculadora de Compras

Vamos simular uma pequena compra para praticar os conceitos.

**Cenário:** Você foi ao mercado e comprou 2 maçãs e 1 abacaxi.

1.  Crie uma variável `preco_maca` e guarde o valor `2.50`.
2.  Crie uma variável `preco_abacaxi` e guarde o valor `5.00`.
3.  Crie uma variável `custo_total` que calcule o preço de 2 maçãs mais 1 abacaxi.
4.  No final, mostre o resultado.

```python
# Seu código aqui
preco_maca = 2.50
preco_abacaxi = 5.00
custo_total = (2 * preco_maca) + preco_abacaxi
print(custo_total)
```

---

## Aplicação no Mundo Real: Onde Usamos Isso?

Esses conceitos simples são a base de quase tudo no mundo digital:

* **Carrinho de Compras Online:** Um site usa variáveis para guardar o preço de cada item e operadores matemáticos para somar o valor total da sua compra.
* **Games:** A pontuação de um jogador é uma variável (`int`) que aumenta (+) a cada ação correta.
* **Redes Sociais:** Seu nome de usuário é guardado em uma variável do tipo `str`.

---

## Reflexão: Organizando o Conhecimento

Pense por um momento sobre o que fizemos:
1.  **O Que Aconteceu?** Aprendemos sobre variáveis, tipos de dados e operações. Vimos um erro comum.
2.  **O Que Senti?** A lógica pareceu clara? O erro fez sentido quando explicado com a analogia das caixas?
3.  **Qual o Aprendizado?** A importância de manter os tipos de dados organizados e de usar as operações corretas para cada tipo.
4.  **Próximo Passo:** Como posso usar isso para resolver um pequeno problema do meu dia a dia, como calcular uma média de notas ou um orçamento simples?

---

## Conclusão e Aplicação Real

Hoje, demos o primeiro passo na jornada da programação. Entendemos que programar é, em grande parte, organizar informações em locais etiquetados (variáveis) e operar sobre elas de maneira lógica.

A "confusão das caixas" (`TypeError`) não é um defeito do programador, mas um lembrete do computador de que a lógica precisa ser clara e consistente. Ao dominar esses fundamentos, você constrói a base para criar soluções mais complexas e poderosas.

---

## Material Complementar

- **Leitura:** Capítulos iniciais de "Beginning Programming with Python for Dummies" para reforçar os conceitos de tipos de dados.
- **Prática:** Plataforma Scratch para treinar lógica de programação com blocos visuais, sem se preocupar com a sintaxe do código.
- **Vídeo:** Tutoriais para iniciantes em canais de programação que mostram a declaração de variáveis e operações passo a passo.

