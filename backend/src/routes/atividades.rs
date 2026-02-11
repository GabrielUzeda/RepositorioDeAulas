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

pub async fn get_atividade(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.get_atividade(id).await {
        Ok(Some(atv)) => Json(atv).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Atividade not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn create_atividade(
    State(state): State<AppState>,
    Json(payload): Json<NewAtividade>,
) -> impl IntoResponse {
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
    Json(payload): Json<NewAtividade>,
) -> impl IntoResponse {
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
