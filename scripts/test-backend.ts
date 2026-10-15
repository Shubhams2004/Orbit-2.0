import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/index';
import { Env } from '../worker/types';

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
  assert(user2ConvCheck.status === 404, 'User 2 cannot read messages in User 1 conversation (404 Not Found)');

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
