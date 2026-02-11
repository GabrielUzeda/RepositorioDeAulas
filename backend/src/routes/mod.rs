use axum::{
    routing::{get, post},
    Router, Json, extract::State,
    middleware,
};
use tower_http::cors::{Any, CorsLayer};
use crate::mailer;
use crate::startup::AppState;
use crate::auth;

pub mod turmas;
pub mod aulas;
pub mod atividades;

pub fn create_router(state: AppState) -> Router {
    // Configurar CORS para permitir requisições do navegador
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Rotas protegidas (Apenas Professor)
    let admin_routes = Router::new()
        .route("/turmas", post(turmas::create_turma))
        .route("/turmas/:id", post(turmas::update_turma).delete(turmas::delete_turma)) // Usando POST para update em alguns casos ou PUT
        .route("/turmas/:id", axum::routing::put(turmas::update_turma))
        
        .route("/aulas", post(aulas::create_aula))
        .route("/aulas/:id", axum::routing::put(aulas::update_aula).delete(aulas::delete_aula))
        
        .route("/atividades", post(atividades::create_atividade))
        .route("/atividades/:id", axum::routing::put(atividades::update_atividade).delete(atividades::delete_atividade))
        .layer(middleware::from_fn(auth::professor_auth));

    Router::new()
        .route("/send-mail", post(mailer::send_mail))
        .route("/db-test", get(test_db))
        
        // Rotas Públicas de Turmas
        .route("/turmas", get(turmas::list_turmas))
        .route("/turmas/:id", get(turmas::get_turma))
        
        // Rotas de Aulas/Atividades (Protegidas por senha da turma via Handler)
        .route("/aulas", get(aulas::list_aulas))
        .route("/aulas/:id", get(aulas::get_aula))
        .route("/atividades", get(atividades::list_atividades))
        .route("/atividades/:id", get(atividades::get_atividade))
        
        .merge(admin_routes)
        .with_state(state)
        .layer(cors)
}

async fn test_db(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    match &state.pg_db {
        Some(pg) => {
            match pg.check_connection().await {
                Ok(_) => Json(serde_json::from_str("{\"success\": true, \"message\": \"Conexão com Postgres OK!\"}").unwrap()),
                Err(e) => Json(serde_json::from_str(&format!("{{\"success\": false, \"message\": \"Erro na conexão: {}\"}}", e)).unwrap()),
            }
        }
        None => Json(serde_json::from_str("{\"success\": false, \"message\": \"Postgres não inicializado\"}").unwrap()),
    }
}
