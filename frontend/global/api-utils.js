// global/api-utils.js

/**
 * Configurações globais da API
 */
export const API_BASE = 'http://localhost:8080';

/**
 * Função genérica para fazer requisições à API
 * @param {string} endpoint - Endpoint da API (ex: '/auth/login')
 * @param {object} options - Opções da requisição (method, body, headers, etc.)
 * @returns {Promise<object>} Resposta JSON da API
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthToken(),
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Obtém o token de autenticação do localStorage
 * @returns {string} Token de autenticação ou string vazia
 */
export function getAuthToken() {
  try {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    return user ? user.usuario : '';
  } catch {
    return '';
  }
}

/**
 * Verifica se o usuário está autenticado
 * @returns {object|null} Dados do usuário ou null se não autenticado
 */
export function checkAuth() {
  const savedUser = localStorage.getItem('currentUser');
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return null;
  }
}

/**
 * Faz logout do usuário
 */
export function logout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userToken');
}

/**
 * Validações comuns de formulário
 */
export const validations = {
  /**
   * Valida se um campo está preenchido
   * @param {string} value - Valor do campo
   * @param {string} fieldName - Nome do campo para mensagem de erro
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  required: (value, fieldName) => {
    if (!value || value.trim() === '') {
      return `${fieldName} é obrigatório`;
    }
    return null;
  },

  /**
   * Valida formato de email
   * @param {string} email - Email a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return 'Email inválido';
    }
    return null;
  },

  /**
   * Valida tamanho mínimo da senha
   * @param {string} password - Senha a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  password: (password) => {
    if (password && password.length < 6) {
      return 'A senha deve ter pelo menos 6 caracteres';
    }
    return null;
  }
};

/**
 * Utilitários para manipulação de DOM
 */
export const domUtils = {
  /**
   * Mostra um elemento
   * @param {string|Element} element - ID do elemento ou elemento DOM
   */
  show: (element) => {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (el) el.classList.remove('hidden');
  },

  /**
   * Esconde um elemento
   * @param {string|Element} element - ID do elemento ou elemento DOM
   */
  hide: (element) => {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (el) el.classList.add('hidden');
  },

  /**
   * Alterna visibilidade de um elemento
   * @param {string|Element} element - ID do elemento ou elemento DOM
   */
  toggle: (element) => {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (el) el.classList.toggle('hidden');
  }
};
