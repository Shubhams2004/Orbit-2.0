/**
 * Web Crypto AES-GCM (256-bit) Encryption & Decryption Utilities
 *
 * Provides secure encryption at rest for Bring Your Own API Key (BYOK) credentials.
 * Keys are derived per authenticated user using a server secret and the user's unique ID,
 * ensuring complete cryptographic isolation between users.
 */

const DEFAULT_SECRET = 'orbit-2.0-master-credential-key-seed-2026';

/**
 * Derives a dedicated 256-bit AES-GCM CryptoKey for a specific user.
 */
async function deriveUserKey(userId: string, masterSecret?: string): Promise<CryptoKey> {
  const secret = (masterSecret && masterSecret.trim()) || DEFAULT_SECRET;
  const keyMaterial = `${secret}:user_cred_salt:${userId}`;

  const encoder = new TextEncoder();
  const rawKeyData = encoder.encode(keyMaterial);

  // Hash key material to 256 bits via SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', rawKeyData);

  // Import as AES-GCM key
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext API key for a given user using AES-GCM with a random 12-byte IV.
 * Returns a serialized string format: `${base64(iv)}.${base64(ciphertext)}`
 */
export async function encryptApiKey(
  apiKey: string,
  userId: string,
  masterSecret?: string
): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key cannot be empty for encryption.');
  }

  const userKey = await deriveUserKey(userId, masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encodedPlaintext = encoder.encode(apiKey.trim());

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    userKey,
    encodedPlaintext as unknown as BufferSource
  );

  const ivB64 = uint8ArrayToBase64(iv);
  const cipherB64 = uint8ArrayToBase64(new Uint8Array(ciphertextBuffer));

  return `${ivB64}.${cipherB64}`;
}

/**
 * Decrypts an encrypted API key payload for a given user.
 * Throws an error if the authentication tag fails (wrong user or tampered data).
 */
export async function decryptApiKey(
  encryptedPayload: string,
  userId: string,
  masterSecret?: string
): Promise<string> {
  if (!encryptedPayload || !encryptedPayload.includes('.')) {
    throw new Error('Invalid encrypted credential payload format.');
  }

  const [ivB64, cipherB64] = encryptedPayload.split('.');
  if (!ivB64 || !cipherB64) {
    throw new Error('Malformed encrypted credential payload.');
  }

  const iv = base64ToUint8Array(ivB64);
  const cipherData = base64ToUint8Array(cipherB64);
  const userKey = await deriveUserKey(userId, masterSecret);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      userKey,
      cipherData as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err: unknown) {
    throw new Error('Failed to decrypt API key: authentication tag mismatch or invalid user scope.');
  }
}

/**
 * Generates a safe masked hint for display (e.g., "sk-...ab12" or "AIza...9xQ").
 * Never exposes more than the first few and last few non-sensitive prefix/suffix characters.
 */
export function generateKeyHint(apiKey: string): string {
  const clean = apiKey.trim();
  if (clean.length <= 8) {
    return '••••••••';
  }

  // Preserve standard prefix if recognizable
  if (clean.startsWith('sk-ant-')) {
    return `sk-ant-...${clean.slice(-4)}`;
  }
  if (clean.startsWith('sk-proj-')) {
    return `sk-proj-...${clean.slice(-4)}`;
  }
  if (clean.startsWith('sk-')) {
    return `sk-...${clean.slice(-4)}`;
  }
  if (clean.startsWith('AIzaSy')) {
    return `AIza...${clean.slice(-4)}`;
  }

  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}...${suffix}`;
}

// Helpers for Base64 (compatible with both Worker and Node runtimes)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
