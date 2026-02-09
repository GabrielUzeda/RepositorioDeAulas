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
  blockquote {
    background-color: #e9effb;
    border-left: 8px solid #1a3a6e;
    padding: 15px;
    margin: 20px 0;
  }
---

# As Leis da Lógica Proposicional

### Simplificando o Raciocínio e o Código

---

## Objetivos

- Entender o que são as leis da lógica proposicional e quando aplicá-las.
- Aplicar as leis de **De Morgan**, **Comutativa**, **Associativa** e **Distributiva**.
- Utilizar outras leis importantes, como **Dupla Negação** e **Contrapositiva**.
- Usar essas leis para simplificar e clarificar expressões lógicas em Python.

---

## A Gramática do Raciocínio

As leis da lógica são como a **gramática do pensamento**. Elas nos dão regras para construir e simplificar argumentos de forma válida, garantindo que o significado lógico de uma ideia seja preservado.

---

## Revisão: Conectivos e Precedência

- **Proposições:** Afirmações verdadeiras (V) ou falsas (F).
  - $p$: "O sistema está online."
  - $q$: "O usuário tem permissão."

- **Precedência de operadores (Python):** `not` > `and` > `or`.
  - A expressão `not p and q` é avaliada como `(not p) and q`.
  - Use parênteses `()` para garantir a ordem desejada.

---

## Leis de De Morgan

Essas leis são essenciais para simplificar negações. Elas "distribuem" a negação e invertem o conectivo.

> $\neg(p \land q) \equiv \neg p \lor \neg q$
>
> $\neg(p \lor q) \equiv \neg p \land \neg q$

- **Analogia:** "Não é verdade que a chave está na porta **E** a porta está trancada" significa "A chave **NÃO** está na porta **OU** a porta **NÃO** está trancada".

---

## Provando a 1ª Lei de De Morgan

Uma tabela-verdade prova a equivalência. Se as colunas de resultado são idênticas, as fórmulas são equivalentes.

| $p$ | $q$ | $p \land q$ | **$\neg(p \land q)$** | $\neg p$ | $\neg q$ | **$\neg p \lor \neg q$** |
|:---:|:---:|:-----------:|:---------------------:|:--------:|:--------:|:-----------------------:|
|  V  |  V  |      V      |           **F** |    F     |    F     |            **F** |
|  V  |  F  |      F      |           **V** |    F     |    V     |            **V** |
|  F  |  V  |      F      |           **V** |    V     |    F     |            **V** |
|  F  |  F  |      F      |           **V** |    V     |    V     |            **V** |

As colunas em negrito são idênticas, provando a lei.

---

## Leis Comutativa e Associativa

> **Comutativa:** A ordem não importa.
>
> - $p \land q \equiv q \land p$
> - $p \lor q \equiv q \lor p$

> **Associativa:** O agrupamento não importa para o mesmo conectivo.
>
> - $(p \land q) \land r \equiv p \land (q \land r)$
> - $(p \lor q) \lor r \equiv p \lor (q \lor r)$

---

## Leis Distributivas

Mostram como `and` e `or` interagem, similar à matemática.

> $p \land (q \lor r) \equiv (p \land q) \lor (p \land r)$
>
> $p \lor (q \land r) \equiv (p \lor q) \land (p \lor r)$

- **Analogia:** "É preciso ter **(mais de 18 anos) E (CNH ou passaporte)**".
- É o mesmo que: "**(ter mais de 18 anos E CNH) OU (ter mais de 18 anos E passaporte)**".

---

## Outras Leis Úteis

> **Dupla Negação:** $\neg (\neg p) \equiv p$
> - "Não é verdade que o login falhou" significa "O login foi bem-sucedido".

> **Contrapositiva:** $(p \rightarrow q) \equiv (\neg q \rightarrow \neg p)$
> - "**Se** há fumaça, **então** há fogo" equivale a "**Se não** há fogo, **então não** há fumaça".

> **Absorção:** Simplifica expressões redundantes.
> - $p \lor (p \land q) \equiv p$
> - $p \land (p \lor q) \equiv p$

---

## A Implicação ($p \rightarrow q$)

A implicação lógica **não é um operador em Python**, mas uma estrutura de controle (`if`). Sua equivalência lógica é fundamental:

> $p \rightarrow q \equiv \neg p \lor q$

Podemos verificar essa equivalência no código:

```python
p = False
q = True

# Verificando a equivalência (p -> q) ≡ (not p or q)
resultado = (not p) or q

print(f"O resultado da implicação lógica é: {resultado}") # True
```

---

## Aplicação: Simplificando Código

Conhecer as leis ajuda a escrever código mais limpo.

**Cenário:** O acesso deve ser concedido se a conta **NÃO** está (bloqueada **E** o login expirou).

**Código Complexo:**
```python
if not (conta_bloqueada and login_expirado):
    print("Acesso Permitido.")
```

**Simplificado (com Lei de De Morgan):**
```python
if (not conta_bloqueada) or (not login_expirado):
    print("Acesso Permitido.")
```
A segunda versão é mais explícita e fácil de ler.

---

## Exemplo: Simplificação Passo a Passo

Vamos simplificar a expressão `not (A and (not B or C))`

1.  `not (A and (not B or C))`
    - *Expressão inicial.*

2.  `(not A) or not (not B or C)`
    - *Aplicamos a Lei de De Morgan no `and` principal.*

3.  `(not A) or (not (not B) and not C)`
    - *Aplicamos De Morgan novamente no `or` interno.*

4.  `(not A) or (B and not C)`
    - *Aplicamos a Dupla Negação em `not (not B)`.*
    - **Resultado final simplificado!**

---

## Exercício Rápido

Use as leis da lógica para simplificar a seguinte expressão:

`not (A or (not B and C))`

Pense passo a passo:
1. Aplique a Lei de De Morgan na expressão principal.
2. Aplique a Lei de De Morgan novamente na parte interna.
3. Aplique a Dupla Negação.

---

## Solução do Exercício

**Expressão:** `not (A or (not B and C))`

1.  `not A and not (not B and C)`
    - *De Morgan no `or` principal.*

2.  `not A and (not (not B) or not C)`
    - *De Morgan no `and` interno.*

3.  `not A and (B or not C)`
    - *Dupla Negação. Resultado final!*

---

## Conclusão

- As **leis da lógica** são ferramentas para reescrever e simplificar expressões sem alterar seu significado.
- **Leis de De Morgan**, **Distributiva** e **Contrapositiva** são especialmente úteis para refatorar condições complexas.
- Em programação, seu uso leva a um código mais **eficiente, legível e robusto**.
- Dominar essas leis fortalece o pensamento crítico e a habilidade de resolver problemas.

---

## Material Complementar

- **Stanford Encyclopedia of Philosophy - Propositional Logic:** Um recurso aprofundado para os fundamentos teóricos. [https://plato.stanford.edu/entries/logic-propositional/](https://plato.stanford.edu/entries/logic-propositional/)
- **Real Python - Python Booleans:** Artigos práticos sobre como a lógica booleana funciona em Python. [https://realpython.com/python-boolean/](https://realpython.com/python-boolean/)

## Referências
[1] Rosen, K. H. *Discrete Mathematics and Its Applications*. McGraw-Hill Education, 2019.
[2] Mueller, J. P. *Beginning programming with Python For Dummies*. John Wiley & Sons, 2018.