/**
 * API Client - Modular Request Handler for Rust Backend
 * Provides a consistent interface for AJAX requests with error handling and timeouts.
 *
 * @version 1.0.0
 */

class ApiClient {
    constructor(baseUrl = null) {
        // Auto-detect base URL if not provided
        if (!baseUrl) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                this.baseUrl = 'http://localhost:8080'; // Default Rust backend port
            } else {
                this.baseUrl = window.location.protocol + '//' + window.location.hostname;
            }
        } else {
            this.baseUrl = baseUrl;
        }

        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };

        this.defaultTimeout = 30000; // 30 seconds
    }

    /**
     * Helper to handle timeouts using AbortController
     */
    _createTimeoutSignal(timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        return { signal: controller.signal, timeoutId };
    }

    /**
     * Core request method
     */
    async request(endpoint, method = 'GET', data = null, options = {}) {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const timeout = options.timeout || this.defaultTimeout;
        const { signal, timeoutId } = this._createTimeoutSignal(timeout);

        const config = {
            method,
            headers: { ...this.defaultHeaders, ...options.headers },
            signal
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            // Handle non-JSON responses if needed, but default to JSON
            const contentType = response.headers.get('content-type');
            let result;
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                result = await response.text();
            }

            if (!response.ok) {
                // Try to extract error message from JSON response
                const errorMessage = (typeof result === 'object' && result.message) 
                    ? result.message 
                    : `Request failed with status ${response.status}`;
                
                throw new Error(errorMessage);
            }

            return {
                success: true,
                data: result,
                status: response.status
            };

        } catch (error) {
            clearTimeout(timeoutId);

            let errorMessage = error.message;

            if (error.name === 'AbortError') {
                errorMessage = `Request timeout after ${timeout}ms`;
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection or if the server is running.';
            }

            console.error(`API Error [${method} ${endpoint}]:`, error);

            return {
                success: false,
                message: errorMessage,
                error: error
            };
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, 'GET', null, options);
    }

    async post(endpoint, data, options = {}) {
        return this.request(endpoint, 'POST', data, options);
    }

    async put(endpoint, data, options = {}) {
        return this.request(endpoint, 'PUT', data, options);
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, 'DELETE', null, options);
    }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default ApiClient;

// Expose to window for non-module scripts
window.apiClient = apiClient;
