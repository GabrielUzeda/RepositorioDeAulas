use std::sync::Arc;
use crate::database::postgres::PostgresManager;
use crate::mailer;

#[derive(Clone)]
pub struct AppState {
    pub pg_db: Option<Arc<PostgresManager>>,
}

pub async fn run_init() -> AppState {
    dotenvy::dotenv().ok();

    // Inicializar o banco de dados Postgres com retentativas
    println!("🐘 Inicializando banco de dados Postgres...");
    
    let mut pg_db = None;
    let max_retries = 5;
    let mut delay = std::time::Duration::from_secs(2);

    for i in 1..=max_retries {
        match PostgresManager::new().await {
            Ok(pg) => {
                match pg.check_connection().await {
                    Ok(_) => {
                        println!("✅ Conexão com Postgres estabelecida com sucesso!");
                        pg_db = Some(Arc::new(pg));
                        break;
                    }
                    Err(e) => {
                        eprintln!("⚠️  Tentativa {}/{}: Postgres configurado mas falhou na conexão: {}", i, max_retries, e);
                    }
                }
            }
            Err(e) => {
                eprintln!("⚠️  Tentativa {}/{}: Erro ao carregar Postgres: {}", i, max_retries, e);
            }
        }
        
        if i < max_retries {
            println!("🕒 Aguardando {:?} antes da próxima tentativa...", delay);
            tokio::time::sleep(delay).await;
            delay *= 2;
        }
    }

    if pg_db.is_none() {
        eprintln!("❌ Falha crítica: Não foi possível conectar ao Postgres após {} tentativas.", max_retries);
    }

    // Inicializar o sistema de emails
    mailer::init_mailer();

    AppState { pg_db }
}
