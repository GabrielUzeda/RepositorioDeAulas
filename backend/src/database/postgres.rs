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

        println!("🚀 Rodando migrações...");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .context("Erro ao rodar migrações")?;

        Ok(Self { pool })
    }

    pub async fn check_connection(&self) -> Result<()> {
        sqlx::query("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .context("Erro ao verificar conexão com Postgres")?;
        Ok(())
    }

    // --- Turmas CRUD ---

    pub async fn list_turmas(&self) -> Result<Vec<crate::database::models::Turma>> {
        let turmas = sqlx::query_as::<_, crate::database::models::Turma>(
            "SELECT * FROM turmas ORDER BY nome"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(turmas)
    }

    pub async fn get_turma(&self, id: i32) -> Result<Option<crate::database::models::Turma>> {
        let turma = sqlx::query_as::<_, crate::database::models::Turma>(
            "SELECT * FROM turmas WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(turma)
    }

    pub async fn create_turma(&self, new_turma: crate::database::models::NewTurma) -> Result<crate::database::models::Turma> {
        let turma = sqlx::query_as::<_, crate::database::models::Turma>(
            "INSERT INTO turmas (slug, nome, cor, icone, senha, descricao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
        )
        .bind(new_turma.slug)
        .bind(new_turma.nome)
        .bind(new_turma.cor)
        .bind(new_turma.icone)
        .bind(new_turma.senha)
        .bind(new_turma.descricao)
        .fetch_one(&self.pool)
        .await?;
        Ok(turma)
    }

    pub async fn update_turma(&self, id: i32, update: crate::database::models::NewTurma) -> Result<crate::database::models::Turma> {
        let turma = sqlx::query_as::<_, crate::database::models::Turma>(
            "UPDATE turmas SET slug = $1, nome = $2, cor = $3, icone = $4, senha = COALESCE($5, senha), descricao = $6 WHERE id = $7 RETURNING *"
        )
        .bind(update.slug)
        .bind(update.nome)
        .bind(update.cor)
        .bind(update.icone)
        .bind(update.senha)
        .bind(update.descricao)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(turma)
    }

    pub async fn delete_turma(&self, id: i32) -> Result<()> {
        sqlx::query("DELETE FROM turmas WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // --- Aulas CRUD ---

    pub async fn list_aulas(&self, turma_id: Option<i32>) -> Result<Vec<crate::database::models::Aula>> {
        let query = if let Some(tid) = turma_id {
            sqlx::query_as::<_, crate::database::models::Aula>(
                "SELECT * FROM aulas WHERE turma_id = $1 ORDER BY ordem, titulo"
            )
            .bind(tid)
        } else {
            sqlx::query_as::<_, crate::database::models::Aula>(
                "SELECT * FROM aulas ORDER BY titulo"
            )
        };
        
        let aulas = query.fetch_all(&self.pool).await?;
        Ok(aulas)
    }

    pub async fn get_aula(&self, id: i32) -> Result<Option<crate::database::models::Aula>> {
        let aula = sqlx::query_as::<_, crate::database::models::Aula>(
            "SELECT * FROM aulas WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(aula)
    }

    pub async fn create_aula(&self, new_aula: crate::database::models::NewAula) -> Result<crate::database::models::Aula> {
        let aula = sqlx::query_as::<_, crate::database::models::Aula>(
            "INSERT INTO aulas (turma_id, titulo, caminho, icone, descricao, ordem) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
        )
        .bind(new_aula.turma_id)
        .bind(new_aula.titulo)
        .bind(new_aula.caminho)
        .bind(new_aula.icone)
        .bind(new_aula.descricao)
        .bind(new_aula.ordem)
        .fetch_one(&self.pool)
        .await?;
        Ok(aula)
    }

    pub async fn update_aula(&self, id: i32, update: crate::database::models::NewAula) -> Result<crate::database::models::Aula> {
        let aula = sqlx::query_as::<_, crate::database::models::Aula>(
            "UPDATE aulas SET turma_id = $1, titulo = $2, caminho = $3, icone = $4, descricao = $5, ordem = $6 WHERE id = $7 RETURNING *"
        )
        .bind(update.turma_id)
        .bind(update.titulo)
        .bind(update.caminho)
        .bind(update.icone)
        .bind(update.descricao)
        .bind(update.ordem)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(aula)
    }

    pub async fn delete_aula(&self, id: i32) -> Result<()> {
        sqlx::query("DELETE FROM aulas WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // --- Atividades CRUD ---

    pub async fn list_atividades(&self, turma_id: Option<i32>) -> Result<Vec<crate::database::models::Atividade>> {
        let query = if let Some(tid) = turma_id {
            sqlx::query_as::<_, crate::database::models::Atividade>(
                "SELECT * FROM atividades WHERE turma_id = $1 ORDER BY titulo"
            )
            .bind(tid)
        } else {
            sqlx::query_as::<_, crate::database::models::Atividade>(
                "SELECT * FROM atividades ORDER BY titulo"
            )
        };
        
        let atividades = query.fetch_all(&self.pool).await?;
        Ok(atividades)
    }

    pub async fn get_atividade(&self, id: i32) -> Result<Option<crate::database::models::Atividade>> {
        let atividade = sqlx::query_as::<_, crate::database::models::Atividade>(
            "SELECT * FROM atividades WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(atividade)
    }

    pub async fn create_atividade(&self, new_atv: crate::database::models::NewAtividade) -> Result<crate::database::models::Atividade> {
        let atividade = sqlx::query_as::<_, crate::database::models::Atividade>(
            "INSERT INTO atividades (turma_id, external_id, titulo, descricao, caminho, icone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
        )
        .bind(new_atv.turma_id)
        .bind(new_atv.external_id)
        .bind(new_atv.titulo)
        .bind(new_atv.descricao)
        .bind(new_atv.caminho)
        .bind(new_atv.icone)
        .fetch_one(&self.pool)
        .await?;
        Ok(atividade)
    }

    pub async fn update_atividade(&self, id: i32, update: crate::database::models::NewAtividade) -> Result<crate::database::models::Atividade> {
        let atividade = sqlx::query_as::<_, crate::database::models::Atividade>(
            "UPDATE atividades SET turma_id = $1, external_id = $2, titulo = $3, descricao = $4, caminho = $5, icone = $6 WHERE id = $7 RETURNING *"
        )
        .bind(update.turma_id)
        .bind(update.external_id)
        .bind(update.titulo)
        .bind(update.descricao)
        .bind(update.caminho)
        .bind(update.icone)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(atividade)
    }

    pub async fn delete_atividade(&self, id: i32) -> Result<()> {
        sqlx::query("DELETE FROM atividades WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
