use lmdb::{Environment, Database, Transaction, WriteFlags, Cursor};
use std::path::Path;
use std::fs;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use crate::database::models::*;
use uuid::Uuid;
use chrono::Utc;
use argon2;
use rand::Rng;
use serde_json::json;

pub struct DatabaseManager {
    env: Environment,
    users_db: Database,
    turmas_db: Database,
    aulas_db: Database,
    atividades_db: Database,
    perguntas_db: Database,
    respostas_db: Database,
    notas_db: Database,
    nota_atividade_db: Database,
    rascunhos_db: Database,
    feedback_db: Database,
    solicitacoes_db: Database,
    metadata_db: Database,
    notas_by_atividade_db: Database,
    notas_by_atividade_aluno_db: Database,

}

impl DatabaseManager {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        // Criar diretório se não existir
        fs::create_dir_all(&path)?;

        // Configurar ambiente LMDB
        let env = Environment::new()
            .set_max_dbs(20) // mais DBs agora com índices
            .set_map_size(64 * 1024 * 1024) // 64MB por segurança
            .open(path.as_ref())?;

        // Criar databases
        let users_db = env.create_db(Some("users"), lmdb::DatabaseFlags::empty())?;
        let turmas_db = env.create_db(Some("turmas"), lmdb::DatabaseFlags::empty())?;
        let aulas_db = env.create_db(Some("aulas"), lmdb::DatabaseFlags::empty())?;
        let atividades_db = env.create_db(Some("atividades"), lmdb::DatabaseFlags::empty())?;
        let perguntas_db = env.create_db(Some("perguntas"), lmdb::DatabaseFlags::empty())?;
        let respostas_db = env.create_db(Some("respostas"), lmdb::DatabaseFlags::empty())?;
        let notas_db = env.create_db(Some("notas"), lmdb::DatabaseFlags::empty())?;
        let nota_atividade_db = env.create_db(Some("nota_atividade"), lmdb::DatabaseFlags::empty())?;
        let rascunhos_db = env.create_db(Some("rascunhos"), lmdb::DatabaseFlags::empty())?;
        let feedback_db = env.create_db(Some("feedback"), lmdb::DatabaseFlags::empty())?;
        let solicitacoes_db = env.create_db(Some("solicitacoes"), lmdb::DatabaseFlags::empty())?;
        let metadata_db = env.create_db(Some("metadata"), lmdb::DatabaseFlags::empty())?;
        let notas_by_atividade_db = env.create_db(Some("notas_by_atividade"), lmdb::DatabaseFlags::empty())?;
        let notas_by_atividade_aluno_db = env.create_db(Some("notas_by_atividade_aluno"), lmdb::DatabaseFlags::empty())?;


        Ok(DatabaseManager {
            env,
            users_db,
            turmas_db,
            aulas_db,
            atividades_db,
            perguntas_db,
            respostas_db,
            notas_db,
            nota_atividade_db,
            rascunhos_db,
            feedback_db,
            solicitacoes_db,
            metadata_db,
            notas_by_atividade_db,
            notas_by_atividade_aluno_db,
        })
    }

    // ========================= UTILIDADES =========================

    fn hash_password(&self, senha: &str) -> Result<String> {
        // Argon2 default config (tune for production)
        use argon2::{Argon2, PasswordHasher};
        use password_hash::{SaltString, rand_core::OsRng};

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        let hash = argon2.hash_password(senha.as_bytes(), &salt)
            .map_err(|e| anyhow!("Erro ao criar hash: {}", e))?;
        Ok(hash.to_string())
    }

    fn verify_password(&self, senha: &str, hash: &str) -> Result<bool> {
        use argon2::{Argon2, PasswordVerifier};
        use password_hash::PasswordHash;

        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| anyhow!("Erro ao analisar hash: {}", e))?;
        let argon2 = Argon2::default();

        Ok(argon2.verify_password(senha.as_bytes(), &parsed_hash).is_ok())
    }

    // ========== USUÁRIOS ==========

    pub fn create_usuario(&self, usuario: &str, senha: &str, nome: &str, cargo: Cargo, turmas: Vec<String>) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();

        let id = Uuid::new_v4().to_string();
        let senha_hash = self.hash_password(senha)?;

        let user = Usuario {
            id: id.clone(),
            usuario: usuario.to_string(),
            senha_hash,
            nome: nome.to_string(),
            cargo,
            turmas,
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("user:{}", usuario);
        let value = serde_json::to_string(&user)?;
        txn.put(self.users_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn get_usuario(&self, usuario: &str) -> Result<Option<Usuario>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("user:{}", usuario);

        match txn.get(self.users_db, &key.as_bytes()) {
            Ok(data) => {
                let user: Usuario = serde_json::from_slice(data)?;
                Ok(Some(user))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar usuário: {}", e)),
        }
    }

    pub fn authenticate_usuario(&self, usuario: &str, senha: &str) -> Result<Option<Usuario>> {
        if let Some(user) = self.get_usuario(usuario)? {
            if self.verify_password(senha, &user.senha_hash)? {
                Ok(Some(user))
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    pub fn update_usuario(&self, usuario: &str, updates: UsuarioUpdate) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;

        if let Some(mut user) = self.get_usuario(usuario)? {
            if let Some(senha) = updates.senha {
                user.senha_hash = self.hash_password(&senha)?;
            }
            if let Some(nome) = updates.nome {
                user.nome = nome;
            }
            if let Some(cargo) = updates.cargo {
                user.cargo = cargo;
            }
            if let Some(turmas) = updates.turmas {
                user.turmas = turmas;
            }
            user.atualizado_em = Utc::now().timestamp();

            let key = format!("user:{}", usuario);
            let value = serde_json::to_string(&user)?;
            txn.put(self.users_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
            txn.commit()?;
        }

        Ok(())
    }

    // ========== SOLICITAÇÕES DE TURMA ==========

    pub fn criar_solicitacao_turma(&self, aluno_id: &str, turma_id: &str, mensagem: Option<&str>) -> Result<String> {
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        // Verificar se já existe uma solicitação pendente ou aprovada
        {
            let txn = self.env.begin_ro_txn()?;
            let mut cursor = txn.open_ro_cursor(self.solicitacoes_db)?;
            for (_key, value) in cursor.iter() {
                let key_str = String::from_utf8_lossy(_key);
                if key_str.starts_with(&format!("solicitacao:{}:{}", aluno_id, turma_id)) {
                    let solicitacao: SolicitacaoTurma = serde_json::from_slice(value)?;
                    if matches!(solicitacao.status, SolicitacaoStatus::Pendente | SolicitacaoStatus::Aprovada) {
                        return Err(anyhow!("Já existe uma solicitação ativa para esta turma"));
                    }
                }
            }
        }

        let solicitacao = SolicitacaoTurma {
            id: id.clone(),
            aluno_id: aluno_id.to_string(),
            turma_id: turma_id.to_string(),
            status: SolicitacaoStatus::Pendente,
            mensagem: mensagem.map(|s| s.to_string()),
            criado_em: timestamp,
            respondido_em: None,
            respondido_por: None,
        };

        let mut txn = self.env.begin_rw_txn()?;
        let key = format!("solicitacao:{}:{}", aluno_id, turma_id);
        let value = serde_json::to_string(&solicitacao)?;
        txn.put(self.solicitacoes_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
        txn.commit()?;

        Ok(id)
    }

    pub fn listar_solicitacoes_turma(&self, turma_id: &str) -> Result<Vec<SolicitacaoTurma>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.solicitacoes_db)?;
        let mut solicitacoes = Vec::new();

        for (_key, value) in cursor.iter() {
            let solicitacao: SolicitacaoTurma = serde_json::from_slice(value)?;
            if solicitacao.turma_id == turma_id {
                solicitacoes.push(solicitacao);
            }
        }

        Ok(solicitacoes)
    }

    pub fn aprovar_solicitacao(&self, solicitacao_id: &str, professor_id: &str) -> Result<()> {
        let timestamp = Utc::now().timestamp();

        // Encontrar a solicitação
        let mut solicitacao_encontrada: Option<SolicitacaoTurma> = None;
        let mut key_encontrada: Option<String> = None;

        {
            let txn = self.env.begin_ro_txn()?;
            let mut cursor = txn.open_ro_cursor(self.solicitacoes_db)?;
            for (key, value) in cursor.iter() {
                let solicitacao: SolicitacaoTurma = serde_json::from_slice(value)?;
                if solicitacao.id == solicitacao_id {
                    solicitacao_encontrada = Some(solicitacao);
                    key_encontrada = Some(String::from_utf8_lossy(key).to_string());
                    break;
                }
            }
        }

        let mut solicitacao = solicitacao_encontrada.ok_or_else(|| anyhow!("Solicitação não encontrada"))?;
        let key = key_encontrada.ok_or_else(|| anyhow!("Chave não encontrada"))?;

        if !matches!(solicitacao.status, SolicitacaoStatus::Pendente) {
            return Err(anyhow!("Esta solicitação já foi processada"));
        }

        // Atualizar solicitação
        solicitacao.status = SolicitacaoStatus::Aprovada;
        solicitacao.respondido_em = Some(timestamp);
        solicitacao.respondido_por = Some(professor_id.to_string());

        let mut txn = self.env.begin_rw_txn()?;

        // Adicionar aluno à turma
        match txn.get(self.users_db, &format!("user:{}", solicitacao.aluno_id).as_bytes()) {
            Ok(user_data) => {
                let mut usuario: Usuario = serde_json::from_slice(user_data)?;
                if !usuario.turmas.contains(&solicitacao.turma_id) {
                    usuario.turmas.push(solicitacao.turma_id.clone());
                    usuario.atualizado_em = timestamp;
                    let user_key = format!("user:{}", solicitacao.aluno_id);
                    let user_val = serde_json::to_string(&usuario)?;
                    txn.put(self.users_db, &user_key.as_bytes(), &user_val.as_bytes(), WriteFlags::empty())?;
                }
            }
            Err(lmdb::Error::NotFound) => {
                // Usuário não encontrado, ignorar silenciosamente
            }
            Err(e) => return Err(anyhow!("Erro ao buscar usuário: {}", e)),
        }

        let value = serde_json::to_string(&solicitacao)?;
        txn.put(self.solicitacoes_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
        txn.commit()?;

        Ok(())
    }

    pub fn rejeitar_solicitacao(&self, solicitacao_id: &str, professor_id: &str) -> Result<()> {
        let timestamp = Utc::now().timestamp();

        // Encontrar a solicitação
        let mut solicitacao_encontrada: Option<SolicitacaoTurma> = None;
        let mut key_encontrada: Option<String> = None;

        {
            let txn = self.env.begin_ro_txn()?;
            let mut cursor = txn.open_ro_cursor(self.solicitacoes_db)?;
            for (key, value) in cursor.iter() {
                let solicitacao: SolicitacaoTurma = serde_json::from_slice(value)?;
                if solicitacao.id == solicitacao_id {
                    solicitacao_encontrada = Some(solicitacao);
                    key_encontrada = Some(String::from_utf8_lossy(key).to_string());
                    break;
                }
            }
        }

        let mut solicitacao = solicitacao_encontrada.ok_or_else(|| anyhow!("Solicitação não encontrada"))?;
        let key = key_encontrada.ok_or_else(|| anyhow!("Chave não encontrada"))?;

        if !matches!(solicitacao.status, SolicitacaoStatus::Pendente) {
            return Err(anyhow!("Esta solicitação já foi processada"));
        }

        // Atualizar solicitação
        solicitacao.status = SolicitacaoStatus::Rejeitada;
        solicitacao.respondido_em = Some(timestamp);
        solicitacao.respondido_por = Some(professor_id.to_string());

        let mut txn = self.env.begin_rw_txn()?;
        let value = serde_json::to_string(&solicitacao)?;
        txn.put(self.solicitacoes_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
        txn.commit()?;

        Ok(())
    }

    pub fn listar_minhas_solicitacoes(&self, aluno_id: &str) -> Result<Vec<SolicitacaoTurma>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.solicitacoes_db)?;
        let mut solicitacoes = Vec::new();

        for (_key, value) in cursor.iter() {
            let solicitacao: SolicitacaoTurma = serde_json::from_slice(value)?;
            if solicitacao.aluno_id == aluno_id {
                solicitacoes.push(solicitacao);
            }
        }

        Ok(solicitacoes)
    }

    // ========== TURMAS (mantidas) ==========
    // (mantive suas funções create/get/list conforme antes, mas adicionei pequenas validações)

    pub fn create_turma(&self, id: &str, nome: &str, cor: &str, icone: &str) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();

        let turma = Turma {
            id: id.to_string(),
            nome: nome.to_string(),
            cor: cor.to_string(),
            icone: icone.to_string(),
            aulas: HashMap::new(),
            atividades: Vec::new(),
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("turma:{}", id);
        let value = serde_json::to_string(&turma)?;
        txn.put(self.turmas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
        txn.commit()?;
        Ok(id.to_string())
    }

    pub fn get_turma(&self, id: &str) -> Result<Option<Turma>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("turma:{}", id);

        match txn.get(self.turmas_db, &key.as_bytes()) {
            Ok(data) => {
                let turma: Turma = serde_json::from_slice(data)?;
                Ok(Some(turma))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar turma: {}", e)),
        }
    }

    pub fn list_turmas(&self) -> Result<Vec<Turma>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.turmas_db)?;
        let mut turmas = Vec::new();

        for (_key, value) in cursor.iter() {
            let turma: Turma = serde_json::from_slice(value)?;
            turmas.push(turma);
        }

        Ok(turmas)
    }

    // ========== AULAS ==========

    pub fn create_aula(&self, titulo: &str, caminho: &str, icone: &str, descricao: &str, turma_id: &str, ordem: i32) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let aula = Aula {
            id: id.clone(),
            titulo: titulo.to_string(),
            caminho: caminho.to_string(),
            icone: icone.to_string(),
            descricao: descricao.to_string(),
            turma_id: turma_id.to_string(),
            ordem,
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("aula:{}", id);
        let value = serde_json::to_string(&aula)?;
        txn.put(self.aulas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        // adicionar referência na turma (opcional)
        if let Ok(tdata) = txn.get(self.turmas_db, &format!("turma:{}", turma_id).as_bytes()) {
            let mut turma: Turma = serde_json::from_slice(tdata)?;
            turma.aulas.insert(id.clone(), aula.clone());
            turma.atualizado_em = timestamp;
            let turma_key = format!("turma:{}", turma_id);
            let turma_val = serde_json::to_string(&turma)?;
            txn.put(self.turmas_db, &turma_key.as_bytes(), &turma_val.as_bytes(), WriteFlags::empty())?;
        }

        txn.commit()?;
        Ok(id)
    }

    pub fn get_aula(&self, id: &str) -> Result<Option<Aula>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("aula:{}", id);

        match txn.get(self.aulas_db, &key.as_bytes()) {
            Ok(data) => {
                let aula: Aula = serde_json::from_slice(data)?;
                Ok(Some(aula))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar aula: {}", e)),
        }
    }

    pub fn get_aulas_by_turma(&self, turma_id: &str) -> Result<Vec<Aula>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.aulas_db)?;
        let mut aulas = Vec::new();

        for (_key, value) in cursor.iter() {
            let aula: Aula = serde_json::from_slice(value)?;
            if aula.turma_id == turma_id {
                aulas.push(aula);
            }
        }

        aulas.sort_by(|a, b| a.ordem.cmp(&b.ordem));
        Ok(aulas)
    }

    // ========== ATIVIDADES ==========

    pub fn create_atividade(&self, titulo: &str, descricao: &str, caminho: &str, icone: &str, turma_id: &str, aulas_relacionadas: Vec<String>) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let atividade = Atividade {
            id: id.clone(),
            titulo: titulo.to_string(),
            descricao: descricao.to_string(),
            caminho: caminho.to_string(),
            icone: icone.to_string(),
            turma_id: turma_id.to_string(),
            aulas_relacionadas,
            criado_em: timestamp,
            atualizado_em: timestamp,
            allow_edit: true,
            pontos_totais_hint: None,
        };

        let key = format!("atividade:{}", id);
        let value = serde_json::to_string(&atividade)?;
        txn.put(self.atividades_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        // opcional: atualizar referencia na turma
        if let Ok(tdata) = txn.get(self.turmas_db, &format!("turma:{}", turma_id).as_bytes()) {
            let mut turma: Turma = serde_json::from_slice(tdata)?;
            turma.atividades.push(atividade.clone());
            turma.atualizado_em = timestamp;
            let turma_key = format!("turma:{}", turma_id);
            let turma_val = serde_json::to_string(&turma)?;
            txn.put(self.turmas_db, &turma_key.as_bytes(), &turma_val.as_bytes(), WriteFlags::empty())?;
        }

        txn.commit()?;
        Ok(id)
    }

    pub fn get_atividade(&self, id: &str) -> Result<Option<Atividade>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("atividade:{}", id);

        match txn.get(self.atividades_db, &key.as_bytes()) {
            Ok(data) => {
                let atividade: Atividade = serde_json::from_slice(data)?;
                Ok(Some(atividade))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar atividade: {}", e)),
        }
    }

    pub fn get_atividades_by_turma(&self, turma_id: &str) -> Result<Vec<Atividade>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.atividades_db)?;
        let mut atividades = Vec::new();

        for (_key, value) in cursor.iter() {
            let atividade: Atividade = serde_json::from_slice(value)?;
            if atividade.turma_id == turma_id {
                atividades.push(atividade);
            }
        }

        Ok(atividades)
    }

    // ========== PERGUNTAS ==========

    pub fn create_pergunta(&self, atividade_id: &str, enunciado: &str, pontos: f64, ordem: i32) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        let pergunta = Pergunta {
            id: id.clone(),
            atividade_id: atividade_id.to_string(),
            enunciado: enunciado.to_string(),
            pontos,
            ordem,
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("pergunta:{}", id);
        let value = serde_json::to_string(&pergunta)?;
        txn.put(self.perguntas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn list_perguntas_by_atividade(&self, atividade_id: &str) -> Result<Vec<Pergunta>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.perguntas_db)?;
        let mut perguntas = Vec::new();

        for (_k, value) in cursor.iter() {
            let p: Pergunta = serde_json::from_slice(value)?;
            if p.atividade_id == atividade_id {
                perguntas.push(p);
            }
        }

        perguntas.sort_by(|a, b| a.ordem.cmp(&b.ordem));
        Ok(perguntas)
    }

    // ========== RESPOSTAS ==========

    pub fn submit_resposta(&self, pergunta_id: &str, atividade_id: &str, aluno_id: &str, conteudo: &str, is_submitted: bool) -> Result<String> {
        // Aqui fazemos versionamento simples: buscar últimas versões para essa pergunta/aluno
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        // contar versões existentes
        let mut versao = 1;
        {
            let mut cursor = txn.open_ro_cursor(self.respostas_db)?;
            for (_k, v) in cursor.iter() {
                let r: Resposta = serde_json::from_slice(v)?;
                if r.pergunta_id == pergunta_id && r.aluno_id == aluno_id {
                    versao = std::cmp::max(versao, r.versao + 1);
                }
            }
        }

        let resposta = Resposta {
            id: id.clone(),
            pergunta_id: pergunta_id.to_string(),
            atividade_id: atividade_id.to_string(),
            aluno_id: aluno_id.to_string(),
            conteudo: conteudo.to_string(),
            versao,
            data_envio: timestamp,
            is_submitted,
        };

        let key = format!("resposta:{}", id);
        let value = serde_json::to_string(&resposta)?;
        txn.put(self.respostas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn list_respostas_by_atividade_aluno(&self, atividade_id: &str, aluno_id: &str) -> Result<Vec<Resposta>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.respostas_db)?;
        let mut respostas = Vec::new();

        for (_k, v) in cursor.iter() {
            let r: Resposta = serde_json::from_slice(v)?;
            if r.atividade_id == atividade_id && r.aluno_id == aluno_id {
                respostas.push(r);
            }
        }

        Ok(respostas)
    }

    // ========== NOTAS ==========

    pub fn grade_resposta(&self, resposta_id: &str, professor_id: Option<&str>, valor: f64, feedback: Option<&str>, origem: &str, grade_event_sender: Option<&tokio::sync::mpsc::Sender<crate::GradeEvent>>) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        // localizar a resposta para linkar pergunta/atividade/aluno
        let mut pergunta_id: Option<String> = None;
        let mut atividade_id: Option<String> = None;
        let mut aluno_id: Option<String> = None;

        // leitura dentro do mesmo txn de leitura
        {
            let mut cursor = txn.open_ro_cursor(self.respostas_db)?;
            for (_k, v) in cursor.iter() {
                let r: Resposta = serde_json::from_slice(v)?;
                if r.id == resposta_id {
                    pergunta_id = Some(r.pergunta_id.clone());
                    atividade_id = Some(r.atividade_id.clone());
                    aluno_id = Some(r.aluno_id.clone());
                    break;
                }
            }
        }

        if pergunta_id.is_none() || atividade_id.is_none() || aluno_id.is_none() {
            return Err(anyhow!("Resposta não encontrada"));
        }

        let atividade_id = atividade_id.as_ref().unwrap();
        let aluno_id = aluno_id.as_ref().unwrap();

        // chave índice por atividade
        let idx_key_atividade = format!("atividade:{}:nota:{}", atividade_id, id);
        txn.put(self.notas_by_atividade_db, &idx_key_atividade.as_bytes(), &timestamp.to_string().as_bytes(), WriteFlags::empty())?;

        // chave índice por atividade+aluno
        let idx_key_atividade_aluno = format!("atividade:{}:aluno:{}:nota:{}", atividade_id, aluno_id, id);
        txn.put(self.notas_by_atividade_aluno_db, &idx_key_atividade_aluno.as_bytes(), &timestamp.to_string().as_bytes(), WriteFlags::empty())?;

        let nota = Nota {
            id: id.clone(),
            resposta_id: resposta_id.to_string(),
            pergunta_id: pergunta_id.clone(),
            atividade_id: atividade_id.to_string(),
            aluno_id: aluno_id.to_string(),
            professor_id: professor_id.map(|s| s.to_string()),
            valor,
            feedback: feedback.map(|s| s.to_string()),
            data_avaliacao: timestamp,
            origem: origem.to_string(),
        };

        let key = format!("nota:{}", id);
        let value = serde_json::to_string(&nota)?;
        txn.put(self.notas_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        // Atualizar agregados - async se sender disponível, síncrono caso contrário
        if let Some(sender) = grade_event_sender {
            // Modo assíncrono: enviar evento para worker
            let event = crate::GradeEvent {
                atividade_id: atividade_id.to_string(),
                aluno_id: aluno_id.to_string(),
            };
            // Usar try_send para não bloquear se o canal estiver cheio
            if let Err(e) = sender.try_send(event) {
                eprintln!("Falha ao enviar evento de nota: {}. Usando modo síncrono como fallback.", e);
                self.update_aggregate_nota_atividade_tx(&mut txn, &nota)?;
            }
        } else {
            // Modo síncrono: calcular imediatamente
            self.update_aggregate_nota_atividade_tx(&mut txn, &nota)?;
        }

        txn.commit()?;
        Ok(id)
    }

    /// Calcula dinamicamente a nota de uma atividade para um aluno (somando notas por pergunta / normalizando)
    pub fn calculate_nota_atividade_dynamic(&self, atividade_id: &str, aluno_id: &str) -> Result<NotaAtividadeAluno> {
        let txn = self.env.begin_ro_txn()?;

        // somar notas do aluno para perguntas dessa atividade
        let mut soma_obtido = 0.0f64;
        let mut soma_possivel = 0.0f64;

        // coletar perguntas para soma_possivel
        let mut perguntas: Vec<Pergunta> = Vec::new();
        {
            let mut cursor = txn.open_ro_cursor(self.perguntas_db)?;
            for (_k, v) in cursor.iter() {
                let p: Pergunta = serde_json::from_slice(v)?;
                if p.atividade_id == atividade_id {
                    perguntas.push(p);
                }
            }
        }

        for p in &perguntas {
            soma_possivel += p.pontos;
        }

        // somar notas
        {
            let mut cursor = txn.open_ro_cursor(self.notas_db)?;
            for (_k, v) in cursor.iter() {
                let n: Nota = serde_json::from_slice(v)?;
                if n.atividade_id == atividade_id && n.aluno_id == aluno_id {
                    soma_obtido += n.valor;
                }
            }
        }

        let percentual = if soma_possivel > 0.0 {
            (soma_obtido / soma_possivel) * 100.0
        } else {
            0.0
        };

        let agg = NotaAtividadeAluno {
            id: Uuid::new_v4().to_string(),
            aluno_id: aluno_id.to_string(),
            atividade_id: atividade_id.to_string(),
            soma_pontos_obtidos: soma_obtido,
            soma_pontos_possiveis: soma_possivel,
            percentual,
            calculado_em: Utc::now().timestamp(),
            calculo_origem: "dynamic_read".to_string(),
        };

        Ok(agg)
    }

    /// Atualiza a tabela de agregados (NOTA_ATIVIDADE_ALUNO) para uma nota inserida (sincrono).
    /// Implementado como função que recebe a txn para manter atomicidade quando chamada dentro de grade_resposta.
    fn update_aggregate_nota_atividade_tx(&self, txn: &mut lmdb::RwTransaction, nota: &Nota) -> Result<()> {
        let atividade_id = &nota.atividade_id;
        let aluno_id = &nota.aluno_id;
    
        let prefix = format!("atividade:{}:aluno:{}:nota:", atividade_id, aluno_id);
        let mut soma_obtido = 0.0f64;
        let mut soma_possivel = 0.0f64;
    
        // 1) calcular soma_possivel usando perguntas (ainda é necessário ler perguntas_db)
        {
            let mut cursor = txn.open_ro_cursor(self.perguntas_db)?;
            for (_k, v) in cursor.iter() {
                let p: Pergunta = serde_json::from_slice(v)?;
                if p.atividade_id == *atividade_id {
                    soma_possivel += p.pontos;
                }
            }
        }
    
        // 2) iterar apenas índices de notas para essa (atividade, aluno)
        {
            let mut cursor = txn.open_ro_cursor(self.notas_by_atividade_aluno_db)?;
            for (k, _v) in cursor.iter_from(prefix.as_bytes()) {
                // iter_from começa a partir do prefix; precisamos verificar starts_with
                if !k.starts_with(prefix.as_bytes()) { break; }
                // extrair nota_id do key (split)
                let key_str = String::from_utf8_lossy(k);
                // key: atividade:{atividade}:aluno:{aluno}:nota:{nota_id}
                if let Some(pos) = key_str.rfind(":nota:") {
                    let nota_id = &key_str[pos + 6..];
                    // buscar nota completa em notas_db
                    let nota_key = format!("nota:{}", nota_id);
                    if let Ok(n_raw) = txn.get(self.notas_db, &nota_key.as_bytes()) {
                        let n: Nota = serde_json::from_slice(n_raw)?;
                        soma_obtido += n.valor;
                    }
                }
            }
        }

        let percentual = if soma_possivel > 0.0 {
            (soma_obtido / soma_possivel) * 100.0
        } else {
            0.0
        };

        let agg = NotaAtividadeAluno {
            id: Uuid::new_v4().to_string(),
            aluno_id: aluno_id.to_string(),
            atividade_id: atividade_id.to_string(),
            soma_pontos_obtidos: soma_obtido,
            soma_pontos_possiveis: soma_possivel,
            percentual,
            calculado_em: Utc::now().timestamp(),
            calculo_origem: "sync_update".to_string(),
        };

        // chave: nota_atividade:{atividade}:{aluno}
        let key = format!("nota_atividade:{}:{}", atividade_id, aluno_id);
        let value = serde_json::to_string(&agg)?;
        txn.put(self.nota_atividade_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
        Ok(())
    }

    /// Public wrapper para atualizar agregado (abre txn)
    pub fn update_aggregate_nota_atividade(&self, atividade_id: &str, aluno_id: &str) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        // recompute by scanning notas/perguntas
        let mut soma_obtido = 0.0f64;
        let mut soma_possivel = 0.0f64;

        {
            let mut cursor = txn.open_ro_cursor(self.perguntas_db)?;
            for (_k, v) in cursor.iter() {
                let p: Pergunta = serde_json::from_slice(v)?;
                if p.atividade_id == atividade_id {
                    soma_possivel += p.pontos;
                }
            }
        }

        {
            let mut cursor = txn.open_ro_cursor(self.notas_db)?;
            for (_k, v) in cursor.iter() {
                let n: Nota = serde_json::from_slice(v)?;
                if n.atividade_id == atividade_id && n.aluno_id == aluno_id {
                    soma_obtido += n.valor;
                }
            }
        }

        let percentual = if soma_possivel > 0.0 {
            (soma_obtido / soma_possivel) * 100.0
        } else {
            0.0
        };

        let agg = NotaAtividadeAluno {
            id: Uuid::new_v4().to_string(),
            aluno_id: aluno_id.to_string(),
            atividade_id: atividade_id.to_string(),
            soma_pontos_obtidos: soma_obtido,
            soma_pontos_possiveis: soma_possivel,
            percentual,
            calculado_em: Utc::now().timestamp(),
            calculo_origem: "manual_job".to_string(),
        };

        let key = format!("nota_atividade:{}:{}", atividade_id, aluno_id);
        let value = serde_json::to_string(&agg)?;
        txn.put(self.nota_atividade_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
        txn.commit()?;
        Ok(())
    }

    pub fn get_aggregate_nota_atividade(&self, atividade_id: &str, aluno_id: &str) -> Result<Option<NotaAtividadeAluno>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("nota_atividade:{}:{}", atividade_id, aluno_id);

        match txn.get(self.nota_atividade_db, &key.as_bytes()) {
            Ok(data) => {
                let agg: NotaAtividadeAluno = serde_json::from_slice(data)?;
                Ok(Some(agg))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar agregado: {}", e)),
        }
    }

    // ========== RASCUNHOS (mantidas) ==========

    pub fn create_rascunho(&self, usuario_id: &str, atividade_id: &str, titulo: &str, conteudo: &str) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let timestamp = Utc::now().timestamp();
        let id = Uuid::new_v4().to_string();

        // Verificar se já existe rascunho para este usuário e atividade
        let existing_key = format!("rascunho:{}:{}", usuario_id, atividade_id);
        if txn.get(self.rascunhos_db, &existing_key.as_bytes()).is_ok() {
            return Err(anyhow!("Já existe um rascunho para esta atividade"));
        }

        let rascunho = Rascunho {
            id: id.clone(),
            usuario_id: usuario_id.to_string(),
            atividade_id: atividade_id.to_string(),
            titulo: titulo.to_string(),
            conteudo: conteudo.to_string(),
            criado_em: timestamp,
            atualizado_em: timestamp,
        };

        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);
        let value = serde_json::to_string(&rascunho)?;
        txn.put(self.rascunhos_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;

        txn.commit()?;
        Ok(id)
    }

    pub fn get_rascunho(&self, usuario_id: &str, atividade_id: &str) -> Result<Option<Rascunho>> {
        let txn = self.env.begin_ro_txn()?;
        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);

        match txn.get(self.rascunhos_db, &key.as_bytes()) {
            Ok(data) => {
                let rascunho: Rascunho = serde_json::from_slice(data)?;
                Ok(Some(rascunho))
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao buscar rascunho: {}", e)),
        }
    }

    pub fn update_rascunho(&self, usuario_id: &str, atividade_id: &str, titulo: Option<&str>, conteudo: Option<&str>) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);

        if let Ok(data) = txn.get(self.rascunhos_db, &key.as_bytes()) {
            let mut rascunho: Rascunho = serde_json::from_slice(data)?;

            if let Some(t) = titulo {
                rascunho.titulo = t.to_string();
            }
            if let Some(c) = conteudo {
                rascunho.conteudo = c.to_string();
            }
            rascunho.atualizado_em = Utc::now().timestamp();

            let value = serde_json::to_string(&rascunho)?;
            txn.put(self.rascunhos_db, &key.as_bytes(), &value.as_bytes(), WriteFlags::empty())?;
            txn.commit()?;
        }

        Ok(())
    }

    pub fn delete_rascunho(&self, usuario_id: &str, atividade_id: &str) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        let key = format!("rascunho:{}:{}", usuario_id, atividade_id);

        txn.del(self.rascunhos_db, &key.as_bytes(), None)?;
        txn.commit()?;
        Ok(())
    }

    pub fn get_rascunhos_usuario(&self, usuario_id: &str) -> Result<Vec<Rascunho>> {
        let txn = self.env.begin_ro_txn()?;
        let mut cursor = txn.open_ro_cursor(self.rascunhos_db)?;
        let mut rascunhos = Vec::new();
        let prefix = format!("rascunho:{}:", usuario_id);

        for (key, value) in cursor.iter() {
            if key.starts_with(prefix.as_bytes()) {
                let rascunho: Rascunho = serde_json::from_slice(value)?;
                rascunhos.push(rascunho);
            }
        }

        Ok(rascunhos)
    }

    // ========== FEEDBACK ==========
    pub fn create_feedback_atividade(&self, atividade_id: &str, aluno_id: &str, professor_id: Option<&str>, comentario: &str, publico: bool) -> Result<String> {
        let mut txn = self.env.begin_rw_txn()?;
        let id = Uuid::new_v4().to_string();
        let fb = FeedbackAtividade {
            id: id.clone(),
            atividade_id: atividade_id.to_string(),
            aluno_id: aluno_id.to_string(),
            professor_id: professor_id.map(|s| s.to_string()),
            comentario: comentario.to_string(),
            data_criacao: Utc::now().timestamp(),
            publico,
        };
        let key = format!("feedback:{}", id);
        let val = serde_json::to_string(&fb)?;
        txn.put(self.feedback_db, &key.as_bytes(), &val.as_bytes(), WriteFlags::empty())?;
        txn.commit()?;
        Ok(id)
    }

    // ========== METADATA (tokens de recuperação simples) ==========
    pub fn create_recovery_token(&self, usuario: &str, token_ttl_seconds: i64) -> Result<String> {
        // criar token id (UUID) + armazenar hash do token e expiração
        let mut txn = self.env.begin_rw_txn()?;
        let token = Uuid::new_v4().to_string();
        // hash simples usando argon2 (ok para token)
        let token_hash = self.hash_password(&token)?;
        let expires_at = Utc::now().timestamp() + token_ttl_seconds;

        let payload = json!({
            "usuario": usuario,
            "token_hash": token_hash,
            "expires_at": expires_at
        });

        let key = format!("recovery:{}", token);
        // guard: store hashed token. The token itself must be returned to the user only once.
        txn.put(self.metadata_db, &key.as_bytes(), &serde_json::to_vec(&payload)?, WriteFlags::empty())?;
        txn.commit()?;
        Ok(token)
    }

    pub fn verify_and_consume_recovery_token(&self, token: &str) -> Result<Option<String>> {
        let mut txn = self.env.begin_rw_txn()?;
        let key = format!("recovery:{}", token);
        match txn.get(self.metadata_db, &key.as_bytes()) {
            Ok(data) => {
                let obj: serde_json::Value = serde_json::from_slice(data)?;
                let token_hash = obj["token_hash"].as_str().ok_or(anyhow!("Invalid token object"))?;
                let usuario = obj["usuario"].as_str().ok_or(anyhow!("Invalid token object"))?.to_string();
                let expires_at = obj["expires_at"].as_i64().unwrap_or(0);
                if Utc::now().timestamp() > expires_at {
                    // expired
                    txn.del(self.metadata_db, &key.as_bytes(), None).ok();
                    txn.commit()?;
                    return Ok(None);
                }
                // verify hash
                if self.verify_password(token, token_hash)? {
                    // consume (delete) token
                    txn.del(self.metadata_db, &key.as_bytes(), None)?;
                    txn.commit()?;
                    return Ok(Some(usuario));
                } else {
                    return Ok(None);
                }
            }
            Err(lmdb::Error::NotFound) => Ok(None),
            Err(e) => Err(anyhow!("Erro ao verificar token: {}", e)),
        }
    }

    // ========== METADATA initialization helpers ==========
    pub fn set_initialized(&self) -> Result<()> {
        let mut txn = self.env.begin_rw_txn()?;
        txn.put(self.metadata_db, b"initialized", b"true", WriteFlags::empty())?;
        txn.commit()?;
        Ok(())
    }

    pub fn is_initialized(&self) -> Result<bool> {
        let txn = self.env.begin_ro_txn()?;

        match txn.get(self.metadata_db, b"initialized") {
            Ok(data) => Ok(data == b"true"),
            Err(lmdb::Error::NotFound) => Ok(false),
            Err(e) => Err(anyhow!("Erro ao verificar inicialização: {}", e)),
        }
    }
}
