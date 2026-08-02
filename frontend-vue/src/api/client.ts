import type { ApiResponse } from '@/types';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  public getProfessorToken(): string | null {
    try {
      const stored = sessionStorage.getItem('professor_auth');
      if (!stored) return null;
      const data = JSON.parse(stored);
      if (data.expiry && Date.now() > data.expiry) {
        sessionStorage.removeItem('professor_auth');
        return null;
      }
      return data.token || null;
    } catch {
      return null;
    }
  }

  public setProfessorToken(token: string): void {
    const data = {
      token,
      expiry: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    sessionStorage.setItem('professor_auth', JSON.stringify(data));
  }

  public clearProfessorAuth(): void {
    sessionStorage.removeItem('professor_auth');
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const token = this.getProfessorToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const status = response.status;

      if (status === 401 && endpoint !== '/auth/login') {
        this.clearProfessorAuth();
      }

      if (status === 204) {
        return { success: true, status };
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return {
          success: response.ok,
          data: response.ok ? data : undefined,
          error: !response.ok ? (typeof data === 'string' ? data : data.error || 'Erro na requisição') : undefined,
          status
        };
      } else {
        const text = await response.text();
        return {
          success: response.ok,
          data: response.ok ? (text as any) : undefined,
          error: !response.ok ? text : undefined,
          status
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Erro de conexão',
        status: 0
      };
    }
  }

  public get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  public put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  public delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
