import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index';
import { Env } from '../worker/types';
import { signHs256Jwt, base64UrlEncode } from '../worker/utils/jwt';
import { registerTestPublicKey, clearKeyCaches } from '../worker/utils/firebase-auth';
import { isDevToken, ApiClient } from '../src/services/apiClient';
import { isDemoConversationId, DEMO_CONVERSATION_IDS } from '../src/services/conversationService';
import { formatFirebaseAuthError } from '../src/lib/firebase';
import { parsePath, routeToPath } from '../src/context/WorkspaceContext';
import { SearchManager } from '../worker/services/search/manager';
import { TavilySearchProvider } from '../worker/services/search/tavily';
import { DuckDuckGoSearchProvider } from '../worker/services/search/duckduckgo';
import { ISearchProvider, SearchQueryResult } from '../worker/services/search/types';
import { ModelProviderRegistry } from '../worker/services/ai/registry';
import { CloudflareWorkersAiProvider, DEFAULT_CLOUDFLARE_MODEL } from '../worker/services/ai/providers/cloudflare';
import { OpenAiModelProvider } from '../worker/services/ai/providers/openai';
import { GeminiModelProvider } from '../worker/services/ai/providers/gemini';
import { AnthropicModelProvider } from '../worker/services/ai/providers/anthropic';
import { ModelProviderError } from '../worker/services/ai/types';
import { encryptApiKey, decryptApiKey, generateKeyHint } from '../worker/utils/crypto';
import { getUserCredentials, saveUserCredential, deleteUserCredential, listUserProviders } from '../worker/services/ai/credentials';
import {
  getUnifiedModelCatalog,
  discoverGeminiModels,
  discoverOpenAiModels,
  discoverAnthropicModels,
  DEPRECATED_MODEL_MAP,
  OFFICIAL_MODEL_CATALOG,
} from '../worker/services/ai/catalog';

async function signRs256Jwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: CryptoKey
): Promise<string> {
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// D1 Database implementation wrapping Node.js built-in SQLite
function createTestD1(db: DatabaseSync): any {
  return {
    prepare(query: string) {
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const stmt = db.prepare(query);
          const row: any = stmt.get(...bindings);
          if (!row) return null;
          if (colName) return row[colName];
          return row as T;
        },
        async all<T = unknown>(): Promise<{ results: T[]; meta: any }> {
          const stmt = db.prepare(query);
          const results = stmt.all(...bindings) as T[];
          return { results, meta: { changes: 0 } };
        },
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const stmt = db.prepare(query);
          const result = stmt.run(...bindings);
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
      };
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
}

async function runTests() {
  console.log('--- Starting Cloudflare Worker API & D1 Test Suite ---\n');

  const sqlite = new DatabaseSync(':memory:');
  const d1 = createTestD1(sqlite);

  // 1. Run migrations
  console.log('1. Applying D1 Migrations: 0001, 0002, and 0003_user_ai_credentials.sql...');
  const migration1 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql'), 'utf-8');
  const migration2 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0002_seed_demo_data.sql'), 'utf-8');
  const migration3 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0003_user_ai_credentials.sql'), 'utf-8');
  sqlite.exec(migration1);
  sqlite.exec(migration2);
  sqlite.exec(migration3);
  console.log('   ✅ Migrations applied successfully.\n');

  const env: Env = {
    DB: d1,
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
  };

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`   ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  // 2. Test Health Endpoint
  console.log('2. Testing Health & Unauthenticated Route Access:');
  const healthRes = await worker.fetch(new Request('https://orbit.internal/api/v1/health'), env);
  const healthJson: any = await healthRes.json();
  assert(healthRes.status === 200, 'GET /api/v1/health returns 200 OK');
  assert(healthJson.data?.status === 'nominal', 'Health status is "nominal"');
  assert(healthJson.data?.hasDbBinding === true, 'Health reports D1 database binding active');

  const unauthRes = await worker.fetch(new Request('https://orbit.internal/api/v1/tasks'), env);
  const unauthJson: any = await unauthRes.json();
  assert(unauthRes.status === 401, 'Protected route returns 401 Unauthorized without header');
  assert(unauthJson.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED\n');

  // 3. Test Task CRUD & Validation for User 1 (Alex Morgan: dev_usr_main_01)
  console.log('3. Testing Task Endpoints for User 1:');
  const user1Auth = { Authorization: 'Bearer dev_usr_main_01' };

  // GET tasks
  const getTasksRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', { headers: user1Auth }),
    env
  );
  const getTasksJson: any = await getTasksRes.json();
  assert(getTasksRes.status === 200, 'GET /api/v1/tasks returns 200');
  assert(Array.isArray(getTasksJson.data), 'Tasks data is array');
  assert(getTasksJson.data.length >= 3, 'Seed tasks retrieved successfully');

  // Input Validation: Empty title
  const invalidTaskRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      method: 'POST',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ', priority: 'high' }),
    }),
    env
  );
  const invalidTaskJson: any = await invalidTaskRes.json();
  assert(invalidTaskRes.status === 400, 'POST /api/v1/tasks with empty title returns 400');
  assert(invalidTaskJson.error?.code === 'VALIDATION_ERROR', 'Validation code matches VALIDATION_ERROR');

  // POST valid task
  const createTaskRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      method: 'POST',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Production API Verification Deliverable',
        description: 'Verify D1 persistence and isolated routes',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-10-18',
        projectId: 'proj_core_01',
      }),
    }),
    env
  );
  const createTaskJson: any = await createTaskRes.json();
  assert(createTaskRes.status === 201, 'POST /api/v1/tasks returns 201 Created');
  const createdTaskId = createTaskJson.data.id;
  assert(Boolean(createdTaskId), 'Created task has unique ID');
  assert(createTaskJson.data.userId === 'usr_main_01', 'Task belongs strictly to authenticated user');

  // PATCH task
  const patchTaskRes = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', priority: 'urgent' }),
    }),
    env
  );
  const patchTaskJson: any = await patchTaskRes.json();
  assert(patchTaskRes.status === 200, 'PATCH /api/v1/tasks/:id returns 200');
  assert(patchTaskJson.data.status === 'in_progress', 'Task status updated to in_progress');
  assert(patchTaskJson.data.priority === 'urgent', 'Task priority updated to urgent\n');

  // 4. Test Cross-User Data Isolation (Security Audit)
  console.log('4. Testing Cross-User Data Isolation (User 2: dev_usr_secondary_02):');
  const user2Auth = { Authorization: 'Bearer dev_usr_secondary_02' };

  // User 2 lists tasks (must NOT see User 1 tasks)
  const user2TasksRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', { headers: user2Auth }),
    env
  );
  const user2TasksJson: any = await user2TasksRes.json();
  assert(user2TasksRes.status === 200, 'User 2 GET /api/v1/tasks returns 200');
  assert(user2TasksJson.data.length === 0, 'User 2 cannot see User 1 tasks (0 tasks returned)');

  // User 2 attempts to fetch User 1 task by ID (must return 404)
  const user2SneakTask = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${createdTaskId}`, { headers: user2Auth }),
    env
  );
  assert(user2SneakTask.status === 404, 'User 2 GET /api/v1/tasks/:user1_task_id returns 404 Not Found');

  // User 2 attempts to delete User 1 task (must return 404)
  const user2DeleteSneak = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${createdTaskId}`, {
      method: 'DELETE',
      headers: user2Auth,
    }),
    env
  );
  assert(user2DeleteSneak.status === 404, 'User 2 DELETE /api/v1/tasks/:user1_task_id returns 404 Not Found\n');

  // 5. Test Project CRUD & Cascade Safety
  console.log('5. Testing Project Endpoints & Cascade Safety:');
  const createProjRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/projects', {
      method: 'POST',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ephemeral Test Project',
        description: 'Testing task detachment upon deletion',
        priority: 'medium',
        status: 'active',
      }),
    }),
    env
  );
  const createProjJson: any = await createProjRes.json();
  assert(createProjRes.status === 201, 'POST /api/v1/projects returns 201');
  const testProjId = createProjJson.data.id;

  // Move task to this project
  await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: testProjId }),
    }),
    env
  );

  // Delete project
  const deleteProjRes = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/projects/${testProjId}`, {
      method: 'DELETE',
      headers: user1Auth,
    }),
    env
  );
  assert(deleteProjRes.status === 200, 'DELETE /api/v1/projects/:id returns 200');

  // Verify task was detached, not deleted!
  const taskAfterProjDel = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${createdTaskId}`, { headers: user1Auth }),
    env
  );
  const taskAfterJson: any = await taskAfterProjDel.json();
  assert(taskAfterJson.data.projectId === null, 'Task project_id safely set to null after project deletion\n');

  // 6. Test Conversations & Messages
  console.log('6. Testing Conversations & Message Routing:');
  const createConvRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/conversations', {
      method: 'POST',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Autonomous Execution Session' }),
    }),
    env
  );
  const createConvJson: any = await createConvRes.json();
  assert(createConvRes.status === 201, 'POST /api/v1/conversations returns 201');
  const testConvId = createConvJson.data.id;

  // Rename conversation
  const patchConvRes = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/conversations/${testConvId}`, {
      method: 'PATCH',
      headers: { ...user1Auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Renamed Session' }),
    }),
    env
  );
  const patchConvJson: any = await patchConvRes.json();
  assert(patchConvRes.status === 200, 'PATCH /api/v1/conversations/:id returns 200');
  assert(patchConvJson.data.title === 'Renamed Session', 'Conversation title updated successfully');

  // User 2 cannot access User 1's conversation
  const user2ConvCheck = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/conversations/${testConvId}/messages`, {
      headers: user2Auth,
    }),
    env
  );
  assert(user2ConvCheck.status === 404, 'User 2 cannot read messages in User 1 conversation (404 Not Found)\n');

  // 7. JWT Authentication & Security Test Suite
  console.log('7. Testing HS256 JWT Verification & Impersonation Prevention:');
  const testSecret = 'test_super_secret_signing_key_32_bytes_long!!';
  const prodEnv: Env = {
    DB: d1,
    ENVIRONMENT: 'production',
    JWT_SECRET: testSecret,
    JWT_ISSUER: 'orbit-auth-service',
    JWT_AUDIENCE: 'orbit-api',
  };

  // Test 7.1: Valid HS256 signed token succeeds in production
  const validToken = await signHs256Jwt(
    { sub: 'usr_secure_99', name: 'Verified User', email: 'verified@orbit.io' },
    testSecret,
    { expiresInSeconds: 3600, issuer: 'orbit-auth-service', audience: 'orbit-api' }
  );

  const validJwtRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${validToken}` },
    }),
    prodEnv
  );
  assert(validJwtRes.status === 200, 'Valid HS256 signed JWT succeeds in production (200 OK)');

  // Test 7.2: Invalid signature rejection
  const tamperedSigToken = validToken.slice(0, -3) + 'XYZ';
  const invalidSigRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${tamperedSigToken}` },
    }),
    prodEnv
  );
  const invalidSigJson: any = await invalidSigRes.json();
  assert(invalidSigRes.status === 401, 'Tampered JWT signature rejected with 401 Unauthorized');
  assert(invalidSigJson.error?.code === 'INVALID_SIGNATURE', 'Error code is INVALID_SIGNATURE');

  // Test 7.3: Expired token rejection
  const expiredToken = await signHs256Jwt(
    { sub: 'usr_secure_99', exp: Math.floor(Date.now() / 1000) - 300 },
    testSecret,
    { issuer: 'orbit-auth-service', audience: 'orbit-api' }
  );
  const expiredRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    }),
    prodEnv
  );
  const expiredJson: any = await expiredRes.json();
  assert(expiredRes.status === 401, 'Expired JWT rejected with 401 Unauthorized');
  assert(expiredJson.error?.code === 'TOKEN_EXPIRED', 'Error code is TOKEN_EXPIRED');

  // Test 7.4: Malformed tokens
  const malformedRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: 'Bearer not_a_real_jwt_token' },
    }),
    prodEnv
  );
  const malformedJson: any = await malformedRes.json();
  assert(malformedRes.status === 401, 'Malformed token rejected with 401');
  assert(malformedJson.error?.code === 'MALFORMED_TOKEN', 'Malformed token code is MALFORMED_TOKEN');

  const twoPartRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: 'Bearer partOne.partTwo' },
    }),
    prodEnv
  );
  assert(twoPartRes.status === 401, 'Two-part token rejected with 401 MALFORMED_TOKEN');

  // Test 7.5: Attempted user impersonation (dev token in production)
  const devInProdRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: 'Bearer dev_usr_admin_impersonator' },
    }),
    prodEnv
  );
  const devInProdJson: any = await devInProdRes.json();
  assert(devInProdRes.status === 401, 'Development token rejected in production environment (401)');
  assert(
    devInProdJson.error?.code === 'DEVELOPMENT_TOKEN_REJECTED',
    'Error code is DEVELOPMENT_TOKEN_REJECTED'
  );

  // Test 7.6: Attempted user impersonation (payload tampering with original signature)
  const parts = validToken.split('.');
  const forgedPayload = {
    sub: 'usr_admin_victim',
    name: 'Admin Victim',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'orbit-auth-service',
    aud: 'orbit-api',
  };
  const forgedPayloadB64 = base64UrlEncode(JSON.stringify(forgedPayload));
  const forgedToken = `${parts[0]}.${forgedPayloadB64}.${parts[2]}`; // Reusing original signature!

  const forgedRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${forgedToken}` },
    }),
    prodEnv
  );
  const forgedJson: any = await forgedRes.json();
  assert(forgedRes.status === 401, 'Forged payload with reused signature rejected (401)');
  assert(forgedJson.error?.code === 'INVALID_SIGNATURE', 'Forged payload fails with INVALID_SIGNATURE');

  // Test 7.7: Attempted user impersonation (token signed with wrong/rogue secret)
  const rogueToken = await signHs256Jwt(
    { sub: 'usr_admin_victim' },
    'attacker_rogue_secret_key_1234567890!',
    { expiresInSeconds: 3600, issuer: 'orbit-auth-service', audience: 'orbit-api' }
  );
  const rogueRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${rogueToken}` },
    }),
    prodEnv
  );
  assert(rogueRes.status === 401, 'Token signed with rogue secret rejected (401 INVALID_SIGNATURE)');

  // Test 7.8: Identity derivation is immune to request body parameter injection
  const bodyImpersonationRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Task Attempting Identity Hijack',
        user_id: 'usr_completely_different_admin',
        userId: 'usr_completely_different_admin',
      }),
    }),
    prodEnv
  );
  const bodyImpersonationJson: any = await bodyImpersonationRes.json();
  assert(bodyImpersonationRes.status === 201, 'Task created successfully');
  assert(
    bodyImpersonationJson.data.userId === 'usr_secure_99',
    'Task userId derived strictly from verified JWT sub ("usr_secure_99"), not request body'
  );

  // Test 7.9: Issuer policy enforcement
  const wrongIssuerToken = await signHs256Jwt(
    { sub: 'usr_secure_99' },
    testSecret,
    { expiresInSeconds: 3600, issuer: 'rogue-issuer-id', audience: 'orbit-api' }
  );
  const wrongIssuerRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${wrongIssuerToken}` },
    }),
    prodEnv
  );
  const wrongIssuerJson: any = await wrongIssuerRes.json();
  assert(wrongIssuerRes.status === 401, 'Token with untrusted issuer rejected (401)');
  assert(wrongIssuerJson.error?.code === 'INVALID_ISSUER', 'Error code is INVALID_ISSUER');

  // 8. Test Firebase Auth RS256 Verification & Cross-Firebase-User Isolation
  console.log('\n8. Testing Firebase Auth RS256 Token Verification & Cross-Firebase-User Isolation:');
  const firebaseKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const testKid = 'firebase_test_kid_01';
  registerTestPublicKey(testKid, firebaseKeyPair.publicKey);

  const nowSec = Math.floor(Date.now() / 1000);
  const firebaseProdEnv: Env = {
    DB: d1,
    ENVIRONMENT: 'production',
    FIREBASE_PROJECT_ID: 'orbit-2-auth',
  };

  const createFbToken = async (
    overrides: Record<string, any> = {},
    kid: string = testKid,
    privKey = firebaseKeyPair.privateKey
  ) => {
    const header = { alg: 'RS256', kid, typ: 'JWT' };
    const payload = {
      iss: 'https://securetoken.google.com/orbit-2-auth',
      aud: 'orbit-2-auth',
      sub: 'fb_usr_alice_101',
      iat: nowSec - 10,
      exp: nowSec + 3600,
      auth_time: nowSec - 10,
      email: 'alice@orbit.internal',
      name: 'Alice Firebase',
      ...overrides,
    };
    return signRs256Jwt(header, payload, privKey);
  };

  // Test 8.1: Valid Firebase RS256 token returns 200 and syncs user to D1
  const validFbToken = await createFbToken();
  const validFbRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${validFbToken}` },
    }),
    firebaseProdEnv
  );
  assert(validFbRes.status === 200, 'Valid RS256 Firebase ID token accepted in production (200 OK)');

  // Test 8.2: Expired Firebase token rejected
  const expiredFbToken = await createFbToken({ exp: nowSec - 300 });
  const expiredFbRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${expiredFbToken}` },
    }),
    firebaseProdEnv
  );
  const expiredFbJson: any = await expiredFbRes.json();
  assert(expiredFbRes.status === 401, 'Expired Firebase token rejected with 401 Unauthorized');
  assert(expiredFbJson.error?.code === 'TOKEN_EXPIRED', 'Error code is TOKEN_EXPIRED');

  // Test 8.3: Tampered signature on Firebase ID token
  const tamperedFbToken = validFbToken.slice(0, -4) + 'AAAA';
  const tamperedFbRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${tamperedFbToken}` },
    }),
    firebaseProdEnv
  );
  const tamperedFbJson: any = await tamperedFbRes.json();
  assert(tamperedFbRes.status === 401, 'Tampered RS256 signature rejected with 401');
  assert(tamperedFbJson.error?.code === 'INVALID_SIGNATURE', 'Error code is INVALID_SIGNATURE');

  // Test 8.4: Token with wrong project audience rejected
  const wrongAudToken = await createFbToken({ aud: 'wrong-firebase-project' });
  const wrongAudRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${wrongAudToken}` },
    }),
    firebaseProdEnv
  );
  const wrongAudJson: any = await wrongAudRes.json();
  assert(wrongAudRes.status === 401, 'Token with wrong audience rejected (401)');
  assert(wrongAudJson.error?.code === 'WRONG_PROJECT', 'Error code is WRONG_PROJECT');

  // Test 8.5: Token with wrong project issuer rejected
  const wrongIssToken = await createFbToken({ iss: 'https://securetoken.google.com/different-project' });
  const wrongIssRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${wrongIssToken}` },
    }),
    firebaseProdEnv
  );
  const wrongIssJson: any = await wrongIssRes.json();
  assert(wrongIssRes.status === 401, 'Token with wrong issuer rejected (401)');
  assert(wrongIssJson.error?.code === 'WRONG_PROJECT', 'Error code is WRONG_PROJECT');

  // Test 8.6: Unknown signing key kid rejected
  const unknownKidToken = await createFbToken({}, 'unknown_rogue_kid');
  const unknownKidRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${unknownKidToken}` },
    }),
    firebaseProdEnv
  );
  const unknownKidJson: any = await unknownKidRes.json();
  assert(unknownKidRes.status === 401, 'Token with unknown kid rejected (401)');
  assert(unknownKidJson.error?.code === 'UNKNOWN_SIGNING_KEY', 'Error code is UNKNOWN_SIGNING_KEY');

  // Test 8.7: Token missing sub claim rejected
  const missingSubToken = await createFbToken({ sub: '' });
  const missingSubRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${missingSubToken}` },
    }),
    firebaseProdEnv
  );
  const missingSubJson: any = await missingSubRes.json();
  assert(missingSubRes.status === 401, 'Token with empty sub claim rejected (401)');
  assert(missingSubJson.error?.code === 'INVALID_TOKEN_CLAIMS', 'Error code is INVALID_TOKEN_CLAIMS');

  // Test 8.8: Cross-Firebase-User Isolation
  // Alice creates a task
  const aliceTaskRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: "Alice's Firebase Confidential Deliverable",
        priority: 'high',
      }),
    }),
    firebaseProdEnv
  );
  const aliceTaskJson: any = await aliceTaskRes.json();
  assert(aliceTaskRes.status === 201, "Alice's task created via Firebase token (201 Created)");
  const aliceTaskId = aliceTaskJson.data.id;
  assert(aliceTaskJson.data.userId === 'fb_usr_alice_101', 'Task assigned strictly to Alice UID');

  // Bob token
  const bobToken = await createFbToken({
    sub: 'fb_usr_bob_202',
    email: 'bob@orbit.internal',
    name: 'Bob Firebase',
  });

  // Bob lists tasks: must NOT see Alice's task
  const bobTasksRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      headers: { Authorization: `Bearer ${bobToken}` },
    }),
    firebaseProdEnv
  );
  const bobTasksJson: any = await bobTasksRes.json();
  const aliceTaskSeenByBob = bobTasksJson.data?.some((t: any) => t.id === aliceTaskId);
  assert(!aliceTaskSeenByBob, "Bob cannot see Alice's task in GET /api/v1/tasks");

  // Bob tries to read Alice's task directly
  const bobReadAliceTask = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${aliceTaskId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    }),
    firebaseProdEnv
  );
  assert(bobReadAliceTask.status === 404, "Bob cannot read Alice's task by ID (404 Not Found)");

  // Bob tries to delete Alice's task
  const bobDeleteAliceTask = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/tasks/${aliceTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` },
    }),
    firebaseProdEnv
  );
  assert(bobDeleteAliceTask.status === 404, "Bob cannot delete Alice's task (404 Not Found)");

  // Test 8.9: Attempted identity hijacking via request body injection under Firebase auth
  const bodyHijackRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: "Bob's Task with attempted Alice userId spoof",
        userId: 'fb_usr_alice_101',
        user_id: 'fb_usr_alice_101',
      }),
    }),
    firebaseProdEnv
  );
  const bodyHijackJson: any = await bodyHijackRes.json();
  assert(bodyHijackRes.status === 201, 'Task created successfully');
  assert(
    bodyHijackJson.data.userId === 'fb_usr_bob_202',
    'Task userId derived strictly from Bob verified sub claim ("fb_usr_bob_202"), not request body injection'
  );

  // 9. Test Cloudflare Workers AI Protected Endpoint (/api/v1/ai/chat)
  console.log('\n9. Testing Cloudflare Workers AI Protected Endpoint (/api/v1/ai/chat):');
  
  // Test 9.1: Unauthorized request (no token) returns 401
  const unauthAiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello AI' }),
    }),
    firebaseProdEnv
  );
  const unauthAiJson: any = await unauthAiRes.json();
  assert(unauthAiRes.status === 401, 'POST /api/v1/ai/chat without token returns 401 Unauthorized');
  assert(unauthAiJson.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

  // Test 9.2: Missing AI binding returns 503 AI_UNAVAILABLE
  const noAiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Hello without AI binding' }),
    }),
    firebaseProdEnv // lacks env.AI
  );
  const noAiJson: any = await noAiRes.json();
  assert(noAiRes.status === 503, 'POST /api/v1/ai/chat without AI binding returns 503 Service Unavailable');
  assert(noAiJson.error?.code === 'AI_UNAVAILABLE', 'Error code is AI_UNAVAILABLE');

  // Setup Mock Workers AI Binding
  let mockAiShouldFail = false;
  let lastCapturedMessages: Array<{ role: string; content: string }> = [];
  const mockAi: any = {
    async run(model: string, input: any) {
      if (mockAiShouldFail) {
        throw new Error('Cloudflare Workers AI inference engine rate limited');
      }
      lastCapturedMessages = input.messages ? [...input.messages] : [];
      const lastMsg = input.messages[input.messages.length - 1];
      return {
        response: `[${model}] Processed request: "${lastMsg.content.slice(0, 40)}"`,
      };
    },
  };

  const aiProdEnv: Env = {
    ...firebaseProdEnv,
    AI: mockAi,
  };

  // Re-register test public key for valid token verification
  registerTestPublicKey(testKid, firebaseKeyPair.publicKey);

  // Test 9.3: Empty prompt rejects with 400 VALIDATION_ERROR
  const emptyPromptRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: '    ' }),
    }),
    aiProdEnv
  );
  const emptyPromptJson: any = await emptyPromptRes.json();
  assert(emptyPromptRes.status === 400, 'Empty prompt rejected with 400 Bad Request');
  assert(emptyPromptJson.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

  // Test 9.4: Oversized prompt (>4000 characters) rejects with 400 VALIDATION_ERROR
  const oversizedPrompt = 'A'.repeat(4001);
  const oversizedRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: oversizedPrompt }),
    }),
    aiProdEnv
  );
  const oversizedJson: any = await oversizedRes.json();
  assert(oversizedRes.status === 400, 'Oversized prompt (>4000 chars) rejected with 400');
  assert(oversizedJson.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

  // Test 9.5: Auto-creates conversation when none provided, persists both user and assistant messages
  const autoConvRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Create weekly sprint deliverable summary' }),
    }),
    aiProdEnv
  );
  const autoConvJson: any = await autoConvRes.json();
  assert(autoConvRes.status === 200, 'POST /api/v1/ai/chat succeeds with 200 OK');
  assert(Boolean(autoConvJson.data?.conversationId), 'Conversation ID was created and returned');
  assert(autoConvJson.data?.model === '@cf/meta/llama-3.1-8b-instruct-fast', 'Model is @cf/meta/llama-3.1-8b-instruct-fast');
  assert(Boolean(autoConvJson.data?.response), 'Assistant response text generated');

  const createdConvId = autoConvJson.data.conversationId;

  // Verify D1 records
  const convInDb = await d1.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .bind(createdConvId, 'fb_usr_alice_101')
    .first();
  assert(Boolean(convInDb), 'Conversation record safely persisted in D1 with Alice UID');

  const msgsInDb = await d1.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .bind(createdConvId)
    .all();
  assert(msgsInDb.results.length === 2, 'Exactly 2 messages (user + assistant) persisted in D1');
  assert(msgsInDb.results[0].role === 'user', 'First message has role "user"');
  assert(msgsInDb.results[1].role === 'assistant', 'Second message has role "assistant"');

  // Test 9.6: Appends to existing conversation when valid conversationId provided
  const followUpRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Prioritize task 1 first please',
        conversationId: createdConvId,
      }),
    }),
    aiProdEnv
  );
  const followUpJson: any = await followUpRes.json();
  assert(followUpRes.status === 200, 'Follow-up message succeeds with 200 OK');
  assert(followUpJson.data?.conversationId === createdConvId, 'Appended to the same conversationId');

  const updatedMsgsInDb = await d1.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .bind(createdConvId)
    .all();
  assert(updatedMsgsInDb.results.length === 4, 'Conversation now contains 4 messages in D1');

  // Test 9.7: Cross-user isolation - User B cannot chat in User A's conversation
  const crossUserChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Attempting to inject into Alice conversation',
        conversationId: createdConvId,
      }),
    }),
    aiProdEnv
  );
  const crossUserChatJson: any = await crossUserChatRes.json();
  assert(crossUserChatRes.status === 404, 'Bob cannot post to Alice conversation (404 Not Found)');
  assert(crossUserChatJson.error?.code === 'NOT_FOUND', 'Error code is NOT_FOUND');

  // Test 9.8: Identity derivation is immune to request body injection
  const bodyInjectAiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Bob message with fake user_id in body',
        user_id: 'fb_usr_alice_101',
        userId: 'fb_usr_alice_101',
      }),
    }),
    aiProdEnv
  );
  const bodyInjectAiJson: any = await bodyInjectAiRes.json();
  assert(bodyInjectAiRes.status === 200, 'Bob chat request succeeds');
  const bobConvId = bodyInjectAiJson.data.conversationId;
  const bobConvCheck = await d1.prepare('SELECT user_id FROM conversations WHERE id = ?')
    .bind(bobConvId)
    .first();
  assert(
    bobConvCheck?.user_id === 'fb_usr_bob_202',
    'Conversation owner strictly derived from verified token ("fb_usr_bob_202"), ignoring injected body'
  );

  // Test 9.9: Model execution failure returns 502 AI_GENERATION_FAILED
  mockAiShouldFail = true;
  const failureAiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'This should trigger an AI failure' }),
    }),
    aiProdEnv
  );
  const failureAiJson: any = await failureAiRes.json();
  assert(failureAiRes.status === 502, 'AI model execution failure returns 502 Bad Gateway');
  assert(failureAiJson.error?.code === 'AI_GENERATION_FAILED', 'Error code is AI_GENERATION_FAILED');
  mockAiShouldFail = false;

  // Test 9.10: Regression - Most recent 8 messages are selected and supplied chronologically
  const histConvId = 'conv_history_window_test';
  await d1.prepare('INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(histConvId, 'fb_usr_alice_101', 'History Window Test', '2026-10-26T01:00:00.000Z', '2026-10-26T01:00:00.000Z')
    .run();

  // Insert 12 messages with ordered timestamps
  for (let i = 1; i <= 12; i++) {
    const padded = i < 10 ? `0${i}` : `${i}`;
    const role = i % 2 === 1 ? 'user' : 'assistant';
    const timestamp = `2026-10-26T01:${padded}:00.000Z`;
    await d1.prepare('INSERT INTO messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(`msg_hist_${padded}`, histConvId, 'fb_usr_alice_101', role, `History message ${padded}`, timestamp)
      .run();
  }

  // Alice sends message 13
  const histChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'History prompt 13',
        conversationId: histConvId,
      }),
    }),
    aiProdEnv
  );
  assert(histChatRes.status === 200, 'History test chat request succeeds with 200 OK');

  // Verify messages provided to AI model
  // Total expected in lastCapturedMessages: 1 system prompt + 8 history + 1 current prompt = 10 messages
  assert(lastCapturedMessages.length === 10, 'Model received exactly 10 messages (1 system + 8 history + 1 prompt)');
  assert(lastCapturedMessages[0].role === 'system', 'First message is system prompt');
  // Messages 1 through 4 should be pruned. Messages 5 through 12 should be included in chronological order (05 to 12).
  assert(lastCapturedMessages[1].content === 'History message 05', 'Earliest message in 8-message window is message 05');
  assert(lastCapturedMessages[8].content === 'History message 12', 'Latest message in 8-message window is message 12');
  assert(lastCapturedMessages[9].content === 'History prompt 13', 'Current prompt is at the end');
  assert(lastCapturedMessages[9].role === 'user', 'Current prompt has role "user"');

  // Verify chronological ordering of the 8 messages
  let isChronological = true;
  for (let idx = 1; idx <= 8; idx++) {
    const expectedNum = idx + 4;
    const expectedPadded = expectedNum < 10 ? `0${expectedNum}` : `${expectedNum}`;
    if (lastCapturedMessages[idx].content !== `History message ${expectedPadded}`) {
      isChronological = false;
    }
  }
  assert(isChronological, 'The most recent 8 messages are strictly ordered chronologically');

  // Verify no messages 01-04 were included
  const hasPrunedMsg = lastCapturedMessages.some(m => m.content.includes('History message 01') || m.content.includes('History message 04'));
  assert(!hasPrunedMsg, 'Older messages outside the 8-message window are excluded');

  // Verify new user prompt is not duplicated in model input
  const promptOccurrences = lastCapturedMessages.filter(m => m.content === 'History prompt 13');
  assert(promptOccurrences.length === 1, 'New user message is not duplicated in model input');

  // Test 9.11: Messages from another user are never included in AI context
  const bobSecretConvId = 'conv_bob_secret_01';
  await d1.prepare('INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(bobSecretConvId, 'fb_usr_bob_202', 'Bob Secret Conversation', '2026-10-26T02:00:00.000Z', '2026-10-26T02:00:00.000Z')
    .run();
  await d1.prepare('INSERT INTO messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('msg_bob_top_secret', bobSecretConvId, 'fb_usr_bob_202', 'user', 'TOP_SECRET_BOB_TOKEN_XYZ', '2026-10-26T02:01:00.000Z')
    .run();

  // Alice sends message in her own conversation
  await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Check for leaked context',
        conversationId: histConvId,
      }),
    }),
    aiProdEnv
  );
  const leakedBobData = lastCapturedMessages.some(m => m.content.includes('TOP_SECRET_BOB_TOKEN_XYZ'));
  assert(!leakedBobData, 'Messages from another user conversation are never included in AI context');

  // Test 9.12: Alice cannot access Bob conversation by supplying its ID
  const aliceAccessBobRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Trying to access Bob conversation',
        conversationId: bobSecretConvId,
      }),
    }),
    aiProdEnv
  );
  const aliceAccessBobJson: any = await aliceAccessBobRes.json();
  assert(aliceAccessBobRes.status === 404, 'User cannot access another user conversation by supplying its ID (404 Not Found)');
  assert(aliceAccessBobJson.error?.code === 'NOT_FOUND', 'Cross-user conversation access returns NOT_FOUND error code');

  // Helper for D1 interception tests
  function createFailingD1(baseD1: any, shouldFailQuery: (query: string, bindings: any[]) => boolean, errorToThrow: Error): any {
    return {
      ...baseD1,
      prepare(query: string) {
        const origStmt = baseD1.prepare(query);
        return {
          bind(...args: any[]) {
            const boundStmt = origStmt.bind(...args);
            return {
              async first(colName?: string) {
                if (shouldFailQuery(query, args)) throw errorToThrow;
                return boundStmt.first(colName);
              },
              async all() {
                if (shouldFailQuery(query, args)) throw errorToThrow;
                return boundStmt.all();
              },
              async run() {
                if (shouldFailQuery(query, args)) throw errorToThrow;
                return boundStmt.run();
              },
            };
          },
        };
      },
    };
  }

  // Test 9.13: User-record synchronization failure stops processing
  const userSyncFailD1 = createFailingD1(
    d1,
    (q) => q.includes('INSERT OR IGNORE INTO users'),
    new Error('D1 storage constraint failure: users write lock')
  );
  const userSyncFailEnv: Env = {
    ...aiProdEnv,
    DB: userSyncFailD1,
  };

  const userSyncFailRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Test user sync failure' }),
    }),
    userSyncFailEnv
  );
  const userSyncFailJson: any = await userSyncFailRes.json();
  assert(userSyncFailRes.status === 500, 'User-record synchronization failure stops processing with HTTP 500');
  assert(userSyncFailJson.error?.code === 'USER_SYNC_FAILED', 'Error code is USER_SYNC_FAILED');
  assert(
    !userSyncFailJson.error?.message.includes('SQL') && !userSyncFailJson.error?.message.includes('lock'),
    'User sync failure does not expose internal database or SQL error details'
  );

  // Test 9.14: Assistant-response persistence failure does not return false success
  const assistantFailD1 = createFailingD1(
    d1,
    (q) => q.includes('INSERT INTO messages') && q.includes("'assistant'"),
    new Error('D1 storage engine failure: disk write failure')
  );
  const assistantFailEnv: Env = {
    ...aiProdEnv,
    DB: assistantFailD1,
  };

  const assistantFailRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Test assistant persistence failure' }),
    }),
    assistantFailEnv
  );
  const assistantFailJson: any = await assistantFailRes.json();
  assert(assistantFailRes.status === 500, 'Assistant-response persistence failure returns HTTP 500 (not false 200)');
  assert(assistantFailJson.error?.code === 'PERSISTENCE_FAILED', 'Error code is PERSISTENCE_FAILED');
  assert(
    Boolean(assistantFailJson.error?.details?.conversationId),
    'Preserves conversationId in error details for safe recovery'
  );
  assert(
    Boolean(assistantFailJson.error?.details?.response),
    'Preserves generated AI response in error details for recovery'
  );
  assert(
    !assistantFailJson.error?.message.includes('SQL') && !assistantFailJson.error?.message.includes('disk write'),
    'Assistant persistence failure does not expose SQL or database internals'
  );

  // -------------------------------------------------------------
  // 10. Fresh-Token Usage, Stale Development-Token Removal, Unauthorized Chat Behavior, & Production Bypass Restrictions
  // -------------------------------------------------------------
  console.log('\n10. Testing Fresh-Token Usage, Stale Development-Token Removal, Unauthorized Chat Behavior, & Production Bypass Restrictions:');

  // Test 10.1: isDevToken identifies development and non-JWT tokens
  assert(isDevToken('dev_usr_main_01') === true, 'isDevToken flags dev_usr_main_01 as dev token');
  assert(isDevToken('dev_user_beta_02') === true, 'isDevToken flags dev_user_beta_02 as dev token');
  assert(isDevToken('demo_user') === true, 'isDevToken flags demo_user as dev token');
  assert(isDevToken('orbit_default_token') === true, 'isDevToken flags orbit_default_token as dev token');
  assert(isDevToken('simple-string-without-dots') === true, 'isDevToken flags non-JWT string as dev token');

  // Test 10.2: isDevToken accepts legitimate 3-part JWTs
  assert(isDevToken(validFbToken) === false, 'isDevToken recognizes legitimate RS256 Firebase token as non-dev token');

  // Test 10.3: ApiClient enforces production bypass restrictions and purges stale dev tokens
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const prodClient = new ApiClient();
    prodClient.setAuthToken('dev_usr_main_01');
    assert(prodClient.getAuthToken() === '', 'ApiClient strictly clears dev token in production');

    prodClient.setAuthToken(validFbToken);
    assert(prodClient.getAuthToken() === validFbToken, 'ApiClient stores verified token in production');

    // Attempting to set dev token afterwards clears auth token again
    prodClient.setAuthToken('dev_user_beta_02');
    assert(prodClient.getAuthToken() === '', 'ApiClient purges subsequent dev token attempt in production');
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
  }

  // Test 10.4: Unauthorized chat behavior - POST /api/v1/ai/chat with expired Firebase ID token
  const expiredChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expiredFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Hello with expired token' }),
    }),
    aiProdEnv
  );
  const expiredChatJson: any = await expiredChatRes.json();
  assert(expiredChatRes.status === 401, 'POST /api/v1/ai/chat rejects expired token with 401 Unauthorized');
  assert(expiredChatJson.error?.code === 'TOKEN_EXPIRED', 'Expired chat error code is TOKEN_EXPIRED');

  // Test 10.5: Unauthorized chat behavior - POST /api/v1/ai/chat with development token in production
  const devTokenChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dev_usr_main_01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Hello with dev token in production' }),
    }),
    aiProdEnv
  );
  const devTokenChatJson: any = await devTokenChatRes.json();
  assert(devTokenChatRes.status === 401, 'POST /api/v1/ai/chat rejects development token in production with 401');
  assert(
    devTokenChatJson.error?.code === 'DEVELOPMENT_TOKEN_REJECTED',
    'Dev token in production error code is DEVELOPMENT_TOKEN_REJECTED'
  );

  // Test 10.6: Unauthorized chat behavior - POST /api/v1/ai/chat with tampered RS256 token
  const tamperedChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tamperedFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Hello with tampered token' }),
    }),
    aiProdEnv
  );
  const tamperedChatJson: any = await tamperedChatRes.json();
  assert(tamperedChatRes.status === 401, 'POST /api/v1/ai/chat rejects tampered token with 401');
  assert(tamperedChatJson.error?.code === 'INVALID_SIGNATURE', 'Tampered chat token error code is INVALID_SIGNATURE');

  // Test 10.7: Unauthorized chat behavior - POST /api/v1/ai/chat with wrong audience token
  const wrongAudChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wrongAudToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Hello with wrong audience' }),
    }),
    aiProdEnv
  );
  const wrongAudChatJson: any = await wrongAudChatRes.json();
  assert(wrongAudChatRes.status === 401, 'POST /api/v1/ai/chat rejects wrong audience token with 401');
  assert(wrongAudChatJson.error?.code === 'WRONG_PROJECT', 'Wrong audience chat error code is WRONG_PROJECT');

  // Test 10.8: Unauthorized chat behavior - POST /api/v1/ai/chat with malformed token
  const malformedChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid.token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Hello with malformed token' }),
    }),
    aiProdEnv
  );
  const malformedChatJson: any = await malformedChatRes.json();
  assert(malformedChatRes.status === 401, 'POST /api/v1/ai/chat rejects malformed token with 401');
  assert(malformedChatJson.error?.code === 'MALFORMED_TOKEN', 'Malformed chat error code is MALFORMED_TOKEN');

  // -------------------------------------------------------------
  // 11. Conversation Ownership, Demo ID Protection, User Isolation, & Auto-Creation
  // -------------------------------------------------------------
  console.log('\n11. Testing Conversation Ownership, Demo ID Protection, & User Isolation:');

  // Test 11.1: Demo conversation ID detection
  assert(isDemoConversationId('conv_plan_today') === true, 'conv_plan_today is recognized as demo conversation ID');
  assert(isDemoConversationId('conv_soc2_audit') === true, 'conv_soc2_audit is recognized as demo conversation ID');
  assert(isDemoConversationId('conv_user_778899') === false, 'User conversation ID is not recognized as demo');
  assert(isDemoConversationId('') === false, 'Empty string is not recognized as demo');
  assert(isDemoConversationId(undefined) === false, 'Undefined is not recognized as demo');

  // Test 11.2: A Firebase user attempting to chat in demo conversation returns 404 NOT_FOUND
  const demoChatAttemptRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Testing chat in demo conversation',
        conversationId: 'conv_plan_today',
      }),
    }),
    aiProdEnv
  );
  const demoChatAttemptJson: any = await demoChatAttemptRes.json();
  assert(demoChatAttemptRes.status === 404, 'Posting to demo conversation conv_plan_today returns 404 Not Found');
  assert(demoChatAttemptJson.error?.code === 'NOT_FOUND', 'Error code is NOT_FOUND');

  // Test 11.3: User Charlie (new user with no conversations) auto-creates a conversation when none provided
  const charlieUid = 'fb_usr_charlie_303';
  const charlieToken = await createFbToken({
    sub: charlieUid,
    email: 'charlie@orbit.io',
    name: 'Charlie Davis',
  });

  const charlieChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Charlie roadmap planning prompt',
      }),
    }),
    aiProdEnv
  );
  const charlieChatJson: any = await charlieChatRes.json();
  assert(charlieChatRes.status === 200, 'POST /api/v1/ai/chat succeeds for new user without conversationId');
  assert(Boolean(charlieChatJson.data?.conversationId), 'Server auto-created and returned a new conversationId');
  const charlieConvId = charlieChatJson.data.conversationId;
  assert(!DEMO_CONVERSATION_IDS.includes(charlieConvId), 'Auto-created conversation is not a demo conversation ID');

  // Verify Charlie owns this new conversation in D1
  const charlieConvInDb = await d1.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .bind(charlieConvId, charlieUid)
    .first();
  assert(Boolean(charlieConvInDb), 'New conversation record safely persisted in D1 with Charlie UID');

  // Test 11.4: Loading conversations returns ONLY that user's conversations
  const charlieListRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/conversations', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
      },
    }),
    aiProdEnv
  );
  const charlieListJson: any = await charlieListRes.json();
  assert(charlieListRes.status === 200, 'GET /api/v1/conversations succeeds for Charlie');
  assert(Array.isArray(charlieListJson.data), 'Returns an array of conversations');
  assert(charlieListJson.data.length === 1, 'Charlie has exactly 1 conversation');
  assert(charlieListJson.data[0].id === charlieConvId, 'Charlie list contains Charlie auto-created conversation');
  assert(
    !charlieListJson.data.some((c: any) => c.id === 'conv_plan_today' || c.id === 'conv_soc2_audit'),
    'Charlie conversation list does not contain demo conversations'
  );

  // Test 11.5: Cross-user conversation access prevention
  // Charlie cannot read Alice's conversation messages
  const crossGetMessagesRes = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/conversations/${createdConvId}/messages`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
      },
    }),
    aiProdEnv
  );
  assert(crossGetMessagesRes.status === 404, 'Charlie cannot read Alice conversation messages (404 Not Found)');

  // Charlie cannot delete Alice's conversation
  const crossDeleteConvRes = await worker.fetch(
    new Request(`https://orbit.internal/api/v1/conversations/${createdConvId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
      },
    }),
    aiProdEnv
  );
  assert(crossDeleteConvRes.status === 404, 'Charlie cannot delete Alice conversation (404 Not Found)');

  // Charlie cannot post messages into Alice's conversation
  const crossPostAiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${charlieToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Charlie attempting to post into Alice conversation',
        conversationId: createdConvId,
      }),
    }),
    aiProdEnv
  );
  assert(crossPostAiRes.status === 404, 'Charlie cannot post into Alice conversation (404 Not Found)');

  // Test 11.6: formatFirebaseAuthError handles auth/internal-error clearly
  const internalErrMsg = formatFirebaseAuthError({ code: 'auth/internal-error' });
  assert(
    internalErrMsg.includes('internal error') && internalErrMsg.includes('VITE_FIREBASE_API_KEY'),
    'formatFirebaseAuthError maps auth/internal-error to clear actionable guidance'
  );

  clearKeyCaches();

  // 12. Testing Frontend URL Synchronization, Route Parsing, and Path Generation:
  console.log('\n12. Testing Frontend URL Synchronization, Route Parsing, and Path Generation:');
  
  // Landing page route parsing
  const landingRouteRoot = parsePath('/');
  assert(landingRouteRoot?.page === 'landing' && landingRouteRoot.projectId === null, 'Root path "/" parses to landing page');
  
  const landingRouteNamed = parsePath('/landing');
  assert(landingRouteNamed?.page === 'landing', 'Path "/landing" parses to landing page');

  // Overview / Dashboard route parsing
  const overviewRoute = parsePath('/overview');
  assert(overviewRoute?.page === 'overview', 'Path "/overview" parses to overview page');

  const dashboardRoute = parsePath('/dashboard');
  assert(dashboardRoute?.page === 'overview', 'Alias "/dashboard" parses to overview page');

  // Tasks route parsing
  const tasksRoute = parsePath('/tasks');
  assert(tasksRoute?.page === 'tasks', 'Path "/tasks" parses to tasks page');

  const tasksTrailingSlash = parsePath('/tasks/');
  assert(tasksTrailingSlash?.page === 'tasks', 'Path "/tasks/" with trailing slash parses to tasks page');

  // Projects route parsing
  const projectsRoute = parsePath('/projects');
  assert(projectsRoute?.page === 'projects', 'Path "/projects" parses to projects page');

  // Project Detail deep link parsing
  const projectDetailRoute = parsePath('/projects/proj_core_01');
  assert(
    projectDetailRoute?.page === 'project_detail' && projectDetailRoute.projectId === 'proj_core_01',
    'Path "/projects/proj_core_01" parses to project_detail with projectId'
  );

  // Chat / Agent route parsing
  const chatRoute = parsePath('/chat');
  assert(chatRoute?.page === 'agent', 'Path "/chat" parses to agent AI chat view');

  const agentRoute = parsePath('/agent');
  assert(agentRoute?.page === 'agent', 'Alias "/agent" parses to agent AI chat view');

  // Activity & Settings route parsing
  const activityRoute = parsePath('/activity');
  assert(activityRoute?.page === 'activity', 'Path "/activity" parses to activity view');

  const settingsRoute = parsePath('/settings');
  assert(settingsRoute?.page === 'settings', 'Path "/settings" parses to settings view');

  const profileRoute = parsePath('/profile');
  assert(profileRoute?.page === 'profile', 'Path "/profile" parses to profile view');

  const userProfileRoute = parsePath('/user-profile');
  assert(userProfileRoute?.page === 'profile', 'Alias "/user-profile" parses to profile view');

  // Invalid routes handling (graceful fallback to landing)
  const invalidRoute1 = parsePath('/non-existent-page');
  assert(invalidRoute1 === null, 'Unrecognized path "/non-existent-page" returns null for landing fallback');

  const invalidRoute2 = parsePath('/projects/nested/deep/path');
  assert(invalidRoute2 === null, 'Malformed nested path returns null for landing fallback');

  // Route path generator (routeToPath) verification
  assert(routeToPath('landing') === '/', 'routeToPath("landing") generates "/"');
  assert(routeToPath('overview') === '/overview', 'routeToPath("overview") generates "/overview"');
  assert(routeToPath('tasks') === '/tasks', 'routeToPath("tasks") generates "/tasks"');
  assert(routeToPath('projects') === '/projects', 'routeToPath("projects") generates "/projects"');
  assert(routeToPath('project_detail', 'proj_core_01') === '/projects/proj_core_01', 'routeToPath("project_detail", "proj_core_01") generates "/projects/proj_core_01"');
  assert(routeToPath('project_detail', null) === '/projects', 'routeToPath("project_detail", null) falls back to "/projects"');
  assert(routeToPath('agent') === '/chat', 'routeToPath("agent") generates "/chat"');
  assert(routeToPath('activity') === '/activity', 'routeToPath("activity") generates "/activity"');
  assert(routeToPath('settings') === '/settings', 'routeToPath("settings") generates "/settings"');
  assert(routeToPath('profile') === '/profile', 'routeToPath("profile") generates "/profile"');

  // -------------------------------------------------------------
  // 13. Testing Orbit 2.0 Web Intelligence (Search Detection, Tavily Adapter, Grounding, Caching)
  // -------------------------------------------------------------
  console.log('\n13. Testing Orbit 2.0 Web Intelligence (Detection, Adapter, Caching, Grounding):');

  // Test 13.1: Intelligent Search Intent Detection
  const mockProvider: ISearchProvider = {
    name: 'mock_tavily',
    async search(query: string): Promise<SearchQueryResult> {
      return {
        query,
        sources: [
          {
            title: 'Cloudflare Workers 2026 Roadmap',
            url: 'https://blog.cloudflare.com/workers-2026-roadmap',
            content: 'Cloudflare announced native AI inference updates and sub-5ms cold starts across all edge POPs in 2026.',
            publishedDate: '2026-03-15',
          },
          {
            title: 'Serverless AI Performance Benchmarks',
            url: 'https://example.com/ai-benchmarks',
            content: 'Llama 3.1 8B Fast achieves sub-100ms TTFT on global edge workers.',
            publishedDate: '2026-04-01',
          },
        ],
        retrievedAt: '2026-10-14T12:00:00.000Z',
        provider: 'mock_tavily',
      };
    },
  };

  const testSearchManager = new SearchManager(mockProvider, { ttlMs: 5000 });

  assert(testSearchManager.isConfigured(), 'SearchManager recognizes configured provider');
  assert(testSearchManager.getProviderName() === 'mock_tavily', 'Provider name is mock_tavily');

  // Should NOT search ordinary conversation
  assert(!testSearchManager.shouldSearch('Hello'), 'Does not trigger search for simple greeting "Hello"');
  assert(!testSearchManager.shouldSearch('How are you today?'), 'Does not trigger search for ordinary pleasantry');
  assert(!testSearchManager.shouldSearch('create task for sprint planning'), 'Does not trigger search for internal workspace action');

  // Should trigger search for live/recent queries
  assert(testSearchManager.shouldSearch('What are the latest Cloudflare releases in 2026?'), 'Triggers search for "latest Cloudflare releases in 2026"');
  assert(testSearchManager.shouldSearch('Find online news about serverless GPUs'), 'Triggers search for "Find online news"');
  assert(testSearchManager.shouldSearch('Who won the recent engineering award?'), 'Triggers search for "recent engineering award"');

  // Explicit override test
  assert(testSearchManager.shouldSearch('hello', true), 'Explicit webSearch: true forces search on any query');
  assert(!testSearchManager.shouldSearch('What are the latest releases in 2026?', false), 'Explicit webSearch: false suppresses search');

  // Test 13.2: Result Caching and deduplication
  const firstSearchResult = await testSearchManager.search('Cloudflare Workers 2026');
  assert(firstSearchResult.sources.length === 2, 'Search returns expected source count');
  assert(!firstSearchResult.cached, 'First search execution is not cached');

  const secondSearchResult = await testSearchManager.search('Cloudflare Workers 2026');
  assert(secondSearchResult.cached === true, 'Repeated search within TTL returns cached result');
  assert(secondSearchResult.sources[0].url === 'https://blog.cloudflare.com/workers-2026-roadmap', 'Cached sources match original result');

  // Test 13.3: Unconfigured Search Provider Graceful Handling
  const unconfiguredManager = new SearchManager(null);
  assert(!unconfiguredManager.isConfigured(), 'Unconfigured SearchManager reports isConfigured() === false');

  // Test 13.4: Worker Web Intelligence Endpoint Execution with Grounding Evidence
  // Re-register test public key for valid token verification
  registerTestPublicKey(testKid, firebaseKeyPair.publicKey);

  const webAiEnv: Env = {
    ...aiProdEnv,
    TAVILY_API_KEY: 'tvly-test-mock-key-12345',
  };

  // Mock global fetch to intercept Tavily API call
  const originalFetch = globalThis.fetch;
  let interceptedTavilyCall = false;
  let interceptedQuery = '';

  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('api.tavily.com')) {
      interceptedTavilyCall = true;
      try {
        const parsedBody = JSON.parse(init?.body || '{}');
        interceptedQuery = parsedBody.query || '';
      } catch {}

      return new Response(
        JSON.stringify({
          query: interceptedQuery,
          results: [
            {
              title: 'Official Cloudflare 2026 Release Notes',
              url: 'https://developers.cloudflare.com/workers/release-notes-2026',
              content: 'Workers now include native Llama 3.1 8B Fast with sub-50ms latency.',
              published_date: '2026-05-10',
              score: 0.98,
            },
            {
              title: 'Official Cloudflare 2026 Release Notes', // duplicate URL to test deduplication
              url: 'https://developers.cloudflare.com/workers/release-notes-2026',
              content: 'Duplicate entry.',
              published_date: '2026-05-10',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  try {
    const searchChatRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'What are the latest Cloudflare release notes in 2026?',
        }),
      }),
      webAiEnv
    );

    const searchChatJson: any = await searchChatRes.json();
    assert(searchChatRes.status === 200, 'Live search chat request returns HTTP 200');
    assert(interceptedTavilyCall, 'Tavily search provider API was invoked by Worker');
    const webData = searchChatJson.data?.webSearch || searchChatJson.webSearch;
    assert(webData?.triggered === true, 'Response metadata marks webSearch.triggered as true');
    assert(webData?.sourcesCount === 1, 'Sources deduplicated correctly (1 unique source)');
    assert(webData?.sources[0].url === 'https://developers.cloudflare.com/workers/release-notes-2026', 'Source URL returned in response metadata');

    // Verify system prompt contained grounded evidence
    const groundedSystemMsg = lastCapturedMessages.find((m) => m.role === 'system');
    assert(
      Boolean(groundedSystemMsg && groundedSystemMsg.content.includes('REAL-TIME WEB EVIDENCE')),
      'System prompt injected with real-time web evidence'
    );
    assert(
      Boolean(groundedSystemMsg && groundedSystemMsg.content.includes('https://developers.cloudflare.com/workers/release-notes-2026')),
      'Evidence citations passed to AI model context'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 13.5: Graceful degradation when Tavily quota exhausted (HTTP 429)
  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('api.tavily.com')) {
      return new Response(JSON.stringify({ error: 'Monthly quota exhausted' }), { status: 429 });
    }
    return originalFetch(input, init);
  };

  try {
    const quotaFailRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'What are the latest stock prices today?',
          webSearch: true,
        }),
      }),
      webAiEnv
    );

    const quotaFailJson: any = await quotaFailRes.json();
    const quotaData = quotaFailJson.data?.webSearch || quotaFailJson.webSearch;
    assert(quotaFailRes.status === 200, 'Search quota error degrades gracefully to 200 (does not crash inference)');
    assert(quotaData?.triggered === true, 'Web search was triggered');
    assert(quotaData?.sourcesCount === 0, 'No sources returned due to quota exhaustion');
    assert(
      Boolean(quotaData?.notice && quotaData.notice.includes('quota')),
      'Graceful diagnostic notice returned in webSearch metadata'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 13.6: DuckDuckGo Search Provider Unit & Live Fallback
  const ddgProvider = new DuckDuckGoSearchProvider({ maxResults: 3 });
  assert(ddgProvider.name === 'duckduckgo', 'DuckDuckGo provider name is "duckduckgo"');

  const emptyDdgResult = await ddgProvider.search('');
  assert(emptyDdgResult.sources.length === 0, 'Empty query returns 0 sources');

  // Mock html fetch for DuckDuckGo
  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('duckduckgo.com/html')) {
      const mockHtml = `
        <div class="result results_links">
          <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Forbitwork.io%2Fdocs%2F2026&amp;rut=123">Orbit 2.0 Edge Runtime Release</a>
          <a class="result__snippet" href="#">Orbit 2.0 introduces native multi-provider AI routing and live web intelligence in 2026.</a>
        </div>
      `;
      return new Response(mockHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return originalFetch(input, init);
  };

  try {
    const ddgResult = await ddgProvider.search('Orbit 2.0 release 2026');
    assert(ddgResult.sources.length === 1, 'DuckDuckGo provider parses 1 source from HTML');
    assert(ddgResult.sources[0].url === 'https://orbitwork.io/docs/2026', 'Decoded redirect URL correctly');
    assert(ddgResult.sources[0].title === 'Orbit 2.0 Edge Runtime Release', 'Extracted title correctly');
    assert(ddgResult.sources[0].content.includes('Orbit 2.0 introduces'), 'Extracted snippet correctly');

    // Test live chat fallback with zero Tavily key (uses DuckDuckGo provider)
    const noTavilyEnv: Env = {
      ...aiProdEnv, // lacks TAVILY_API_KEY
    };

    const noKeyChatRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'What are the latest 2026 features?',
          webSearch: true,
        }),
      }),
      noTavilyEnv
    );

    const noKeyChatJson: any = await noKeyChatRes.json();
    const noKeyData = noKeyChatJson.data || noKeyChatJson;
    assert(noKeyChatRes.status === 200, 'Live web search succeeds without Tavily key via fallback');
    assert(noKeyData.webSearch?.triggered === true, 'Web search was triggered on live request');
    assert(noKeyData.webSearch?.sourcesCount === 1, 'Retrieved source via DuckDuckGo fallback');
    assert(noKeyData.webSearch?.sources[0].url === 'https://orbitwork.io/docs/2026', 'Source URL present in response metadata');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // =========================================================================
  // Section 14: Orbit 2.0 Modular Model Provider System
  // =========================================================================
  console.log('\n--- Section 14: Orbit 2.0 Modular Model Provider System ---');

  // Test 14.1: Registry Provider Registration and Resolution
  const mockAiForRegistry: any = {
    run: async (_model: string, _options: any) => ({
      response: 'Cloudflare Workers AI generated response.',
    }),
  };

  const unitRegistry = new ModelProviderRegistry();
  const cfProvider = new CloudflareWorkersAiProvider(mockAiForRegistry);
  const openAiProvider = new OpenAiModelProvider('test-openai-key');
  const geminiProvider = new GeminiModelProvider('test-gemini-key');
  const anthropicProvider = new AnthropicModelProvider('test-anthropic-key');

  unitRegistry.registerProvider(cfProvider, true);
  unitRegistry.registerProvider(openAiProvider);
  unitRegistry.registerProvider(geminiProvider);
  unitRegistry.registerProvider(anthropicProvider);

  assert(unitRegistry.resolveProvider().id === 'cloudflare', 'Default resolution resolves to Cloudflare');
  assert(unitRegistry.resolveProvider('orbit-agent-v2').id === 'cloudflare', 'orbit-agent-v2 resolves to Cloudflare');
  assert(unitRegistry.resolveProvider('@cf/meta/llama-3.1-8b-instruct-fast').id === 'cloudflare', '@cf/ resolves to Cloudflare');
  assert(unitRegistry.resolveProvider('gpt-4o').id === 'openai', 'gpt-4o resolves to OpenAI');
  assert(unitRegistry.resolveProvider('o3-mini').id === 'openai', 'o3-mini resolves to OpenAI');
  assert(unitRegistry.resolveProvider('gemini-2.5-flash').id === 'gemini', 'gemini-2.5-flash resolves to Gemini');
  assert(unitRegistry.resolveProvider('claude-3-7-sonnet').id === 'anthropic', 'claude-3-7-sonnet resolves to Anthropic');
  assert(unitRegistry.resolveProvider('unknown-future-model').id === 'cloudflare', 'Unknown model falls back to default provider');

  // Test 14.2: Provider Configuration State Verification
  const unconfiguredOpenAi = new OpenAiModelProvider(undefined);
  const unconfiguredGemini = new GeminiModelProvider('');
  const unconfiguredAnthropic = new AnthropicModelProvider('   ');
  const unconfiguredCf = new CloudflareWorkersAiProvider(undefined);

  assert(!unconfiguredOpenAi.isConfigured(), 'OpenAI is unconfigured without API key');
  assert(!unconfiguredGemini.isConfigured(), 'Gemini is unconfigured without API key');
  assert(!unconfiguredAnthropic.isConfigured(), 'Anthropic is unconfigured without API key');
  assert(!unconfiguredCf.isConfigured(), 'Cloudflare is unconfigured without AI binding');
  assert(cfProvider.isConfigured(), 'Cloudflare is configured when AI binding present');
  assert(openAiProvider.isConfigured(), 'OpenAI is configured when API key present');

  // Test 14.3: Unconfigured Provider Fallback in Registry
  const fallbackRegistry = new ModelProviderRegistry();
  fallbackRegistry.registerProvider(cfProvider, true);
  fallbackRegistry.registerProvider(unconfiguredOpenAi);

  const fallbackExec = await fallbackRegistry.execute({
    messages: [{ role: 'user', content: 'Test prompt' }],
    modelId: 'gpt-4o',
    allowFallback: true,
  });

  assert(fallbackExec.fallbackUsed === true, 'Fallback was marked as used when requesting unconfigured gpt-4o');
  assert(fallbackExec.provider === 'cloudflare', 'Execution fell back to Cloudflare provider');
  assert(fallbackExec.modelId === DEFAULT_CLOUDFLARE_MODEL, 'Execution fell back to default Cloudflare model');
  assert(fallbackExec.text === 'Cloudflare Workers AI generated response.', 'Returned response from fallback provider');

  // Test 14.4: Disallowed Fallback Throws PROVIDER_NOT_CONFIGURED
  let threwExpected = false;
  try {
    await fallbackRegistry.execute({
      messages: [{ role: 'user', content: 'Test prompt' }],
      modelId: 'gpt-4o',
      allowFallback: false,
    });
  } catch (err: unknown) {
    if (err instanceof ModelProviderError) {
      threwExpected = err.code === 'PROVIDER_NOT_CONFIGURED';
    }
  }
  assert(threwExpected, 'Disallowed fallback throws PROVIDER_NOT_CONFIGURED error');

  // Test 14.5: HTTP API Chat with Default Provider (Cloudflare)
  const defaultModelRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Check default model routing',
        model: 'orbit-agent-v2',
      }),
    }),
    webAiEnv
  );
  const defaultModelJson: any = await defaultModelRes.json();
  const defaultData = defaultModelJson.data || defaultModelJson;
  assert(defaultModelRes.status === 200, 'POST /api/v1/ai/chat with default model returns 200');
  assert(defaultData.provider === 'cloudflare', 'Default execution provider is cloudflare');
  assert(defaultData.model === DEFAULT_CLOUDFLARE_MODEL, 'Default execution model is Llama 3.1 8B');
  assert(defaultData.fallbackUsed === false, 'No fallback needed for default model');

  // Test 14.6: HTTP API Chat with Unconfigured Provider and allowFallback: true
  const fallbackApiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Check unconfigured model graceful fallback',
        model: 'gpt-4o',
        allowFallback: true,
      }),
    }),
    webAiEnv // lacks OPENAI_API_KEY
  );
  const fallbackApiJson: any = await fallbackApiRes.json();
  const fallbackApiData = fallbackApiJson.data || fallbackApiJson;
  assert(fallbackApiRes.status === 200, 'Unconfigured provider with allowFallback returns 200');
  assert(fallbackApiData.fallbackUsed === true, 'fallbackUsed flag is true in API response');
  assert(fallbackApiData.provider === 'cloudflare', 'Fell back to cloudflare in API response');

  // Test 14.7: HTTP API Chat with Unconfigured Provider and allowFallback: false
  const strictUnconfiguredRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Check strict error when unconfigured',
        model: 'claude-3-7-sonnet',
        allowFallback: false,
      }),
    }),
    webAiEnv // lacks ANTHROPIC_API_KEY
  );
  const strictUnconfiguredJson: any = await strictUnconfiguredRes.json();
  assert(strictUnconfiguredRes.status === 503, 'Unconfigured provider with allowFallback: false returns 503');
  assert(strictUnconfiguredJson.error?.code === 'PROVIDER_NOT_CONFIGURED', 'Error code is PROVIDER_NOT_CONFIGURED');
  assert(strictUnconfiguredJson.error?.details?.provider === 'anthropic', 'Error details specify anthropic provider');

  // Test 14.8: Live External Provider Execution when Configured (OpenAI)
  const openAiEnv: Env = {
    ...webAiEnv,
    OPENAI_API_KEY: 'sk-test-mock-openai-key-valid',
  };

  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('api.openai.com/v1/chat/completions')) {
      const authHeader = init?.headers?.Authorization || init?.headers?.authorization;
      if (authHeader !== 'Bearer sk-test-mock-openai-key-valid') {
        return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Response from OpenAI GPT-4o adapter.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  try {
    const liveOpenAiRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Hello GPT-4o',
          model: 'gpt-4o',
        }),
      }),
      openAiEnv
    );
    const liveOpenAiJson: any = await liveOpenAiRes.json();
    const liveData = liveOpenAiJson.data || liveOpenAiJson;
    assert(liveOpenAiRes.status === 200, 'POST /api/v1/ai/chat with configured OpenAI returns 200');
    assert(liveData.provider === 'openai', 'Provider in response is openai');
    assert(liveData.model === 'gpt-4o', 'Model in response is gpt-4o');
    assert(liveData.response === 'Response from OpenAI GPT-4o adapter.', 'Received OpenAI response text');
    assert(liveData.fallbackUsed === false, 'fallbackUsed is false for configured provider');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 14.9: Live External Provider Execution when Configured (Anthropic Claude)
  const anthropicEnv: Env = {
    ...webAiEnv,
    ANTHROPIC_API_KEY: 'sk-ant-test-mock-key-valid',
  };

  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('api.anthropic.com/v1/messages')) {
      const apiKeyHeader = init?.headers?.['x-api-key'];
      if (apiKeyHeader !== 'sk-ant-test-mock-key-valid') {
        return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 });
      }
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'Response from Anthropic Claude adapter.' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 18, output_tokens: 9 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  try {
    const liveAnthropicRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Hello Claude',
          model: 'claude-3-7-sonnet',
        }),
      }),
      anthropicEnv
    );
    const liveAnthropicJson: any = await liveAnthropicRes.json();
    const liveAnthropicData = liveAnthropicJson.data || liveAnthropicJson;
    assert(liveAnthropicRes.status === 200, 'POST /api/v1/ai/chat with configured Anthropic returns 200');
    assert(liveAnthropicData.provider === 'anthropic', 'Provider in response is anthropic');
    assert(liveAnthropicData.model === 'claude-3-7-sonnet', 'Model in response is claude-3-7-sonnet');
    assert(liveAnthropicData.response === 'Response from Anthropic Claude adapter.', 'Received Anthropic response text');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 14.10: Live External Provider Execution when Configured (Google Gemini)
  const geminiEnv: Env = {
    ...webAiEnv,
    GEMINI_API_KEY: 'AIzaSy-test-gemini-key',
  };

  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Response from Google Gemini adapter.' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7, totalTokenCount: 19 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  try {
    const liveGeminiRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Hello Gemini',
          model: 'gemini-2.5-flash',
        }),
      }),
      geminiEnv
    );
    const liveGeminiJson: any = await liveGeminiRes.json();
    const liveGeminiData = liveGeminiJson.data || liveGeminiJson;
    assert(liveGeminiRes.status === 200, 'POST /api/v1/ai/chat with configured Gemini returns 200');
    assert(liveGeminiData.provider === 'gemini', 'Provider in response is gemini');
    assert(liveGeminiData.model === 'gemini-2.5-flash', 'Model in response is gemini-2.5-flash');
    assert(liveGeminiData.response === 'Response from Google Gemini adapter.', 'Received Gemini response text');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 14.11: External Provider Failure Seamlessly Falls Back to Cloudflare
  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('api.openai.com')) {
      return new Response(JSON.stringify({ error: { message: 'OpenAI internal upstream error' } }), { status: 500 });
    }
    return originalFetch(input, init);
  };

  try {
    const failOpenAiRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Test resilient fallback on provider 500 error',
          model: 'gpt-4o',
          allowFallback: true,
        }),
      }),
      openAiEnv
    );
    const failOpenAiJson: any = await failOpenAiRes.json();
    const failData = failOpenAiJson.data || failOpenAiJson;
    assert(failOpenAiRes.status === 200, 'Provider 500 error seamlessly falls back to 200 via Cloudflare Workers AI');
    assert(failData.fallbackUsed === true, 'fallbackUsed is true after primary provider failure');
    assert(failData.provider === 'cloudflare', 'Provider is cloudflare after fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 14.12: GET /api/v1/ai/models endpoint returns available providers and models
  const modelsRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    openAiEnv
  );
  const modelsJson: any = await modelsRes.json();
  const modelsData = modelsJson.data || modelsJson;
  assert(modelsRes.status === 200, 'GET /api/v1/ai/models returns 200 OK');
  assert(Array.isArray(modelsData.providers), 'Returns providers array');
  assert(modelsData.defaultModel === DEFAULT_CLOUDFLARE_MODEL, 'Default model matches Cloudflare Llama');
  assert(modelsData.providers.some((p: any) => p.id === 'cloudflare' && p.isDefault), 'Cloudflare is listed as default provider');
  assert(modelsData.providers.some((p: any) => p.id === 'openai' && p.isConfigured), 'OpenAI is recognized as configured when key present');
  assert(Array.isArray(modelsData.models), 'Returns models catalog');
  assert(modelsData.models.some((m: any) => m.id === 'orbit-agent-v2' && m.isDefault), 'Catalog contains default orbit-agent-v2');

  // =========================================================================
  // Section 15: Orbit 2.0 Direct Bring Your Own API Key (BYOK) Access
  // =========================================================================
  console.log('\n--- Section 15: Orbit 2.0 Direct Bring Your Own API Key (BYOK) Access ---');

  // Test 15.1: AES-GCM 256-bit Cryptographic Encryption & User Scope Isolation
  const sampleRawKey = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
  const aliceUserId = 'user_alice_123';
  const bobUserId = 'user_bob_456';
  const byokTestSecret = 'test-master-encryption-secret-2026';

  const encryptedForAlice = await encryptApiKey(sampleRawKey, aliceUserId, byokTestSecret);
  assert(typeof encryptedForAlice === 'string' && encryptedForAlice.includes('.'), 'Encrypted payload is serialized IV.ciphertext');
  assert(!encryptedForAlice.includes(sampleRawKey), 'Encrypted payload does not contain raw API key');

  const decryptedAlice = await decryptApiKey(encryptedForAlice, aliceUserId, byokTestSecret);
  assert(decryptedAlice === sampleRawKey, 'Decrypted key matches original plaintext for Alice');

  let bobDecryptionFailed = false;
  try {
    await decryptApiKey(encryptedForAlice, bobUserId, byokTestSecret);
  } catch {
    bobDecryptionFailed = true;
  }
  assert(bobDecryptionFailed, 'Decryption fails when attempted by Bob (strict cryptographic isolation)');

  // Key hint generation tests
  const hintGemini = generateKeyHint(sampleRawKey);
  assert(hintGemini === 'AIza...O5P6', `Gemini key hint is masked: ${hintGemini}`);
  assert(!hintGemini.includes(sampleRawKey.slice(5, 20)), 'Key hint does not leak sensitive middle characters');

  const hintOpenAi = generateKeyHint('sk-proj-1234567890abcdefghijklmnopqr');
  assert(hintOpenAi.startsWith('sk-proj-...'), 'OpenAI hint preserves standard prefix');

  const hintAnthropic = generateKeyHint('sk-ant-1234567890abcdefghijklmnopqr');
  assert(hintAnthropic.startsWith('sk-ant-...'), 'Anthropic hint preserves standard prefix');

  // Test 15.2: GET /api/v1/ai/providers returns supported providers
  const providersRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/providers', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  const providersJson: any = await providersRes.json();
  const providersData = providersJson.data || providersJson;
  assert(providersRes.status === 200, 'GET /api/v1/ai/providers returns 200 OK');
  assert(Array.isArray(providersData.providers), 'Returns providers list');
  const cloudflareProv = providersData.providers.find((p: any) => p.id === 'cloudflare');
  assert(cloudflareProv && cloudflareProv.isDefault && cloudflareProv.isConfigured, 'Cloudflare Workers AI is default and ready');
  const geminiProv = providersData.providers.find((p: any) => p.id === 'gemini');
  assert(geminiProv && geminiProv.byokSupported && !geminiProv.isConfigured, 'Gemini is unconfigured initially for Alice');

  // Test 15.3: POST /api/v1/ai/providers/connect connects BYOK key
  const connectGeminiRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/providers/connect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'gemini',
        apiKey: sampleRawKey,
        preferredModel: 'gemini-2.5-flash',
      }),
    }),
    aiProdEnv
  );
  const connectGeminiJson: any = await connectGeminiRes.json();
  const connectData = connectGeminiJson.data || connectGeminiJson;
  assert(connectGeminiRes.status === 200, 'POST /api/v1/ai/providers/connect returns 200 OK');
  assert(connectData.success === true, 'Connect result success is true');
  assert(connectData.provider === 'gemini', 'Connected provider is gemini');
  assert(connectData.keyHint === hintGemini, 'Returned keyHint matches safe mask');
  assert(!JSON.stringify(connectGeminiJson).includes(sampleRawKey), 'Never leaks raw API key in response');

  // Test 15.4: User credential persistence and Isolation between Alice and Bob
  const aliceProvidersRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/providers', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  const aliceProvJson: any = await aliceProvidersRes.json();
  const aliceProvData = aliceProvJson.data || aliceProvJson;
  const aliceGemini = aliceProvData.providers.find((p: any) => p.id === 'gemini');
  assert(aliceGemini && aliceGemini.isConfigured === true, 'Gemini is now marked configured for Alice');
  assert(aliceGemini.keyHint === hintGemini, 'Alice receives her own keyHint');

  // Check Bob (different authenticated user)
  const bobByokToken = await createFbToken({
    sub: bobUserId,
    name: 'Bob Tester',
    email: 'bob@example.com',
  });

  const bobProvidersRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/providers', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bobByokToken}`,
      },
    }),
    aiProdEnv
  );
  const bobProvJson: any = await bobProvidersRes.json();
  const bobProvData = bobProvJson.data || bobProvJson;
  const bobGemini = bobProvData.providers.find((p: any) => p.id === 'gemini');
  assert(bobGemini && bobGemini.isConfigured === false, 'Gemini is unconfigured for Bob (strict user isolation)');
  assert(!bobGemini.keyHint, 'Bob cannot see Alice keyHint');

  // Test 15.5: Dynamic Model Catalog reflecting user BYOK status
  const aliceModelsRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  const aliceModelsJson: any = await aliceModelsRes.json();
  const aliceModelsData = aliceModelsJson.data || aliceModelsJson;
  const aliceGeminiModel = aliceModelsData.models.find((m: any) => m.id === 'gemini-2.5-flash');
  assert(aliceGeminiModel && aliceGeminiModel.isConfigured === true, 'gemini-2.5-flash is configured for Alice');

  const bobModelsRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bobByokToken}`,
      },
    }),
    aiProdEnv
  );
  const bobModelsJson: any = await bobModelsRes.json();
  const bobModelsData = bobModelsJson.data || bobModelsJson;
  const bobGeminiModel = bobModelsData.models.find((m: any) => m.id === 'gemini-2.5-flash');
  assert(bobGeminiModel && bobGeminiModel.isConfigured === false, 'gemini-2.5-flash is NOT configured for Bob');

  // Test 15.6: Chat inference using Alice's decrypted BYOK key
  let capturedGeminiApiKey = '';
  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('generativelanguage.googleapis.com')) {
      const parsedUrl = new URL(urlStr);
      capturedGeminiApiKey = parsedUrl.searchParams.get('key') || '';
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Response via Alice BYOK Gemini key!' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6, totalTokenCount: 16 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  try {
    const aliceChatRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validFbToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Hello from Alice with BYOK',
          model: 'gemini-2.5-flash',
        }),
      }),
      aiProdEnv
    );
    const aliceChatJson: any = await aliceChatRes.json();
    const aliceChatData = aliceChatJson.data || aliceChatJson;
    assert(aliceChatRes.status === 200, 'Alice chat with BYOK key returns 200 OK');
    assert(aliceChatData.provider === 'gemini', 'Provider used is gemini');
    assert(aliceChatData.response === 'Response via Alice BYOK Gemini key!', 'Received BYOK response text');
    assert(capturedGeminiApiKey === sampleRawKey, 'Worker accurately decrypted and supplied Alice BYOK key');

    // Bob calling without key and with allowFallback: false returns 503
    const bobChatRes = await worker.fetch(
      new Request('https://orbit.internal/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bobByokToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Bob trying Gemini without BYOK',
          model: 'gemini-2.5-flash',
          allowFallback: false,
        }),
      }),
      aiProdEnv
    );
    assert(bobChatRes.status === 503, 'Bob without BYOK key receives 503 when fallback disallowed');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 15.7: DELETE /api/v1/ai/providers/:provider disconnects key
  const disconnectRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/providers/gemini', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  const disconnectJson: any = await disconnectRes.json();
  const disconnectData = disconnectJson.data || disconnectJson;
  assert(disconnectRes.status === 200, 'DELETE /api/v1/ai/providers/gemini returns 200 OK');
  assert(disconnectData.disconnected === true, 'Provider was marked disconnected');

  // Verify Gemini is now unconfigured for Alice
  const postDisconnectProvRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/providers', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  const postDisconnectJson: any = await postDisconnectProvRes.json();
  const postData = postDisconnectJson.data || postDisconnectJson;
  const postGemini = postData.providers.find((p: any) => p.id === 'gemini');
  assert(postGemini && postGemini.isConfigured === false, 'Gemini is unconfigured after disconnection');

  // Test 15.8: Built-in Cloudflare Workers AI remains operational
  const defaultChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Test built-in model after disconnect',
        model: 'orbit-agent-v2',
      }),
    }),
    aiProdEnv
  );
  assert(defaultChatRes.status === 200, 'Default built-in model returns 200 after disconnect');
  const defaultChatJson: any = await defaultChatRes.json();
  const defaultChatData = defaultChatJson.data || defaultChatJson;
  assert(defaultChatData.provider === 'cloudflare', 'Default execution provider is cloudflare');

  // =========================================================================
  // Section 16: Orbit 2.0 Dynamic Model Discovery, Categorization, & Lifecycle
  // =========================================================================
  console.log('\n--- Section 16: Orbit 2.0 Dynamic Model Discovery, Categorization, & Lifecycle ---');

  // Test 16.1: Curated Official Model Catalog categories and verified metadata
  assert(OFFICIAL_MODEL_CATALOG.length >= 10, 'Catalog contains at least 10 official production models');
  const fastModels = OFFICIAL_MODEL_CATALOG.filter((m) => m.category === 'fast');
  const balancedModels = OFFICIAL_MODEL_CATALOG.filter((m) => m.category === 'balanced');
  const reasoningModels = OFFICIAL_MODEL_CATALOG.filter((m) => m.category === 'reasoning');
  const codingModels = OFFICIAL_MODEL_CATALOG.filter((m) => m.category === 'coding');
  const specializedModels = OFFICIAL_MODEL_CATALOG.filter((m) => m.category === 'specialized');

  assert(fastModels.length >= 2, 'Has fast category models (e.g. Orbit Core, GPT-4o mini, Haiku)');
  assert(balancedModels.length >= 2, 'Has balanced category models (e.g. Gemini 2.5 Flash, GPT-4o)');
  assert(reasoningModels.length >= 2, 'Has advanced reasoning models (e.g. o3-mini, o1, Gemini 2.5 Pro)');
  assert(codingModels.length >= 2, 'Has coding & agentic models (e.g. Claude 3.7 Sonnet, Claude 3.5 Sonnet)');
  assert(specializedModels.length >= 1, 'Has specialized models (e.g. Gemini 3.8 Flash preview)');

  // Verify verified context windows
  const geminiFlash = OFFICIAL_MODEL_CATALOG.find((m) => m.id === 'gemini-2.5-flash');
  assert(Boolean(geminiFlash && geminiFlash.contextWindow === '1M' && geminiFlash.contextTokens === 1048576), 'Gemini 2.5 Flash has verified 1M context');
  const geminiPro = OFFICIAL_MODEL_CATALOG.find((m) => m.id === 'gemini-2.5-pro');
  assert(Boolean(geminiPro && geminiPro.contextWindow === '2M' && geminiPro.contextTokens === 2097152), 'Gemini 2.5 Pro has verified 2M context');
  const claude37 = OFFICIAL_MODEL_CATALOG.find((m) => m.id === 'claude-3-7-sonnet');
  assert(Boolean(claude37 && claude37.contextWindow === '200k' && claude37.reasoningCapability === 'hybrid'), 'Claude 3.7 Sonnet has verified 200k context & hybrid reasoning');

  // Verify stable vs preview status distinction
  assert(Boolean(geminiFlash?.status === 'stable'), 'Gemini 2.5 Flash is flagged stable');
  const gemini38 = OFFICIAL_MODEL_CATALOG.find((m) => m.id === 'gemini-3.8-flash');
  assert(Boolean(gemini38?.status === 'preview'), 'Gemini 3.8 Flash is clearly distinguished as preview');

  // Test 16.2: GET /api/v1/ai/models returns rich metadata and catalog timestamp
  const upgradedModelsRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  const upgradedModelsJson: any = await upgradedModelsRes.json();
  const upgradedData = upgradedModelsJson.data || upgradedModelsJson;
  assert(upgradedModelsRes.status === 200, 'GET /api/v1/ai/models returns 200 OK');
  assert(typeof upgradedData.catalogUpdatedAt === 'string', 'Returns catalogUpdatedAt ISO string');
  assert(typeof upgradedData.discoveryStatus === 'object', 'Returns discoveryStatus summary');
  assert(typeof upgradedData.deprecated === 'object', 'Returns deprecated models lifecycle dictionary');
  assert(upgradedData.models.some((m: any) => m.id === 'o3-mini' && m.category === 'reasoning'), 'o3-mini returned with reasoning category');
  assert(upgradedData.models.some((m: any) => m.id === 'claude-3-7-sonnet' && m.category === 'coding'), 'claude-3-7-sonnet returned with coding category');

  // Test 16.3: POST /api/v1/ai/models/discover executes discovery endpoint
  const discoverRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/models/discover', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
      },
    }),
    aiProdEnv
  );
  assert(discoverRes.status === 200, 'POST /api/v1/ai/models/discover returns 200 OK');
  const discoverJson: any = await discoverRes.json();
  const discoverData = discoverJson.data || discoverJson;
  assert(discoverData.success === true, 'Discovery result reports success');
  assert(Array.isArray(discoverData.models), 'Returns verified models list from discovery');

  // Test 16.4: Dynamic Model Discovery with Mocked Official Provider APIs
  let interceptedGeminiDiscovery = false;
  let interceptedOpenAiDiscovery = false;
  let interceptedAnthropicDiscovery = false;

  globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    if (urlStr.includes('generativelanguage.googleapis.com/v1beta/models')) {
      interceptedGeminiDiscovery = true;
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('api.openai.com/v1/models')) {
      interceptedOpenAiDiscovery = true;
      return new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-4o', object: 'model' },
            { id: 'o3-mini', object: 'model' },
            { id: 'text-embedding-3-small', object: 'model' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('api.anthropic.com/v1/models')) {
      interceptedAnthropicDiscovery = true;
      return new Response(
        JSON.stringify({
          data: [
            { id: 'claude-3-7-sonnet-20250219', type: 'model' },
            { id: 'claude-3-5-sonnet-20241022', type: 'model' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  try {
    const geminiModels = await discoverGeminiModels('fake-gemini-key');
    assert(interceptedGeminiDiscovery, 'Invoked official Google Gemini models discovery endpoint');
    assert(geminiModels.includes('gemini-2.5-flash'), 'Discovered gemini-2.5-flash');
    assert(!geminiModels.includes('gemini-embedding-001'), 'Filtered out non-generateContent models');

    const openAiModels = await discoverOpenAiModels('fake-openai-key');
    assert(interceptedOpenAiDiscovery, 'Invoked official OpenAI models discovery endpoint');
    assert(openAiModels.includes('gpt-4o'), 'Discovered gpt-4o');
    assert(!openAiModels.includes('text-embedding-3-small'), 'Filtered out non-chat embedding models');

    const anthropicModels = await discoverAnthropicModels('fake-anthropic-key');
    assert(interceptedAnthropicDiscovery, 'Invoked official Anthropic models discovery endpoint');
    assert(anthropicModels.some((id) => id.startsWith('claude-3-7-sonnet')), 'Discovered Claude 3.7 Sonnet');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Test 16.5: Model Lifecycle & Deprecation Handling in AI Chat
  const deprecatedChatRes = await worker.fetch(
    new Request('https://orbit.internal/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validFbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Hello with legacy model',
        model: 'gpt-3.5-turbo',
      }),
    }),
    aiProdEnv
  );
  assert(deprecatedChatRes.status === 200, 'Deprecated model request succeeds with graceful fallback (200 OK)');
  const deprecatedChatJson: any = await deprecatedChatRes.json();
  const deprecatedChatData = deprecatedChatJson.data || deprecatedChatJson;
  assert(typeof deprecatedChatData.deprecationNotice === 'string', 'Returns clear deprecation notice to client');
  assert(deprecatedChatData.deprecationNotice.includes('GPT-3.5 Turbo is legacy'), 'Notice identifies retired model and replacement');

  console.log(`\n========================================`);
  console.log(`All Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
