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

# A Arte de Organizar: Modularização na Programação

---

## Objetivos

* Entender o que é **modularização** e por que é uma estratégia essencial na programação.
* Identificar os benefícios de dividir um sistema complexo em partes menores e independentes.
* Aprender a aplicar a modularização através de **funções e módulos**.
* Reconhecer e evitar os problemas de um código "monolítico" e desorganizado.

---

## Introdução: Construindo com Peças de LEGO

Imagine construir um castelo complexo. Você não derreteria todo o plástico para esculpir o castelo de uma só vez. Em vez disso, você usaria peças de **LEGO**: blocos padronizados que se encaixam de maneiras previsíveis.

* Cada peça de LEGO é um **módulo**: tem uma função específica e bem definida.
* Você pode construir pequenas partes do castelo separadamente (uma torre, uma muralha) e depois juntá-las.
* Se uma peça quebrar, você substitui apenas aquela peça, e não o castelo inteiro.

A modularização na programação segue exatamente essa lógica.

---

## Conceitos Fundamentais: O Que é um Módulo?

Um **módulo** é um bloco de código autocontido, projetado para realizar uma tarefa específica. Os princípios-chave são:
* **Alta Coesão**: Focar em fazer uma única coisa bem feita.
* **Baixo Acoplamento**: Módulos independentes. Uma mudança em um não deve quebrar os outros.




---

## Na Prática: Antes e Depois

Veja um código que calcula a área de diferentes formas, tudo misturado:

```python
# ANTES: Código monolítico
forma = "retangulo"
largura = 10
altura = 5
if forma == "retangulo":
    print(f"Área: {largura * altura}")
# ...aqui entraria o código para círculo, triângulo, etc.
```

Agora, o mesmo código, modularizado com funções:

```python
# DEPOIS: Código modularizado
def calcular_area_retangulo(largura, altura):
    return largura * altura

area = calcular_area_retangulo(10, 5)
print(f"Área: {area}")
```

---

## Erros Comuns: A Gaveta da Bagunça

Um erro comum é criar um "módulo faz-tudo", onde todo o código do projeto é jogado. É como ter uma única gaveta em casa para guardar ferramentas, documentos, talheres e meias.

* **O Problema**: Encontrar algo se torna um pesadelo. Uma pequena mudança pode ter efeitos colaterais inesperados em outra parte do sistema.
* **O Sintoma**: Arquivos com milhares de linhas de código e funções que tentam fazer várias coisas ao mesmo tempo.
* **A Prevenção**: Se uma função ou arquivo está ficando muito grande, é um sinal de que ele precisa ser quebrado em partes menores e mais especializadas.

---

## Atividade Prática: A Calculadora Organizada

**Cenário**: Você precisa criar uma calculadora que realiza as quatro operações básicas.

1.  Crie quatro funções separadas: `somar(a, b)`, `subtrair(a, b)`, `multiplicar(a, b)` e `dividir(a, b)`.
2.  Crie um menu principal que pergunte ao usuário qual operação ele deseja realizar e quais são os números.
3.  **Desafio Extra**: Leve a modularização para o próximo nível!
    * Coloque suas quatro funções em um arquivo chamado `operacoes.py`.
    * Em outro arquivo chamado `main.py`, **importe** as funções do arquivo `operacoes.py` e use-as para fazer a calculadora funcionar.

---

## Aplicação no Mundo Real

A modularização não é apenas uma boa prática, é a base do software moderno.

* **Equipes de Desenvolvimento**: Permite que diferentes programadores trabalhem em módulos distintos simultaneamente, sem interferir uns nos outros.
* **Navegadores de Internet**: O motor que renderiza a página, o que executa JavaScript e a interface do usuário são todos módulos separados.
* **Bibliotecas e Frameworks**: Quando você usa uma biblioteca como `NumPy` ou um framework como `React`, está importando módulos que outra pessoa construiu e testou.

---

## Reflexão

Pense em como uma cozinha de restaurante profissional funciona. Existem diferentes "estações" ou "módulos": a estação das saladas, a da grelha, a das sobremesas.

* O que aconteceria se houvesse apenas um chef tentando fazer tudo ao mesmo tempo?
* Como a comunicação entre as estações (os módulos) precisa ser clara e bem definida para que o prato final (o software) seja entregue corretamente?
* Que problemas surgiriam se a estação da grelha dependesse diretamente de uma panela específica da estação de sobremesas? (Alto Acoplamento).

---

## Conclusão e Aplicação Real

Modularizar não é sobre escrever mais código, mas sobre **organizar a complexidade**. É uma estratégia que transforma problemas grandes e assustadores em conjuntos de problemas menores e gerenciáveis.

Ao adotar essa prática, seu código se torna:
* **Mais legível e fácil de manter.**
* **Reutilizável em outros projetos.**
* **Mais robusto e menos propenso a erros.**
* **Ideal para o trabalho em equipe.**

---

## Material Complementar

* **Clean Code: A Handbook of Agile Software Craftsmanship por Robert C. Martin**: Um livro clássico que aprofunda os princípios de software bem escrito, incluindo a modularização.
* **Documentação Oficial do Python sobre Módulos**: Essencial para entender como o Python implementa e gerencia módulos. [https://docs.python.org/3/tutorial/modules.html](https://docs.python.org/3/tutorial/modules.html)
* **Refactoring.Guru**: Um site com excelentes exemplos visuais de como melhorar o design do código, incluindo técnicas de modularização. [https://refactoring.guru/](https://refactoring.guru/)

---

## Referências

[1] Downey, A. (2011). *Think Stats: Probability and Statistics for Programmers*. O'Reilly Media.
[2] Mueller, J. P. (2018). *Beginning Programming with Python For Dummies*. John Wiley & Sons.