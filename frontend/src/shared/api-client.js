/**
 * API Client - Modular Request Handler for the backend
 */
class ApiClient {
    constructor(baseUrl = null) {
        if (!baseUrl) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                this.baseUrl = 'http://localhost:8080';
            } else {
                this.baseUrl = window.location.protocol + '//' + window.location.hostname;
            }
        } else {
            this.baseUrl = baseUrl;
        }

        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };

        this.defaultTimeout = 30000;
    }

    setProfessorToken(token) {
        const expiry = Date.now() + (23 * 60 * 60 * 1000);
        sessionStorage.setItem('professor_auth', JSON.stringify({ token, expiry }));
    }

    getProfessorToken() {
        const auth = sessionStorage.getItem('professor_auth');
        if (!auth) return null;
        try {
            const { token, expiry } = JSON.parse(auth);
            if (Date.now() > expiry) {
                sessionStorage.removeItem('professor_auth');
                return null;
            }
            return token;
        } catch (e) {
            return null;
        }
    }

    clearProfessorAuth() {
        sessionStorage.removeItem('professor_auth');
    }

    _createTimeoutSignal(timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        return { signal: controller.signal, timeoutId };
    }

    async request(endpoint, method = 'GET', data = null, options = {}) {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const timeout = options.timeout || this.defaultTimeout;
        const { signal, timeoutId } = this._createTimeoutSignal(timeout);

        const headers = { ...this.defaultHeaders, ...options.headers };
        const token = this.getProfessorToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = { method, headers, signal };
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            const contentType = response.headers.get('content-type');
            let result;
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                result = await response.text();
            }

            if (!response.ok) {
                const errorMessage = (typeof result === 'object' && result.message)
                    ? result.message
                    : (typeof result === 'string' && result.length < 100 ? result : `Erro ${response.status}`);

                // Tenta usar o modal global se disponível e aguarda interação
                if (!options.silent && window.showErrorModal) {
                    await window.showErrorModal(errorMessage);
                }

                return { success: false, message: errorMessage, status: response.status };
            }

            // Sucesso automático para escrita se não for silent e aguarda interação
            if (!options.silent && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
                if (window.showSuccessModal) {
                    await window.showSuccessModal(options.successMessage || 'Operação realizada com sucesso!');
                }
            }

            return { success: true, data: result, status: response.status };

        } catch (error) {
            clearTimeout(timeoutId);
            let errorMessage = error.name === 'AbortError' ? `Tempo esgotado` : 'Erro de conexão.';
            if (!options.silent && window.showErrorModal) {
                window.showErrorModal(errorMessage);
            }
            return { success: false, message: errorMessage, error: error };
        }
    }

    async get(endpoint, options = {}) { return this.request(endpoint, 'GET', null, options); }
    async post(endpoint, data, options = {}) { return this.request(endpoint, 'POST', data, options); }
    async put(endpoint, data, options = {}) { return this.request(endpoint, 'PUT', data, options); }
    async delete(endpoint, options = {}) { return this.request(endpoint, 'DELETE', null, options); }
}

// Export singleton
export const apiClient = new ApiClient();
window.apiClient = apiClient;
export default apiClient;
