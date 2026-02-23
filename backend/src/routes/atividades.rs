use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::startup::AppState;
use crate::database::models::{NewAtividade};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct AtividadeQuery {
    pub turma_id: i32,
    pub senha: Option<String>,
}

pub async fn list_atividades(
    Query(query): Query<AtividadeQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    // Validar senha da turma
    match pg.get_turma(query.turma_id).await {
        Ok(Some(turma)) => {
            if turma.senha != query.senha {
                return (StatusCode::UNAUTHORIZED, "Senha da turma incorreta").into_response();
            }
        }
        Ok(None) => return (StatusCode::NOT_FOUND, "Turma não encontrada").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }

    match pg.list_atividades(Some(query.turma_id)).await {
        Ok(atividades) => Json(atividades).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

#[derive(Deserialize)]
pub struct GetAtividadeQuery {
    pub senha: Option<String>,
}

pub async fn get_atividade(
    Path(id): Path<i32>,
    Query(query): Query<GetAtividadeQuery>,
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    // 1. Fetch Atividade
    let mut atv = match pg.get_atividade(id).await {
        Ok(Some(a)) => a,
        Ok(None) => return (StatusCode::NOT_FOUND, "Atividade not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    };

    // 2. Professor Auth Bypass
    let prof_pass = std::env::var("PROFESSOR_PASSWORD").unwrap_or_else(|_| "admin123".to_string());
    if let Some(header_pass) = headers.get("X-Professor-Password") {
        if let Ok(p) = header_pass.to_str() {
            if p == prof_pass {
                return Json(atv).into_response(); // Professor has full access
            }
        }
    }

    // 3. Fetch Turma for context
    let turma = match pg.get_turma(atv.turma_id).await {
        Ok(Some(t)) => t,
        Ok(None) => return (StatusCode::INTERNAL_SERVER_ERROR, "Turma not found for activity").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    };

    // 4. Student Auth Logic
    let input_senha = query.senha.as_deref().unwrap_or("");
    let turma_senha = turma.senha.as_deref().unwrap_or("");
    let atv_senha = atv.senha.as_deref().unwrap_or("");
    let is_protected = atv.allow_password.unwrap_or(false);

    if input_senha == atv_senha && is_protected {
        // Authenticated with specific Activity Password -> Full Access
        return Json(atv).into_response();
    } else if input_senha == turma_senha {
        // Authenticated with Class Password
        if is_protected {
            // Protected activity -> Return Metadata ONLY (Redact JSON)
            atv.json_data = None;
            // Optionally redact other sensitive fields if any
        }
        return Json(atv).into_response();
    } else {
         // Invalid password
         return (StatusCode::UNAUTHORIZED, "Senha incorreta").into_response();
    }
}

pub async fn create_atividade(
    State(state): State<AppState>,
    Json(mut payload): Json<NewAtividade>,
) -> impl IntoResponse {
    if let Some(ext_id) = &payload.external_id {
        payload.external_id = Some(crate::utils::sanitize_slug(ext_id));
    }
    payload.caminho = crate::utils::sanitize_path_or_url(&payload.caminho);

    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.create_atividade(payload).await {
        Ok(atv) => (StatusCode::CREATED, Json(atv)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn update_atividade(
    Path(id): Path<i32>,
    State(state): State<AppState>,
    Json(mut payload): Json<NewAtividade>,
) -> impl IntoResponse {
    if let Some(ext_id) = &payload.external_id {
        payload.external_id = Some(crate::utils::sanitize_slug(ext_id));
    }
    payload.caminho = crate::utils::sanitize_path_or_url(&payload.caminho);

    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.update_atividade(id, payload).await {
        Ok(atv) => Json(atv).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn delete_atividade(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.delete_atividade(id).await {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}
