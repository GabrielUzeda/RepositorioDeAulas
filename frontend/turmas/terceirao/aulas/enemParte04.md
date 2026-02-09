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

# **Guia Prático: Expondo sua IA Local com Ngrok**

---

## **Objetivos da Aula**

* **Parte 1: O Túnel Mágico para a Internet**
  * Entender o que é o **ngrok** e como ele nos ajuda.
  * Instalar, configurar e iniciar um túnel seguro.
  * Testar a conexão com o modelo de IA **Ollama**.

* **Parte 2: Integrando a IA em nossa Aplicação**
  * Implementar uma nova rota em Python com **Flask**.
  * Usar a biblioteca `requests` para se comunicar com a IA.
  * Gerar conteúdo dinâmico (questões) através da API.

---

## **Parte 1: O Túnel Mágico para a Internet com Ngrok**

Imagine que sua aplicação rodando localmente (no seu computador) está em uma ilha isolada. Para que o mundo exterior possa visitá-la, você precisa de uma ponte segura.

O **ngrok** é essa ponte. Ele cria um **túnel seguro** da internet pública diretamente para a sua máquina [1].

Isso é essencial para testarmos aplicações que precisam receber respostas de serviços externos, como APIs.

---

### **Passo a Passo: Construindo a Ponte (Instalando o Ngrok)**

1. **Acesse o Painel do Ngrok:**
   * Navegue para `https://dashboard.ngrok.com/get-started/setup/windows` [1].

2. **Faça o Download:**
   * Clique no botão de download para **Windows (64-bits)**.
   * Salve o arquivo `.zip` em um local de fácil acesso.

3. **Extraia e Prepare:**
   * Extraia o conteúdo do arquivo `.zip`. Dentro, você encontrará o executável `ngrok.exe`.
   * Abra o terminal (CMD ou PowerShell) e navegue até a pasta onde você extraiu o `ngrok.exe`.

---

### **Passo a Passo: Autenticando sua Ponte**

Para que o **ngrok** saiba quem você é, precisamos de um "token" (uma chave secreta).

1. **Obtenha seu Authtoken:**
   * Vá para `https://dashboard.ngrok.com/get-started/your-authtoken` [2].
   * Copie o token fornecido em sua conta.

2. **Configure no Terminal:**
   * No terminal, dentro da pasta do ngrok, execute o comando abaixo, substituindo `SEU_TOKEN_AQUI` pela chave que você copiou:
   ```bash
   ngrok config add-authtoken SEU_TOKEN_AQUI
   ```

---

### **Passo a Passo: Abrindo o Túnel para o Ollama**

Agora, vamos abrir a ponte diretamente para a porta onde o **Ollama** está "escutando".

* **Inicie o Túnel:**
  * O Ollama geralmente roda na porta `11434`. Execute o comando:
  ```bash
  ngrok http 11434 --host-header="localhost:11434"
  ```

* **Armazene sua URL:**
  * O terminal mostrará uma URL pública na linha **"Forwarding"**. Copie essa URL (algo como `https://aleatorio-unico.ngrok-free.dev`). **Esta é a sua ponte!**

---

### **Passo a Passo: Testando a Conexão com a IA**

Vamos enviar uma mensagem através do túnel para ver se o modelo de IA responde.

1. **Baixe o Modelo (se necessário):**
   * No terminal, execute: `ollama pull gemma:2b`.

2. **Envie uma Requisição `curl`:**
   * Abra um **novo terminal** e use o comando abaixo.
   * **Atenção:** Substitua a URL de exemplo pela **sua URL do ngrok** que você copiou.
   ```bash
   curl -X POST https://sua-url-aqui.ngrok-free.dev/api/generate \
   -H "Content-Type: application/json" \
   -d '{
     "model": "gemma:2b",
     "prompt": "Me conte uma curiosidade rápida sobre a linguagem Python.",
     "stream": false
   }'
   ```

---

## **Parte 2: Integrando a IA em nossa Aplicação Python**

Agora que a ponte está funcionando, vamos ensinar nossa aplicação a atravessá-la para buscar informações.

**A Analogia do Garçom Digital (API):**
Nossa aplicação Python (`@app.route`) será o **cliente** no restaurante. Ela não vai até a cozinha (o **Ollama**), mas chama um garçom (`requests.post`) e entrega um pedido claro (`prompt`). O garçom leva o pedido até a cozinha e retorna com o prato pronto (a **resposta da IA**).

---

### **O Código da Nova Rota: Gerador de Questões**

Vamos adicionar uma nova rota ao nosso arquivo Python. Ela receberá um tema e gerará uma questão de múltipla escolha.

```python
import requests
import re
import json
from flask import request, jsonify, Flask

app = Flask(__name__)

# Rota: Gerar nova questão com IA
@app.route("/api/questions/generate", methods=["POST"])
def gerar_questao_ia():
    data = request.get_json()
    if not data:
        return jsonify({"erro": "Nenhum JSON recebido"}), 400

    tema = data.get("tema")
    area = data.get("area")
    dificuldade = data.get("dificuldade", "médio")

```
---
```python
    if not tema or not area:
        return jsonify({"erro": "Campos 'tema' e 'area' são obrigatórios"}), 400

    prompt = (
        f"Crie uma questão de múltipla escolha sobre o tema '{tema}', "
        f"na área '{area}', com nível de dificuldade {dificuldade}. "
        f"A saída deve estar em JSON no seguinte formato:\n"
        f"{{\n"
        f'  "enunciado": "texto da questão",\n'
        f'  "alternativas": [\n'
        f'    {{"letra":"A", "conteudo":"...", "correta":false}},\n'
        f'    {{"letra":"B", "conteudo":"...", "correta":false}},\n'
        f'    {{"letra":"C", "conteudo":"...", "correta":true}},\n'
        f'    {{"letra":"D", "conteudo":"...", "correta":false}},\n'
        f'    {{"letra":"E", "conteudo":"...", "correta":false}}\n'
        f'  ]\n'
        f"}}\n"
    )
```
---
```python
    try:
        # IMPORTANTE: Altere a URL abaixo para a sua URL do ngrok!
        response = requests.post(
            "https://sua-url-aqui.ngrok-free.dev/api/generate",
            headers={"Content-Type": "application/json"},
            json={
                "model": "gemma:2b",
                "prompt": prompt,
                "stream": False
            },
            timeout=60
        )

        if response.status_code != 200:
            return jsonify({"erro": "Falha ao gerar questão com IA", "detalhes": response.text}), 500

        ia_result = response.json()
        texto = ia_result.get("response", "")
```
---
```python        
        # Extrai o JSON da resposta da IA
        match = re.search(r'\{.*\}', texto, re.DOTALL)
        if match:
            questao_json = json.loads(match.group(0))
        else:
            return jsonify({"erro": "Não foi possível extrair um JSON válido da resposta da IA", "resposta": texto}), 500

        questao_formatada = {
            "area": area,
            "materia": tema,
            "enunciado": questao_json.get("enunciado", "Questão sem enunciado"),
            "pontuacao": 1,
            "ano": 2025,
            "alternativas": questao_json.get("alternativas", [])
        }
        return jsonify(questao_formatada)

    except Exception as e:
        return jsonify({"erro": f"Erro ao chamar API da IA: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

---

### **Testando a Integração**

1. **Rode sua aplicação Python:**
   * Salve o código anterior em um arquivo (ex: `app.py`) e execute-o. O Flask iniciará seu servidor local.

2. **Envie um POST para a nova rota:**
   * Use uma ferramenta como o Postman ou `curl` para enviar uma requisição POST para sua API no PythonAnywhere (ou localmente), direcionada à rota `/api/questions/generate`.
   * **Corpo da Requisição (JSON):**
   ```json
   {
       "tema": "História do Brasil",
       "area": "História",
       "dificuldade": "fácil"
   }
   ```

Sua aplicação irá chamar o **ngrok**, que redireciona para o **Ollama**, que gera a questão, e o resultado volta pelo mesmo caminho até você!

---

## **Reflexão e Próximos Passos**

* **O que aconteceu?**
  * Criamos uma ponte (túnel **ngrok**) entre a internet e nossa máquina.
  * Nossa aplicação aprendeu a usar essa ponte para "conversar" com uma IA.
  * Transformamos uma tarefa manual (escrever questões) em um processo automatizado.

* **O que podemos fazer a seguir?**
  * Como podemos tratar respostas mal formatadas da IA?
  * De que outras formas podemos usar essa integração para enriquecer nossa aplicação?
  * Pense em como essa arquitetura pode ser útil em outros projetos.

---

## **Referências**

[1] Ngrok Documentation. *Get Started with ngrok*. Disponível em: https://ngrok.com/docs/getting-started [2]
[2] Python Requests. *Requests: HTTP for Humans™*. Disponível em: https://requests.readthedocs.io/
[3] Ollama. *Ollama Documentation*. Disponível em: https://ollama.com/docs/
[4] PythonAnywhere. *PythonAnywhere Help*. Disponível em: https://help.pythonanywhere.com/