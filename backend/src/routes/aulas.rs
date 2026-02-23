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
use regex::Regex;

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
    #[serde(alias = "conteudo_md")]
    pub markdown: Option<String>,
}

// Removed local slugify in favor of crate::utils::sanitize_slug

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
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized".to_string()).into_response(),
    };

    let mut final_caminho = crate::utils::sanitize_path_or_url(&payload.caminho.clone().unwrap_or_default());
    let conteudo_md = payload.markdown.clone();

    let turma_slug = match pg.get_turma(payload.turma_id).await {
        Ok(Some(turma)) => turma.slug,
        Ok(None) => return (StatusCode::NOT_FOUND, "Turma not found".to_string()).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    };

    if let Some(md_content) = &payload.markdown {
        match process_marp_content(&turma_slug, &payload.titulo, md_content) {
            Ok(caminho) => final_caminho = caminho,
            Err(e) => return e.into_response(),
        }
    }

    let new_aula = NewAula {
        turma_id: payload.turma_id,
        titulo: payload.titulo,
        caminho: final_caminho,
        icone: payload.icone,
        descricao: payload.descricao,
        ordem: payload.ordem,
        conteudo_md,
    };

    match pg.create_aula(new_aula).await {
        Ok(aula) => (StatusCode::CREATED, Json(aula)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    }
}

fn process_marp_content(turma_slug: &str, titulo: &str, md_content: &str) -> Result<String, (StatusCode, String)> {
    let slug = crate::utils::sanitize_slug(titulo);
    let base_dir = format!("/app/frontend_static/turmas/{}/aulas", turma_slug);
    
    if let Err(e) = fs::create_dir_all(&base_dir) {
         return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create directory: {}", e)));
    }

    let md_path = format!("{}/{}.md", base_dir, slug);
    let html_path = format!("{}/{}.html", base_dir, slug);
    
    // Inject Mermaid support
    let mut md_content_with_mermaid = md_content.to_string();
    if !md_content_with_mermaid.contains("mermaid.initialize") {
         md_content_with_mermaid.push_str("\n\n<script type=\"module\">\n  import mermaid from \"https://esm.sh/mermaid@10\";\n  mermaid.initialize({ startOnLoad: true, theme: 'default' });\n</script>");
    }

    // Replace ```mermaid blocks with <div class="mermaid">
    let re = Regex::new(r"```mermaid\s*([\s\S]*?)```").unwrap();
    let md_content_with_mermaid = re.replace_all(&md_content_with_mermaid, "<div class=\"mermaid\">$1</div>").to_string();

    if let Err(e) = fs::write(&md_path, md_content_with_mermaid) {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write MD file: {}", e)));
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
                return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Marp failed: {}", stderr)));
            }
        }
        Err(e) => {
            return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to execute marp: {}", e)));
        }
    }

    Ok(format!("turmas/{}/aulas/{}.html", turma_slug, slug))
}

pub async fn update_aula(
    Path(id): Path<i32>,
    State(state): State<AppState>,
    Json(payload): Json<CreateAulaRequest>,
) -> impl IntoResponse {
    let pg = match &state.pg_db {
        Some(pg) => pg,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, "Postgres not initialized".to_string()).into_response(),
    };

    let mut final_caminho = crate::utils::sanitize_path_or_url(&payload.caminho.clone().unwrap_or_default());
    let conteudo_md = payload.markdown.clone();

    let turma_slug = match pg.get_turma(payload.turma_id).await {
        Ok(Some(turma)) => turma.slug,
        Ok(None) => return (StatusCode::NOT_FOUND, "Turma not found".to_string()).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {}", e)).into_response(),
    };

    if let Some(md_content) = &payload.markdown {
        match process_marp_content(&turma_slug, &payload.titulo, md_content) {
            Ok(caminho) => final_caminho = caminho,
            Err(e) => return e.into_response(),
        }
    }

    let update = NewAula {
        turma_id: payload.turma_id,
        titulo: payload.titulo,
        caminho: final_caminho,
        icone: payload.icone,
        descricao: payload.descricao,
        ordem: payload.ordem,
        conteudo_md,
    };

    match pg.update_aula(id, update).await {
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
