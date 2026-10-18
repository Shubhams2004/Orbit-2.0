import { Env, AuthenticatedUser } from '../types';
import { verifyFirebaseIdToken } from '../utils/firebase-auth';
import { verifyHs256Jwt, base64UrlDecodeString } from '../utils/jwt';

export class AuthError extends Error {
  constructor(public code: string, message: string, public status = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authenticates requests against the Authorization header.
 * 
 * Production Security Policies:
 * 1. Cryptographic RS256 verification of Firebase ID tokens against Google's public signing keys.
 * 2. Strict validation of 'sub', 'exp', 'iat', issuer ('https://securetoken.google.com/<projectId>'),
 *    and audience ('<projectId>').
 * 3. Strict rejection of development tokens in production.
 * 4. User identity is derived strictly from verified token 'sub' claim, preventing client-side spoofing.
 * 5. Production does not depend on a custom symmetric JWT_SECRET; Google's asymmetric RS256 keys are verified natively.
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    throw new AuthError('UNAUTHORIZED', 'Missing Authorization header. Bearer token required.', 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AuthError('INVALID_TOKEN_FORMAT', 'Authorization must be Bearer format.', 401);
  }

  const token = parts[1].trim();
  if (!token) {
    throw new AuthError('INVALID_TOKEN_FORMAT', 'Bearer token cannot be empty.', 401);
  }

  const isProduction = env.ENVIRONMENT === 'production';
  const isDevOrTest =
    env.ENVIRONMENT === 'development' ||
    env.ENVIRONMENT === 'test' ||
    env.ALLOW_DEV_TOKENS === 'true';

  // 1. Strict rejection of development tokens in production
  if (token.startsWith('dev_') || token === 'demo_user' || token === 'orbit_default_token') {
    if (isProduction) {
      throw new AuthError(
        'DEVELOPMENT_TOKEN_REJECTED',
        'Development bearer tokens are not accepted in production. A verified Firebase ID token is required.',
        401
      );
    }

    if (isDevOrTest) {
      const devUserId = token.startsWith('dev_')
        ? token.replace('dev_', '')
        : 'usr_main_01';

      if (!devUserId.trim()) {
        throw new AuthError('INVALID_CREDENTIALS', 'Development token does not contain a valid user ID.', 401);
      }

      const devUser: AuthenticatedUser = {
        id: devUserId.trim(),
        displayName: devUserId === 'usr_main_01' ? 'Alex Morgan' : `Dev User (${devUserId})`,
        email: `${devUserId}@orbit.local`,
      };

      await syncUserRecord(devUser, env);
      return devUser;
    }

    throw new AuthError('UNAUTHORIZED', 'Development tokens are not permitted in this environment.', 401);
  }

  // 2. Token Inspection & Algorithm Routing
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    throw new AuthError('MALFORMED_TOKEN', 'Token format is malformed (expected 3 dot-separated segments).', 401);
  }

  let alg = 'RS256';
  try {
    const headerJson = JSON.parse(base64UrlDecodeString(tokenParts[0]));
    if (headerJson.alg) {
      alg = headerJson.alg;
    }
  } catch {
    throw new AuthError('MALFORMED_TOKEN', 'Malformed token header JSON.', 401);
  }

  const firebaseProjectId = env.FIREBASE_PROJECT_ID || 'orbit-2-auth';

  // 3. Primary Path: Firebase ID Token RS256 Verification
  if (alg === 'RS256') {
    try {
      const payload = await verifyFirebaseIdToken(token, firebaseProjectId);

      const userId = payload.sub.trim();
      if (!userId) {
        throw new AuthError('INVALID_TOKEN_CLAIMS', 'Firebase token is missing valid subject claim.', 401);
      }

      const displayName =
        payload.name ||
        (payload.email ? payload.email.split('@')[0] : 'Orbit User');
      const email = payload.email || undefined;

      const authenticatedUser: AuthenticatedUser = {
        id: userId,
        displayName,
        email,
      };

      await syncUserRecord(authenticatedUser, env);
      return authenticatedUser;
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        throw err;
      }

      const msg = err instanceof Error ? err.message : String(err);

      switch (msg) {
        case 'TOKEN_EXPIRED':
          throw new AuthError('TOKEN_EXPIRED', 'Firebase ID token has expired.', 401);
        case 'INVALID_SIGNATURE':
        case 'INVALID_SIGNATURE_ENCODING':
          throw new AuthError('INVALID_SIGNATURE', 'Cryptographic signature verification failed against Google public keys.', 401);
        case 'WRONG_PROJECT_AUDIENCE':
          throw new AuthError('WRONG_PROJECT', `Token audience does not match Firebase project "${firebaseProjectId}".`, 401);
        case 'WRONG_PROJECT_ISSUER':
          throw new AuthError('WRONG_PROJECT', `Token issuer does not match Firebase project "${firebaseProjectId}".`, 401);
        case 'UNKNOWN_SIGNING_KEY':
          throw new AuthError('UNKNOWN_SIGNING_KEY', 'Token was signed by an unrecognized key ID (kid).', 401);
        case 'MISSING_KID':
          throw new AuthError('MALFORMED_TOKEN', 'Token header is missing key ID (kid).', 401);
        case 'MISSING_SUB_CLAIM':
          throw new AuthError('INVALID_TOKEN_CLAIMS', 'Firebase token is missing subject claim (sub).', 401);
        case 'TOKEN_NOT_YET_VALID':
          throw new AuthError('TOKEN_NOT_YET_VALID', 'Token is not yet active (iat/nbf).', 401);
        case 'MALFORMED_TOKEN':
        case 'MALFORMED_TOKEN_HEADER':
        case 'MALFORMED_TOKEN_PAYLOAD':
          throw new AuthError('MALFORMED_TOKEN', 'Malformed Firebase JWT structure.', 401);
        default:
          throw new AuthError('INVALID_CREDENTIALS', `Firebase token verification failed: ${msg}`, 401);
      }
    }
  }

  // 4. Fallback Path: Legacy HS256 Verification (Only if JWT_SECRET explicitly provided)
  if (alg === 'HS256' && env.JWT_SECRET) {
    try {
      const payload = await verifyHs256Jwt(token, env.JWT_SECRET, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        requireExp: isProduction,
      });

      const userId = (payload.sub as string).trim();
      const displayName =
        (payload.name as string) ||
        (payload.display_name as string) ||
        'Orbit User';
      const email = (payload.email as string) || undefined;

      const authenticatedUser: AuthenticatedUser = {
        id: userId,
        displayName,
        email,
      };

      await syncUserRecord(authenticatedUser, env);
      return authenticatedUser;
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'TOKEN_EXPIRED') throw new AuthError('TOKEN_EXPIRED', 'Authentication token has expired.', 401);
      if (msg === 'INVALID_SIGNATURE') throw new AuthError('INVALID_SIGNATURE', 'Cryptographic signature verification failed.', 401);
      if (msg === 'INVALID_ISSUER') throw new AuthError('INVALID_ISSUER', 'Token issuer policy validation failed.', 401);
      if (msg === 'INVALID_AUDIENCE') throw new AuthError('INVALID_AUDIENCE', 'Token audience policy validation failed.', 401);
      throw new AuthError('INVALID_CREDENTIALS', `Unable to authenticate HS256 credentials: ${msg}`, 401);
    }
  }

  throw new AuthError(
    'UNSUPPORTED_ALGORITHM',
    `Unsupported token algorithm "${alg}". Expected RS256 Firebase ID token.`,
    401
  );
}

/**
 * Ensures user record exists in D1 database
 */
async function syncUserRecord(user: AuthenticatedUser, env: Env): Promise<void> {
  if (!env.DB) return;
  try {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(user.id, user.displayName, user.email || null, now, now)
      .run();
  } catch {
    // Best-effort user synchronization
  }
}
