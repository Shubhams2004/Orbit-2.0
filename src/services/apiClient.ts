/**
 * Orbit 2.0 API Client
 * Centralized fetch handler for Cloudflare Workers API (/api/v1).
 * Never exposes secrets; attaches authorization headers from current session.
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string = 'dev_usr_main_01'; // Default development bearer credential

  constructor() {
    this.baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  getAuthToken(): string {
    return this.authToken;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers = {}, ...customConfig } = options;

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.authToken}`,
    };

    const config: RequestInit = {
      ...customConfig,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err: unknown) {
      throw new ApiError(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : 'Network request failed. Is the Cloudflare Worker running?',
        0
      );
    }

    let payload: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {}
    }

    if (!response.ok) {
      const code = payload?.error?.code || `HTTP_${response.status}`;
      const message = payload?.error?.message || response.statusText || 'Request failed';
      const details = payload?.error?.details;
      throw new ApiError(code, message, response.status, details);
    }

    return payload?.data !== undefined ? (payload.data as T) : (payload as T);
  }

  get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
