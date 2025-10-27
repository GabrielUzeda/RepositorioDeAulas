use crate::database::database::DatabaseManager;
use crate::database::models::*;
use anyhow::Result;

pub async fn initialize_clean_database(db: &DatabaseManager) -> Result<()> {
    println!("🧹 Inicializando banco limpo com apenas administrador...");

    let clean_data = r#"{
        "turmas": {},
        "logica": {
            "nome": "",
            "cor": "",
            "icone": "",
            "aulas": {},
            "atividades": []
        },
        "usuarios_iniciais": [
            {
                "usuario": "admin",
                "senha": "asdf1234",
                "nome": "Administrador do Sistema",
                "cargo": "admin",
                "turmas": []
            }
        ]
    }"#;

    let initial_data: InitialData = serde_json::from_str(clean_data)?;
    initialize_database(db, initial_data).await
}

async fn initialize_database(db: &DatabaseManager, data: InitialData) -> Result<()> {
    println!("🏗️  Inicializando estruturas do banco...");

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
