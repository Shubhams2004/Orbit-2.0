import { Env, AuthenticatedUser } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
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

export async function handleGetConversations(
  _request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
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
  const conversations = (result.results || []).map((row: ConversationRow) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    messageCount: row.message_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return jsonResponse(conversations, 200, { total: conversations.length });
}

export async function handleCreateConversation(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const title = (body.title && typeof body.title === 'string' && body.title.trim())
    ? body.title.trim()
    : 'New Conversation';

  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, title, now, now)
    .run();

  const newConv = {
    id,
    userId: user.id,
    title,
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
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Field "title" cannot be empty.', 400);
  }

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  )
    .bind(body.title.trim(), now, conversationId, user.id)
    .run();

  if (!result.meta.changes) {
    return errorResponse('NOT_FOUND', `Conversation with id "${conversationId}" not found.`, 404);
  }

  return jsonResponse({
    id: conversationId,
    userId: user.id,
    title: body.title.trim(),
    updatedAt: now,
  }, 200);
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
