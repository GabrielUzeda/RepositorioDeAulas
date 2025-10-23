# 📚 Academic LMS API Documentation

API REST completa para o sistema acadêmico com sistema de notas otimizado.

## 🚀 Servidor

- **URL Base**: `http://localhost:8080`
- **Formato**: JSON
- **Autenticação**: Por enquanto sem autenticação (TODO: implementar JWT)

## 📋 Respostas Padrão

Todas as respostas seguem o formato:
```json
{
  "success": boolean,
  "message": "string (opcional)",
  "...dados específicos..."
}
```

## 🔐 Autenticação

### POST `/auth/login`
Autenticar usuário no sistema.

**Request:**
```json
{
  "usuario": "string",
  "senha": "string"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso!",
  "usuario": {
    "id": "uuid",
    "usuario": "string",
    "nome": "string",
    "cargo": "aluno|professor|admin",
    "turmas": ["string"],
    "criado_em": 1234567890,
    "atualizado_em": 1234567890
  }
}
```

## 📖 Turmas

### GET `/turmas`
Listar todas as turmas disponíveis.

**Response:**
```json
{
  "success": true,
  "turmas": [
    {
      "id": "string",
      "nome": "Turma A - 2025/2",
      "cor": "#FF5733",
      "icone": "book",
      "criado_em": 1234567890,
      "atualizado_em": 1234567890
    }
  ]
}
```

### POST `/turmas`
Criar uma nova turma.

**Request:**
```json
{
  "nome": "Turma B - 2025/2",
  "cor": "#33FF57",
  "icone": "graduation-cap"
}
```

### GET `/turmas/:turma_id`
Obter detalhes de uma turma específica.

## 📝 Atividades

### GET `/turmas/:turma_id/atividades`
Listar atividades de uma turma.

### POST `/atividades`
Criar uma nova atividade.

**Request:**
```json
{
  "titulo": "Atividade de Programação",
  "descricao": "Resolver exercícios de algoritmos",
  "caminho": "/atividades/programacao",
  "icone": "code",
  "turma_id": "uuid-da-turma",
  "aulas_relacionadas": ["aula1", "aula2"]
}
```

### GET `/atividades/:atividade_id`
Obter detalhes de uma atividade.

## ❓ Perguntas

### GET `/atividades/:atividade_id/perguntas`
Listar perguntas de uma atividade.

### POST `/perguntas`
Criar uma nova pergunta.

**Request:**
```json
{
  "atividade_id": "uuid-da-atividade",
  "enunciado": "Qual é a capital do Brasil?",
  "pontos": 10.0,
  "ordem": 1
}
```

## ✍️ Respostas (Fluxo do Aluno)

### POST `/respostas`
Submeter uma resposta para uma pergunta.

**Request:**
```json
{
  "pergunta_id": "uuid-da-pergunta",
  "atividade_id": "uuid-da-atividade",
  "conteudo": "Brasília",
  "is_submitted": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Resposta submetida com sucesso",
  "resposta_id": "uuid-da-resposta"
}
```

### GET `/atividades/:atividade_id/alunos/:aluno_id/respostas`
Obter respostas de um aluno para uma atividade.

## ✅ Avaliação (Fluxo do Professor)

### POST `/avaliacao/grade`
Avaliar uma resposta (aciona worker assíncrono).

**Request:**
```json
{
  "resposta_id": "uuid-da-resposta",
  "valor": 8.5,
  "feedback": "Ótima resposta, mas faltou explicar melhor.",
  "origem": "manual"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Nota atribuída com sucesso",
  "nota_id": "uuid-da-nota"
}
```

## 📊 Notas e Relatórios

### GET `/atividades/:atividade_id/alunos/:aluno_id/nota`
Obter nota agregada pré-calculada (otimizada).

**Response:**
```json
{
  "success": true,
  "nota_agregada": {
    "id": "uuid",
    "aluno_id": "uuid",
    "atividade_id": "uuid",
    "soma_pontos_obtidos": 25.5,
    "soma_pontos_possiveis": 30.0,
    "percentual": 85.0,
    "calculado_em": 1234567890,
    "calculo_origem": "async_worker"
  }
}
```

### GET `/atividades/:atividade_id/alunos/:aluno_id/calcular-nota`
Calcular nota dinâmica em tempo real (mais lento).

## 💬 Feedback

### POST `/feedback`
Criar feedback para uma atividade.

**Request:**
```json
{
  "atividade_id": "uuid-da-atividade",
  "comentario": "Excelente atividade! Aprendi muito sobre algoritmos.",
  "publico": true
}
```

## 📧 Email (Compatibilidade)

### POST `/send-mail`
Enviar email (funcionalidade herdada).

## 🔄 Fluxo Completo de Uso

1. **Login**: `POST /auth/login`
2. **Explorar**: `GET /turmas` → `GET /turmas/:id/atividades`
3. **Estudar**: `GET /atividades/:id/perguntas`
4. **Responder**: `POST /respostas` (repetir para cada pergunta)
5. **Avaliar**: `POST /avaliacao/grade` (professor)
6. **Ver Resultado**: `GET /atividades/:id/alunos/:id/nota`
7. **Feedback**: `POST /feedback`

## ⚡ Otimizações de Performance

- **Worker Assíncrono**: Avaliações não bloqueiam o usuário
- **Índices LMDB**: Consultas de agregados usam índices dedicados
- **Fallback Síncrono**: Garante funcionamento mesmo com sobrecarga
- **Atomicidade**: Índices criados na mesma transação das notas

## 🧪 Exemplos de Teste

### Criar Turma
```bash
curl -X POST http://localhost:8080/turmas \
  -H "Content-Type: application/json" \
  -d '{"nome": "Turma Teste", "cor": "#FF5733", "icone": "book"}'
```

### Criar Atividade
```bash
curl -X POST http://localhost:8080/atividades \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Atividade de Teste",
    "descricao": "Testar a API",
    "caminho": "/teste",
    "icone": "test",
    "turma_id": "turma_teste_1234567890",
    "aulas_relacionadas": []
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin", "senha": "admin123"}'
```
