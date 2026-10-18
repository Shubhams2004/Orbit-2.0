/**
 * Firebase Authentication ID Token Verification Engine for Cloudflare Workers
 * 
 * Complies with the official Firebase ID token verification specification:
 * - RS256 signature verification via Web Crypto API (RSASSA-PKCS1-v1_5 SHA-256)
 * - Automatic retrieval and caching of Google's public JWKS certificates
 * - Verification of 'sub', 'aud', 'iss', 'exp', 'iat', and 'auth_time' claims
 * - Zero external runtime dependencies; purely native Web Crypto
 */

import { base64UrlDecode, base64UrlDecodeString } from './jwt';

export interface FirebaseIdTokenPayload {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  auth_time: number;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  firebase?: {
    identities?: Record<string, unknown>;
    sign_in_provider?: string;
  };
  [key: string]: unknown;
}

export interface FirebaseTokenHeader {
  alg: string;
  kid: string;
  typ?: string;
}

interface JwkKey {
  kty: string;
  alg?: string;
  use?: string;
  kid: string;
  n: string;
  e: string;
}

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// In-memory JWKS and imported CryptoKey cache
let jwksCache: {
  keys: Map<string, JwkKey>;
  expiresAt: number;
} | null = null;

const importedKeyCache = new Map<string, CryptoKey>();

// Test key registry for offline integration tests
const testKeyRegistry = new Map<string, CryptoKey>();

/**
 * Register a test RSA key (used during automated integration tests)
 */
export function registerTestPublicKey(kid: string, key: CryptoKey): void {
  testKeyRegistry.set(kid, key);
}

/**
 * Clear all test keys and caches
 */
export function clearKeyCaches(): void {
  testKeyRegistry.clear();
  importedKeyCache.clear();
  jwksCache = null;
}

/**
 * Fetches and caches Google's public JWKS keys with respect to Cache-Control headers
 */
async function getGooglePublicJwk(kid: string): Promise<JwkKey | null> {
  const now = Date.now();

  // If cache is valid and has the key, return it
  if (jwksCache && jwksCache.expiresAt > now && jwksCache.keys.has(kid)) {
    return jwksCache.keys.get(kid)!;
  }

  // Fetch fresh JWKS if expired or kid is missing
  try {
    const res = await fetch(GOOGLE_JWKS_URL);
    if (!res.ok) {
      return null;
    }

    // Determine cache TTL from Cache-Control header
    let ttlSeconds = 3600; // Default 1 hour
    const cacheControl = res.headers.get('cache-control');
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/i);
      if (match && match[1]) {
        ttlSeconds = parseInt(match[1], 10);
      }
    }

    const data = (await res.json()) as { keys?: JwkKey[] };
    if (!data.keys || !Array.isArray(data.keys)) {
      return null;
    }

    const newMap = new Map<string, JwkKey>();
    for (const k of data.keys) {
      if (k.kid) {
        newMap.set(k.kid, k);
      }
    }

    jwksCache = {
      keys: newMap,
      expiresAt: now + ttlSeconds * 1000,
    };

    return newMap.get(kid) || null;
  } catch {
    return null;
  }
}

/**
 * Imports a JWK into a Web Crypto CryptoKey for RSASSA-PKCS1-v1_5 verification
 */
async function getCryptoKey(kid: string): Promise<CryptoKey | null> {
  // Check test registry first
  if (testKeyRegistry.has(kid)) {
    return testKeyRegistry.get(kid)!;
  }

  // Check imported key cache
  if (importedKeyCache.has(kid)) {
    return importedKeyCache.get(kid)!;
  }

  // Fetch JWK
  const jwk = await getGooglePublicJwk(kid);
  if (!jwk) {
    return null;
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    importedKeyCache.set(kid, cryptoKey);
    return cryptoKey;
  } catch {
    return null;
  }
}

/**
 * Verifies a Firebase Auth ID Token using Web Crypto RS256
 */
export async function verifyFirebaseIdToken(
  token: string,
  expectedProjectId: string = 'orbit-2-auth'
): Promise<FirebaseIdTokenPayload> {
  // 1. Structure validation
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('MALFORMED_TOKEN');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('MALFORMED_TOKEN');
  }

  // 2. Header parsing & validation
  let header: FirebaseTokenHeader;
  try {
    header = JSON.parse(base64UrlDecodeString(headerB64));
  } catch {
    throw new Error('MALFORMED_TOKEN_HEADER');
  }

  if (header.alg !== 'RS256') {
    throw new Error('UNSUPPORTED_ALGORITHM');
  }

  if (!header.kid || typeof header.kid !== 'string' || !header.kid.trim()) {
    throw new Error('MISSING_KID');
  }

  // 3. Retrieve Google signing public key
  const cryptoKey = await getCryptoKey(header.kid.trim());
  if (!cryptoKey) {
    throw new Error('UNKNOWN_SIGNING_KEY');
  }

  // 4. Verify cryptographic signature
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlDecode(signatureB64);
  } catch {
    throw new Error('INVALID_SIGNATURE_ENCODING');
  }

  const isSigValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    sigBytes as unknown as BufferSource,
    data
  );

  if (!isSigValid) {
    throw new Error('INVALID_SIGNATURE');
  }

  // 5. Payload parsing
  let payload: FirebaseIdTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecodeString(payloadB64));
  } catch {
    throw new Error('MALFORMED_TOKEN_PAYLOAD');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('MALFORMED_TOKEN_PAYLOAD');
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = 60; // 60 seconds clock skew tolerance

  // 6. Expiration (exp) check
  if (typeof payload.exp !== 'number' || payload.exp + tolerance < now) {
    throw new Error('TOKEN_EXPIRED');
  }

  // 7. Issued-at (iat) check
  if (typeof payload.iat !== 'number' || payload.iat - tolerance > now) {
    throw new Error('TOKEN_NOT_YET_VALID');
  }

  // 8. Audience (aud) check - must match Firebase project ID
  if (payload.aud !== expectedProjectId) {
    throw new Error('WRONG_PROJECT_AUDIENCE');
  }

  // 9. Issuer (iss) check - must match https://securetoken.google.com/<projectId>
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error('WRONG_PROJECT_ISSUER');
  }

  // 10. Subject (sub) check - must be a non-empty string representing the user UID
  if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new Error('MISSING_SUB_CLAIM');
  }

  // 11. Auth time check
  if (payload.auth_time !== undefined) {
    if (typeof payload.auth_time !== 'number' || payload.auth_time - tolerance > now) {
      throw new Error('INVALID_AUTH_TIME');
    }
  }

  return payload;
}
