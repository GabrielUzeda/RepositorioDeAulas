---
marp: true
paginate: true
---

# Estruturas de Controle
### Ensinando o Programa a Tomar Decisões e Repetir Tarefas

---

## Antes de Começar... O Fluxo Padrão

Vamos relembrar: por padrão, um computador executa comandos em **sequência**, como ler um livro.

1.  Primeiro, ele executa a linha 1.
2.  Depois, a linha 2.
3.  E assim por diante...

Hoje, vamos aprender a **quebrar essa sequência** e dar inteligência ao nosso código.

---

## Objetivos da Aula

* Entender o que são **estruturas de controle** e por que são essenciais.
* Diferenciar entre estruturas **condicionais** (`if`, `else`, `elif`).
* Diferenciar entre estruturas de **repetição** (`for`, `while`).
* Identificar e evitar os erros mais comuns.

---
### 🔹 Etapa 1: Ensinando o Programa a Decidir

## Cozinhando com um Programa 🍳

Imagine um programa como uma receita. Sem estruturas de controle, ele seguiria as instruções de cima para baixo, sem desvios.

Mas e se a receita disser:
* "**Se** a massa estiver seca, **adicione** mais água." (Decisão)
* "**Repita** o processo de sovar por 10 minutos." (Repetição)

Estruturas de controle são as ferramentas que dão essa **inteligência** ao nosso código.

---

## Estruturas Condicionais: A Encruzilhada 🚦

Permitem que o programa escolha um caminho com base em uma **condição**.

Uma **condição** é simplesmente uma pergunta que pode ser respondida com **Verdadeiro** ou **Falso**.

* `if`: "Se esta condição for verdadeira, faça isso."
* `elif` (else if): "Senão, se esta outra for verdadeira, faça aquilo."
* `else`: "Se nenhuma das anteriores for verdadeira, faça esta outra coisa."

---

## Condicionais na Prática

Vamos usar Python para verificar se uma pessoa pode votar.

**Código:**
```python
idade = 20

if idade >= 18:
    print("Você pode votar!")
elif idade >= 16:
    print("Seu voto é opcional.")
else:
    print("Você ainda não pode votar.")
```

---

**Saída esperada:**

```
Você pode votar!
```

*💡 E se `idade = 16`? O que o programa mostraria?*

---

## Agora que o programa já sabe decidir, vamos ensiná-lo a repetir tarefas\!

---

### 🔸 Etapa 2: O Poder da Repetição

## Estruturas de Repetição (Loops)

Usadas para executar o mesmo bloco de código múltiplas vezes.

  * **`for`**: O trabalhador da linha de montagem 🏭. Repete a ação para **cada item** de uma sequência. Ideal para quando você **sabe** o número de repetições.
  * **`while`**: O corredor na esteira 🏃. Repete a ação **enquanto** uma condição for verdadeira. Ideal para quando você **não sabe** quantas vezes precisará repetir.

---

## Loop `for` na Prática

Vamos imprimir cada item de uma lista de compras.

**Código:**

```python
lista_de_compras = ["Maçã", "Banana", "Leite"]

for item in lista_de_compras:
    print(f"Comprar: {item}")
```

**Saída esperada:**

```
Comprar: Maçã
Comprar: Banana
Comprar: Leite
```

---

## Loop `while` na Prática

Uma contagem regressiva para o lançamento.

**Código:**

```python
contador = 5

while contador > 0:
    print(f"{contador}...")
    contador = contador - 1 # Essencial para evitar um loop infinito!

print("Lançar!")
```

---

**Saída esperada:**

```
5...
4...
3...
2...
1...
Lançar!
```

*💡 Você já usou algo parecido na vida real? (ex: repetir uma tarefa até dar certo?)*

---

## Síntese: Condicionais vs. Loops

| Tipo | Palavra-chave | Uso Ideal | Analogia |
| :--- | :--- | :--- | :--- |
| **Condicional** | `if` / `else` | Tomar uma decisão única | 🚦 Sinal de trânsito |
| **Loop `for`** | `for` | Repetição com limite conhecido | 🏭 Linha de montagem |
| **Loop `while`** | `while` | Repetição com limite indefinido| 🏃 Esteira |

---

## 💣 Erros Comuns: As Armadilhas

  * ⚠️ **Loop Infinito:** Um loop `while` cuja condição **nunca** se torna falsa. Sempre garanta que a condição possa ser alterada dentro do loop.
  * ❗ **Indentação Incorreta (Python):** Python usa espaços para definir o que está "dentro" de uma estrutura. Errar a indentação muda toda a lógica.
  * 🤯 **Condição `if` mal formulada:** Usar `=` (atribuição) em vez de `==` (comparação) é um erro clássico que leva a resultados inesperados.

---

### 🔻 Etapa 3: Aplicação e Síntese

## Fluxo de Decisão e Repetição (Visual)

<div class="mermaid">
graph LR
    A[Início] --> B{Condição?};
    B -- Sim --> C[Bloco 'if'];
    B -- Não --> D[Bloco 'else'];
    C --> E[Continua...];
    D --> E;
</div>

---
## Fluxo de Decisão e Repetição (Visual)

<div class="mermaid">

graph LR
    subgraph "Loop"
      F[Entra no Loop] --> G{Condição do Loop?};
      G -- Sim --> H[Executa Bloco];
      H --> G;
    end
    
    G -- Não --> I[Sai do Loop];

</div>


---

## Atividade: Qual Estrutura Usar?

Para cada cenário, qual estrutura seria mais adequada? (`if/elif/else`, `for`, `while`)

1.  Verificar todos os e-mails em uma caixa de entrada e marcar os que são "spam".
2.  Exibir uma mensagem de "Login Inválido" se a senha digitada não corresponder à senha salva.
3.  Manter um jogo rodando até que o jogador decida apertar a tecla "ESC" para sair.

---

## Discussão das Respostas

1.  **Verificar e-mails: `for`**. Você tem uma coleção finita de itens (os e-mails) e precisa executar uma ação (`if`) para cada um deles.
2.  **Login Inválido: `if/else`**. É uma decisão única: a senha digitada é igual à salva? Sim ou não.
3.  **Manter o jogo rodando: `while`**. O número de repetições é desconhecido. O loop deve continuar "enquanto o jogador não apertar ESC".

---

## Mini-Desafio: Juntando Tudo

Que tal um desafio prático?

**Objetivo:** Crie um programa que conte de 1 a 10. Para cada número, ele deve dizer se o número é **'par'** ou **'ímpar'**.

**Dica:** Você precisará de um loop `for` e uma estrutura `if/else` dentro dele. O operador `%` (módulo) pode ajudar a verificar se um número é par.

---

## Resumo Final

Parabéns\! Nesta aula, você aprendeu a:

  - ✅ Controlar o fluxo de execução de um programa.
  - ✅ Usar estruturas condicionais (`if`, `else`, `elif`) para tomar decisões.
  - ✅ Usar estruturas de repetição (`for`, `while`) para automatizar tarefas.
  - ✅ Reconhecer e evitar os erros mais comuns.

---

## Conclusão

Estruturas de controle são os componentes que dão vida e inteligência aos programas.

  * **Condicionais** permitem que o software **reaja** a diferentes situações.
  * **Loops** permitem que ele execute tarefas repetitivas de forma **eficiente**.

Dominar essas estruturas é o passo fundamental para ir de um script sequencial para um programa verdadeiramente dinâmico e útil.

---

## Referências

[1] Mueller, J. P. *Beginning programming with Python*. John Wiley and Sons, 2018.

[2] Documentação Oficial do Python sobre Estruturas de Controle: `https://docs.python.org/3/tutorial/controlflow.html`

[3] Downey, A. B. *Think Python: How to Think Like a Computer Scientist*. 2ª ed. O'Reilly Media, 2015.

```