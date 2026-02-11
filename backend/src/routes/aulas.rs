use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use crate::startup::AppState;
use crate::database::models::{NewAula};
use serde::Deserialize;
use std::fs;
use std::process::Command;

#[derive(Deserialize)]
pub struct AulaQuery {
    pub turma_id: i32,
    pub senha: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateAulaRequest {
    pub turma_id: i32,
    pub titulo: String,
    pub caminho: Option<String>,
    pub icone: Option<String>,
    pub descricao: Option<String>,
    pub ordem: i32,
    pub markdown: Option<String>,
}

fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
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
    Json(payload): Json<CreateAulaRequest>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized").into_response(),
    };

    let mut final_caminho = payload.caminho.unwrap_or_default();

    if let Some(md_content) = payload.markdown {
        let slug = slugify(&payload.titulo);
        let base_dir = "/app/frontend_static/turmas/aulas";
        
        if let Err(e) = fs::create_dir_all(base_dir) {
             return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directory: {}", e)).into_response();
        }

        let md_path = format!("{}/{}.md", base_dir, slug);
        let html_path = format!("{}/{}.html", base_dir, slug);
        
        // Inject Mermaid support
        let mut md_content_with_mermaid = md_content.clone();
        if !md_content_with_mermaid.contains("mermaid.initialize") {
             md_content_with_mermaid.push_str("\n\n<script type=\"module\">\n  import mermaid from \"https://esm.sh/mermaid@10\";\n  mermaid.initialize({ startOnLoad: true, theme: 'default' });\n</script>");
        }

        if let Err(e) = fs::write(&md_path, md_content_with_mermaid) {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write MD file: {}", e)).into_response();
        }

        // Run marp
        let output = Command::new("marp")
            .arg(&md_path)
            .arg("--html")
            .arg("-o")
            .arg(&html_path)
            .output();

        match output {
            Ok(out) => {
                if !out.status.success() {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    return (StatusCode::INTERNAL_SERVER_ERROR, format!("Marp failed: {}", stderr)).into_response();
                }
            }
            Err(e) => {
                return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to execute marp: {}", e)).into_response();
            }
        }

        final_caminho = format!("turmas/aulas/{}.html", slug);
    }

    let new_aula = NewAula {
        turma_id: payload.turma_id,
        titulo: payload.titulo,
        caminho: final_caminho,
        icone: payload.icone,
        descricao: payload.descricao,
        ordem: payload.ordem,
    };

    match pg.create_aula(new_aula).await {
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
