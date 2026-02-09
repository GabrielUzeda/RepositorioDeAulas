---
marp: true
theme: default
paginate: true
style: |
  section {
    font-family: Arial, sans-serif;
    line-height: 1.6;
  }
  h1, h2 {
    color: #1d3b8b;
  }
  code {
    background-color: #f0f0f0;
    padding: 2px 5px;
    border-radius: 4px;
  }
---

# Controle de Erros com `try` e `except` em Python

Gerenciando o Inesperado no Código

---

## Objetivos da Aula

Ao final desta apresentação, você será capaz de:

* Entender por que o tratamento de erros é fundamental na programação.
* Utilizar a estrutura `try` e `except` para capturar e gerenciar exceções.
* Identificar erros comuns e como evitá-los.
* Aplicar o controle de erros em situações práticas para criar programas mais robustos.

---

## Uma Analogia: O Robô Cozinheiro

Imagine que você programou um robô para seguir uma receita. Ele funciona perfeitamente se todos os ingredientes estiverem disponíveis.

Mas, e se um dia faltar ovos na geladeira?

O robô entraria em pane e pararia completamente. O bloco `try/except` é como dar ao robô um "Plano B":

* **`try` (Tente):** "Robô, tente pegar os ovos."
* **`except` (Se falhar):** "Se não houver ovos, use esta receita alternativa sem ovos em vez de parar."

Essa é a essência do tratamento de erros: prever falhas e instruir o programa sobre como reagir sem "quebrar".

---

## Conceitos Fundamentais: A Estrutura de Segurança

A estrutura `try/except` possui partes que trabalham juntas para criar um código seguro.

* **`try`**: O bloco de código que você quer "tentar" executar. É aqui que você coloca a operação que pode falhar (ex: converter um texto para número, ler um arquivo).

* **`except`**: Se um erro ocorrer dentro do bloco `try`, o código dentro do `except` é executado. É o seu plano de contingência.

* **`else`** (Opcional): Este bloco é executado somente se o bloco `try` for concluído com sucesso, sem nenhum erro.

* **`finally`** (Opcional): O código aqui será executado sempre, não importa se houve um erro ou não. É ideal para "limpar a bagunça", como fechar um arquivo.

---

## Anatomia do `try/except` em Python

Vamos ver como a estrutura funciona na prática.

```python
try:
    # Código que pode gerar um erro
    numero = int(input("Digite um número: "))
    resultado = 10 / numero
except:
    # Executado quando acontecer um erro
    print("Ops! Algo deu errado!")
else:
    # Executado se não ocorreram erros no try
    print(f"O resultado é {resultado}")
finally:
    # Executado sempre, ao final de tudo
    print("Fim da operação.")
```

---

## Erros Comuns: A Armadilha do `except` Genérico

Um erro muito comum é usar um `except` que captura *qualquer* tipo de erro.

```python
# Exemplo a ser evitado
try:
    # ... código ...
except:
    print("Ocorreu um erro.")
```

**A Analogia do Alarme:** Isso é como instalar um alarme de incêndio que dispara para qualquer coisa: fumaça, vapor do chuveiro ou uma mosca que passou perto. Logo, você não saberá a real causa do problema e pode ignorar perigos reais.

**A Prática Correta:** Sempre especifique o erro que você espera capturar (ex: `except ValueError`). Assim, você trata o problema conhecido e deixa que outros erros inesperados apareçam para que possam ser corrigidos.

---


## Problematizando o `except` Genérico

Usar apenas `except:` sem indicar o tipo de erro pode trazer problemas sérios:

```python
try:
    numero = int(input("Digite um número: "))
    resultado = 10 / numero
except:  # captura *qualquer* erro
    print("Algo deu errado!")
```

### Quais são os riscos?
* **Dificulta a manutenção** → erros inesperados ficam “mascarados” e podem passar despercebidos.  

Se o programa trata tudo da mesma forma, como você ou o usuário saberão o que realmente deu errado?

---

## Alternativa: Usando Exceções Específicas

Exemplos de exceções comuns em Python que costumam ser tratadas:

```python
try:
    numero = int(input("Digite um número: "))
    resultado = 10 / numero
except ValueError:
    print("Erro: Você não digitou um número válido.")
except ZeroDivisionError:
    print("Erro: Não é possível dividir por zero.")
except FileNotFoundError:
    print("Erro: Arquivo não encontrado.")
except IndexError:
    print("Erro: Índice fora do intervalo da lista.")
```

**Boa prática:** trate apenas os erros que você realmente espera que aconteçam no contexto do seu programa.

---

## Capturando a Exceção em uma Variável (`as`)

No Python, ao usar `try...except`, é possível capturar a exceção em uma variável para inspecionar suas informações.

Isso é feito com a palavra-chave **`as`**:

```python
try:
    numero = int("abc")   # Erro ao converter string para inteiro
except ValueError as e:
    print("Ocorreu um erro:", e)
```

### Vantagens:
* Permite exibir a **mensagem detalhada do erro**.
* Facilita **debug** e registro de logs.
* Ajuda a compreender o motivo específico da exceção.

---

## Atividade Prática: Calculadora Segura

Vamos criar uma calculadora que não "quebra".

**Desafio:**
Escreva um programa que peça ao usuário dois números e realize uma divisão.

**Requisitos:**
1.  O programa deve continuar funcionando mesmo que o usuário digite um texto em vez de um número.
2.  O programa não deve "quebrar" se o usuário tentar dividir por zero.
3.  Utilize `try`, `except ValueError` e `except ZeroDivisionError` para gerenciar essas situações e informar o usuário sobre o erro específico.

---

## Aplicação no Mundo Real

Onde usamos `try/except` o tempo todo?

* **Conexões de Rede:** Ao tentar acessar um site, a conexão pode falhar. Um bloco `try` tenta fazer a conexão, e o `except` lida com a falha, talvez tentando novamente ou mostrando uma mensagem de erro.

* **Leitura de Arquivos:** O programa tenta (`try`) abrir um arquivo. Se o arquivo não existir (`except FileNotFoundError`), ele pode criar o arquivo ou avisar o usuário.

* **Validação de Dados:** Ao receber dados de um formulário online, o programa tenta converter as informações para os tipos corretos (números, datas). Se falhar, o `except` informa ao usuário qual campo está incorreto.

---

## Reflexão: Lidando com Falhas

Antes de conhecer o `try/except`, como você lidava com erros inesperados em seus programas?

* O programa simplesmente parava?
* Você tentava prever todas as entradas possíveis com `if/else`?

Pense em um programa que você já criou. Onde um bloco `try/except` poderia torná-lo mais confiável e amigável para o usuário? A ideia não é apenas evitar que o programa pare, mas também fornecer uma experiência melhor para quem o utiliza.

---

## Conclusão: Programando com Resiliência

O tratamento de erros com `try/except` não é um recurso avançado, mas uma ferramenta essencial para qualquer programador.

* Ele transforma programas frágeis em sistemas **robustos**.
* Permite **antecipar falhas** e criar planos de ação.
* Melhora a **experiência do usuário**, fornecendo mensagens claras em vez de um programa que simplesmente para de funcionar.

Lembre-se do robô cozinheiro: um bom programa não é aquele que nunca encontra problemas, mas aquele que sabe como lidar com eles.

---

## Material Complementar

Para aprofundar seus conhecimentos:

* **Documentação Oficial do Python:** [Manuseando exceções](https://docs.python.org/pt-br/3/tutorial/errors.html)
* **W3Schools:** [Python Try Except](https://www.w3schools.com/python/python_try_except.asp) (em inglês)
* **Real Python:** [Python Exceptions: An Introduction](https://realpython.com/python-exceptions/) (em inglês)