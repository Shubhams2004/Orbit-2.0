import { Env } from '../../types';
import { encryptApiKey, decryptApiKey, generateKeyHint } from '../../utils/crypto';

export interface UserCredentialRecord {
  id: string;
  user_id: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  encrypted_key: string;
  key_hint: string;
  preferred_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProviderStatus {
  id: 'cloudflare' | 'gemini' | 'openai' | 'anthropic';
  name: string;
  isDefault: boolean;
  byokSupported: boolean;
  isConfigured: boolean;
  keyHint?: string;
  preferredModel?: string;
  updatedAt?: string;
}

export const SUPPORTED_BYOK_PROVIDERS: Array<{
  id: 'gemini' | 'openai' | 'anthropic';
  name: string;
  defaultModel: string;
  supportedModels: string[];
}> = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3.8-flash'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultModel: 'claude-3-7-sonnet',
    supportedModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
  },
];

/**
 * Ensures the user_ai_credentials table exists in D1.
 * Idempotent, safe to run during any Worker request.
 * Uses individual prepare().run() statements rather than multi-statement db.exec()
 * to prevent D1_EXEC_ERROR or incomplete input parser issues in Cloudflare D1.
 */
export async function ensureCredentialsTable(db: D1Database): Promise<void> {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS user_ai_credentials (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          encrypted_key TEXT NOT NULL,
          key_hint TEXT NOT NULL,
          preferred_model TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, provider)
        )`
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_user ON user_ai_credentials(user_id)`
      )
      .run();
  } catch (err: unknown) {
    console.error('[BYOK] Error ensuring user_ai_credentials table:', err);
    try {
      if (typeof (db as any).exec === 'function') {
        await (db as any).exec(
          'CREATE TABLE IF NOT EXISTS user_ai_credentials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL, encrypted_key TEXT NOT NULL, key_hint TEXT NOT NULL, preferred_model TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, provider));'
        );
      }
    } catch (execErr) {
      console.error('[BYOK] Fallback db.exec also failed:', execErr);
    }
  }
}

/**
 * Loads all decrypted BYOK credentials for the specified user.
 * Keys are decrypted strictly in memory for the duration of inference.
 */
export async function getUserCredentials(
  db: D1Database,
  userId: string,
  env: Env
): Promise<Map<string, { apiKey: string; preferredModel?: string; keyHint: string; updatedAt: string }>> {
  await ensureCredentialsTable(db);
  const result = new Map<string, { apiKey: string; preferredModel?: string; keyHint: string; updatedAt: string }>();

  try {
    const rows = await db
      .prepare(
        'SELECT provider, encrypted_key, key_hint, preferred_model, updated_at FROM user_ai_credentials WHERE user_id = ?'
      )
      .bind(userId)
      .all<UserCredentialRecord>();

    const masterSecret = env.BYOK_ENCRYPTION_KEY || env.JWT_SECRET;

    for (const row of rows.results || []) {
      try {
        const decryptedKey = await decryptApiKey(row.encrypted_key, userId, masterSecret);
        if (decryptedKey && decryptedKey.trim().length > 0) {
          result.set(row.provider, {
            apiKey: decryptedKey.trim(),
            preferredModel: row.preferred_model || undefined,
            keyHint: row.key_hint,
            updatedAt: row.updated_at,
          });
        }
      } catch (decryptErr) {
        console.error(`[BYOK] Failed to decrypt credential for provider ${row.provider}:`, decryptErr);
      }
    }
  } catch (err) {
    console.error('[BYOK] Error reading user credentials from database:', err);
  }

  return result;
}

/**
 * Saves or updates a user's encrypted BYOK credential.
 */
export async function saveUserCredential(
  db: D1Database,
  userId: string,
  provider: string,
  apiKey: string,
  preferredModel?: string,
  env?: Env
): Promise<{ provider: string; keyHint: string; preferredModel?: string }> {
  await ensureCredentialsTable(db);

  const cleanProvider = provider.toLowerCase().trim() as 'gemini' | 'openai' | 'anthropic';
  const validProvider = SUPPORTED_BYOK_PROVIDERS.find((p) => p.id === cleanProvider);
  if (!validProvider) {
    throw new Error(
      `Unsupported AI provider "${provider}". Supported providers: ${SUPPORTED_BYOK_PROVIDERS.map((p) => p.id).join(', ')}`
    );
  }

  const cleanKey = apiKey.trim();
  if (!cleanKey || cleanKey.length < 8) {
    throw new Error('API key must be at least 8 characters in length.');
  }

  const masterSecret = env?.BYOK_ENCRYPTION_KEY || env?.JWT_SECRET;
  const encryptedKey = await encryptApiKey(cleanKey, userId, masterSecret);
  const keyHint = generateKeyHint(cleanKey);
  const now = new Date().toISOString();
  const id = `ucred_${userId}_${cleanProvider}`;

  const modelToSave = preferredModel?.trim() || validProvider.defaultModel;

  try {
    await db
      .prepare(
        `INSERT INTO user_ai_credentials (id, user_id, provider, encrypted_key, key_hint, preferred_model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET
           encrypted_key = excluded.encrypted_key,
           key_hint = excluded.key_hint,
           preferred_model = excluded.preferred_model,
           updated_at = excluded.updated_at`
      )
      .bind(id, userId, cleanProvider, encryptedKey, keyHint, modelToSave, now, now)
      .run();
  } catch (insertErr: unknown) {
    const errMsg = String(insertErr);
    if (errMsg.includes('no such table') || errMsg.includes('SQLITE_ERROR')) {
      // Recreate table explicitly and retry insertion
      await ensureCredentialsTable(db);
      await db
        .prepare(
          `INSERT INTO user_ai_credentials (id, user_id, provider, encrypted_key, key_hint, preferred_model, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, provider) DO UPDATE SET
             encrypted_key = excluded.encrypted_key,
             key_hint = excluded.key_hint,
             preferred_model = excluded.preferred_model,
             updated_at = excluded.updated_at`
        )
        .bind(id, userId, cleanProvider, encryptedKey, keyHint, modelToSave, now, now)
        .run();
    } else {
      throw insertErr;
    }
  }

  return {
    provider: cleanProvider,
    keyHint,
    preferredModel: modelToSave,
  };
}

/**
 * Deletes a user's BYOK credential for a specific provider.
 */
export async function deleteUserCredential(
  db: D1Database,
  userId: string,
  provider: string
): Promise<boolean> {
  await ensureCredentialsTable(db);
  const cleanProvider = provider.toLowerCase().trim();

  const res = await db
    .prepare('DELETE FROM user_ai_credentials WHERE user_id = ? AND provider = ?')
    .bind(userId, cleanProvider)
    .run();

  return Number(res.meta.changes) > 0;
}

/**
 * Lists all providers with user's connection status. Never exposes API keys.
 */
export async function listUserProviders(
  db: D1Database,
  userId: string,
  env: Env
): Promise<UserProviderStatus[]> {
  await ensureCredentialsTable(db);
  const configuredMap = new Map<string, { keyHint: string; preferredModel?: string; updatedAt: string }>();

  try {
    const rows = await db
      .prepare('SELECT provider, key_hint, preferred_model, updated_at FROM user_ai_credentials WHERE user_id = ?')
      .bind(userId)
      .all<UserCredentialRecord>();

    for (const row of rows.results || []) {
      configuredMap.set(row.provider, {
        keyHint: row.key_hint,
        preferredModel: row.preferred_model || undefined,
        updatedAt: row.updated_at,
      });
    }
  } catch (err) {
    console.error('[BYOK] Failed to query user credentials:', err);
  }

  const providers: UserProviderStatus[] = [
    {
      id: 'cloudflare',
      name: 'Orbit Core (Cloudflare Workers AI)',
      isDefault: true,
      byokSupported: false,
      isConfigured: Boolean(env.AI),
      preferredModel: 'orbit-agent-v2',
    },
    ...SUPPORTED_BYOK_PROVIDERS.map((p) => {
      const userCred = configuredMap.get(p.id);
      // Check if user has connected their own key, or if server has a fallback key
      const isConfiguredByUser = Boolean(userCred);
      const isConfiguredByEnv =
        (p.id === 'openai' && Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0)) ||
        (p.id === 'gemini' && Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0)) ||
        (p.id === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length > 0));

      return {
        id: p.id,
        name: p.name,
        isDefault: false,
        byokSupported: true,
        isConfigured: isConfiguredByUser || isConfiguredByEnv,
        keyHint: userCred?.keyHint,
        preferredModel: userCred?.preferredModel || p.defaultModel,
        updatedAt: userCred?.updatedAt,
      };
    }),
  ];

  return providers;
}
