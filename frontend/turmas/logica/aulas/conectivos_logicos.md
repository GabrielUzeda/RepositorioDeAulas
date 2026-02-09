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
---

# Conectivos Lógicos na Programação

---

## Objetivos

- Compreender o que são conectivos lógicos e sua importância na programação.
- Identificar a simbologia e a aplicação dos operadores **`and`**, **`or`** e **`not`**.
- Aprofundar o conhecimento sobre o operador **XOR** (OU Exclusivo).
- Entender como a lógica é implementada em Python.

---

## Uma Decisão Lógica no Dia a Dia

Imagine que você está escolhendo uma roupa. Sua decisão depende de algumas condições:
"**SE** estiver chovendo **E** estiver frio, **ENTÃO** vou usar uma jaqueta impermeável."

Na programação, usamos **conectivos lógicos** para tomar decisões baseadas em condições, guiando o fluxo de um programa da mesma forma que você decide o que vestir.

---

## O Conectivo "E" (`and`)

O operador **`and`** exige que **ambas** as condições sejam verdadeiras para que o resultado seja verdadeiro.

- **Analogia:** Para fazer um sanduíche de queijo, você precisa de **pão E queijo**. Se faltar um dos dois, não há sanduíche.
- **Simbologia Lógica:** $A \land B$
- **Em Python:** `and`

```python
tem_pao = True
tem_queijo = False

if tem_pao and tem_queijo:
    print("Fazendo sanduíche de queijo!")
else:
    print("Não é possível fazer o sanduíche.")
```

---

## O Conectivo "OU" (`or`)

O operador **`or`** exige que **pelo menos uma** das condições seja verdadeira para que o resultado seja verdadeiro.

- **Analogia:** Em uma cafeteria, você pode pedir **café OU chá**. Pedir um deles é suficiente para satisfazer sua escolha.
- **Simbologia Lógica:** $A \lor B$
- **Em Python:** `or`

```python
quer_cafe = True
quer_cha = False

if quer_cafe or quer_cha:
    print("Servindo uma bebida quente!")
else:
    print("Nenhuma bebida foi escolhida.")
```

---

## O Conectivo "NÃO" (`not`)

O operador **`not`** **inverte** o valor de uma condição. O que é verdadeiro se torna falso, e vice-versa.

- **Analogia:** "Eu vou ao parque **SE NÃO** estiver chovendo." A condição para ir é a ausência de chuva.
- **Simbologia Lógica:** $\neg A$
- **Em Python:** `not`

```python
chovendo = False

if not chovendo:
    print("Vamos ao parque!")
else:
    print("Melhor ficar em casa.")
```

---

## Foco: O "OU Exclusivo" (XOR)

O **XOR** retorna verdadeiro apenas se **uma, e somente uma**, das condições for verdadeira.

- **Analogia:** Pense numa escada com dois interruptores (um em cima, outro embaixo). A luz acende se **apenas um** deles estiver ligado. Se ambos estiverem ligados ou ambos desligados, a luz apaga.
- **Simbologia Lógica:** $A \oplus B$
- **Em Python:** para booleanos, use `!=`. 
```python
interruptor_A = True
interruptor_B = False

# A forma mais clara e recomendada para XOR lógico
if interruptor_A != interruptor_B:
    print("XOR (com !=): A luz acendeu.")

```
---
## XOR vs. OR: A Diferença Crucial

O **OR** é inclusivo (um, outro, ou ambos). O **XOR** é exclusivo (apenas um, não ambos).

| A | B | `A or B` | `A != B` (XOR) |
| :---: | :---: | :----: | :---------: |
| **V** | **V** |   V    |      F      |
| **V** | **F** |   V    |      V      |
| **F** | **V** |   V    |      V      |
| **F** | **F** |   F    |      F      |

O XOR é muito útil para alternar estados ou verificar se um bit mudou.

---

## Implicação: "Se... Então..." (`if`)

A lógica "Se... Então..." é implementada em Python através da **estrutura de controle `if`**.

- **Analogia:** "**SE** o sinal está verde, **ENTÃO** você pode atravessar." A ação de atravessar depende da condição do sinal.
- **Simbologia Lógica:** $A \rightarrow B$
- **Python:** `if condicao:`

```python
sinal_verde = True

if sinal_verde:
    # Este bloco de código é a parte "Então..."
    print("Pode atravessar a rua.")
else:
    print("Espere o sinal abrir.")
```

---

## Implicação Lógica: Uma Nota Técnica

A estrutura `if` controla a **execução** de um bloco de código. Ela não é um operador que retorna `True` ou `False`.

Em lógica formal, a implicação $A \rightarrow B$ é uma expressão que pode ser avaliada, e sua equivalência é $\neg A \lor B$.

Para **verificar** se uma implicação lógica é verdadeira em Python, usamos:

```python
A = True
B = False

# Verifica se a implicação A -> B é verdadeira
resultado = (not A) or B

print(f"A implicação A -> B é: {resultado}") # False
```

---

## Armadilhas Comuns: Evitando Erros

Um erro comum é confundir operadores **lógicos** (`and`, `or`) com operadores **bitwise** (`&`, `|`).

- **A Cilada:** `and` e `or` avaliam a veracidade de expressões. `&` e `|` realizam operações bit a bit em números. Usar `if 5 & 2:` em vez de `if (x > 0) and (y > 0):` pode gerar resultados inesperados.
- **Analogia:** É como pedir "água com gás" e receber os dois itens separados (água e um botijão de gás) em vez da bebida pronta. A instrução foi entendida, mas de forma literal e errada.

Sempre use `and`, `or`, `not` para lógica condicional com booleanos.

---

## Atividade Prática: Qual Conectivo Usar?

**Cenário:** Para ter acesso a um laboratório, uma pessoa precisa ser **ou** aluna **ou** professora, mas não ambos. Uma pessoa que é aluna e também monitora (considerada professora) não pode entrar usando as duas credenciais ao mesmo tempo.

Qual expressão em Python modela essa regra de acesso?

* `eh_aluna and eh_professora`
* `eh_aluna or eh_professora`
* `eh_aluna != eh_professora`
* `not eh_aluna`

... A resposta é **`eh_aluna != eh_professora`**, pois o acesso é permitido a um grupo ou a outro, mas não a ambos (XOR).

---

## Aplicação no Mundo Real

Os conectivos lógicos são a base da inteligência em softwares:

* **Filtros de E-mail:** `if (remetente == "chefe" or "urgente" in assunto) and not is_spam:`
* **Sistemas de Segurança:** `if (sensor_porta or sensor_janela) and alarme_ligado:`
* **Games:** `if tem_chave and esta_perto_da_porta:`

Eles transformam regras simples em comportamentos complexos e úteis.

---

## Reflexão

Pense no seu dia. Quantas vezes você usou a lógica "E", "OU" ou "NÃO" para tomar uma decisão?

- Escolher um filme: "Quero um filme de comédia **OU** um de ação, mas **NÃO** um que seja muito longo."
- Comprar um produto: "Preciso de um celular que tenha uma boa câmera **E** bateria de longa duração."

A lógica de programação está em toda parte, organizando o mundo ao nosso redor.

---

## Conclusão

- **`and`, `or`, `not`** são os pilares para construir condições em qualquer linguagem de programação.
- **XOR** (implementado com `!=` para booleanos) oferece uma forma poderosa de exclusividade.
- **`if`** é a estrutura de controle que aplica a lógica "Se... Então..." para criar ações e reações em nossos programas.

Dominar esses conectivos é o primeiro grande passo para pensar como um programador.

---

## Material Complementar

- **Documentação Oficial do Python sobre Operadores Booleanos:** Para aprofundar, explore a documentação e veja mais exemplos. [https://docs.python.org/3/library/stdtypes.html#boolean-operations-and-or-not](https://docs.python.org/3/library/stdtypes.html#boolean-operations-and-or-not)
- **W3Schools - Python Operators:** Um ótimo recurso com exemplos interativos para praticar. [https://www.w3schools.com/python/python_operators.asp](https://www.w3schools.com/python/python_operators.asp)

## Referências
[1] Mueller, J. P. *Beginning programming with Python For Dummies*. John Wiley & Sons, 2018.
[2] Downey, A. B. *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media, 2011.