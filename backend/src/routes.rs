use axum::{
    routing::{get, post},
    Router, Json, Extension,
};
use tower_http::cors::{Any, CorsLayer};
use std::sync::Arc;
use crate::mailer;
use crate::database;
use crate::startup::AppState;

pub fn create_router(state: AppState) -> Router {
    // Configurar CORS para permitir requisições do navegador
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/send-mail", post(mailer::send_mail))
        .route("/db-test", get(test_db))
        .layer(Extension(state.pg_db))
        .layer(cors)
}

async fn test_db(
    Extension(pg_db): Extension<Option<Arc<database::postgres::PostgresManager>>>,
) -> Json<serde_json::Value> {
    match pg_db {
        Some(pg) => {
            match pg.check_connection().await {
                Ok(_) => Json(serde_json::from_str("{\"success\": true, \"message\": \"Conexão com Postgres OK!\"}").unwrap()),
                Err(e) => Json(serde_json::from_str(&format!("{{\"success\": false, \"message\": \"Erro na conexão: {}\"}}", e)).unwrap()),
            }
        }
        None => Json(serde_json::from_str("{\"success\": false, \"message\": \"Postgres não inicializado\"}").unwrap()),
    }
}
