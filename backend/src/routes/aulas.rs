use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::startup::AppState;
use crate::database::models::{NewAula};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct AulaQuery {
    pub turma_id: i32,
    pub senha: Option<String>,
}

pub async fn list_aulas(
    Query(query): Query<AulaQuery>,
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

    match pg.list_aulas(Some(query.turma_id)).await {
        Ok(aulas) => Json(aulas).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn get_aula(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.get_aula(id).await {
        Ok(Some(aula)) => Json(aula).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Aula not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn create_aula(
    State(state): State<AppState>,
    Json(payload): Json<NewAula>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.create_aula(payload).await {
        Ok(aula) => (StatusCode::CREATED, Json(aula)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn update_aula(
    Path(id): Path<i32>,
    State(state): State<AppState>,
    Json(payload): Json<NewAula>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.update_aula(id, payload).await {
        Ok(aula) => Json(aula).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn delete_aula(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.delete_aula(id).await {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}
