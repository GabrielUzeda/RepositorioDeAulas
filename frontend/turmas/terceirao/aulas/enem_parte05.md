---
marp: true
theme: default
paginate: true
style: '@import url("https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap");section{font-family:"Roboto",sans-serif;background-color:#f4f6fb;color:#2b2b2b;font-size:28px;line-height:1.5}h1,h2,h3{font-family:"Roboto Slab",serif;color:#1a3a6e}h2{border-bottom:2px solid #1a3a6e;padding-bottom:5px}strong{color:#d62828;font-weight:700}'
---

# Tokens JWT: Umm crachá de cada usuario

---

## Objetivos

* Entender o que é um JSON Web Token (JWT) e por que ele é crucial para a segurança de aplicações web.
* Identificar as três partes que compõem um JWT: **Header**, **Payload** e **Signature**.
* Compreender o fluxo de autenticação e autorização usando JWT em um cenário real.
* Reconhecer erros comuns e boas práticas ao utilizar tokens JWT para proteger sistemas.

---

## A Gênese de uma Crise Digital

Imagine nosso projeto no ar: um gerador de questões para o ENEM, alimentado por Inteligência Artificial. O objetivo é nobre — democratizar o acesso a material de estudo de qualidade.

A plataforma é lançada e, em poucas horas, o inesperado acontece. A IA, em um erro algorítmico, gera e publica uma questão de múltipla escolha com conteúdo **machista e polêmico**.

Um usuário captura a tela. Em minutos, o post viraliza no Twitter, gerando milhares de compartilhamentos e uma crise de imagem para o projeto.

---

## O Caminho da Solução: Da Crise ao Código

O problema é claro: a questão precisa ser **apagada imediatamente**. Mas como?

* Para apagar a questão, é necessário um **painel de administrador**.
* Para que exista um painel de administrador, é preciso uma **tabela de usuários** com diferentes níveis de permissão.
* Para controlar o acesso a esse painel, é fundamental um sistema de **autenticação e autorização**.

É aqui que entra uma das tecnologias mais comuns para essa tarefa: o **JSON Web Token**, ou **JWT**.

---

## O Que é um Token JWT? A Analogia do Crachá VIP

Pense em um JWT como um **crachá de acesso VIP** para um grande evento.

* Na entrada (login), você apresenta seu ingresso (usuário e senha). O segurança verifica e lhe entrega um crachá intransferível.
* Com o crachá no pescoço, você pode acessar todas as áreas permitidas (**autorização**) sem precisar mostrar seu ingresso novamente a cada porta.
* O crachá contém suas informações (seu nome, sua área de acesso - "Admin") e tem uma assinatura especial que prova sua autenticidade. Qualquer tentativa de falsificação é facilmente detectada.

O JWT funciona da mesma forma: é um "crachá digital" que o servidor entrega ao seu navegador após o login.

---

## A Anatomia de um Crachá Digital (JWT)

Um token JWT é um texto longo, dividido em três partes separadas por pontos.

**1. Header (Cabeçalho):** O tipo do crachá.
   - Informa que o token é do tipo `JWT` e qual o algoritmo de assinatura usado (ex: `HS256`). É o "material" do crachá.

**2. Payload (Carga Útil):** As suas credenciais.
   - Contém as "claims" ou informações sobre o usuário, como `userID`, `nome` e, crucialmente, `role: 'admin'`. Essas informações são legíveis por qualquer um, como o texto em um crachá.

---

**3. Signature (Assinatura):** O selo de autenticidade.
   - É uma combinação criptografada do Header, do Payload e de uma **chave secreta** que só o servidor conhece. Garante que o conteúdo do crachá não foi alterado.


![alt text](image.png)

---

## O Fluxo da Autenticação em Ação


<div class="mermaid">
graph LR;
    A[Usuário Admin envia login e senha] --> B{Servidor};
    B -->|Verifica credenciais| C[Gera um JWT com 'role: admin'];
    C --> D[Navegador/Cliente armazena o JWT];
</div>
<div class="mermaid">

graph LR;
    D[Admin clica em 'Apagar Questão'] -->|Requisição com JWT no Header| F{Servidor};
    F -->|Valida a Assinatura do JWT| G[Acesso Autorizado];
    G --> H[Questão polêmica é apagada do banco de dados];
</div>

---

## Armadilhas Comuns: Onde as Coisas Dão Errado

Usar JWTs exige cuidado. Um pequeno erro pode comprometer toda a segurança do sistema.

* **Não guarde segredos no Payload:** O Payload é codificado em Base64, não criptografado. Qualquer pessoa pode decodificá-lo. **Nunca** armazene senhas, chaves de API ou dados sensíveis nele. É como escrever a senha do seu banco no crachá do evento.

* **Proteja a Chave Secreta a todo custo:** A assinatura depende de uma chave que **apenas o servidor** deve conhecer. Se essa chave vazar, um invasor poderá criar seus próprios "crachás VIP" com acesso de administrador. É o equivalente a roubar o carimbo oficial do evento.

---

## Aplicação Prática: Resolvendo a Crise do ENEM

O administrador, com seu crachá digital (JWT) em mãos, precisa fazer uma requisição para apagar a questão de ID `123`.

Ele usa uma ferramenta como o `curl` para enviar o comando `DELETE` ao servidor, incluindo o token no cabeçalho de autorização.

```bash
# O token JWT é longo, então o guardamos em uma variável
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MiIsInJvbGUiOiJhZG1pbiJ9.SECRET_SIGNATURE"

# A requisição para apagar a questão, passando o token no header
curl -X DELETE \
  http://api.enem-ia.com/questions/123 \
  -H "Authorization: Bearer $TOKEN"
```

O servidor valida o `TOKEN`, confirma a `role: 'admin'` e apaga a questão. A crise imediata foi contida.

---


## Evitando Crises com Refinamento de Prompts de IA

Sem recursos para moderação humana ou serviços pagos, a melhor defesa é **fortalecer o prompt** de geração e **filtrar localmente** o resultado.

### Estratégia de Dupla Camada

1. **Prompt de Geração Refinado (Camada 1)**
   - A IA recebe instruções explícitas para **evitar conteúdo sensível, político ou discriminatório**.
   - O tom e contexto são limitados a temas neutros e acadêmicos do ENEM.
   - O modelo é instruído a **rejeitar** pedidos fora desse escopo.

---

### Estratégia de Dupla Camada

2. **Prompt de Verificação (Camada 2)**
   - Após gerar uma questão, outro prompt verifica se há elementos problemáticos.
   - O verificador atua como um “auditor automático”, retornando um alerta caso detecte:
     - linguagem ofensiva,
     - estereótipos de gênero, raça, religião ou classe,
     - insinuações políticas ou morais.

---

## Exemplo de Prompt — Geração Segura

```text
Você é uma IA educacional que cria questões do ENEM. 
Seu objetivo é gerar questões éticas, neutras e adequadas a estudantes do ensino médio.

⚠️ Restrições obrigatórias:
- Não use temas políticos, religiosos ou ideológicos.
- Não inclua linguagem ofensiva, estereótipos ou conteúdo sensível.
- Use sempre um tom didático e respeitoso.
- Gere apenas questões com alternativas objetivas e verificáveis.

Gere uma questão sobre {{matéria}}, nível ENEM, com 4 alternativas e apenas uma correta.
```

---


## Exemplo de Prompt — Verificação Automática

```text
Você é uma IA de verificação de segurança de conteúdo.
Receberá uma questão gerada por outra IA. 
Sua função é identificar se há qualquer problema ético, político ou discriminatório.

Questão:
"{{texto_da_questao}}"

Responda com:
- "APROVADA" se o texto for adequado.
- "REPROVADA" se contiver qualquer linguagem ofensiva, política, religiosa, sexual ou discriminatória.

```

Essa checagem pode ser feita localmente, antes de salvar a questão no banco ou exibir na interface.

----

## Estrutura de Banco de Dados: Armazenamento Correto
Cada questão e alternativa precisa estar vinculada a um autor (usuário) e a um estado automático de revisão.

```sql
-- Extensão do banco EducaEnem com verificação automática de IA

ALTER TABLE questoes
ADD COLUMN autor_id INT NOT NULL,
ADD COLUMN status ENUM('pendente_verificacao', 'aprovada', 'reprovada') DEFAULT 'pendente_verificacao',
ADD FOREIGN KEY (autor_id) REFERENCES usuarios(id);

CREATE TABLE IF NOT EXISTS ia_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    questao_id INT,
    prompt_geracao TEXT NOT NULL,
    resposta_gerada TEXT NOT NULL,
    prompt_verificacao TEXT NOT NULL,
    resultado_verificacao ENUM('APROVADA','REPROVADA') DEFAULT 'APROVADA',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (questao_id) REFERENCES questoes(id) ON DELETE CASCADE
);
```

---

## Enviando Dados com JWT e JSON
O administrador ou script da IA envia a questão e o resultado da verificação em uma única requisição.

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiJ9.SECRET_SIGNATURE"

curl -X POST http://api.enem-ia.com/questions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "area": "Linguagens",
    "materia": "Português",
    "enunciado": "Qual é a função do sujeito em uma oração?",
    "pontuacao": 10.0,
    "ano": 2024,
    "status": "aprovada",
    "alternativas": [
      {"letra": "A", "conteudo": "Indicar quem pratica a ação", "correta": true},
      {"letra": "B", "conteudo": "Indicar o tempo verbal"},
      {"letra": "C", "conteudo": "Explicar o predicado"},
      {"letra": "D", "conteudo": "Introduzir o verbo principal"}
    ]
  }'
```

---


## Reflexão: E Agora?

A questão foi apagada. A crise foi contida, mas o problema foi realmente resolvido?

A autenticação com JWT funcionou como uma ferramenta de emergência, garantindo que apenas a pessoa certa pudesse agir.

Pense sobre o que aconteceu:
* O que a autenticação resolveu? Apenas o **acesso**.
* Qual é o problema mais profundo que a autenticação **não resolveu**?
* Que outras medidas (técnicas ou não) poderiam ser implementadas para evitar que uma crise como essa aconteça novamente no futuro?

---

## Conclusão e Aplicação no Mundo Real

A história do gerador de questões do ENEM, embora fictícia, ilustra um cenário real: sistemas falham, e o acesso controlado é a primeira linha de defesa para gerenciar crises.

O **JWT** é essa defesa. Ele não é apenas um conceito técnico abstrato; é o porteiro digital que decide quem pode entrar e o que pode fazer, garantindo que, quando algo der terrivelmente errado, apenas as pessoas autorizadas tenham as chaves para consertar.

---

## Material Complementar e Referências

* **JWT.io:** Uma ferramenta fantástica para decodificar, verificar e gerar tokens JWT. Essencial para depuração. [https://jwt.io/](https://jwt.io/)
* **Introdução ao JSON Web Tokens:** Um artigo detalhado que cobre os fundamentos e os casos de uso de JWTs. [https://auth0.com/learn/json-web-tokens](https://auth0.com/learn/json-web-tokens)

---

## Referências

[1] SELF, J. W. *Static analysis of code*. Auerbach Publications, 2017.
[2] Mueller, J. P. *Beginning programming with Python*. John Wiley and Sons, 2018.