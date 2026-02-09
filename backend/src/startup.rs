use std::sync::Arc;
use crate::database::postgres::PostgresManager;
use crate::mailer;

pub struct AppState {
    pub pg_db: Option<Arc<PostgresManager>>,
}

pub async fn run_init() -> AppState {
    dotenvy::dotenv().ok();

    // Inicializar o banco de dados Postgres
    println!("🐘 Inicializando banco de dados Postgres...");
    let pg_db = match PostgresManager::new().await {
        Ok(pg) => {
            if let Err(e) = pg.check_connection().await {
                eprintln!("⚠️  Postgres configurado mas falhou na conexão: {}", e);
            } else {
                println!("✅ Conexão com Postgres estabelecida com sucesso!");
            }
            Some(Arc::new(pg))
        }
        Err(e) => {
            eprintln!("⚠️  Não foi possível inicializar o Postgres (verifique DATABASE_URL): {}", e);
            None
        }
    };

    // Inicializar o sistema de emails
    mailer::init_mailer();

    AppState { pg_db }
}
