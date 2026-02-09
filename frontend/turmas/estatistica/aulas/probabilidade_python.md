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

# Simulação de Eventos com Python

---

## Objetivos de Aprendizagem

* Entender a diferença entre **eventos independentes** e **dependentes**.
* Usar a biblioteca `random` de forma simples para criar simulações.
* Conectar cada linha de código aos conceitos de probabilidade.

---

## Eventos Independentes: Cada Vez é a Primeira Vez

Em eventos independentes, o passado não importa.
**Analogia:** Lançar uma moeda. O resultado anterior não muda a próxima jogada.

### Exemplo 1: Lançando uma Moeda

```python
import random

opcoes = ['Cara', 'Coroa']

# A função choice() simplesmente escolhe um item da lista.
resultado = random.choice(opcoes)

print("Resultado do lançamento:", resultado)
```

---

## Atividade Prática 1: O Dado Viciado

Vamos simular um dado onde o número **6** tem 50% de chance, e os outros (1 a 5) têm 10% cada.

**Dica:** `random.choices()` pode usar "pesos" para o sorteio.

```python
import random

numeros = [1, 2, 3, 4, 5, 6]
pesos = [0.1, 0.1, 0.1, 0.1, 0.1, 0.5] # 10% + 10% + ... + 50% = 100%

# A função choices() devolve uma lista, então pegamos o primeiro item com [0]
resultado = random.choices(numeros, weights=pesos)[0]

print("Lançamento do dado viciado:", resultado)
```

---

## Eventos Dependentes: O Que Acontece, Fica

Neste caso, um evento muda as chances do próximo.
**Analogia:** Tirar uma carta de um baralho e **não devolver**. O baralho agora tem uma carta a menos.

---
### Exemplo 2: Criando um Baralho (Passo a Passo)

```python
import random

# Primeiro, criamos as listas de naipes e valores
naipes = ['Copas', 'Ouros', 'Paus', 'Espadas']
valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

# Agora, criamos o baralho com laços "for" simples
baralho = []
for naipe in naipes:
    for valor in valores:
        carta = f"{valor} de {naipe}"
        baralho.append(carta)

# random.sample() tira uma amostra sem repetir
mao = random.sample(baralho, k=5)
print("Sua mão:", mao)
```

---

## Erro Comum: Usar a Ferramenta Errada

Usar `random.choice()` para um sorteio onde a pessoa não pode ganhar duas vezes é um erro. Ele pode escolher o mesmo nome de novo.

**Forma Incorreta (Pode repetir!)**
```python
import random
nomes = ['Ana', 'Bruno', 'Carla']
# Sorteia duas vezes, mas Ana pode ganhar os dois prêmios!
ganhador1 = random.choice(nomes)
ganhador2 = random.choice(nomes)
print(f"Ganhadores (errado): {ganhador1} e {ganhador2}")
```

**Forma Correta (Garante ganhadores diferentes)**
```python
# random.sample() garante que não haverá repetição.
ganhadores_correto = random.sample(nomes, k=2)
print("Ganhadores (correto):", ganhadores_correto)
```

---

## Atividade Prática 2: Montando Times (Passo a Passo)

Temos 6 jogadores e queremos formar dois times de 3.

```python
import random

jogadores = ['Alice', 'Beto', 'Clara', 'Davi', 'Eva', 'Felipe']

# 1. Sorteamos o primeiro time, sem repetição
time_a = random.sample(jogadores, k=3)

# 2. Criamos uma lista vazia para o segundo time
time_b = []

# 3. Verificamos cada jogador da lista original
for jogador in jogadores:
    # Se o jogador NÃO está no time A, ele vai para o time B
    if jogador not in time_a:
        time_b.append(jogador)

print("Time A:", time_a)
print("Time B:", time_b)
```

---

## Analisando uma Simulação: Urna de Bolas

Temos uma urna com 5 bolas vermelhas (V) e 3 azuis (A).
Tiramos **duas bolas sem devolver**. Vamos simular muitas vezes para ver o que acontece.

---

```python
import random

urna = ['V', 'V', 'V', 'V', 'V', 'A', 'A', 'A']
total_de_simulacoes = 10000

# Contadores que começam em zero
primeira_foi_vermelha = 0
ambas_foram_vermelhas = 0

# O "i" aqui é só para contar de 0 até 9999.
# Ele garante que o código dentro do laço repita 10000 vezes.
for i in range(total_de_simulacoes):
    sorteio = random.sample(urna, k=2)
    
    # Se a primeira bola sorteada (posição 0) for 'V'...
    if sorteio[0] == 'V':
        primeira_foi_vermelha = primeira_foi_vermelha + 1
        
        # ...então verificamos se a segunda (posição 1) também é 'V'.
        if sorteio[1] == 'V':
            ambas_foram_vermelhas = ambas_foram_vermelhas + 1

probabilidade = ambas_foram_vermelhas / primeira_foi_vermelha
print(f"Chance da 2ª ser 'V' se a 1ª foi 'V': {probabilidade:.2f}") # Ex: 0.57
print(f"Valor teórico (4/7): {4/7:.2f}")
```

---

## Conclusão Final

* **Eventos Independentes (com reposição):**
    Use `random.choice()`. As opções **não mudam**.

* **Eventos Dependentes (sem reposição):**
    Use `random.sample()`. As opções **diminuem** a cada sorteio.

O código mais simples é o melhor para aprender. O importante é que ele mostre a ideia claramente.

---

## Referências

[1] Downey, A. (2011). *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media.
[2] Mueller, J. P. (2018). *Beginning Programming with Python for Dummies*. John Wiley & Sons.
[3] Documentação Oficial do Python. Módulo `random`. Acessado em 2024.