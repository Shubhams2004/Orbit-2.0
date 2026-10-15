-- ============================================================================
-- Orbit 2.0 Cloudflare D1 Migration: 0002_seed_demo_data.sql
-- Baseline initial data for demonstration and development verification
-- ============================================================================

-- Seed Default User
INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at)
VALUES (
  'usr_main_01',
  'Alex Morgan',
  'alex.morgan@orbitwork.io',
  '2026-09-01T00:00:00.000Z',
  '2026-09-01T00:00:00.000Z'
);

-- Seed Default Projects
INSERT OR IGNORE INTO projects (id, user_id, name, description, status, priority, created_at, updated_at)
VALUES
(
  'proj_core_01',
  'usr_main_01',
  'Platform 2.0 Architecture',
  'Transitioning frontend orchestration and zero-latency state synchronization with edge workers.',
  'in_progress',
  'high',
  '2026-09-15T08:00:00.000Z',
  '2026-10-12T14:30:00.000Z'
),
(
  'proj_sec_02',
  'usr_main_01',
  'Security & SOC2 Type II Audit',
  'Data isolation verification, RBAC rules audit, and vendor compliance certification.',
  'active',
  'urgent',
  '2026-09-20T10:00:00.000Z',
  '2026-10-14T09:15:00.000Z'
);

-- Seed Initial Tasks
INSERT OR IGNORE INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, created_at, updated_at)
VALUES
(
  'task_001',
  'usr_main_01',
  'proj_core_01',
  'Review D1 database schema migration draft',
  'Validate foreign key constraints and index performance on task project IDs.',
  'todo',
  'high',
  '2026-10-12',
  '2026-10-09T09:00:00.000Z',
  '2026-10-09T09:00:00.000Z'
),
(
  'task_002',
  'usr_main_01',
  'proj_sec_02',
  'Verify SOC2 encryption key rotation schedule',
  'Confirm automated 90-day rotation cycle with cloud credential vault.',
  'in_progress',
  'urgent',
  '2026-10-13',
  '2026-10-08T11:30:00.000Z',
  '2026-10-13T10:00:00.000Z'
),
(
  'task_003',
  'usr_main_01',
  'proj_core_01',
  'Finalize Agent human-in-the-loop approval protocol',
  'Establish clear boundary between read-only audit tools and state-mutating actions.',
  'in_progress',
  'urgent',
  '2026-10-14',
  '2026-10-11T14:00:00.000Z',
  '2026-10-14T08:15:00.000Z'
);

-- Seed Initial Conversation
INSERT OR IGNORE INTO conversations (id, user_id, title, created_at, updated_at)
VALUES (
  'conv_plan_today',
  'usr_main_01',
  'Daily Workflow & SLA Triage',
  '2026-10-14T08:30:00.000Z',
  '2026-10-14T09:30:00.000Z'
);

-- Seed Messages
INSERT OR IGNORE INTO messages (id, conversation_id, user_id, role, content, created_at)
VALUES
(
  'msg_init_01',
  'conv_plan_today',
  'usr_main_01',
  'user',
  'Summarize my pending tasks and plan my morning workflow.',
  '2026-10-14T08:31:00.000Z'
),
(
  'msg_init_02',
  'conv_plan_today',
  'usr_main_01',
  'assistant',
  'I evaluated your workspace tasks. You have 2 overdue items and 1 deliverable due today.',
  '2026-10-14T08:31:05.000Z'
);
