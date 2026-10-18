import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index';
import { Env } from '../worker/types';
import { signHs256Jwt, base64UrlEncode } from '../worker/utils/jwt';
import { registerTestPublicKey, clearKeyCaches } from '../worker/utils/firebase-auth';

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
  console.log('1. Applying D1 Migrations: 0001_initial_schema.sql & 0002_seed_demo_data.sql...');
  const migration1 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql'), 'utf-8');
  const migration2 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0002_seed_demo_data.sql'), 'utf-8');
  sqlite.exec(migration1);
  sqlite.exec(migration2);
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
  const mockAi: any = {
    async run(model: string, input: any) {
      if (mockAiShouldFail) {
        throw new Error('Cloudflare Workers AI inference engine rate limited');
      }
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
  assert(autoConvJson.data?.model === '@cf/meta/llama-3.1-8b-instruct', 'Model is @cf/meta/llama-3.1-8b-instruct');
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

  clearKeyCaches();

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
