import { Env, AuthenticatedUser, TaskStatus, TaskPriority } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

interface TaskRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

function formatTask(row: TaskRow) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleGetTasks(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const projectId = url.searchParams.get('projectId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  let query = 'SELECT * FROM tasks WHERE user_id = ?';
  const bindings: unknown[] = [user.id];

  if (status && ['todo', 'in_progress', 'done'].includes(status)) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
    query += ' AND priority = ?';
    bindings.push(priority);
  }

  if (projectId) {
    if (projectId === 'unassigned') {
      query += ' AND project_id IS NULL';
    } else {
      query += ' AND project_id = ?';
      bindings.push(projectId);
    }
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const stmt = env.DB.prepare(query).bind(...bindings);
  const result = await stmt.all<TaskRow>();

  // Count total for pagination
  const countStmt = env.DB.prepare('SELECT COUNT(*) as total FROM tasks WHERE user_id = ?').bind(user.id);
  const countRes = await countStmt.first<{ total: number }>();
  const total = countRes?.total ?? 0;

  const tasks = (result.results || []).map(formatTask);
  return jsonResponse(tasks, 200, { total, limit, offset });
}

export async function handleCreateTask(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Field "title" is required and cannot be empty.', 400);
  }

  const title = body.title.trim();
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const status: TaskStatus = ['todo', 'in_progress', 'done'].includes(body.status) ? body.status : 'todo';
  const priority: TaskPriority = ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium';
  const dueDate: string | null = body.dueDate || body.due_date || null;
  let projectId: string | null = body.projectId || body.project_id || null;

  // If projectId is provided, verify it exists and belongs to this user
  if (projectId) {
    const projCheck = await env.DB.prepare(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?'
    )
      .bind(projectId, user.id)
      .first();

    if (!projCheck) {
      return errorResponse('NOT_FOUND', 'Specified project does not exist or does not belong to you.', 404);
    }
  }

  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tasks (id, user_id, project_id, title, description, status, priority, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, projectId, title, description, status, priority, dueDate, now, now)
    .run();

  const newTask = {
    id,
    userId: user.id,
    projectId,
    title,
    description,
    status,
    priority,
    dueDate,
    createdAt: now,
    updatedAt: now,
  };

  return jsonResponse(newTask, 201);
}

export async function handleGetTask(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  taskId: string
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
  )
    .bind(taskId, user.id)
    .first<TaskRow>();

  if (!row) {
    return errorResponse('NOT_FOUND', `Task with id "${taskId}" not found.`, 404);
  }

  return jsonResponse(formatTask(row), 200);
}

export async function handlePatchTask(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  taskId: string
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
  )
    .bind(taskId, user.id)
    .first<TaskRow>();

  if (!existing) {
    return errorResponse('NOT_FOUND', `Task with id "${taskId}" not found.`, 404);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return errorResponse('VALIDATION_ERROR', 'Field "title" cannot be empty.', 400);
    }
    updates.push('title = ?');
    bindings.push(body.title.trim());
  }

  if (body.description !== undefined) {
    updates.push('description = ?');
    bindings.push(typeof body.description === 'string' ? body.description.trim() : '');
  }

  if (body.status !== undefined) {
    if (!['todo', 'in_progress', 'done'].includes(body.status)) {
      return errorResponse('VALIDATION_ERROR', 'Invalid status. Must be todo, in_progress, or done.', 400);
    }
    updates.push('status = ?');
    bindings.push(body.status);
  }

  if (body.priority !== undefined) {
    if (!['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
      return errorResponse('VALIDATION_ERROR', 'Invalid priority.', 400);
    }
    updates.push('priority = ?');
    bindings.push(body.priority);
  }

  if (body.dueDate !== undefined || body.due_date !== undefined) {
    const d = body.dueDate !== undefined ? body.dueDate : body.due_date;
    updates.push('due_date = ?');
    bindings.push(d || null);
  }

  if (body.projectId !== undefined || body.project_id !== undefined) {
    const pId = body.projectId !== undefined ? body.projectId : body.project_id;
    if (pId) {
      // Validate ownership of target project
      const projCheck = await env.DB.prepare(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?'
      )
        .bind(pId, user.id)
        .first();

      if (!projCheck) {
        return errorResponse('NOT_FOUND', 'Target project does not exist.', 404);
      }
    }
    updates.push('project_id = ?');
    bindings.push(pId || null);
  }

  if (updates.length === 0) {
    return jsonResponse(formatTask(existing), 200);
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  bindings.push(now);

  bindings.push(taskId, user.id);

  await env.DB.prepare(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...bindings)
    .run();

  const updatedRow = await env.DB.prepare(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
  )
    .bind(taskId, user.id)
    .first<TaskRow>();

  return jsonResponse(formatTask(updatedRow!), 200);
}

export async function handleDeleteTask(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  taskId: string
): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?'
  )
    .bind(taskId, user.id)
    .run();

  if (!result.meta.changes) {
    return errorResponse('NOT_FOUND', `Task with id "${taskId}" not found.`, 404);
  }

  return jsonResponse({ success: true, id: taskId }, 200);
}
