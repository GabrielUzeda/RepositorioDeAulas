use crate::database::database::DatabaseManager;
use crate::database::models::*;
use anyhow::Result;
use std::fs;
use std::path::Path;
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct SettingsData {
    turmas: HashMap<String, TurmaSettings>,
}

#[derive(Debug, Deserialize)]
struct TurmaSettings {
    nome: String,
    cor: String,
    icone: String,
    aulas: HashMap<String, AulaSettings>,
    atividades: Vec<AtividadeSettings>,
}

#[derive(Debug, Deserialize)]
struct AulaSettings {
    caminho: String,
    icone: String,
    descricao: String,
}

#[derive(Debug, Deserialize)]
struct AtividadeSettings {
    id: String,
    icone: String,
    titulo: String,
    descricao: String,
    caminho: String,
}

#[derive(Debug, Deserialize)]
struct SecretData {
    turmasSenhas: HashMap<String, String>,
}

pub async fn initialize_from_remote(db: &DatabaseManager, url: &str) -> Result<()> {
    println!("📡 Baixando dados remotos de {}...", url);

    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;
    let initial_data: InitialData = response.json().await?;

    println!("✅ Dados remotos baixados, inicializando banco...");
    initialize_database(db, initial_data).await
}

pub async fn initialize_from_file<P: AsRef<Path>>(db: &DatabaseManager, path: P) -> Result<()> {
    println!("📁 Carregando dados locais de {:?}...", path.as_ref());

    let content = fs::read_to_string(path)?;
    let initial_data: InitialData = serde_json::from_str(&content)?;

    println!("✅ Dados locais carregados, inicializando banco...");
    initialize_database(db, initial_data).await
}

async fn initialize_database(db: &DatabaseManager, data: InitialData) -> Result<()> {
    println!("🏗️  Inicializando estruturas do banco...");

    // Combinar turmas regulares com logica
    let mut all_turmas = data.turmas;
    all_turmas.insert("logica".to_string(), data.logica);

    // Criar turmas
    for (turma_id, turma_data) in all_turmas {
        println!("📚 Criando turma: {}", turma_data.nome);

        // Criar turma
        db.create_turma(&turma_id, &turma_data.nome, &turma_data.cor, &turma_data.icone)?;

        // Criar aulas
        let mut ordem = 1;
        for (aula_titulo, aula_data) in turma_data.aulas {
            println!("  📖 Criando aula: {}", aula_titulo);
            db.create_aula(
                &aula_titulo,
                &aula_data.caminho,
                &aula_data.icone,
                &aula_data.descricao,
                &turma_id,
                ordem,
            )?;
            ordem += 1;
        }

        // Criar atividades + perguntas exemplo
        for atividade_data in turma_data.atividades {
            println!("  📝 Criando atividade: {}", atividade_data.titulo);
            let atividade_id = db.create_atividade(
                &atividade_data.titulo,
                &atividade_data.descricao,
                &atividade_data.caminho,
                &atividade_data.icone,
                &turma_id,
                vec![], // aulas relacionadas
            )?;

            // Exemplo: criar 3 perguntas padrão valendo 10 cada (apenas se não houver)
            db.create_pergunta(&atividade_id, "Pergunta 1 - enunciado padrão", 10.0, 1)?;
            db.create_pergunta(&atividade_id, "Pergunta 2 - enunciado padrão", 10.0, 2)?;
            db.create_pergunta(&atividade_id, "Pergunta 3 - enunciado padrão", 10.0, 3)?;
        }
    }

    // Criar usuários iniciais
    for usuario_data in data.usuarios_iniciais {
        println!("👤 Criando usuário: {}", usuario_data.usuario);

        let cargo = match usuario_data.cargo.as_str() {
            "professor" => Cargo::Professor,
            "aluno" => Cargo::Aluno,
            "admin" => Cargo::Admin,
            _ => Cargo::Aluno,
        };

        db.create_usuario(
            &usuario_data.usuario,
            &usuario_data.senha,
            &usuario_data.nome,
            cargo,
            usuario_data.turmas,
        )?;
    }

    // Marcar como inicializado
    db.set_initialized()?;

    println!("🎉 Banco de dados inicializado com sucesso!");
    Ok(())
}

pub fn is_initialized(db: &DatabaseManager) -> Result<bool> {
    db.is_initialized()
}

pub async fn initialize_from_settings(db: &DatabaseManager) -> Result<()> {
    println!("📁 Carregando dados do settings.json...");

    // Ler settings.json
    let settings_content = fs::read_to_string("settings.json")?;
    let settings: SettingsData = serde_json::from_str(&settings_content)?;

    // Ler secret.json para senhas
    let secret_content = fs::read_to_string("secret.json")?;
    let secret: SecretData = serde_json::from_str(&secret_content)?;

    println!("✅ Dados carregados, inicializando banco...");
    initialize_database_from_settings(db, settings, secret).await
}

async fn initialize_database_from_settings(db: &DatabaseManager, settings: SettingsData, secret: SecretData) -> Result<()> {
    println!("🏗️  Inicializando estruturas do banco com dados do settings.json...");

    // Criar turmas (logica já está incluída no settings.json agora)
    for (turma_id, turma_data) in &settings.turmas {
        println!("📚 Criando turma: {} ({})", turma_data.nome, turma_id);

        // Criar turma
        db.create_turma(turma_id, &turma_data.nome, &turma_data.cor, &turma_data.icone)?;

        // Criar aulas
        let mut ordem = 1;
        for (aula_titulo, aula_data) in &turma_data.aulas {
            println!("  📖 Criando aula: {}", aula_titulo);
            db.create_aula(
                aula_titulo,
                &aula_data.caminho,
                &aula_data.icone,
                &aula_data.descricao,
                turma_id,
                ordem,
            )?;
            ordem += 1;
        }

        // Criar atividades
        for atividade_data in &turma_data.atividades {
            println!("  📝 Criando atividade: {}", atividade_data.titulo);
            let atividade_id = db.create_atividade(
                &atividade_data.titulo,
                &atividade_data.descricao,
                &atividade_data.caminho,
                &atividade_data.icone,
                turma_id,
                vec![], // aulas relacionadas (por enquanto vazio)
            )?;

            // Criar perguntas padrão para cada atividade
            println!("    ❓ Criando perguntas padrão...");
            db.create_pergunta(&atividade_id, "Questão 1 - Responda conforme solicitado na atividade", 10.0, 1)?;
            db.create_pergunta(&atividade_id, "Questão 2 - Demonstre o conhecimento adquirido", 10.0, 2)?;
            db.create_pergunta(&atividade_id, "Questão 3 - Explique sua solução", 10.0, 3)?;
        }
    }

    // Criar usuário admin padrão
    println!("👑 Criando usuário admin...");
    db.create_usuario(
        "admin",
        "asdf1234",
        "Administrador do Sistema",
        Cargo::Admin,
        vec!["estatistica".to_string(), "terceirao".to_string(), "logica".to_string(), "visualizacao_dados".to_string()],
    )?;

    // Criar professor padrão
    println!("👨‍🏫 Criando professor padrão...");
    db.create_usuario(
        "professor",
        "asdf1234",
        "Professor Padrão",
        Cargo::Professor,
        vec!["estatistica".to_string(), "terceirao".to_string(), "logica".to_string(), "visualizacao_dados".to_string()],
    )?;

    // Marcar como inicializado
    db.set_initialized()?;

    println!("🎉 Banco de dados inicializado com sucesso a partir do settings.json!");
    Ok(())
}

pub async fn initialize_database_from_default(db: &DatabaseManager) -> Result<()> {
    // Usar settings.json como fonte principal
    match initialize_from_settings(db).await {
        Ok(_) => return Ok(()),
        Err(e) => {
            eprintln!("⚠️  Erro ao carregar dados do settings.json: {}", e);
            eprintln!("📁 Tentando dados remotos...");

            // Fallback para dados remotos
            let remote_url = "https://uzeda.ddns.net/efg/settings.json";
            match initialize_from_remote(db, remote_url).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    eprintln!("⚠️  Erro ao carregar dados remotos: {}", e);
                    eprintln!("📁 Tentando arquivo local...");
                }
            }

            // Último fallback para arquivo local
            let local_path = "./database/init/initial_data.json";
            match initialize_from_file(db, local_path).await {
                Ok(_) => Ok(()),
                Err(e) => {
                    eprintln!("❌ Erro ao carregar dados locais: {}", e);
                    Err(e)
                }
            }
        }
    }
}
