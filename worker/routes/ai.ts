import { Env, AuthenticatedUser } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const SYSTEM_PROMPT =
  'You are Orbit, an intelligent personal workspace co-pilot. Provide clear, accurate, and concise assistance for task management, project planning, and technical productivity. Keep responses well-structured and helpful.';

interface MessageHistoryRow {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function handleAiChat(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  // 1. Guard: Check Cloudflare Workers AI Binding
  if (!env.AI) {
    return errorResponse(
      'AI_UNAVAILABLE',
      'Cloudflare Workers AI binding "AI" is not configured or unavailable on this Worker.',
      503
    );
  }

  // 2. Parse and Validate Request Body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  if (!body || typeof body !== 'object') {
    return errorResponse('VALIDATION_ERROR', 'Request body must be a JSON object.', 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return errorResponse('VALIDATION_ERROR', 'Field "prompt" is required and cannot be empty.', 400);
  }

  if (prompt.length > 4000) {
    return errorResponse(
      'VALIDATION_ERROR',
      `Prompt exceeds maximum allowed length of 4000 characters (received ${prompt.length}).`,
      400
    );
  }

  let conversationId: string | null =
    typeof body.conversationId === 'string' && body.conversationId.trim()
      ? body.conversationId.trim()
      : null;

  const now = new Date().toISOString();

  // Ensure authenticated user record exists in D1 database to satisfy foreign keys
  try {
    const userDisplayName = user.displayName?.trim() || 'Orbit User';
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(user.id, userDisplayName, user.email || null, now, now)
      .run();
  } catch (err: unknown) {
    console.warn('[AI Chat] User sync notice:', err);
  }

  // 3. Conversation Ownership & Creation (Strictly isolated by user.id)
  try {
    if (conversationId) {
      const existingConv = await env.DB.prepare(
        'SELECT id, title FROM conversations WHERE id = ? AND user_id = ?'
      )
        .bind(conversationId, user.id)
        .first();

      if (!existingConv) {
        return errorResponse(
          'NOT_FOUND',
          `Conversation with id "${conversationId}" not found or does not belong to you.`,
          404
        );
      }
    } else {
      // Automatically generate conversation when not provided
      const newTitle = prompt.length > 50 ? `${prompt.slice(0, 47)}...` : prompt;
      conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      await env.DB.prepare(
        `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(conversationId, user.id, newTitle, now, now)
        .run();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return errorResponse(
      'DATABASE_ERROR',
      `Failed to access or create conversation in database: ${message}`,
      500
    );
  }

  // 4. Persist User Message to D1 (role: user, strictly bound to verified user.id)
  const userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
       VALUES (?, ?, ?, 'user', ?, ?)`
    )
      .bind(userMsgId, conversationId, user.id, prompt, now)
      .run();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return errorResponse(
      'DATABASE_ERROR',
      `Failed to persist message in database: ${message}`,
      500
    );
  }

  // 5. Retrieve Recent Conversation Context (Last 8 messages before this prompt)
  const aiMessages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  try {
    const priorHistory = await env.DB.prepare(
      `SELECT role, content FROM messages
       WHERE conversation_id = ? AND user_id = ? AND id != ?
       ORDER BY created_at ASC LIMIT 8`
    )
      .bind(conversationId, user.id, userMsgId)
      .all<MessageHistoryRow>();

    for (const m of priorHistory.results || []) {
      // Sanitize role to ensure client cannot inject rogue system prompts
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      aiMessages.push({ role, content: m.content });
    }
  } catch (err: unknown) {
    console.warn('[AI Chat] Context retrieval notice:', err);
  }

  aiMessages.push({ role: 'user', content: prompt });

  // 6. Execute Cloudflare Workers AI Model
  let assistantText = '';
  try {
    const aiResponse: any = await env.AI.run(WORKERS_AI_MODEL, {
      messages: aiMessages,
      max_tokens: 1024,
    });

    if (aiResponse && typeof aiResponse === 'object') {
      assistantText = typeof aiResponse.response === 'string'
        ? aiResponse.response.trim()
        : JSON.stringify(aiResponse);
    } else if (typeof aiResponse === 'string') {
      assistantText = aiResponse.trim();
    }

    if (!assistantText) {
      assistantText = 'I received your message, but no response was generated by the model.';
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Workers AI execution error';
    return errorResponse(
      'AI_GENERATION_FAILED',
      `Failed to generate response from Workers AI model: ${message}`,
      502
    );
  }

  // 7. Persist Assistant Response to D1
  const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const assistantNow = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
       VALUES (?, ?, ?, 'assistant', ?, ?)`
    )
      .bind(assistantMsgId, conversationId, user.id, assistantText, assistantNow)
      .run();

    // Update conversation updated_at
    await env.DB.prepare(
      `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
    )
      .bind(assistantNow, conversationId, user.id)
      .run();
  } catch (err: unknown) {
    console.warn('[AI Chat] Assistant response persistence notice:', err);
  }

  // 8. Return Clean JSON Response
  return jsonResponse(
    {
      response: assistantText,
      conversationId,
      messageId: assistantMsgId,
      model: WORKERS_AI_MODEL,
    },
    200
  );
}
