---
marp: true
theme: default
paginate: true
style: |
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css');
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
  .fa-solid, .fa-brands {
    color: #1a3a6e;
    margin-right: 10px;
  }
---

# APIs: O Que São e Como Movem o Mundo Digital
### Desmistificando os "Garçons" da Tecnologia

---

## <i class="fa-solid fa-bullseye"></i> Objetivos da Aula

Ao final desta sessão, você será capaz de:

* Definir o que é uma **API** (Interface de Programação de Aplicações).
* Explicar a função de uma API usando uma analogia do mundo real.
* Identificar os componentes básicos de uma interação de API (Requisição, Resposta).
* Reconhecer exemplos de APIs públicas e seu impacto.

---

## A Analogia do Restaurante <i class="fa-solid fa-utensils"></i>

Imagine que você está em um restaurante:

* **Você (O Cliente):** É um aplicativo.
* **A Cozinha (O Servidor):** O sistema complexo que prepara os dados (ex: o serviço de meteorologia).
* **O Cardápio (A Documentação):** Lista o que você pode pedir.

**O Garçom (A API):** Você não pode entrar na cozinha. O garçom é a **interface** que anota seu pedido, leva à cozinha e traz o prato pronto (os dados) para você.

---

## O Que é uma API?

**API** significa **Interface de Programação de Aplicações**.

* **Interface:** É um ponto de contato, um "rosto" que um sistema mostra para outro.
* **Programação:** Define as regras de como esse contato deve ser feito (a "língua" que o garçom entende).
* **Aplicações:** Permite que programas de software diferentes conversem.

Em essência, uma API é um **contrato formal** que define como um software pode solicitar serviços ou dados de outro.

---

## O Fluxo Básico: Requisição e Resposta

A comunicação via API é uma "conversa" estruturada.

<div class="mermaid" style="transform: scale(0.9);">
  graph LR;
    A[Seu Aplicativo <i class="fa-solid fa-mobile-screen-button"></i>]
        -- 1. Cria Requisição (Ex: Qual o clima em SP?) --> 
    B(API / O Garçom <i class="fa-solid fa-user-tie"></i>);
    
    B -- 2. Processa Pedido --> 
    C[Servidor / A Cozinha <i class="fa-solid fa-server"></i>];
    
    C -- 3. Prepara os Dados --> B;
    
    B -- 4. Entrega Resposta (Ex: Faz 22°C) --> A;
  
</div>

* **Requisição (Request):** O pedido que seu app faz.
* **Resposta (Response):** O que o servidor entrega de volta.

---

## A "Língua" das APIs (Parte 1): Endpoints

Como o "garçom" sabe o que você quer? Precisamos de um **endereço** claro.

* **Endpoint:** É o "endereço" específico do seu pedido. É como dizer ao garçom exatamente o número do item no cardápio.
* Cada *endpoint* representa um recurso ou uma ação específica.

**Exemplos de Endpoints:**
* `https://api.exemplo.com/clima/hoje`
    * (Traz o clima de hoje)
* `https://api.exemplo.com/usuarios/123`
    * (Traz os dados do usuário com ID 123)

---

## A "Língua" das APIs (Parte 2): JSON

O *endpoint* é o endereço, mas **JSON** é o pacote que o garçom entrega.

* **JSON** (JavaScript Object Notation) é o formato de texto usado para organizar e enviar os dados.
* É leve, fácil de ler para humanos e fácil de interpretar para máquinas.

Sua estrutura é baseada em **Pares Chave-Valor**:

```json
{
  "chave_1": "Valor (texto)",
  "chave_2": 30,
  "chave_3": true,
  "cidade": "Goiânia",
  "temperatura": 30,
  "condicao": "Ensolarado"
}
```

---

## <i class="fa-solid fa-triangle-exclamation"></i> "O Garçom Responde..." (Erros Comuns)

Às vezes, o pedido falha. Entender o porquê é crucial.

* **Erro 404 (Não Encontrado):**
    * <i class="fa-solid fa-map-location-dot"></i> **O que é:** Você tentou acessar um *endpoint* que não existe.
    * **Analogia:** "Desculpe, senhor(a), não temos 'sopa de abacaxi' no cardápio."

* **Erro 401/403 (Não Autorizado / Proibido):**
    * <i class="fa-solid fa-key"></i> **O que é:** Você não enviou sua **Chave de API (API Key)** ou ela é inválida.
    * **Analogia:** "Sua reserva não foi encontrada para esta área VIP."

* **Erro 400 (Requisição Inválida):**
    * <i class="fa-solid fa-language"></i> **O que é:** Você enviou os dados em um formato errado (ex: XML em vez de JSON).
    * **Analogia:** "Não consegui anotar seu pedido, você poderia repetir de forma mais clara?"

---

## Estudo de Caso: O App de Transporte <i class="fa-solid fa-car-side"></i>

Quando você abre um app de transporte, ele parece "mágico", mas são várias APIs trabalhando juntas:

1.  **API de Mapas (Ex: Google Maps API):**
    * **Pedido:** "Onde está o usuário? Onde está o motorista mais próximo?"
    * **Resposta:** Mostra o mapa, o carro se movendo e calcula a rota.

2.  **API de Pagamento (Ex: Stripe API):**
    * **Pedido:** "Cobrar R$ 15,00 do cartão final 4002."
    * **Resposta:** "Pagamento aprovado."

3.  **API de Notificação (Ex: Uber API):**
    * **Pedido:** "Envie um SMS: 'Seu motorista chegou'."
    * **Resposta:** "Mensagem enviada."

---

## Onde as APIs Estão? (APIs Públicas)

APIs públicas permitem que qualquer desenvolvedor use dados ou serviços de outras empresas (muitas vezes com uma chave gratuita ou paga).

* **<i class="fa-solid fa-cloud-sun"></i> OpenWeatherMap:** Fornece dados de clima e previsão do tempo.
* **<i class="fa-brands fa-github"></i> GitHub API:** Permite interagir com repositórios, issues e usuários.
* **<i class="fa-solid fa-chart-line"></i> Dados Abertos (gov.br):** O governo disponibiliza dados sobre orçamento, saúde e educação via APIs.
* **<i class="fa-solid fa-palette"></i> The Color API:** Uma API simples que retorna informações sobre esquemas de cores.
* **<i class="fa-solid fa-rocket"></i> NASA APIs:** Fornece acesso a imagens e dados da agência espacial.

---

## <i class="fa-solid fa-lightbulb"></i> Momento de Reflexão

Pense em um aplicativo que você usa todos os dias (ex: Instagram, Spotify, iFood).

* **Descrição:** O que o aplicativo faz?
* **Sentimento/Reação:** Qual a sua primeira impressão sobre a complexidade dele?
* **Análise:** Agora, tente "desmontar" o app.
    * *Quais 'garçons' (APIs) ele pode estar chamando?*
    * *Ele busca seu perfil (API interna)? Busca músicas (API do Spotify)? Mostra um mapa (API de Mapas)?*
* **Conclusão/Ação:** Como sua visão sobre esse app mudou sabendo que ele é, provavelmente, um "orquestrador" de várias APIs?

---

## Conclusão: Os Conectores do Mundo

* APIs não são o "produto" final; elas são os **mecanismos (os garçons)** que permitem que os produtos funcionem.
* Elas são a base da "Economia das Aplicações", permitindo que empresas colaborem e criem serviços complexos (como o app de transporte).
* Sem um padrão de comunicação (sem um "cardápio" e um "idioma" em comum), cada nova integração seria caótica. As APIs trazem **ordem e padronização** a essa conversa.

---

## <i class="fa-solid fa-book-open"></i> Material Complementar

* **MDN Web Docs - API (Visão Geral):** Uma explicação técnica fundamental sobre o conceito de APIs no contexto da web.
    * `https://developer.mozilla.org/pt-BR/docs/Learn/JavaScript/Client-side_web_APIs/Introduction`

* **Public APIs (Repositório):** Uma lista gigantesca de APIs públicas e gratuitas para você testar e construir seus primeiros projetos.
    * `https://github.com/public-apis/public-apis`

* **Livro: "APIs: A Strategy Guide" (Daniel Jacobson, et al.):** Focado mais na estratégia de negócio por trás das APIs, mas excelente para entender o impacto.