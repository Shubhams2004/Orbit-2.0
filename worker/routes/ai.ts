import { Env, AuthenticatedUser } from '../types';
import { jsonResponse, errorResponse, CORS_HEADERS } from '../utils/response';
import { SearchManager } from '../services/search/manager';
import { TavilySearchProvider } from '../services/search/tavily';
import { DuckDuckGoSearchProvider } from '../services/search/duckduckgo';
import { SearchEvidenceSource } from '../services/search/types';
import { ModelProviderRegistry } from '../services/ai/registry';
import { ModelMessage, ModelProviderError } from '../services/ai/types';
import { DEFAULT_CLOUDFLARE_MODEL } from '../services/ai/providers/cloudflare';
import { ensureConversationsSchema } from './conversations';
import {
  getUserCredentials,
  saveUserCredential,
  deleteUserCredential,
  listUserProviders,
  SUPPORTED_BYOK_PROVIDERS,
} from '../services/ai/credentials';
import {
  getUnifiedModelCatalog,
  DEPRECATED_MODEL_MAP,
  resolveActiveModelSelection,
} from '../services/ai/catalog';

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
  const requestStartMs = Date.now();

  // 1. Guard: Check AI Capability (Cloudflare Workers AI default or active external BYOK / env providers)
  const userCredentials = await getUserCredentials(env.DB, user.id, env);
  const modelRegistry = ModelProviderRegistry.forUser(env, userCredentials);
  const activeProviders = modelRegistry.listProviders().filter((p) => p.isConfigured);
  if (activeProviders.length === 0) {
    return errorResponse(
      'AI_UNAVAILABLE',
      'No AI model providers are configured or available. Please configure Cloudflare Workers AI or connect a BYOK provider.',
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

  const wantStream = body.stream === true;
  const isRetry = body.retry === true;

  let conversationId: string | null =
    typeof body.conversationId === 'string' && body.conversationId.trim()
      ? body.conversationId.trim()
      : null;

  await ensureConversationsSchema(env.DB);

  let requestedModel =
    typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : typeof body.modelId === 'string' && body.modelId.trim()
      ? body.modelId.trim()
      : undefined;

  // If client did not explicitly pass a model, attempt to recover from existing conversation or user preference
  if (!requestedModel && conversationId) {
    try {
      const convRow = await env.DB.prepare(
        'SELECT model_id FROM conversations WHERE id = ? AND user_id = ?'
      )
        .bind(conversationId, user.id)
        .first<{ model_id?: string }>();
      if (convRow?.model_id) {
        requestedModel = convRow.model_id;
      }
    } catch {}
  }

  // If still not determined, check user's saved default model preference
  if (!requestedModel) {
    try {
      const userRow = await env.DB.prepare(
        'SELECT default_chat_model FROM users WHERE id = ?'
      )
        .bind(user.id)
        .first<{ default_chat_model?: string }>();
      if (userRow?.default_chat_model) {
        requestedModel = userRow.default_chat_model;
      }
    } catch {}
  }

  // Lifecycle check: detect deprecated/restricted models and migrate safely to active replacement
  const modelResolution = resolveActiveModelSelection(requestedModel || WORKERS_AI_MODEL);
  const targetModelId = modelResolution.modelId;
  const deprecationNotice = modelResolution.notice;

  if (modelResolution.migratedFrom) {
    const migrateNow = new Date().toISOString();
    // Repair stored references in D1 if the migrated model came from saved user or conversation state
    if (conversationId) {
      env.DB.prepare(
        'UPDATE conversations SET model_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND model_id = ?'
      )
        .bind(targetModelId, migrateNow, conversationId, user.id, modelResolution.migratedFrom)
        .run()
        .catch(() => {});
    }
    env.DB.prepare(
      'UPDATE users SET default_chat_model = ?, updated_at = ? WHERE id = ? AND default_chat_model = ?'
    )
      .bind(targetModelId, migrateNow, user.id, modelResolution.migratedFrom)
      .run()
      .catch(() => {});
  }

  const resolvedPrimaryProvider = modelRegistry.resolveProvider(targetModelId);

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
        'SELECT id, title, model_id FROM conversations WHERE id = ? AND user_id = ?'
      )
        .bind(conversationId, user.id)
        .first<{ id: string; title: string; model_id?: string }>();

      if (!existingConv) {
        return errorResponse(
          'NOT_FOUND',
          `Conversation with id "${conversationId}" not found or does not belong to you.`,
          404
        );
      }

      // Update model_id on existing conversation if explicitly requested
      if (body.model || body.modelId) {
        await env.DB.prepare(
          'UPDATE conversations SET model_id = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        )
          .bind(targetModelId, now, conversationId, user.id)
          .run();
      }
    } else {
      // Automatically generate conversation when not provided
      const newTitle = prompt.length > 50 ? `${prompt.slice(0, 47)}...` : prompt;
      conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      await env.DB.prepare(
        `INSERT INTO conversations (id, user_id, title, model_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(conversationId, user.id, newTitle, targetModelId, now, now)
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

  // 4. Persist User Message to D1 (or reuse existing on retry to avoid duplicate user messages)
  let userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let reusedExistingUserMsg = false;

  if (isRetry && conversationId) {
    try {
      const latestMsg = await env.DB.prepare(
        `SELECT id, role, content FROM messages
         WHERE conversation_id = ? AND user_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`
      )
        .bind(conversationId, user.id)
        .first<{ id: string; role: string; content: string }>();

      if (latestMsg && latestMsg.role === 'user' && latestMsg.content.trim() === prompt) {
        userMsgId = latestMsg.id;
        reusedExistingUserMsg = true;
      }
    } catch {}
  }

  if (!reusedExistingUserMsg) {
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

  const isExplicitByokModel =
    targetModelId !== WORKERS_AI_MODEL && targetModelId !== 'orbit-agent-v2';
  const isGeminiTarget =
    resolvedPrimaryProvider.id === 'gemini' ||
    targetModelId.toLowerCase().includes('gemini');

  // Fallback determination:
  // 1. NEVER silently route Gemini requests to Llama (even if deprecated model migrated).
  // 2. If body.allowFallback is boolean for non-Gemini models, respect client preference.
  // 3. Otherwise default to false for BYOK models and true for Orbit Core default.
  const allowFallback = isGeminiTarget
    ? false
    : typeof body.allowFallback === 'boolean'
    ? body.allowFallback
    : deprecationNotice
    ? true
    : !isExplicitByokModel;

  const webSearchPayload = {
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
  };

  console.info('[AI Chat] Dispatching request', {
    provider: resolvedPrimaryProvider.id,
    model: targetModelId,
    stream: wantStream,
    retry: isRetry,
    allowFallback,
    historyTurns: aiMessages.length - 1,
  });

  // 8A. Real SSE Streaming Execution (prevents Cloudflare 524 TTFB timeouts)
  if (wantStream) {
    const encoder = new TextEncoder();
    const sseEncode = (event: Record<string, unknown>): Uint8Array =>
      encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

    let upstreamReader: ReadableStreamDefaultReader<any> | null = null;

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = '';
        let executedModel = targetModelId;
        let executedProvider = resolvedPrimaryProvider.id;
        let fallbackUsed = false;
        let finalUsage: Record<string, number | undefined> | undefined;

        try {
          // Immediately flush metadata event so client & edge proxy receive first bytes right away
          controller.enqueue(
            sseEncode({
              type: 'meta',
              conversationId,
              userMessageId: userMsgId,
              model: targetModelId,
              provider: resolvedPrimaryProvider.id,
              deprecationNotice,
              webSearch: webSearchPayload,
            })
          );

          const streamResult = await modelRegistry.executeStream({
            messages: aiMessages as ModelMessage[],
            maxTokens: 2048,
            modelId: targetModelId,
            allowFallback,
            signal: request.signal,
          });

          executedModel = streamResult.modelId;
          executedProvider = streamResult.provider;
          fallbackUsed = streamResult.fallbackUsed;

          upstreamReader = streamResult.stream.getReader();

          while (true) {
            const { done, value } = await upstreamReader.read();
            if (done) break;

            if (value.type === 'delta' && value.text) {
              assistantText += value.text;
              controller.enqueue(
                sseEncode({
                  type: 'delta',
                  text: value.text,
                })
              );
            } else if (value.type === 'done') {
              if (value.usage) {
                finalUsage = value.usage;
              }
            }
          }

          const finalOutput = assistantText.trim();
          if (!finalOutput) {
            throw new ModelProviderError(
              'The AI provider completed without returning any text.',
              {
                code: 'EMPTY_OUTPUT',
                provider: executedProvider,
                statusCode: 502,
                isRetryable: true,
              }
            );
          }

          const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const assistantNow = new Date().toISOString();

          try {
            await env.DB.prepare(
              `INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
               VALUES (?, ?, ?, 'assistant', ?, ?)`
            )
              .bind(assistantMsgId, conversationId, user.id, finalOutput, assistantNow)
              .run();

            await env.DB.prepare(
              `UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?`
            )
              .bind(assistantNow, conversationId, user.id)
              .run();
          } catch (persistErr) {
            console.error('[AI Chat Stream] Failed to persist assistant response:', persistErr);
            controller.enqueue(
              sseEncode({
                type: 'error',
                code: 'PERSISTENCE_FAILED',
                message: 'The AI response was generated successfully, but could not be saved to your conversation history.',
                status: 500,
                retryable: false,
                provider: executedProvider,
                model: executedModel,
                conversationId,
                partialText: finalOutput,
              })
            );
            controller.close();
            return;
          }

          console.info('[AI Chat Stream] Completed successfully', {
            provider: executedProvider,
            model: executedModel,
            fallbackUsed,
            outputChars: finalOutput.length,
            elapsedMs: Date.now() - requestStartMs,
          });

          controller.enqueue(
            sseEncode({
              type: 'done',
              messageId: assistantMsgId,
              conversationId,
              model: executedModel,
              provider: executedProvider,
              fallbackUsed,
              deprecationNotice,
              usage: finalUsage,
              webSearch: webSearchPayload,
            })
          );
          controller.close();
        } catch (err: unknown) {
          const elapsedMs = Date.now() - requestStartMs;

          if (err instanceof ModelProviderError) {
            console.error('[AI Chat Stream] Provider error', {
              provider: err.provider,
              model: targetModelId,
              code: err.code,
              statusCode: err.statusCode,
              upstreamStatus: err.upstreamStatus,
              retryable: err.isRetryable,
              partialChars: assistantText.length,
              elapsedMs,
            });

            controller.enqueue(
              sseEncode({
                type: 'error',
                code: err.code,
                message: err.message,
                status: err.statusCode,
                retryable: err.isRetryable,
                upstreamStatus: err.upstreamStatus,
                provider: err.provider,
                model: targetModelId,
                conversationId,
                partialText: assistantText.trim() || undefined,
              })
            );
          } else {
            const safeMsg = err instanceof Error ? err.message : 'Model streaming error';
            console.error('[AI Chat Stream] Unexpected stream failure', {
              provider: executedProvider,
              model: targetModelId,
              partialChars: assistantText.length,
              elapsedMs,
            });

            controller.enqueue(
              sseEncode({
                type: 'error',
                code: 'STREAM_INTERRUPTED',
                message: `Failed to complete response stream: ${safeMsg}`,
                status: 502,
                retryable: true,
                provider: executedProvider,
                model: targetModelId,
                conversationId,
                partialText: assistantText.trim() || undefined,
              })
            );
          }

          controller.close();
        }
      },
      async cancel() {
        if (upstreamReader) {
          await upstreamReader.cancel().catch(() => {});
        }
      },
    });

    return new Response(sseStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...CORS_HEADERS,
      },
    });
  }

  // 8B. Standard JSON Execution (Backwards-compatible for non-streaming clients)
  let assistantText = '';
  let executedModel = WORKERS_AI_MODEL;
  let executedProvider = resolvedPrimaryProvider.id;
  let fallbackUsed = false;

  try {
    const execResult = await modelRegistry.execute({
      messages: aiMessages as ModelMessage[],
      maxTokens: 2048,
      modelId: targetModelId,
      allowFallback,
      signal: request.signal,
    });

    assistantText = execResult.text;
    executedModel = execResult.modelId;
    executedProvider = execResult.provider;
    fallbackUsed = Boolean(execResult.fallbackUsed);
  } catch (err: unknown) {
    const elapsedMs = Date.now() - requestStartMs;

    if (err instanceof ModelProviderError) {
      console.error('[AI Chat] Provider error', {
        provider: err.provider,
        model: targetModelId,
        code: err.code,
        statusCode: err.statusCode,
        upstreamStatus: err.upstreamStatus,
        retryable: err.isRetryable,
        elapsedMs,
      });

      return errorResponse(err.code, err.message, err.statusCode, {
        provider: err.provider,
        model: targetModelId,
        retryable: err.isRetryable,
        upstreamStatus: err.upstreamStatus,
        conversationId,
      });
    }
    const message = err instanceof Error ? err.message : 'Model execution error';
    console.error('[AI Chat] Unexpected execution failure', {
      provider: executedProvider,
      model: targetModelId,
      elapsedMs,
    });
    return errorResponse(
      'AI_GENERATION_FAILED',
      `Failed to generate response from model: ${message}`,
      502,
      {
        provider: executedProvider,
        model: targetModelId,
        retryable: true,
        conversationId,
      }
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

  console.info('[AI Chat] Completed successfully', {
    provider: executedProvider,
    model: executedModel,
    fallbackUsed,
    outputChars: assistantText.length,
    elapsedMs: Date.now() - requestStartMs,
  });

  // 10. Return Structured JSON Response with Web Intelligence & Model Metadata
  return jsonResponse(
    {
      response: assistantText,
      conversationId,
      messageId: assistantMsgId,
      model: executedModel,
      provider: executedProvider,
      fallbackUsed,
      deprecationNotice,
      webSearch: webSearchPayload,
    },
    200
  );
}

export async function handleGetAiModels(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  const userCredentials = await getUserCredentials(env.DB, user.id, env);
  const modelRegistry = ModelProviderRegistry.forUser(env, userCredentials);

  const url = new URL(request.url);
  const shouldDiscover = url.searchParams.get('discover') === 'true';

  const catalogResult = await getUnifiedModelCatalog(env, userCredentials, {
    performLiveDiscovery: shouldDiscover,
  });

  return jsonResponse(
    {
      providers: modelRegistry.listProviders(),
      defaultModel: DEFAULT_CLOUDFLARE_MODEL,
      catalogUpdatedAt: catalogResult.catalogUpdatedAt,
      discoveryStatus: catalogResult.discoveryStatus,
      models: catalogResult.models,
      deprecated: DEPRECATED_MODEL_MAP,
    },
    200
  );
}

/**
 * POST /api/v1/ai/models/discover
 * Explicitly triggers real-time discovery of available models across user's connected BYOK providers.
 */
export async function handleDiscoverAiModels(
  _request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  const userCredentials = await getUserCredentials(env.DB, user.id, env);
  const modelRegistry = ModelProviderRegistry.forUser(env, userCredentials);

  const catalogResult = await getUnifiedModelCatalog(env, userCredentials, {
    performLiveDiscovery: true,
  });

  return jsonResponse(
    {
      success: true,
      providers: modelRegistry.listProviders(),
      defaultModel: DEFAULT_CLOUDFLARE_MODEL,
      catalogUpdatedAt: catalogResult.catalogUpdatedAt,
      discoveryStatus: catalogResult.discoveryStatus,
      models: catalogResult.models,
    },
    200
  );
}

/**
 * GET /api/v1/ai/providers
 * Returns list of AI providers, BYOK configuration status, and masked key hints for the authenticated user.
 */
export async function handleGetAiProviders(
  _request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  const providers = await listUserProviders(env.DB, user.id, env);
  return jsonResponse({ providers }, 200);
}

/**
 * POST /api/v1/ai/providers/connect
 * Connects or updates a BYOK credential for the authenticated user.
 * Keys are encrypted at rest with AES-GCM and never returned in responses or logs.
 */
export async function handleConnectAiProvider(
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

  if (!body || typeof body !== 'object') {
    return errorResponse('VALIDATION_ERROR', 'Request body must be a JSON object.', 400);
  }

  const { provider, apiKey, preferredModel } = body;

  if (!provider || typeof provider !== 'string') {
    return errorResponse('VALIDATION_ERROR', 'Field "provider" is required.', 400);
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return errorResponse('VALIDATION_ERROR', 'Field "apiKey" is required and cannot be empty.', 400);
  }

  // Ensure user record exists in users table if table is present
  try {
    const now = new Date().toISOString();
    const userDisplayName = user.displayName?.trim() || 'Orbit User';
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(user.id, userDisplayName, user.email || null, now, now)
      .run();
  } catch {
    // Non-fatal if users table is not ready
  }

  try {
    const result = await saveUserCredential(
      env.DB,
      user.id,
      provider,
      apiKey,
      typeof preferredModel === 'string' ? preferredModel : undefined,
      env
    );

    return jsonResponse(
      {
        success: true,
        provider: result.provider,
        keyHint: result.keyHint,
        preferredModel: result.preferredModel,
        message: `Successfully connected ${result.provider} with encrypted BYOK storage.`,
      },
      200
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save provider credential.';
    return errorResponse('CREDENTIAL_SAVE_FAILED', message, 400);
  }
}

/**
 * DELETE /api/v1/ai/providers/:provider
 * Disconnects and removes a user's BYOK credential from encrypted storage.
 */
export async function handleDisconnectAiProvider(
  _request: Request,
  env: Env,
  user: AuthenticatedUser,
  provider: string
): Promise<Response> {
  if (!provider || !provider.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Provider parameter is required.', 400);
  }

  try {
    const deleted = await deleteUserCredential(env.DB, user.id, provider);
    return jsonResponse(
      {
        success: true,
        provider,
        disconnected: deleted,
        message: deleted
          ? `Disconnected ${provider} credentials.`
          : `No stored credentials found for ${provider}.`,
      },
      200
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete provider credential.';
    return errorResponse('CREDENTIAL_DELETE_FAILED', message, 500);
  }
}

/**
 * GET /api/v1/ai/preferences
 * Returns the authenticated user's active AI model and provider preferences.
 */
export async function handleGetAiPreferences(
  _request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  let defaultModel = WORKERS_AI_MODEL;
  let migratedFrom: string | undefined;
  let migrationNotice: string | undefined;

  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN default_chat_model TEXT').run();
  } catch {}

  try {
    const userRow = await env.DB.prepare(
      'SELECT default_chat_model FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first<{ default_chat_model?: string }>();
    if (userRow?.default_chat_model) {
      const resolved = resolveActiveModelSelection(userRow.default_chat_model);
      defaultModel = resolved.modelId;
      if (resolved.migratedFrom) {
        migratedFrom = resolved.migratedFrom;
        migrationNotice = resolved.notice;
        await env.DB.prepare(
          'UPDATE users SET default_chat_model = ?, updated_at = ? WHERE id = ?'
        )
          .bind(defaultModel, new Date().toISOString(), user.id)
          .run()
          .catch(() => {});
      }
    }
  } catch {}

  const providerPreferences: Record<string, string> = {};
  try {
    const credRows = await env.DB.prepare(
      'SELECT provider, preferred_model FROM user_ai_credentials WHERE user_id = ?'
    )
      .bind(user.id)
      .all<{ provider: string; preferred_model: string | null }>();

    for (const c of credRows.results || []) {
      if (c.preferred_model) {
        const resolved = resolveActiveModelSelection(c.preferred_model);
        providerPreferences[c.provider] = resolved.modelId;
        if (resolved.migratedFrom) {
          await env.DB.prepare(
            'UPDATE user_ai_credentials SET preferred_model = ?, updated_at = ? WHERE user_id = ? AND provider = ?'
          )
            .bind(resolved.modelId, new Date().toISOString(), user.id, c.provider)
            .run()
            .catch(() => {});
        }
      }
    }
  } catch {}

  return jsonResponse({ defaultModel, providerPreferences, migratedFrom, migrationNotice }, 200);
}

/**
 * PUT or POST /api/v1/ai/preferences
 * Updates the authenticated user's active AI model preference.
 */
export async function handleUpdateAiPreferences(
  request: Request,
  env: Env,
  user: AuthenticatedUser
): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Malformed JSON in request body.', 400);
  }

  const rawDefaultModel =
    typeof body.defaultModel === 'string' && body.defaultModel.trim()
      ? body.defaultModel.trim()
      : typeof body.modelId === 'string' && body.modelId.trim()
      ? body.modelId.trim()
      : undefined;

  if (!rawDefaultModel) {
    return errorResponse('VALIDATION_ERROR', 'Field "defaultModel" is required.', 400);
  }

  const resolved = resolveActiveModelSelection(rawDefaultModel);
  const defaultModel = resolved.modelId;

  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN default_chat_model TEXT').run();
  } catch {}

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, display_name, email, default_chat_model, created_at, updated_at)
       VALUES (?, 'Orbit User', null, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         default_chat_model = excluded.default_chat_model,
         updated_at = excluded.updated_at`
    )
      .bind(user.id, defaultModel, now, now)
      .run();
  } catch (err: unknown) {
    console.error('[AI Preferences] Failed to update user preference:', err);
  }

  return jsonResponse(
    {
      success: true,
      defaultModel,
      migratedFrom: resolved.migratedFrom,
      migrationNotice: resolved.notice,
    },
    200
  );
}



