use axum::{routing::{post, get, put, delete}, Router, Json, Extension, http::HeaderMap};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::database::DatabaseManager;
use crate::database::models::*;

// ========== STRUCTS DE REQUEST/RESPONSE ==========

// Auth
#[derive(Deserialize)]
pub struct LoginRequest {
    pub usuario: String,
    pub senha: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub usuario: Option<Usuario>,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub usuario: String,
    pub senha: String,
    pub nome: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub success: bool,
    pub message: String,
    pub usuario_id: Option<String>,
}

// Turmas
#[derive(Serialize)]
pub struct TurmasResponse {
    pub success: bool,
    pub turmas: Vec<Turma>,
}

#[derive(Deserialize)]
pub struct CreateTurmaRequest {
    pub nome: String,
    pub cor: String,
    pub icone: String,
}

// Atividades
#[derive(Serialize)]
pub struct AtividadesResponse {
    pub success: bool,
    pub atividades: Vec<Atividade>,
}

#[derive(Deserialize)]
pub struct CreateAtividadeRequest {
    pub titulo: String,
    pub descricao: String,
    pub caminho: String,
    pub icone: String,
    pub turma_id: String,
    pub aulas_relacionadas: Vec<String>,
}

// Perguntas
#[derive(Serialize)]
pub struct PerguntasResponse {
    pub success: bool,
    pub perguntas: Vec<Pergunta>,
}

#[derive(Deserialize)]
pub struct CreatePerguntaRequest {
    pub atividade_id: String,
    pub enunciado: String,
    pub pontos: f64,
    pub ordem: i32,
}

// Respostas
#[derive(Serialize)]
pub struct RespostasResponse {
    pub success: bool,
    pub respostas: Vec<Resposta>,
}

#[derive(Deserialize)]
pub struct SubmitRespostaRequest {
    pub pergunta_id: String,
    pub atividade_id: String,
    pub conteudo: String,
    pub is_submitted: bool,
}

// Avaliação/Notas
#[derive(Deserialize)]
pub struct GradeRespostaRequest {
    pub resposta_id: String,
    pub valor: f64,
    pub feedback: Option<String>,
    pub origem: String,
}

#[derive(Serialize)]
pub struct GradeResponse {
    pub success: bool,
    pub message: String,
    pub nota_id: Option<String>,
}

#[derive(Serialize)]
pub struct NotaAgregadaResponse {
    pub success: bool,
    pub nota_agregada: Option<NotaAtividadeAluno>,
}

// Feedback
#[derive(Deserialize)]
pub struct CreateFeedbackRequest {
    pub atividade_id: String,
    pub comentario: String,
    pub publico: bool,
}

#[derive(Serialize)]
pub struct FeedbackResponse {
    pub success: bool,
    pub message: String,
    pub feedback_id: Option<String>,
}

// Solicitações de Turma
#[derive(Serialize)]
pub struct SolicitacoesResponse {
    pub success: bool,
    pub solicitacoes: Vec<crate::database::models::SolicitacaoTurma>,
}

#[derive(Deserialize)]
pub struct SolicitarEntradaRequest {
    pub mensagem: Option<String>,
}

// ========== HELPERS ==========

fn get_current_user(headers: &HeaderMap) -> Result<String, String> {
    if let Some(auth_header) = headers.get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            // Espera formato "Bearer <usuario>" ou apenas "<usuario>"
            if auth_str.starts_with("Bearer ") {
                Ok(auth_str[7..].to_string())
            } else {
                Ok(auth_str.to_string())
            }
        } else {
            Err("Header de autorização inválido".to_string())
        }
    } else {
        Err("Header de autorização não encontrado".to_string())
    }
}

// ========== HANDLERS ==========

// ========== AUTH ==========
pub async fn login(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<LoginRequest>,
) -> Json<serde_json::Value> {
    match db.authenticate_usuario(&req.usuario, &req.senha) {
        Ok(Some(usuario)) => Json(serde_json::json!({
            "success": true,
            "message": "Login realizado com sucesso!",
            "usuario": usuario
        })),
        Ok(None) => Json(serde_json::json!({
            "success": false,
            "message": "Usuário ou senha incorretos"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro interno: {}", e)
        })),
    }
}

pub async fn register(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<RegisterRequest>,
) -> Json<serde_json::Value> {
    // Apenas alunos podem se cadastrar via API - professores/admins são criados via BD
    let cargo = Cargo::Aluno;
    let turmas = Vec::new(); // Alunos começam sem turmas - solicitam entrada depois

    match db.create_usuario(&req.usuario, &req.senha, &req.nome, cargo, turmas) {
        Ok(usuario_id) => Json(serde_json::json!({
            "success": true,
            "message": "Usuário cadastrado com sucesso! Agora você pode solicitar entrada nas turmas.",
            "usuario_id": usuario_id
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao cadastrar usuário: {}", e)
        })),
    }
}

// ========== TURMAS ==========
pub async fn get_turmas(
    Extension(db): Extension<Arc<DatabaseManager>>,
) -> Json<serde_json::Value> {
    match db.list_turmas() {
        Ok(turmas) => Json(serde_json::json!({
            "success": true,
            "turmas": turmas
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao listar turmas: {}", e),
            "turmas": []
        })),
    }
}

pub async fn create_turma(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<CreateTurmaRequest>,
) -> Json<serde_json::Value> {
    let turma_id = format!("turma_{}", chrono::Utc::now().timestamp());

    match db.create_turma(&turma_id, &req.nome, &req.cor, &req.icone) {
        Ok(_) => match db.list_turmas() {
            Ok(turmas) => Json(serde_json::json!({
                "success": true,
                "message": "Turma criada com sucesso",
                "turma_id": turma_id,
                "turmas": turmas
            })),
            Err(e) => Json(serde_json::json!({
                "success": false,
                "message": format!("Turma criada mas erro ao listar: {}", e)
            })),
        },
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao criar turma: {}", e)
        })),
    }
}

pub async fn get_turma(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path(turma_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    match db.get_turma(&turma_id) {
        Ok(Some(turma)) => Json(serde_json::json!({
            "success": true,
            "turma": turma
        })),
        Ok(None) => Json(serde_json::json!({
            "success": false,
            "message": "Turma não encontrada"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro: {}", e)
        })),
    }
}

// ========== ATIVIDADES ==========
pub async fn get_atividades_by_turma(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path(turma_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    match db.get_atividades_by_turma(&turma_id) {
        Ok(atividades) => Json(serde_json::json!({
            "success": true,
            "atividades": atividades
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao listar atividades: {}", e),
            "atividades": []
        })),
    }
}

pub async fn create_atividade(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<CreateAtividadeRequest>,
) -> Json<serde_json::Value> {
    match db.create_atividade(
        &req.titulo,
        &req.descricao,
        &req.caminho,
        &req.icone,
        &req.turma_id,
        req.aulas_relacionadas,
    ) {
        Ok(atividade_id) => match db.get_atividades_by_turma(&req.turma_id) {
            Ok(atividades) => Json(serde_json::json!({
                "success": true,
                "message": "Atividade criada com sucesso",
                "atividade_id": atividade_id,
                "atividades": atividades
            })),
            Err(e) => Json(serde_json::json!({
                "success": false,
                "message": format!("Atividade criada mas erro ao listar: {}", e)
            })),
        },
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao criar atividade: {}", e)
        })),
    }
}

pub async fn get_atividade(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path(atividade_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    match db.get_atividade(&atividade_id) {
        Ok(Some(atividade)) => Json(serde_json::json!({
            "success": true,
            "atividade": atividade
        })),
        Ok(None) => Json(serde_json::json!({
            "success": false,
            "message": "Atividade não encontrada"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro: {}", e)
        })),
    }
}

// ========== PERGUNTAS ==========
pub async fn get_perguntas_by_atividade(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path(atividade_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    match db.list_perguntas_by_atividade(&atividade_id) {
        Ok(perguntas) => Json(serde_json::json!({
            "success": true,
            "perguntas": perguntas
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao listar perguntas: {}", e),
            "perguntas": []
        })),
    }
}

pub async fn create_pergunta(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<CreatePerguntaRequest>,
) -> Json<serde_json::Value> {
    match db.create_pergunta(&req.atividade_id, &req.enunciado, req.pontos, req.ordem) {
        Ok(pergunta_id) => match db.list_perguntas_by_atividade(&req.atividade_id) {
            Ok(perguntas) => Json(serde_json::json!({
                "success": true,
                "message": "Pergunta criada com sucesso",
                "pergunta_id": pergunta_id,
                "perguntas": perguntas
            })),
            Err(e) => Json(serde_json::json!({
                "success": false,
                "message": format!("Pergunta criada mas erro ao listar: {}", e)
            })),
        },
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao criar pergunta: {}", e)
        })),
    }
}

// ========== RESPOSTAS ==========
pub async fn submit_resposta(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<SubmitRespostaRequest>,
) -> Json<serde_json::Value> {
    // TODO: obter aluno_id do contexto de autenticação
    // Por enquanto vamos usar um ID fixo para teste
    let aluno_id = "aluno_teste";

    match db.submit_resposta(&req.pergunta_id, &req.atividade_id, aluno_id, &req.conteudo, req.is_submitted) {
        Ok(resposta_id) => Json(serde_json::json!({
            "success": true,
            "message": "Resposta submetida com sucesso",
            "resposta_id": resposta_id
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao submeter resposta: {}", e)
        })),
    }
}

pub async fn get_respostas_by_atividade_aluno(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path((atividade_id, aluno_id)): axum::extract::Path<(String, String)>,
) -> Json<serde_json::Value> {
    match db.list_respostas_by_atividade_aluno(&atividade_id, &aluno_id) {
        Ok(respostas) => Json(serde_json::json!({
            "success": true,
            "respostas": respostas
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao listar respostas: {}", e),
            "respostas": []
        })),
    }
}

// ========== AVALIAÇÃO/NOTAS ==========
pub async fn grade_resposta(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<GradeRespostaRequest>,
) -> Json<serde_json::Value> {
    // TODO: obter professor_id do contexto de autenticação
    // Por enquanto vamos usar um ID fixo para teste
    let professor_id = Some("professor_teste");

    match db.grade_resposta(&req.resposta_id, professor_id.as_deref(), req.valor, req.feedback.as_deref(), &req.origem, None) {
        Ok(nota_id) => Json(serde_json::json!({
            "success": true,
            "message": "Nota atribuída com sucesso",
            "nota_id": nota_id
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao atribuir nota: {}", e)
        })),
    }
}

pub async fn get_nota_agregada(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path((atividade_id, aluno_id)): axum::extract::Path<(String, String)>,
) -> Json<serde_json::Value> {
    match db.get_aggregate_nota_atividade(&atividade_id, &aluno_id) {
        Ok(nota_agregada) => Json(serde_json::json!({
            "success": true,
            "nota_agregada": nota_agregada
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao obter nota agregada: {}", e)
        })),
    }
}

pub async fn calculate_nota_atividade(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path((atividade_id, aluno_id)): axum::extract::Path<(String, String)>,
) -> Json<serde_json::Value> {
    match db.calculate_nota_atividade_dynamic(&atividade_id, &aluno_id) {
        Ok(nota_agregada) => Json(serde_json::json!({
            "success": true,
            "nota_agregada": nota_agregada
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao calcular nota: {}", e)
        })),
    }
}

// ========== FEEDBACK ==========
pub async fn create_feedback(
    Extension(db): Extension<Arc<DatabaseManager>>,
    Json(req): Json<CreateFeedbackRequest>,
) -> Json<serde_json::Value> {
    // TODO: obter aluno_id e professor_id do contexto de autenticação
    // Por enquanto vamos usar IDs fixos para teste
    let aluno_id = "aluno_teste";
    let professor_id = Some("professor_teste");

    match db.create_feedback_atividade(&req.atividade_id, aluno_id, professor_id.as_deref(), &req.comentario, req.publico) {
        Ok(feedback_id) => Json(serde_json::json!({
            "success": true,
            "message": "Feedback criado com sucesso",
            "feedback_id": feedback_id
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao criar feedback: {}", e)
        })),
    }
}

// ========== SOLICITAÇÕES DE TURMA ==========
pub async fn solicitar_entrada_turma(
    Extension(db): Extension<Arc<DatabaseManager>>,
    headers: HeaderMap,
    axum::extract::Path(turma_id): axum::extract::Path<String>,
    Json(req): Json<SolicitarEntradaRequest>,
) -> Json<serde_json::Value> {
    // Obter usuário atual da autenticação
    let aluno_id = match get_current_user(&headers) {
        Ok(user) => user,
        Err(e) => return Json(serde_json::json!({
            "success": false,
            "message": format!("Erro de autenticação: {}", e)
        })),
    };

    match db.criar_solicitacao_turma(&aluno_id, &turma_id, req.mensagem.as_deref()) {
        Ok(solicitacao_id) => Json(serde_json::json!({
            "success": true,
            "message": "Solicitação de entrada enviada com sucesso",
            "solicitacao_id": solicitacao_id
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao solicitar entrada: {}", e)
        })),
    }
}

pub async fn listar_solicitacoes_turma(
    Extension(db): Extension<Arc<DatabaseManager>>,
    axum::extract::Path(turma_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    match db.listar_solicitacoes_turma(&turma_id) {
        Ok(solicitacoes) => Json(serde_json::json!({
            "success": true,
            "solicitacoes": solicitacoes
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao listar solicitações: {}", e),
            "solicitacoes": []
        })),
    }
}

pub async fn aprovar_solicitacao(
    Extension(db): Extension<Arc<DatabaseManager>>,
    headers: HeaderMap,
    axum::extract::Path(solicitacao_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    // Obter usuário atual da autenticação
    let professor_id = match get_current_user(&headers) {
        Ok(user) => user,
        Err(e) => return Json(serde_json::json!({
            "success": false,
            "message": format!("Erro de autenticação: {}", e)
        })),
    };

    match db.aprovar_solicitacao(&solicitacao_id, &professor_id) {
        Ok(_) => Json(serde_json::json!({
            "success": true,
            "message": "Solicitação aprovada com sucesso"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao aprovar solicitação: {}", e)
        })),
    }
}

pub async fn rejeitar_solicitacao(
    Extension(db): Extension<Arc<DatabaseManager>>,
    headers: HeaderMap,
    axum::extract::Path(solicitacao_id): axum::extract::Path<String>,
) -> Json<serde_json::Value> {
    // Obter usuário atual da autenticação
    let professor_id = match get_current_user(&headers) {
        Ok(user) => user,
        Err(e) => return Json(serde_json::json!({
            "success": false,
            "message": format!("Erro de autenticação: {}", e)
        })),
    };

    match db.rejeitar_solicitacao(&solicitacao_id, &professor_id) {
        Ok(_) => Json(serde_json::json!({
            "success": true,
            "message": "Solicitação rejeitada com sucesso"
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao rejeitar solicitação: {}", e)
        })),
    }
}

pub async fn listar_minhas_solicitacoes(
    Extension(db): Extension<Arc<DatabaseManager>>,
    headers: HeaderMap,
) -> Json<serde_json::Value> {
    // Obter usuário atual da autenticação
    let aluno_id = match get_current_user(&headers) {
        Ok(user) => user,
        Err(e) => return Json(serde_json::json!({
            "success": false,
            "message": format!("Erro de autenticação: {}", e),
            "solicitacoes": []
        })),
    };

    match db.listar_minhas_solicitacoes(&aluno_id) {
        Ok(solicitacoes) => Json(serde_json::json!({
            "success": true,
            "solicitacoes": solicitacoes
        })),
        Err(e) => Json(serde_json::json!({
            "success": false,
            "message": format!("Erro ao listar solicitações: {}", e),
            "solicitacoes": []
        })),
    }
}

// ========== CONFIGURAÇÃO DAS ROTAS ==========
// API REST completa para o sistema acadêmico LMS
//
// 📚 FLUXO TÍPICO DE USO:
// 1. POST /auth/register → cadastrar novo usuário
// 2. POST /auth/login → obter autenticação
// 3. GET /turmas → listar turmas disponíveis
// 4. POST /turmas → criar nova turma (admin/professor)
// 5. GET /turmas/:id/atividades → ver atividades da turma
// 6. POST /atividades → criar nova atividade
// 7. GET /atividades/:id/perguntas → ver perguntas da atividade
// 8. POST /perguntas → criar pergunta na atividade
// 9. POST /respostas → aluno submete resposta
// 10. POST /avaliacao/grade → professor avalia resposta
// 11. GET /atividades/:id/alunos/:id/nota → ver nota agregada
// 12. POST /feedback → criar feedback da atividade
//
// 🔧 TODOS OS ENDPOINTS RETORNAM JSON COM {success: boolean, ...}
pub fn create_router(db: Arc<DatabaseManager>) -> Router {
    Router::new()
        // 🔐 AUTENTICAÇÃO
        .route("/auth/login", post(login))
        .route("/auth/register", post(register))

        // 📖 TURMAS (CRUD básico)
        .route("/turmas", get(get_turmas))                    // GET: listar todas
        .route("/turmas", post(create_turma))                 // POST: criar nova
        .route("/turmas/:turma_id", get(get_turma))           // GET: detalhes de uma turma

        // 📝 SOLICITAÇÕES DE TURMA
        .route("/turmas/:turma_id/solicitar-entrada", post(solicitar_entrada_turma)) // POST: aluno solicita entrada
        .route("/turmas/:turma_id/solicitacoes", get(listar_solicitacoes_turma))     // GET: professor vê solicitações
        .route("/solicitacoes/:solicitacao_id/aprovar", post(aprovar_solicitacao))   // POST: professor aprova
        .route("/solicitacoes/:solicitacao_id/rejeitar", post(rejeitar_solicitacao)) // POST: professor rejeita
        .route("/minhas-solicitacoes", get(listar_minhas_solicitacoes))             // GET: aluno vê suas solicitações

        // 📝 ATIVIDADES
        .route("/turmas/:turma_id/atividades", get(get_atividades_by_turma)) // GET: atividades da turma
        .route("/atividades", post(create_atividade))           // POST: criar atividade
        .route("/atividades/:atividade_id", get(get_atividade)) // GET: detalhes da atividade

        // ❓ PERGUNTAS
        .route("/atividades/:atividade_id/perguntas", get(get_perguntas_by_atividade)) // GET: perguntas da atividade
        .route("/perguntas", post(create_pergunta))             // POST: criar pergunta

        // ✍️ RESPOSTAS (fluxo do aluno)
        .route("/respostas", post(submit_resposta))            // POST: submeter resposta
        .route("/atividades/:atividade_id/alunos/:aluno_id/respostas", get(get_respostas_by_atividade_aluno)) // GET: respostas do aluno

        // ✅ AVALIAÇÃO (fluxo do professor)
        .route("/avaliacao/grade", post(grade_resposta))       // POST: avaliar resposta (worker assíncrono)

        // 📊 NOTAS E RELATÓRIOS
        .route("/atividades/:atividade_id/alunos/:aluno_id/nota", get(get_nota_agregada)) // GET: nota agregada (pré-calculada)
        .route("/atividades/:atividade_id/alunos/:aluno_id/calcular-nota", get(calculate_nota_atividade)) // GET: calcular nota dinâmica

        // 💬 FEEDBACK
        .route("/feedback", post(create_feedback))             // POST: criar feedback da atividade

        // 📧 EMAIL (compatibilidade)
        .route("/send-mail", post(crate::mailer::send_mail))

        .layer(Extension(db))
}
