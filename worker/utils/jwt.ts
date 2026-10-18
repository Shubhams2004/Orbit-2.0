/**
 * Web Crypto HS256 JWT Sign & Verify Utilities
 * Compatible with Cloudflare Workers V8 runtime and Node.js Web Crypto API.
 */

export interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

export interface JwtPayload {
  sub: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  name?: string;
  display_name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface VerifyJwtOptions {
  issuer?: string;
  audience?: string;
  clockToleranceSeconds?: number;
  requireExp?: boolean;
}

export interface SignJwtOptions {
  expiresInSeconds?: number;
  issuer?: string;
  audience?: string;
}

/**
 * Base64URL encoding without external dependencies
 */
export function base64UrlEncode(data: Uint8Array | string): string {
  const binary = typeof data === 'string'
    ? data
    : Array.from(data, (b) => String.fromCharCode(b)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decoding to Uint8Array
 */
export function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Base64URL decoding to UTF-8 string
 */
export function base64UrlDecodeString(str: string): string {
  const bytes = base64UrlDecode(str);
  return new TextDecoder().decode(bytes);
}

/**
 * Signs an HS256 JWT using Web Crypto API
 */
export async function signHs256Jwt(
  payload: JwtPayload,
  secret: string,
  options?: SignJwtOptions
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    iat: now,
    ...payload,
  };

  if (options?.expiresInSeconds !== undefined && fullPayload.exp === undefined) {
    fullPayload.exp = now + options.expiresInSeconds;
  }
  if (options?.issuer && !fullPayload.iss) {
    fullPayload.iss = options.issuer;
  }
  if (options?.audience && !fullPayload.aud) {
    fullPayload.aud = options.audience;
  }

  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verifies an HS256 JWT using Web Crypto API
 * Validates cryptographic signature, algorithm, sub claim, expiration, and issuer/audience policies.
 */
export async function verifyHs256Jwt(
  token: string,
  secret: string,
  options?: VerifyJwtOptions
): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('MALFORMED_TOKEN');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('MALFORMED_TOKEN');
  }

  // 1. Verify Header
  let header: JwtHeader;
  try {
    header = JSON.parse(base64UrlDecodeString(headerB64));
  } catch {
    throw new Error('MALFORMED_TOKEN_HEADER');
  }

  if (header.alg !== 'HS256') {
    throw new Error('UNSUPPORTED_ALGORITHM');
  }

  // 2. Cryptographic Signature Verification
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlDecode(signatureB64);
  } catch {
    throw new Error('INVALID_SIGNATURE_ENCODING');
  }

  const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as unknown as BufferSource, data);
  if (!isValid) {
    throw new Error('INVALID_SIGNATURE');
  }

  // 3. Verify Payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecodeString(payloadB64));
  } catch {
    throw new Error('MALFORMED_TOKEN_PAYLOAD');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('MALFORMED_TOKEN_PAYLOAD');
  }

  // 4. Validate subject (sub)
  if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new Error('MISSING_SUB_CLAIM');
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options?.clockToleranceSeconds || 0;

  // 5. Validate expiration (exp)
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number' || payload.exp + tolerance < now) {
      throw new Error('TOKEN_EXPIRED');
    }
  } else if (options?.requireExp) {
    throw new Error('MISSING_EXP_CLAIM');
  }

  // 6. Validate not before (nbf)
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number' || payload.nbf - tolerance > now) {
      throw new Error('TOKEN_NOT_YET_VALID');
    }
  }

  // 7. Validate issuer (iss)
  if (options?.issuer && payload.iss !== options.issuer) {
    throw new Error('INVALID_ISSUER');
  }

  // 8. Validate audience (aud)
  if (options?.audience) {
    if (Array.isArray(payload.aud)) {
      if (!payload.aud.includes(options.audience)) {
        throw new Error('INVALID_AUDIENCE');
      }
    } else if (payload.aud !== options.audience) {
      throw new Error('INVALID_AUDIENCE');
    }
  }

  return payload;
}
