use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env};
use tokio::{sync::{mpsc, oneshot}, time::{sleep, Duration}};
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha20Rng;
use lettre::{
    AsyncSmtpTransport, Tokio1Executor, AsyncTransport, Message,
    transport::smtp::authentication::Credentials,
    message::{MultiPart, SinglePart, header::ContentType},
};
use std::fs;
use anyhow;

#[derive(Deserialize, Clone)]
pub struct MailRequest {
    pub to: String,
    pub subject: String,
    pub template: Option<String>,
    pub variables: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
pub struct MailResponse {
    pub success: bool,
    pub message: String,
}

struct MailJob {
    request: MailRequest,
    response_tx: oneshot::Sender<Result<(), String>>,
}

static mut TX: Option<mpsc::Sender<MailJob>> = None;

pub async fn send_mail(Json(req): Json<MailRequest>) -> Result<Json<MailResponse>, StatusCode> {
    let (response_tx, response_rx) = oneshot::channel();
    
    let job = MailJob {
        request: req,
        response_tx,
    };
    
    unsafe {
        if let Some(tx) = TX.as_ref() {
            if tx.send(job).await.is_err() {
                return Ok(Json(MailResponse {
                    success: false,
                    message: "Erro ao enfileirar email".to_string(),
                }));
            }
            
            match response_rx.await {
                Ok(Ok(())) => {
                    return Ok(Json(MailResponse {
                        success: true,
                        message: "Email enviado com sucesso".to_string(),
                    }));
                }
                Ok(Err(err)) => {
                    return Ok(Json(MailResponse {
                        success: false,
                        message: format!("Erro ao enviar email: {}", err),
                    }));
                }
                Err(_) => {
                    return Ok(Json(MailResponse {
                        success: false,
                        message: "Erro interno ao processar email".to_string(),
                    }));
                }
            }
        }
    }
    
    Ok(Json(MailResponse {
        success: false,
        message: "Serviço de email não inicializado".to_string(),
    }))
}

pub fn init_mailer() {
    let (tx, rx) = mpsc::channel::<MailJob>(100);
    unsafe { TX = Some(tx); }
    tokio::spawn(mail_worker(rx));
}

async fn mail_worker(mut rx: mpsc::Receiver<MailJob>) {
    let mut rng = ChaCha20Rng::from_entropy();

    while let Some(job) = rx.recv().await {
        let result = match process_mail(job.request).await {
            Ok(()) => Ok(()),
            Err(err) => {
                eprintln!("Erro ao enviar email: {err:?}");
                Err(format!("{}", err))
            }
        };
        
        let _ = job.response_tx.send(result);

        let delay_ms = rng.gen_range(1200..=2000);
        sleep(Duration::from_millis(delay_ms)).await;
    }
}

async fn process_mail(req: MailRequest) -> anyhow::Result<()> {
    let smtp_host = env::var("SMTP_HOST")?;
    let smtp_port: u16 = env::var("SMTP_PORT")?.parse()?;
    let smtp_user = env::var("SMTP_USERNAME")?;
    let smtp_pass = env::var("SMTP_PASSWORD")?;
    let mail_from = env::var("MAIL_FROM")?;

    let template_name = req.template.unwrap_or_else(|| "default.txt".to_string());
    
    // Security check to prevent path traversal
    if template_name.contains('/') || template_name.contains('\\') || template_name.contains("..") {
        return Err(anyhow::anyhow!("Invalid template name"));
    }

    let template_path = format!("/app/templates/{}", template_name);

    let mut body = fs::read_to_string(&template_path)?;

    if let Some(vars) = req.variables {
        for (k, v) in vars {
            body = body.replace(&format!("{{{{{}}}}}", k), &v);
        }
    }

    let creds = Credentials::new(smtp_user.clone(), smtp_pass);

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp_host)?
        .port(smtp_port)
        .credentials(creds)
        .build();

    let is_html = template_name.ends_with(".html");
    let email = if is_html {
        Message::builder()
            .from(mail_from.parse()?)
            .to(req.to.parse()?)
            .subject(req.subject)
            .multipart(
                MultiPart::alternative().singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(body),
                ),
            )?
    } else {
        Message::builder()
            .from(mail_from.parse()?)
            .to(req.to.parse()?)
            .subject(req.subject)
            .body(body)?
    };

    mailer.send(email).await?;
    Ok(())
}
