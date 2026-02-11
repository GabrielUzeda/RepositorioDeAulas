use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::env;

pub async fn professor_auth(
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req.headers()
        .get("X-Professor-Password")
        .and_then(|h| h.to_str().ok());

    let professor_password = env::var("PROFESSOR_PASSWORD").unwrap_or_else(|_| "admin123".to_string());

    if let Some(auth) = auth_header {
        if auth == professor_password {
            return Ok(next.run(req).await);
        }
    }

    Err(StatusCode::UNAUTHORIZED)
}
