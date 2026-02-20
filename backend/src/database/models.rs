use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Turma {
    pub id: i32,
    pub slug: String,
    pub nome: String,
    pub cor: Option<String>,
    pub icone: Option<String>,
    pub senha: Option<String>,
    pub descricao: Option<String>,
    pub criado_em: Option<DateTime<Utc>>,
    pub atualizado_em: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaPublica {
    pub id: i32,
    pub slug: String,
    pub nome: String,
    pub cor: Option<String>,
    pub icone: Option<String>,
    pub descricao: Option<String>,
}

impl From<Turma> for TurmaPublica {
    fn from(t: Turma) -> Self {
        Self {
            id: t.id,
            slug: t.slug,
            nome: t.nome,
            cor: t.cor,
            icone: t.icone,
            descricao: t.descricao,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTurma {
    pub slug: String,
    pub nome: String,
    pub cor: Option<String>,
    pub icone: Option<String>,
    pub senha: Option<String>,
    pub descricao: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Aula {
    pub id: i32,
    pub turma_id: i32,
    pub titulo: String,
    pub caminho: String,
    pub icone: Option<String>,
    pub descricao: Option<String>,
    pub ordem: i32,
    pub conteudo_md: Option<String>,
    pub criado_em: Option<DateTime<Utc>>,
    pub atualizado_em: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAula {
    pub turma_id: i32,
    pub titulo: String,
    pub caminho: String,
    pub icone: Option<String>,
    pub descricao: Option<String>,
    pub ordem: i32,
    pub conteudo_md: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Atividade {
    pub id: i32,
    pub turma_id: i32,
    pub external_id: Option<String>,
    pub titulo: String,
    pub descricao: Option<String>,
    pub caminho: String,
    pub icone: Option<String>,
    pub json_data: Option<String>,
    pub tipo: Option<String>,
    pub senha: Option<String>,
    pub allow_password: Option<bool>,
    pub ordem: Option<i32>,
    pub criado_em: Option<DateTime<Utc>>,
    pub atualizado_em: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewAtividade {
    pub turma_id: i32,
    pub external_id: Option<String>,
    pub titulo: String,
    pub descricao: Option<String>,
    pub caminho: String,
    pub icone: Option<String>,
    pub json_data: Option<String>,
    pub tipo: Option<String>,
    pub senha: Option<String>,
    pub allow_password: Option<bool>,
    pub ordem: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Usuario {
    pub id: i32,
    pub usuario: String,
    pub senha: String,
    pub nome: String,
    pub cargo: String,
    pub criado_em: Option<DateTime<Utc>>,
    pub atualizado_em: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Ranking {
    pub id: i32,
    pub atividade_id: i32,
    pub nome_jogador: String,
    pub pontuacao: i32,
    pub data_envio: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewRanking {
    pub atividade_id: i32,
    pub nome_jogador: String,
    pub pontuacao: i32,
}
