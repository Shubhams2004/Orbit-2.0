import { Env, AuthenticatedUser, ProjectStatus, TaskPriority } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  total_tasks?: number;
  completed_tasks?: number;
}

function formatProject(row: ProjectRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    totalTasks: row.total_tasks || 0,
    completedTasks: row.completed_tasks || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleGetProjects(
  _request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  const query = `
    SELECT 
      p.*,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.user_id = p.user_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  const result = await env.DB.prepare(query).bind(user.id).all<ProjectRow>();
  const projects = (result.results || []).map(formatProject);

  return jsonResponse(projects, 200, { total: projects.length });
}

export async function handleCreateProject(
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

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Field "name" is required and cannot be empty.', 400);
  }

  const name = body.name.trim();
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const status: ProjectStatus = ['active', 'in_progress', 'on_hold', 'completed'].includes(body.status)
    ? body.status
    : 'active';
  const priority: TaskPriority = ['low', 'medium', 'high', 'urgent'].includes(body.priority)
    ? body.priority
    : 'medium';

  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO projects (id, user_id, name, description, status, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, name, description, status, priority, now, now)
    .run();

  const newProject = {
    id,
    userId: user.id,
    name,
    description,
    status,
    priority,
    totalTasks: 0,
    completedTasks: 0,
    createdAt: now,
    updatedAt: now,
  };

  return jsonResponse(newProject, 201);
}

export async function handleGetProject(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  projectId: string
): Promise<Response> {
  const query = `
    SELECT 
      p.*,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.user_id = p.user_id
    WHERE p.id = ? AND p.user_id = ?
    GROUP BY p.id
  `;

  const row = await env.DB.prepare(query).bind(projectId, user.id).first<ProjectRow>();

  if (!row) {
    return errorResponse('NOT_FOUND', `Project with id "${projectId}" not found.`, 404);
  }

  return jsonResponse(formatProject(row), 200);
}

export async function handlePatchProject(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  projectId: string
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, user.id)
    .first<ProjectRow>();

  if (!existing) {
    return errorResponse('NOT_FOUND', `Project with id "${projectId}" not found.`, 404);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return errorResponse('VALIDATION_ERROR', 'Field "name" cannot be empty.', 400);
    }
    updates.push('name = ?');
    bindings.push(body.name.trim());
  }

  if (body.description !== undefined) {
    updates.push('description = ?');
    bindings.push(typeof body.description === 'string' ? body.description.trim() : '');
  }

  if (body.status !== undefined) {
    if (!['active', 'in_progress', 'on_hold', 'completed'].includes(body.status)) {
      return errorResponse('VALIDATION_ERROR', 'Invalid status for project.', 400);
    }
    updates.push('status = ?');
    bindings.push(body.status);
  }

  if (body.priority !== undefined) {
    if (!['low', 'medium', 'high', 'urgent'].includes(body.priority)) {
      return errorResponse('VALIDATION_ERROR', 'Invalid priority for project.', 400);
    }
    updates.push('priority = ?');
    bindings.push(body.priority);
  }

  if (updates.length === 0) {
    return jsonResponse(formatProject(existing), 200);
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  bindings.push(now);

  bindings.push(projectId, user.id);

  await env.DB.prepare(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...bindings)
    .run();

  return handleGetProject(request, env, user, projectId);
}

export async function handleDeleteProject(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  projectId: string
): Promise<Response> {
  // Ensure tasks are detached cleanly
  await env.DB.prepare(
    'UPDATE tasks SET project_id = NULL WHERE project_id = ? AND user_id = ?'
  )
    .bind(projectId, user.id)
    .run();

  const result = await env.DB.prepare(
    'DELETE FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, user.id)
    .run();

  if (!result.meta.changes) {
    return errorResponse('NOT_FOUND', `Project with id "${projectId}" not found.`, 404);
  }

  return jsonResponse({ success: true, id: projectId }, 200);
}
