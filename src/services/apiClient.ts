/**
 * Orbit 2.0 API Client
 * Centralized fetch handler for Cloudflare Workers API (/api/v1).
 * Never exposes secrets; attaches authorization headers from current session.
 */

import { getCurrentIdToken } from '../lib/firebase';

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

export const isProductionEnv = (): boolean => {
  return Boolean(
    (typeof import.meta !== 'undefined' && import.meta.env?.PROD) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
  );
};

export const isDevToken = (token: string): boolean => {
  if (!token) return false;
  const clean = token.trim();
  return (
    clean.startsWith('dev_') ||
    clean === 'demo_user' ||
    clean === 'orbit_default_token' ||
    !clean.includes('.')
  );
};

export class ApiClient {
  private baseUrl: string;
  private authToken: string;

  constructor() {
    this.baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
    let saved = '';
    try {
      saved = localStorage.getItem('orbit_bearer_token') || '';
    } catch {}

    // In production, never load development tokens from localStorage
    if (isProductionEnv() && isDevToken(saved)) {
      saved = '';
      try {
        localStorage.removeItem('orbit_bearer_token');
      } catch {}
    }

    this.authToken = saved;
  }

  setAuthToken(token: string) {
    const clean = (token || '').trim();

    // In production, never accept development tokens
    if (isProductionEnv() && isDevToken(clean)) {
      this.authToken = '';
      try {
        localStorage.removeItem('orbit_bearer_token');
      } catch {}
      return;
    }

    this.authToken = clean;
    try {
      if (this.authToken) {
        localStorage.setItem('orbit_bearer_token', this.authToken);
      } else {
        localStorage.removeItem('orbit_bearer_token');
      }
    } catch {}
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
    };

    // Obtain a fresh Firebase ID token if an active session exists
    let effectiveToken = '';
    try {
      const freshFirebaseToken = await getCurrentIdToken();
      if (freshFirebaseToken) {
        effectiveToken = freshFirebaseToken;
        this.authToken = freshFirebaseToken;
      }
    } catch {}

    // Fall back to saved token only if fresh Firebase token is not available and token is valid for current environment
    if (!effectiveToken && this.authToken) {
      if (isProductionEnv()) {
        if (isDevToken(this.authToken)) {
          this.authToken = '';
          try {
            localStorage.removeItem('orbit_bearer_token');
          } catch {}
        } else {
          effectiveToken = this.authToken;
        }
      } else {
        effectiveToken = this.authToken;
      }
    }

    // Never attach development tokens in production
    if (effectiveToken && isProductionEnv() && isDevToken(effectiveToken)) {
      effectiveToken = '';
      this.authToken = '';
      try {
        localStorage.removeItem('orbit_bearer_token');
      } catch {}
    }

    if (effectiveToken) {
      defaultHeaders['Authorization'] = `Bearer ${effectiveToken}`;
    }

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
