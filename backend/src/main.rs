mod mailer;
mod database;
mod startup;
mod routes;

#[tokio::main]
async fn main() {
    // Inicialização centralizada
    let state = startup::run_init().await;

    // Configuração de rotas centralizada
    let app = routes::create_router(state);

    println!("🚀 Servidor Rust Mailer rodando em 0.0.0.0:8080");
    println!("📧 Endpoint: POST /send-mail");
    println!("📁 Templates disponíveis em: /app/templates/");
    println!("🗄️  Postgres disponível via DATABASE_URL");
    println!("🌐 CORS habilitado para desenvolvimento");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
