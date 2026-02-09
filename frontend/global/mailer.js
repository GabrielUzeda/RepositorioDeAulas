/**
 * Email Sender - Cliente JavaScript para API Rust Mailer
 * Uso sem bibliotecas adicionais - Vanilla JavaScript
 *
 * @author Sistema de Email Rust
 * @version 1.0.0
 */

/**
 * Classe EmailJS - Fallback para serviço de email pago
 */
class EmailJSFallback {
    constructor(config = null) {
        this.config = config;
        this.initialized = false;
    }

    /**
     * Inicializa o EmailJS com a configuração
     */
    async initialize() {
        try {
            if (this.initialized) return;

            // Se não recebeu configuração, tenta carregar
            if (!this.config) {
                this.config = await this._loadEmailConfig();
            }

            if (!this.config?.public_key) {
                console.warn('EmailJS public key not configured. Fallback disabled.');
                return;
            }

            // Initialize emailjs
            emailjs.init(this.config.public_key);
            this.initialized = true;
            console.log('EmailJS fallback service initialized successfully.');

        } catch (error) {
            console.error('Failed to initialize EmailJS fallback:', error);
            throw error;
        }
    }

    /**
     * Carrega configuração do email (settings.json + secret.json)
     */
    async _loadEmailConfig() {
        let emailConfig = {};

        // Tenta carregar settings.json público (fallback)
        try {
            const response = await fetch('/settings.json');
            if (response.ok) {
                const settings = await response.json();
                emailConfig = settings.email || {};
            }
        } catch (error) {
            console.warn('Could not load settings.json:', error.message);
        }

        // Tenta mesclar com secret.json local (prioridade)
        try {
            const secretResp = await fetch('/secret.json');
            if (secretResp.ok) {
                const secrets = await secretResp.json();
                if (secrets.emailjs) {
                    emailConfig = Object.assign({}, emailConfig, secrets.emailjs);
                }
            }
        } catch (err) {
            console.warn('No secret.json found, using available config only:', err.message);
        }

        return emailConfig;
    }

    /**
     * Envia email usando EmailJS como fallback
     */
    async sendEmail(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.config || !this.config.service_id || !this.config.template_id) {
            throw new Error('EmailJS is not configured properly.');
        }

        try {
            // Prepara dados para o template EmailJS
            const emailData = {
                to_email: options.to,
                subject: options.subject,
                from_name: 'Sistema de Atividades',
                message: options.body || 'Mensagem enviada via sistema de atividades escolares.',
                ...options.variables
            };

            await emailjs.send(
                this.config.service_id,
                this.config.template_id,
                emailData
            );

            return {
                success: true,
                message: 'Email enviado com sucesso via EmailJS (fallback)',
                service: 'emailjs'
            };

        } catch (error) {
            console.error('Erro no fallback EmailJS:', error);
            throw new Error(`Fallback EmailJS failed: ${error.message}`);
        }
    }
}

/**
 * Classe principal para envio de emails
 */
class EmailSender {
    constructor(apiUrl = null) {
        // Tenta detectar automaticamente a URL da API
        if (!apiUrl) {
            // API sempre roda na mesma origem (porta padrão), independente do domínio
            if (window.location.hostname === 'localhost') {
                // Desenvolvimento local
                this.apiUrl = 'http://localhost:8080';
            } else {
                // Produção - usa o mesmo domínio sem especificar porta (nginx proxy)
                this.apiUrl = window.location.protocol + '//' + window.location.hostname;
            }
        } else {
            this.apiUrl = apiUrl;
        }
        this.endpoint = '/send-mail';

        // Instância do fallback EmailJS
        this.fallbackService = new EmailJSFallback();
        this.fallbackEnabled = true;
    }

    /**
     * Envia um email usando a API com fallback para EmailJS
     *
     * @param {Object} options - Opções do email
     * @param {string} options.to - Email do destinatário (obrigatório)
     * @param {string} options.subject - Assunto do email (obrigatório)
     * @param {string} options.template - Nome do template (padrão: 'default.txt')
     * @param {Object} options.variables - Variáveis para substituir no template
     * @param {string} options.body - Corpo do email (usado se não houver template)
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendEmail(options = {}) {
        // Validação básica
        if (!options.to) {
            throw new Error('Destinatário (to) é obrigatório');
        }
        if (!options.subject) {
            throw new Error('Assunto (subject) é obrigatório');
        }

        // Tentar primeiro o serviço principal (Rust) com timeout
        try {
            const result = await this._tryPrimaryService(options);
            return result;
        } catch (primaryError) {
            console.warn('Serviço principal falhou:', primaryError.message);

            // Verificar se EmailJS está configurado antes de tentar fallback
            try {
                await this.fallbackService.initialize();
                // Se chegou aqui, EmailJS está configurado, tentar fallback
                if (this.fallbackEnabled) {
                    try {
                        const fallbackResult = await this.fallbackService.sendEmail(options);
                        return fallbackResult;
                    } catch (fallbackError) {
                        console.error('Fallback EmailJS também falhou:', fallbackError.message);

                        return {
                            success: false,
                            message: `Ambos os serviços falharam. Primário: ${primaryError.message}, Fallback: ${fallbackError.message}`,
                            error: { primary: primaryError, fallback: fallbackError }
                        };
                    }
                }
            } catch (initError) {
                // EmailJS não está configurado, retornar apenas erro do serviço principal
                console.warn('EmailJS não configurado, não há fallback disponível');
            }

            return {
                success: false,
                message: `Serviço principal falhou: ${primaryError.message}`,
                error: primaryError
            };
        }
    }

    /**
     * Tenta enviar email usando o serviço principal (Rust) com timeout
     */
    async _tryPrimaryService(options = {}) {
        // Usar AbortController para timeout mais confiável
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            // Preparar payload
            const payload = {
                to: options.to,
                subject: options.subject,
                template: options.template || 'default.txt',
                variables: options.variables || {}
            };

            // Se não usar template, usar o corpo direto
            if (!options.template && options.body) {
                payload.template = 'default.txt';
                payload.variables = { body: options.body };
            }

            // Fazer requisição com timeout
            const response = await fetch(`${this.apiUrl}${this.endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro na requisição');
            }

            clearTimeout(timeoutId);
            return {
                success: true,
                message: result.message,
                data: result,
                service: 'rust'
            };

        } catch (error) {
            clearTimeout(timeoutId);

            // Verificar se foi timeout
            if (error.name === 'AbortError') {
                throw new Error('Timeout: Serviço principal demorou mais de 30 segundos');
            }

            console.error('Erro no serviço principal:', error);

            // Verifica se é erro de conexão
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Erro de conexão com o servidor. Verifique se a API está rodando.');
            }

            // Verifica se é erro de resposta HTTP
            if (error.message.includes('HTTP')) {
                throw new Error(`Erro do servidor: ${error.message}`);
            }

            throw new Error(error.message || 'Erro desconhecido ao enviar email');
        }
    }

    /**
     * Envia email com template HTML personalizado
     *
     * @param {string} to - Destinatário
     * @param {string} subject - Assunto
     * @param {string} template - Nome do template (ex: 'envio_atividades.html')
     * @param {Object} variables - Variáveis do template
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendTemplateEmail(to, subject, template, variables = {}) {
        return this.sendEmail({
            to,
            subject,
            template,
            variables
        });
    }

    /**
     * Envia email simples (sem template)
     *
     * @param {string} to - Destinatário
     * @param {string} subject - Assunto
     * @param {string} body - Corpo do email
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendSimpleEmail(to, subject, body) {
        return this.sendEmail({
            to,
            subject,
            body
        });
    }

    /**
     * Envia email de atividade escolar
     *
     * @param {string} to - Email do professor/destinatário
     * @param {string} turma - Nome da turma
     * @param {string} fromName - Nome do aluno
     * @param {string} tema - Tema da aula
     * @param {string} mensagem - Mensagem da atividade
     * @returns {Promise<Object>} Resultado do envio
     */
    async sendAtividadeEmail(to, turma, fromName, tema, mensagem) {
        return this.sendTemplateEmail(
            to,
            'Nova Atividade Enviada',
            'envio_atividades.html',
            {
                turma,
                from_name: fromName,
                tema,
                mensagem
            }
        );
    }
}

/**
 * Instância global do EmailSender (opcional)
 * Pode ser usada diretamente: window.emailSender.sendEmail({...})
 */
window.emailSender = new EmailSender();

// Exporta a classe para uso em módulos ES6
export default EmailSender;

/**
 * Funções de conveniência globais
 */

// Envio rápido de email
window.sendEmail = async (to, subject, body, template = null, variables = {}) => {
    const options = { to, subject };
    if (template) {
        options.template = template;
        options.variables = variables;
    } else {
        options.body = body;
    }
    return await window.emailSender.sendEmail(options);
};

// Envio de atividade escolar
window.sendAtividade = async (to, turma, fromName, tema, mensagem) => {
    return await window.emailSender.sendAtividadeEmail(to, turma, fromName, tema, mensagem);
};

// Teste da API
window.testEmailAPI = async () => {
    console.log('🧪 Testando API de email...');

    const result = await window.emailSender.sendEmail({
        to: 'teste@example.com',
        subject: 'Teste da API',
        body: 'Este é um teste da API de envio de emails!'
    });

    console.log('📧 Resultado:', result);
    return result;
};

/**
 * Funções utilitárias
 */

// Valida formato de email
window.isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Mostra resultado em um elemento HTML
window.showEmailResult = (elementId, result) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `
        <div style="
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid ${result.success ? '#4CAF50' : '#f44336'};
            background-color: ${result.success ? '#e8f5e8' : '#ffebee'};
            color: ${result.success ? '#2e7d32' : '#c62828'};
        ">
            <strong>${result.success ? '✅ Sucesso' : '❌ Erro'}:</strong>
            ${result.message}
        </div>
    `;
};
