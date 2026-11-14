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
  timeoutMs?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_STREAM_TIMEOUT_MS = 140_000;

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

  private async resolveAuthHeader(): Promise<string | null> {
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

    return effectiveToken ? `Bearer ${effectiveToken}` : null;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
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

    return url;
  }

  private createTimeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number) {
    const controller = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort();
      } else {
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
      }
    }

    return {
      signal: controller.signal,
      didTimeout: () => timedOut,
      cleanup: () => {
        clearTimeout(timer);
        if (parentSignal) {
          parentSignal.removeEventListener('abort', onParentAbort);
        }
      },
    };
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal: parentSignal, ...customConfig } = options;
    const url = this.buildUrl(endpoint, params);

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const authHeader = await this.resolveAuthHeader();
    if (authHeader) {
      defaultHeaders['Authorization'] = authHeader;
    }

    const timeoutCtrl = this.createTimeoutSignal(parentSignal ?? undefined, timeoutMs);

    const config: RequestInit = {
      ...customConfig,
      signal: timeoutCtrl.signal,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err: unknown) {
      timeoutCtrl.cleanup();
      if (timeoutCtrl.didTimeout()) {
        throw new ApiError(
          'REQUEST_TIMEOUT',
          'The request timed out while waiting for the server. Please try again.',
          504,
          { retryable: true }
        );
      }
      if (parentSignal?.aborted) {
        throw new ApiError('REQUEST_ABORTED', 'Request was cancelled.', 499, { retryable: false });
      }
      throw new ApiError(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : 'Network request failed. Please check your connection and try again.',
        0,
        { retryable: true }
      );
    }

    timeoutCtrl.cleanup();

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

  async streamPost(
    endpoint: string,
    body: unknown,
    options: { signal?: AbortSignal; timeoutMs?: number } = {}
  ): Promise<Response> {
    const url = this.buildUrl(endpoint);
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
    };

    const authHeader = await this.resolveAuthHeader();
    if (authHeader) {
      defaultHeaders['Authorization'] = authHeader;
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
    const timeoutCtrl = this.createTimeoutSignal(options.signal, timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: defaultHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: timeoutCtrl.signal,
      });
    } catch (err: unknown) {
      timeoutCtrl.cleanup();
      if (timeoutCtrl.didTimeout()) {
        throw new ApiError(
          'REQUEST_TIMEOUT',
          'The connection timed out before receiving a response. Please retry.',
          504,
          { retryable: true }
        );
      }
      if (options.signal?.aborted) {
        throw new ApiError('REQUEST_ABORTED', 'Generation was cancelled.', 499, { retryable: false });
      }
      throw new ApiError(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : 'Network request failed. Please try again.',
        0,
        { retryable: true }
      );
    }

    timeoutCtrl.cleanup();

    if (!response.ok) {
      let payload: any = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          payload = await response.json();
        } catch {}
      }
      const code = payload?.error?.code || `HTTP_${response.status}`;
      const message =
        payload?.error?.message ||
        (response.status === 524
          ? 'The AI provider gateway timed out (HTTP 524). Please retry.'
          : response.statusText || `Request failed with HTTP ${response.status}`);
      const details = payload?.error?.details;
      throw new ApiError(code, message, response.status, details);
    }

    return response;
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

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
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
