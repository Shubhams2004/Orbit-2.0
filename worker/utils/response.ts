import { ApiResponse } from '../types';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export function jsonResponse<T>(
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
  additionalHeaders?: Record<string, string>
): Response {
  const body: ApiResponse<T> = {
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...additionalHeaders,
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): Response {
  const body: ApiResponse = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
