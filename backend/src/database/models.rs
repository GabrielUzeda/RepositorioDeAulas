use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Usuários e perfis

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usuario {
    pub id: String,
    pub usuario: String,
    pub senha_hash: String, // agora armazenamos hash
    pub nome: String,
    pub cargo: Cargo,
    pub turmas: Vec<String>,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Cargo {
    #[serde(rename = "aluno")]
    Aluno,
    #[serde(rename = "professor")]
    Professor,
    #[serde(rename = "admin")]
    Admin,
}

/// Turmas / Aulas / Atividades

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Turma {
    pub id: String,
    pub nome: String,
    pub cor: String,
    pub icone: String,
    pub aulas: HashMap<String, Aula>,
    pub atividades: Vec<Atividade>,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aula {
    pub id: String,
    pub titulo: String,
    pub caminho: String,
    pub icone: String,
    pub descricao: String,
    pub turma_id: String,
    pub ordem: i32,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Atividade {
    pub id: String,
    pub titulo: String,
    pub descricao: String,
    pub caminho: String,
    pub icone: String,
    pub turma_id: String,
    pub aulas_relacionadas: Vec<String>,
    pub criado_em: i64,
    pub atualizado_em: i64,
    // opções úteis para cálculo
    pub allow_edit: bool,
    pub pontos_totais_hint: Option<f64>,
}

/// Rascunhos
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rascunho {
    pub id: String,
    pub usuario_id: String,
    pub atividade_id: String,
    pub conteudo: String,
    pub titulo: String,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

/// Perguntas / Respostas / Notas / Feedback

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pergunta {
    pub id: String,
    pub atividade_id: String,
    pub enunciado: String,
    pub pontos: f64, // normalmente 10.0
    pub ordem: i32,
    pub criado_em: i64,
    pub atualizado_em: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resposta {
    pub id: String,
    pub pergunta_id: String,
    pub atividade_id: String,
    pub aluno_id: String,
    pub conteudo: String,
    pub versao: i32,
    pub data_envio: i64,
    pub is_submitted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nota {
    pub id: String,
    pub resposta_id: String,
    pub pergunta_id: Option<String>,
    pub atividade_id: String,
    pub aluno_id: String,
    pub professor_id: Option<String>,
    pub valor: f64,
    pub feedback: Option<String>,
    pub data_avaliacao: i64,
    pub origem: String, // manual, automatica, reavaliacao
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotaAtividadeAluno {
    pub id: String,
    pub aluno_id: String,
    pub atividade_id: String,
    pub soma_pontos_obtidos: f64,
    pub soma_pontos_possiveis: f64,
    pub percentual: f64,
    pub calculado_em: i64,
    pub calculo_origem: String, // trigger, job, manual
}

/// Feedback por atividade (opcional)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackAtividade {
    pub id: String,
    pub atividade_id: String,
    pub aluno_id: String,
    pub professor_id: Option<String>,
    pub comentario: String,
    pub data_criacao: i64,
    pub publico: bool,
}

/// Solicitações de entrada em turmas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolicitacaoTurma {
    pub id: String,
    pub aluno_id: String,
    pub turma_id: String,
    pub status: SolicitacaoStatus,
    pub mensagem: Option<String>,
    pub criado_em: i64,
    pub respondido_em: Option<i64>,
    pub respondido_por: Option<String>, // ID do professor/admin que respondeu
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SolicitacaoStatus {
    #[serde(rename = "pendente")]
    Pendente,
    #[serde(rename = "aprovada")]
    Aprovada,
    #[serde(rename = "rejeitada")]
    Rejeitada,
}

/// Estruturas para inicialização
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitialData {
    pub turmas: HashMap<String, TurmaData>,
    pub logica: TurmaData,
    pub usuarios_iniciais: Vec<UsuarioInicial>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaData {
    pub nome: String,
    pub cor: String,
    pub icone: String,
    pub aulas: HashMap<String, AulaData>,
    pub atividades: Vec<AtividadeData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AulaData {
    pub caminho: String,
    pub icone: String,
    pub descricao: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtividadeData {
    pub id: String,
    pub icone: String,
    pub titulo: String,
    pub descricao: String,
    pub caminho: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsuarioInicial {
    pub usuario: String,
    pub senha: String,
    pub nome: String,
    pub cargo: String,
    pub turmas: Vec<String>,
}

/// Atualização de usuário
#[derive(Debug)]
pub struct UsuarioUpdate {
    pub senha: Option<String>,
    pub nome: Option<String>,
    pub cargo: Option<Cargo>,
    pub turmas: Option<Vec<String>>,
}

impl Default for UsuarioUpdate {
    fn default() -> Self {
        UsuarioUpdate {
            senha: None,
            nome: None,
            cargo: None,
            turmas: None,
        }
    }
}
