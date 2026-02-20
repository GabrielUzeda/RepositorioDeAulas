use axum::{
    extract::{Path, State},
    Json,
    http::StatusCode,
};
use crate::startup::AppState;
use crate::database::models::{NewRanking, Ranking};

pub async fn create_ranking(
    State(state): State<AppState>,
    Json(payload): Json<NewRanking>,
) -> Result<Json<Ranking>, (StatusCode, String)> {
    if let Some(pg) = &state.pg_db {
        match pg.create_ranking(payload).await {
            Ok(ranking) => Ok(Json(ranking)),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao criar ranking: {}", e))),
        }
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, "Banco de dados não disponível".to_string()))
    }
}

pub async fn list_ranking(
    State(state): State<AppState>,
    Path(atividade_id): Path<i32>,
) -> Result<Json<Vec<Ranking>>, (StatusCode, String)> {
    if let Some(pg) = &state.pg_db {
        match pg.list_ranking(atividade_id).await {
            Ok(rankings) => Ok(Json(rankings)),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Erro ao listar ranking: {}", e))),
        }
    } else {
        Err((StatusCode::SERVICE_UNAVAILABLE, "Banco de dados não disponível".to_string()))
    }
}
