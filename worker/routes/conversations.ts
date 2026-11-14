import { Env, AuthenticatedUser } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { resolveActiveModelSelection } from '../services/ai/catalog';

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  model_id?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

let conversationsSchemaEnsured = false;

export async function ensureConversationsSchema(db: D1Database): Promise<void> {
  if (conversationsSchemaEnsured) return;
  try {
    await db.prepare('ALTER TABLE conversations ADD COLUMN model_id TEXT').run();
  } catch (err: unknown) {
    // Column already exists or duplicate column error - safe to ignore
  }
  conversationsSchemaEnsured = true;
}

export async function handleGetConversations(
  _request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  await ensureConversationsSchema(env.DB);

  const query = `
    SELECT 
      c.*,
      COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `;

  const result = await env.DB.prepare(query).bind(user.id).all<ConversationRow>();
  const conversations = await Promise.all(
    (result.results || []).map(async (row: ConversationRow) => {
      const resolved = resolveActiveModelSelection(row.model_id || 'orbit-agent-v2');
      if (resolved.migratedFrom) {
        await env.DB.prepare(
          'UPDATE conversations SET model_id = ? WHERE id = ? AND user_id = ?'
        )
          .bind(resolved.modelId, row.id, user.id)
          .run()
          .catch(() => {});
      }
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        modelId: resolved.modelId,
        messageCount: row.message_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    })
  );

  return jsonResponse(conversations, 200, { total: conversations.length });
}

export async function handleCreateConversation(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  await ensureConversationsSchema(env.DB);

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const title =
    body.title && typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : 'New Conversation';

  const rawModelId =
    body.modelId && typeof body.modelId === 'string' && body.modelId.trim()
      ? body.modelId.trim()
      : body.model && typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : 'orbit-agent-v2';

  const modelId = resolveActiveModelSelection(rawModelId).modelId;

  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, model_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, title, modelId, now, now)
    .run();

  const newConv = {
    id,
    userId: user.id,
    title,
    modelId,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  return jsonResponse(newConv, 201);
}

export async function handlePatchConversation(
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  conversationId: string
): Promise<Response> {
  await ensureConversationsSchema(env.DB);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  const updates: string[] = [];
  const bindings: any[] = [];

  if (body.title && typeof body.title === 'string' && body.title.trim()) {
    updates.push('title = ?');
    bindings.push(body.title.trim());
  }

  if (body.modelId && typeof body.modelId === 'string' && body.modelId.trim()) {
    updates.push('model_id = ?');
    bindings.push(resolveActiveModelSelection(body.modelId.trim()).modelId);
  } else if (body.model && typeof body.model === 'string' && body.model.trim()) {
    updates.push('model_id = ?');
    bindings.push(resolveActiveModelSelection(body.model.trim()).modelId);
  }

  if (updates.length === 0) {
    return errorResponse('VALIDATION_ERROR', 'No valid fields provided to update (title or modelId).', 400);
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  bindings.push(now);

  bindings.push(conversationId, user.id);

  const result = await env.DB.prepare(
    `UPDATE conversations SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...bindings)
    .run();

  if (!result.meta.changes) {
    return errorResponse('NOT_FOUND', `Conversation with id "${conversationId}" not found.`, 404);
  }

  const updatedConv = await env.DB.prepare(
    'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
  )
    .bind(conversationId, user.id)
    .first<ConversationRow>();

  return jsonResponse(
    {
      id: conversationId,
      userId: user.id,
      title: updatedConv?.title || body.title,
      modelId: updatedConv?.model_id || body.modelId || 'orbit-agent-v2',
      updatedAt: now,
    },
    200
  );
}

export async function handleDeleteConversation(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  conversationId: string
): Promise<Response> {
  // Cascades messages automatically due to ON DELETE CASCADE
  const result = await env.DB.prepare(
    'DELETE FROM conversations WHERE id = ? AND user_id = ?'
  )
    .bind(conversationId, user.id)
    .run();

  if (!result.meta.changes) {
    return errorResponse('NOT_FOUND', `Conversation with id "${conversationId}" not found.`, 404);
  }

  return jsonResponse({ success: true, id: conversationId }, 200);
}

export async function handleGetMessages(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  conversationId: string
): Promise<Response> {
  // First ensure user owns this conversation
  const conv = await env.DB.prepare(
    'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
  )
    .bind(conversationId, user.id)
    .first();

  if (!conv) {
    return errorResponse('NOT_FOUND', `Conversation with id "${conversationId}" not found.`, 404);
  }

  const result = await env.DB.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC'
  )
    .bind(conversationId, user.id)
    .all<MessageRow>();

  const messages = (result.results || []).map((m: MessageRow) => ({
    id: m.id,
    conversationId: m.conversation_id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  return jsonResponse(messages, 200, { total: messages.length });
}
