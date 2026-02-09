use sqlx::postgres::PgPoolOptions;
use sqlx::{Pool, Postgres};
use std::env;
use anyhow::{Result, Context};

pub struct PostgresManager {
    pub pool: Pool<Postgres>,
}

impl PostgresManager {
    pub async fn new() -> Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .context("DATABASE_URL must be set")?;

        println!("🔌 Conectando ao Postgres em: {}", database_url);

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .context("Erro ao conectar ao PostgreSQL")?;

        Ok(Self { pool })
    }

    pub async fn check_connection(&self) -> Result<()> {
        sqlx::query("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .context("Erro ao verificar conexão com Postgres")?;
        Ok(())
    }
}
