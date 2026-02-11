use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::startup::AppState;
use crate::database::models::{NewTurma, TurmaPublica};

pub async fn list_turmas(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.list_turmas().await {
        Ok(turmas) => {
            let public_turmas: Vec<TurmaPublica> = turmas.into_iter().map(TurmaPublica::from).collect();
            Json(public_turmas).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn get_turma(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.get_turma(id).await {
        Ok(Some(turma)) => Json(turma).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Turma not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn create_turma(
    State(state): State<AppState>,
    Json(payload): Json<NewTurma>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.create_turma(payload).await {
        Ok(turma) => (StatusCode::CREATED, Json(turma)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn update_turma(
    Path(id): Path<i32>,
    State(state): State<AppState>,
    Json(payload): Json<NewTurma>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.update_turma(id, payload).await {
        Ok(turma) => Json(turma).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

pub async fn delete_turma(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    match pg.delete_turma(id).await {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}
