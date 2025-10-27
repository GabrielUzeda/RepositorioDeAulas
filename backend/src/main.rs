mod mailer;
mod database;
mod routes;

use tokio::sync::mpsc;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use std::sync::Arc;
use crate::database::database::DatabaseManager;

#[derive(Debug)]
pub struct GradeEvent {
    pub atividade_id: String,
    pub aluno_id: String,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    // Inicializar o banco de dados LMDB
    println!("🗄️  Inicializando banco de dados LMDB...");
    let db = match database::database::DatabaseManager::new("./database/data") {
        Ok(db) => {
            println!("✅ Banco LMDB conectado com sucesso!");

            // Inicializar dados se for a primeira vez
            if !database::init::is_initialized(&db).unwrap_or(false) {
                println!("📝 Inicializando dados do banco...");
                if let Err(e) = database::init::initialize_clean_database(&db).await {
                    eprintln!("❌ Erro ao inicializar dados: {}", e);
                } else {
                    println!("✅ Dados inicializados com sucesso!");
                }
            } else {
                println!("ℹ️  Banco já inicializado");
            }

            Arc::new(db)
        }
        Err(e) => {
            eprintln!("❌ Erro ao inicializar banco LMDB: {}", e);
            std::process::exit(1);
        }
    };

    // Inicializar o sistema de emails
    mailer::init_mailer();

    // Inicializar worker assíncrono para processamento de notas
    let (_tx, mut rx) = mpsc::channel::<GradeEvent>(1024);
    let db_worker = db.clone();
    tokio::spawn(async move {
        while let Some(evt) = rx.recv().await {
            // bom practice: retry/backoff se falhar
            if let Err(e) = db_worker.update_aggregate_nota_atividade(&evt.atividade_id, &evt.aluno_id) {
                // log e possivelmente re-enfileirar
                eprintln!("Erro ao processar GradeEvent {:?}: {}", evt, e);
            }
        }
    });

    // Configurar CORS para permitir requisições do navegador
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Criar router com todas as rotas usando o novo módulo
    let app = routes::create_router(db)
        .layer(cors);

    println!("🚀 Servidor Academic API rodando em 0.0.0.0:8080");
    println!("📚 Endpoints disponíveis:");
    println!("  🔐 Auth: POST /auth/register (apenas alunos), POST /auth/login");
    println!("  📖 Turmas: GET/POST /turmas, GET /turmas/:id");
    println!("  📝 Solicitações: POST /turmas/:id/solicitar-entrada, GET /turmas/:id/solicitacoes, POST /solicitacoes/:id/aprovar, POST /solicitacoes/:id/rejeitar, GET /minhas-solicitacoes");
    println!("  📝 Atividades: GET /turmas/:id/atividades, POST /atividades, GET /atividades/:id");
    println!("  ❓ Perguntas: GET /atividades/:id/perguntas, POST /perguntas");
    println!("  ✍️  Respostas: POST /respostas, GET /atividades/:id/alunos/:id/respostas");
    println!("  ✅ Avaliação: POST /avaliacao/grade");
    println!("  📊 Notas: GET /atividades/:id/alunos/:id/nota, GET /atividades/:id/alunos/:id/calcular-nota");
    println!("  💬 Feedback: POST /feedback");
    println!("  📧 Email: POST /send-mail");
    println!("🗄️  LMDB disponível em: ./database/data");
    println!("🌐 CORS habilitado para desenvolvimento");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

