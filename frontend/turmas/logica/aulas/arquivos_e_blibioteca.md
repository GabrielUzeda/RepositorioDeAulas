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
  code {
    background-color: #e0e0e0;
    padding: 2px 6px;
    border-radius: 4px;
  }
---

# A Lógica da Manipulação de Arquivos e Bibliotecas

Entendendo o "Quê" e o "Porquê"

---

## Objetivos da Aula

Ao final desta sessão, você será capaz de:

* Entender a **lógica** do que é um arquivo e por que precisamos deles.
* Diferenciar os **modos de operação** lógicos: Leitura (`'r'`), Escrita (`'w'`) e Adição (`'a'`).
* Compreender o conceito de "bibliotecas" como caixas de ferramentas lógicas.
* **Criar sua própria biblioteca local** e importá-la.
* Aplicar a lógica de verificação (biblioteca `os`) para evitar erros comuns.

---

## Introdução: O Escritório Digital

Imagine que seu programa (script) é um funcionário em um escritório.

* **Variáveis** (ex: `x = 10`) são pensamentos ou anotações em um post-it. Quando o funcionário vai embora (o programa fecha), tudo é jogado fora.
* **Arquivos** (`.txt`, `.log`) são as gavetas e armários. São os locais onde o funcionário **guarda** informações de forma permanente (persistência) para consultar no dia seguinte.

Nesta aula, aprenderemos a lógica de como usar essas gavetas com segurança.

---

## A Lógica dos Arquivos

Formalmente, um arquivo é um contêiner no sistema de armazenamento (HD, SSD) para guardar dados de forma persistente.

* Para o Python, um arquivo é um **objeto** que podemos "abrir" para realizar operações.
* O mais importante é o **"modo"** (a intenção) com que abrimos o arquivo.

---

## A Ferramenta Principal: `open()`

Para interagir com um arquivo, usamos a função `open()`. Ela precisa de duas informações lógicas:

1.  O **Nome** do arquivo (o endereço da gaveta).
2.  O **Modo** (o que queremos fazer com a gaveta).

* `'r'` (Read): **Leitura**. Apenas olhar o que tem dentro. (Falha se a gaveta não existir).
* `'w'` (Write): **Escrita**. Esvaziar a gaveta e colocar coisas novas. (Se não existir, cria uma nova gaveta).
* `'a'` (Append): **Adição**. Abrir a gaveta e colocar mais coisas no final, sem mexer no que já estava lá.

---

## A Prática Lógica: O Bloco `with`

A forma lógica (e mais segura) de manipular arquivos é usando a declaração `with`.

* **Analogia:** O `with` é como um assistente inteligente. Você diz a ele: "Abra esta gaveta (`open()`) para mim".
* Assim que você termina seu trabalho (o bloco de código dentro do `with` acaba), o assistente **automaticamente garante que a gaveta seja fechada**.
* Isso é crucial! Se o programa falhar no meio e a "gaveta" ficar aberta, os dados podem ser corrompidos. O `with` previne isso.

---

## Lógica na Prática: Lendo e Escrevendo

```python
# Modo 'w' (Write) - Lógica de Criacao/Sobrescrita
# Se 'diario.txt' existir, sera apagado. Se nao, sera criado.
with open('diario.txt', 'w', encoding='utf-8') as f:
    f.write('Hoje aprendi sobre arquivos.\n')
    f.write('Parece util.\n')

# Modo 'a' (Append) - Lógica de Adicao
# Adiciona ao final, sem apagar o conteudo anterior.
with open('diario.txt', 'a', encoding='utf-8') as f:
    f.write('Acabei de adicionar mais uma linha!\n')
```

---

## Lógica na Prática: Lendo o Arquivo

Agora, vamos ler o que acabamos de salvar.

```python
# Modo 'r' (Read) - Lógica de Leitura
try:
    with open('diario.txt', 'r', encoding='utf-8') as f:
        # A forma mais simples de ler: linha por linha
        for linha in f:
            # .strip() apenas remove espacos/quebras de linha extras
            print(linha.strip()) 
except FileNotFoundError:
    print("Ops! O arquivo 'diario.txt' nao foi encontrado.")
```

---

## Erros Comuns (Lógica Preventiva)

* **A Armadilha do Caminho (Path):**
    * **Erro Lógico:** Tentar ler (`'r'`) um arquivo que não existe. O programa "trava" (gera um `FileNotFoundError`).
    * **Prevenção:** Como podemos *verificar* se o arquivo existe *antes* de tentar abri-lo? (Veremos isso com Bibliotecas).

* **A Armadilha da Destruição (`'w'`):**
    * **Erro Lógico:** Abrir um arquivo importante no modo `'w'` (escrita) por engano. Isso **apaga permanentemente** todo o seu conteúdo anterior.
    * **Prevenção:** Só use `'w'` se sua lógica *exige* começar do zero. Na dúvida, use `'a'` (adição).

---

## Erros Comuns (Lógica Preventiva)

* **A Armadilha do "Esquecimento":**
    * **Erro Lógico:** Usar `open()` sem o `with` e esquecer de fechar o arquivo (`f.close()`).
    * **Prevenção:** **Sempre** use o bloco `with` (o "assistente") para gerenciar arquivos.

---

## A Lógica das Bibliotecas

Bibliotecas (ou "Módulos") são caixas de ferramentas que resolvem problemas específicos.

* **Analogia:** Seu programa sabe somar e subtrair. Mas ele não sabe, por padrão, calcular uma raiz quadrada ou verificar se um arquivo existe no sistema operacional.
* Para que construir uma ferramenta do zero se você pode **importar** uma pronta?
* O comando `import` traz a "caixa de ferramentas" (biblioteca) para o seu script.

---

## Exemplo de Lógica: Biblioteca `math`

Vamos "importar" a caixa de ferramentas matemáticas.

```python
# Importa a biblioteca 'math' (matematica)
import math

# Agora podemos usar as ferramentas de dentro dela:
# Sintaxe logica: biblioteca.ferramenta()
raiz_quadrada = math.sqrt(16)
print(f'A raiz de 16 e: {raiz_quadrada}') # Saida: 4.0

print(f'O valor de PI e: {math.pi}') # Bibliotecas tambem tem constantes
```

---
## A Lógica das Bibliotecas: Criando a Sua

Uma "biblioteca" (ou módulo) não é mágica. É simplesmente **outro arquivo Python (`.py`)** que você cria para organizar seu código.

* **Analogia:** Em vez de colocar todas as suas ferramentas em uma única caixa gigante (seu script principal), você as organiza em caixas menores e etiquetadas (arquivos de biblioteca).

* **Lógica:**
    1.  `ferramentas.py` (A biblioteca - guarda as funções)
    2.  `principal.py` (O script - importa e usa as funções)

---

## Guia: Criando sua Própria Biblioteca (Passo 1)

**Passo 1: Crie o arquivo da biblioteca.**

Crie um arquivo chamado `ferramentas.py`. Dentro dele, apenas defina suas funções. Este arquivo não deve ser executado diretamente.

```python
# Nome do arquivo: ferramentas.py

def dar_oi(nome):
    """Uma funcao simples que imprime uma saudacao."""
    print(f"Ola, {nome}! Bem-vindo(a).")

def somar(a, b):
    """Uma funcao que retorna a soma de dois numeros."""
    return a + b
```

---

## Guia: Criando sua Própria Biblioteca (Passo 2)

**Passo 2: Importe e use em seu script principal.**

Crie *outro* arquivo (ex: `principal.py`) **na mesma pasta**. Agora, você pode `importar` seu arquivo `ferramentas` (note: sem o `.py`).

```python
# Nome do arquivo: principal.py

# Importa o *arquivo* 'ferramentas.py' que esta na mesma pasta
import ferramentas

# Agora, use a sintaxe: nome_do_arquivo.funcao()
ferramentas.dar_oi("Alice")

resultado = ferramentas.somar(10, 5)
print(f"O resultado da soma e: {resultado}")
```

---

## Erro Comum (Bibliotecas): Conflito de Nomes

* **Erro Lógico:** Você cria seu próprio arquivo e o chama de `math.py` ou `os.py`.
* **O que acontece:** Quando seu script principal (`principal.py`) executa `import math`, o Python **encontra o seu arquivo `math.py` primeiro** (porque está na mesma pasta) e o importa, ignorando a biblioteca padrão do sistema.
* **A Armadilha:** Seu arquivo (provavelmente) não terá a função `sqrt()`, e seu programa falhará com um `AttributeError`.
* **Prevenção:** **Nunca** nomeie seus arquivos com os mesmos nomes das bibliotecas padrão do Python.

---

## Biblioteca Essencial: `os` (Operating System)

Esta biblioteca é a caixa de ferramentas para interagir com o Sistema Operacional (Windows, Linux, Mac).

* Ela nos permite fazer perguntas lógicas *sobre* os arquivos, antes de *abri-los*.
* **Ferramenta Principal:** `os.path.exists(nome_do_arquivo)`
    * Esta função retorna `True` (Verdadeiro) se o arquivo existir, ou `False` (Falso) se não existir.
* Outras ferramentas lógicas:
    * `os.listdir('.')`: Lista quais arquivos existem no diretório atual.
    * `os.mkdir('nova_pasta')`: Cria um novo diretório (pasta).

---

## Estudo de Caso: Unindo Lógicas

**Problema:** Como podemos ler o `diario.txt` (slide 8) de forma 100% segura, prevenindo o `FileNotFoundError`?

**Solução Lógica:**
1.  Importar a ferramenta de verificação (`os`).
2.  Perguntar (`if`) se o arquivo existe.
3.  Se sim, abrir para leitura (`'r'`).
4.  Se não, avisar o usuário.

---
## Estudo de Caso: Unindo Lógicas


```python
import os # Trazendo a caixa de ferramentas do Sistema

NOME_ARQUIVO = 'diario.txt'

# 1. Aplicando a logica de verificacao
if os.path.exists(NOME_ARQUIVO):
    # 2. Se existe, abrimos com seguranca no modo 'r'
    print('Arquivo encontrado! Lendo...')
    with open(NOME_ARQUIVO, 'r', encoding='utf-8') as f:
        print(f.read())
else:
    # 3. Se nao existe, informamos o usuario
    print(f'Logica: O arquivo "{NOME_ARQUIVO}" nao existe ainda.')
```

---

## Atividade Prática: O Diário Inteligente

Vamos aplicar toda a lógica aprendida (`w` vs `a` e `os.path.exists`).

**Sua Missão Lógica:**

Crie um script que gerencia um arquivo `log.txt`.

1.  O script deve primeiro **verificar** se o `log.txt` já existe (usando `os.path.exists`).
2.  **Se NÃO existir:** O script deve usar o modo `'w'` (write) para criar o arquivo e escrever a linha: `Registro iniciado.`
3.  **Se SIM (já existir):** O script deve usar o modo `'a'` (append) para adicionar a linha: `Nova entrada no registro.`

**Execute seu script duas ou três vezes e veja o que acontece no arquivo `log.txt`!**

---

## Reflexão (Diário Inteligente)

* **O que aconteceu** na primeira vez que você rodou o script? E nas vezes seguintes?
* **O que aconteceria** (o erro lógico) se você usasse **apenas** o modo `'w'` (write) todas as vezes?
    * *Resposta:* Você apagaria todo o histórico a cada execução.
* **O que aconteceria** se você usasse **apenas** o modo `'r'` (read)?
    * *Resposta:* O script falharia na primeira vez (ou não faria nada), pois o arquivo não existiria.

---

## Conclusão

* **Arquivos** (`open`, `with`) são a lógica para **persistir** (salvar) dados.
* A lógica mais importante é a **escolha do modo**:
    * `'r'` (Leitura): Seguro, mas falha se não existir.
    * `'w'` (Escrita): Perigoso! Apaga tudo. Use para criar ou reiniciar.
    * `'a'` (Adição): Seguro! Adiciona ao final.
* **Bibliotecas** (`import`) são a lógica para **reutilizar** código.
* **Bibliotecas Locais** (ex: `ferramentas.py`) são como as bibliotecas padrão, mas você mesmo as cria para organizar seu projeto.
* A biblioteca `os` nos dá a lógica de **verificação** (`os.path.exists`) para tomar decisões seguras.

---

## Material Complementar

* **Documentação Oficial do Python (Arquivos):** Essencial para entender todos os detalhes de `open()`.
    [https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files)
* **Documentação Oficial do Python (Módulos):** Aprofunde-se em como o `import` funciona.
    [https://docs.python.org/3/tutorial/modules.html](https://docs.python.org/3/tutorial/modules.html)
* **Documentação da Biblioteca `os.path`:**
    [https://docs.python.org/3/library/os.path.html](https://docs.python.org/3/library/os.path.html)
* **Livro "Automate the Boring Stuff with Python" (Al Sweigart):** Foco prático em manipulação de arquivos. Os capítulos sobre organização de arquivos (Cap. 9 e 10 da 2ª ed.) são excelentes e gratuitos online.