import { Env, AuthenticatedUser } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { SearchManager } from '../services/search/manager';
import { TavilySearchProvider } from '../services/search/tavily';
import { DuckDuckGoSearchProvider } from '../services/search/duckduckgo';
import { SearchEvidenceSource } from '../services/search/types';
import { ModelProviderRegistry } from '../services/ai/registry';
import { ModelMessage, ModelProviderError } from '../services/ai/types';
import { DEFAULT_CLOUDFLARE_MODEL } from '../services/ai/providers/cloudflare';

const WORKERS_AI_MODEL = DEFAULT_CLOUDFLARE_MODEL;
const BASE_SYSTEM_PROMPT =
  'You are Orbit, an intelligent personal workspace co-pilot. Provide clear, accurate, and concise assistance for task management, project planning, and technical productivity. Keep responses well-structured and helpful.';

// Module-level SearchManager instance for in-memory caching across requests
let cachedSearchManager: SearchManager | null = null;
let lastApiKeyUsed: string | undefined = undefined;

function getSearchManager(env: Env): SearchManager {
  const currentKey = env.TAVILY_API_KEY?.trim();
  if (cachedSearchManager && lastApiKeyUsed === currentKey) {
    return cachedSearchManager;
  }

  let provider: any = null;
  if (currentKey) {
    provider = new TavilySearchProvider({
      apiKey: currentKey,
      baseUrl: env.TAVILY_BASE_URL,
      maxResults: 5,
    });
  } else {
    // Resilient live web search provider retrieving real-time internet data without requiring API keys
    provider = new DuckDuckGoSearchProvider({
      maxResults: 5,
    });
  }

  cachedSearchManager = new SearchManager(provider);
  lastApiKeyUsed = currentKey;
  return cachedSearchManager;
}

interface MessageHistoryRow {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function handleAiChat(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  // 1. Guard: Check AI Capability (Cloudflare Workers AI default or active external providers)
  const modelRegistry = ModelProviderRegistry.fromEnv(env);
  const activeProviders = modelRegistry.listProviders().filter((p) => p.isConfigured);
  if (activeProviders.length === 0) {
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

  const requestedModel =
    typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : typeof body.modelId === 'string' && body.modelId.trim()
      ? body.modelId.trim()
      : undefined;

  // Explicit web search mode requested by client ('auto' | boolean)
  const webSearchMode = body.webSearch === true ? true : body.webSearch === false ? false : undefined;

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
    console.error('[AI Chat] Failed to synchronize user profile record:', err);
    return errorResponse(
      'USER_SYNC_FAILED',
      'Unable to establish user profile record required for conversation storage.',
      500
    );
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
    console.error('[AI Chat] Conversation access or creation failed:', err);
    return errorResponse(
      'DATABASE_ERROR',
      'Failed to access or create conversation in database.',
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
    console.error('[AI Chat] Failed to persist user message in database:', err);
    return errorResponse(
      'DATABASE_ERROR',
      'Failed to persist user message in database.',
      500
    );
  }

  // 5. Orbit Web Intelligence: Intelligent Detection & Source Retrieval
  const searchManager = getSearchManager(env);
  const requiresSearch = searchManager.shouldSearch(prompt, webSearchMode);

  let searchSources: SearchEvidenceSource[] = [];
  let searchRetrievedAt: string | null = null;
  let searchCached = false;
  let searchNotice: string | null = null;

  if (requiresSearch) {
    if (!searchManager.isConfigured()) {
      // If client explicitly requested web search or search was detected, notify gracefully without breaking inference
      searchNotice = 'Web search provider (Tavily) is not configured in Worker environment.';
    } else {
      try {
        const searchResult = await searchManager.search(prompt, { maxResults: 5 });
        searchSources = searchResult.sources;
        searchRetrievedAt = searchResult.retrievedAt;
        searchCached = Boolean(searchResult.cached);
      } catch (searchErr: unknown) {
        console.error('[Orbit Web Intelligence] Search retrieval failure:', searchErr);
        searchNotice =
          searchErr instanceof Error
            ? searchErr.message
            : 'Web search encountered an unexpected retrieval error.';
      }
    }
  }

  // 6. Build Contextual System Prompt Grounded with Retrieved Evidence
  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (searchSources.length > 0) {
    const evidenceText = searchSources
      .map(
        (s, idx) =>
          `[Source ${idx + 1}]: "${s.title}" (${s.url})\nDate: ${s.publishedDate || 'Recent'}\nContent: ${s.content}`
      )
      .join('\n\n');

    systemPrompt += `\n\n--- REAL-TIME WEB EVIDENCE (Retrieved: ${searchRetrievedAt || now}) ---\n${evidenceText}\n\nGround your response strictly on the evidence above. Reference facts clearly and cite claims using markdown links or numbered citations matching the source URLs. If the evidence does not contain sufficient details to answer, state this clearly without fabricating facts.`;
  } else if (requiresSearch && searchNotice) {
    systemPrompt += `\n\nNote: A live internet search was attempted or requested, but could not be completed (${searchNotice}). Answer to the best of your foundational knowledge, and clearly disclose to the user that live internet data was unavailable.`;
  }

  // 7. Retrieve Recent Conversation Context (Most recent 8 messages before this prompt)
  const aiMessages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  try {
    const priorHistory = await env.DB.prepare(
      `SELECT role, content FROM messages
       WHERE conversation_id = ? AND user_id = ? AND id != ?
       ORDER BY created_at DESC, id DESC LIMIT 8`
    )
      .bind(conversationId, user.id, userMsgId)
      .all<MessageHistoryRow>();

    // Reverse to chronological order (oldest to newest among the 8 most recent)
    const historyRows = (priorHistory.results || []).slice().reverse();
    for (const m of historyRows) {
      // Sanitize role to ensure client cannot inject rogue system prompts
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      aiMessages.push({ role, content: m.content });
    }
  } catch (err: unknown) {
    console.error('[AI Chat] Context retrieval error:', err);
  }

  aiMessages.push({ role: 'user', content: prompt });

  // 8. Execute Model via Modular Provider Registry
  let assistantText = '';
  let executedModel = WORKERS_AI_MODEL;
  let executedProvider = 'cloudflare';
  let fallbackUsed = false;

  try {
    const execResult = await modelRegistry.execute({
      messages: aiMessages as ModelMessage[],
      maxTokens: 1024,
      modelId: requestedModel,
      allowFallback: body.allowFallback !== false,
    });

    assistantText = execResult.text;
    executedModel = execResult.modelId;
    executedProvider = execResult.provider;
    fallbackUsed = Boolean(execResult.fallbackUsed);
  } catch (err: unknown) {
    if (err instanceof ModelProviderError) {
      return errorResponse(err.code, err.message, err.statusCode, {
        provider: err.provider,
      });
    }
    const message = err instanceof Error ? err.message : 'Model execution error';
    return errorResponse(
      'AI_GENERATION_FAILED',
      `Failed to generate response from model: ${message}`,
      502
    );
  }

  // 9. Persist Assistant Response to D1
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
    console.error('[AI Chat] Failed to persist assistant response to database:', err);
    return errorResponse(
      'PERSISTENCE_FAILED',
      'The AI response was generated successfully, but could not be saved to your conversation history.',
      500,
      {
        conversationId,
        response: assistantText,
        messageId: assistantMsgId,
      }
    );
  }

  // 10. Return Structured JSON Response with Web Intelligence & Model Metadata
  return jsonResponse(
    {
      response: assistantText,
      conversationId,
      messageId: assistantMsgId,
      model: executedModel,
      provider: executedProvider,
      fallbackUsed,
      webSearch: {
        triggered: requiresSearch,
        sourcesCount: searchSources.length,
        sources: searchSources.map((s) => ({
          title: s.title,
          url: s.url,
          publishedDate: s.publishedDate,
        })),
        retrievedAt: searchRetrievedAt,
        cached: searchCached,
        notice: searchNotice,
      },
    },
    200
  );
}

export async function handleGetAiModels(
  _request: Request,
  env: Env,
  _user: AuthenticatedUser
): Promise<Response> {
  const modelRegistry = ModelProviderRegistry.fromEnv(env);
  return jsonResponse(
    {
      providers: modelRegistry.listProviders(),
      defaultModel: DEFAULT_CLOUDFLARE_MODEL,
      models: [
        {
          id: 'orbit-agent-v2',
          name: 'Llama 3.1 8B Instruct Fast',
          provider: 'cloudflare',
          isDefault: true,
          isConfigured: Boolean(env.AI),
        },
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'openai',
          isDefault: false,
          isConfigured: Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0),
        },
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          provider: 'gemini',
          isDefault: false,
          isConfigured: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0),
        },
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet',
          provider: 'anthropic',
          isDefault: false,
          isConfigured: Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length > 0),
        },
      ],
    },
    200
  );
}

