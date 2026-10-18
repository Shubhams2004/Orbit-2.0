/**
 * Cloudflare Worker Environment and Common Types
 */

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  API_VERSION?: string;
  JWT_SECRET?: string;
  JWT_ISSUER?: string;
  JWT_AUDIENCE?: string;
  FIREBASE_PROJECT_ID?: string;
  ALLOW_DEV_TOKENS?: string;
  ASSETS?: Fetcher;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  displayName: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    timestamp: string;
  };
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStatus = 'active' | 'in_progress' | 'on_hold' | 'completed';
