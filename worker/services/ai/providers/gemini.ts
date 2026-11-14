import {
  IModelProvider,
  ModelExecutionOptions,
  ModelExecutionResult,
  ModelProviderError,
  ModelStreamChunk,
} from '../types';

export interface GeminiProviderConfig {
  maxRetries?: number;
  retryBaseDelayMs?: number;
  defaultTimeoutMs?: number;
}

interface GeminiPreparedRequest {
  targetModel: string;
  payload: Record<string, any>;
}

const DEFAULT_TIMEOUT_MS = 55_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 600;
const MAX_RETRY_DELAY_MS = 5_000;

function sanitizeSecretText(text: string): string {
  return text
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]');
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | undefined {
  if (!retryAfterHeader) return undefined;
  const trimmed = retryAfterHeader.trim();
  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.min(Math.max(Math.round(seconds * 1000), 200), MAX_RETRY_DELAY_MS);
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    if (diff > 0) {
      return Math.min(Math.max(diff, 200), MAX_RETRY_DELAY_MS);
    }
  }
  return undefined;
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function createAttemptController(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number
): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    },
  };
}

export class GeminiModelProvider implements IModelProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  private apiKey?: string;
  private baseUrl: string;
  private maxRetries: number;
  private retryBaseDelayMs: number;
  private defaultTimeoutMs: number;

  constructor(
    apiKey?: string,
    baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta',
    config: GeminiProviderConfig = {}
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('gemini-') || modelId.includes('gemini');
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ModelProviderError(
        'Gemini API key is not configured. Please connect your Google Gemini API key via the chat provider selector.',
        {
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: this.id,
          statusCode: 503,
          isRetryable: false,
        }
      );
    }
  }

  private prepareRequest(options: ModelExecutionOptions): GeminiPreparedRequest {
    const targetModel = (options.modelId || 'gemini-3-flash-preview').replace(/^models\//, '');

    // 1. Separate system instructions from conversational history
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const conversationMessages = options.messages.filter((m) => m.role !== 'system');

    const systemText = systemMessages
      .map((m) => m.content.trim())
      .filter(Boolean)
      .join('\n\n');

    const systemInstruction =
      systemText.length > 0
        ? {
            parts: [{ text: systemText }],
          }
        : undefined;

    // 2. Format conversation turns strictly alternating between 'user' and 'model'
    // Gemini API rejects consecutive turns of the same role or empty text parts.
    interface GeminiContent {
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }

    const contents: GeminiContent[] = [];

    for (const msg of conversationMessages) {
      const text = (msg.content || '').trim();
      if (!text) continue; // Skip empty parts

      const geminiRole: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
      const last = contents[contents.length - 1];

      if (last && last.role === geminiRole) {
        // Merge into existing turn to prevent consecutive same-role turns
        last.parts.push({ text });
      } else {
        contents.push({
          role: geminiRole,
          parts: [{ text }],
        });
      }
    }

    // Official Gemini rule: The first turn MUST have role 'user'
    if (contents.length > 0 && contents[0].role !== 'user') {
      contents.unshift({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }],
      });
    }

    // 3. Build generationConfig (Gemini 3/3.1/4 thinking models share maxOutputTokens with thinking tokens)
    const isThinkingOrNextGen =
      targetModel.includes('gemini-3') ||
      targetModel.includes('gemini-4') ||
      targetModel.includes('thinking') ||
      targetModel.includes('pro');

    const requestedMaxTokens = options.maxTokens || 2048;
    const generationConfig: Record<string, any> = {
      maxOutputTokens: isThinkingOrNextGen ? Math.max(requestedMaxTokens, 8192) : requestedMaxTokens,
    };

    // Google Gemini guidelines: omit custom temperature for Gemini 3/4/thinking models
    if (!isThinkingOrNextGen && options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }

    const payload: Record<string, any> = {
      contents,
      generationConfig,
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    return { targetModel, payload };
  }

  private mapHttpError(
    status: number,
    rawBody: string,
    targetModel: string,
    retryAfterHeader: string | null
  ): ModelProviderError {
    let jsonErrorMessage: string | undefined;
    let jsonErrorStatus: string | undefined;

    try {
      const errJson = JSON.parse(rawBody);
      if (typeof errJson?.error?.message === 'string' && errJson.error.message.trim()) {
        jsonErrorMessage = sanitizeSecretText(errJson.error.message.trim());
      }
      if (typeof errJson?.error?.status === 'string') {
        jsonErrorStatus = errJson.error.status;
      }
    } catch {
      // Upstream returned non-JSON (e.g., Cloudflare HTML 524/502 error page)
    }

    const lowerMsg = (jsonErrorMessage || '').toLowerCase();
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader);

    // HTTP 524 Cloudflare Gateway Timeout
    if (status === 524) {
      return new ModelProviderError(
        `Google Gemini timed out before responding (HTTP 524). The model "${targetModel}" took too long to generate a response. Please retry or switch to a faster model.`,
        {
          code: 'GATEWAY_TIMEOUT',
          provider: this.id,
          statusCode: 504,
          upstreamStatus: 524,
          isRetryable: true,
          retryAfterMs,
        }
      );
    }

    // HTTP 504 Upstream Gateway Timeout
    if (status === 504) {
      return new ModelProviderError(
        `Google Gemini gateway timed out (HTTP 504). Please retry your request.`,
        {
          code: 'UPSTREAM_TIMEOUT',
          provider: this.id,
          statusCode: 504,
          upstreamStatus: 504,
          isRetryable: true,
          retryAfterMs,
        }
      );
    }

    // Authentication / Invalid API Key errors (never retry)
    if (
      status === 401 ||
      status === 403 ||
      (jsonErrorStatus === 'INVALID_ARGUMENT' &&
        (lowerMsg.includes('api key') || lowerMsg.includes('api_key'))) ||
      lowerMsg.includes('api_key_invalid') ||
      lowerMsg.includes('api key not valid') ||
      lowerMsg.includes('api key invalid') ||
      lowerMsg.includes('permission denied')
    ) {
      const detail = jsonErrorMessage || `Gemini authentication failed (HTTP ${status}).`;
      return new ModelProviderError(`Gemini provider error: ${detail}`, {
        code: 'AUTHENTICATION_FAILED',
        provider: this.id,
        statusCode: 401,
        upstreamStatus: status,
        isRetryable: false,
      });
    }

    // Model Not Found / Restricted / Unsupported Model (never retry)
    if (
      status === 404 ||
      lowerMsg.includes('no longer available to new users') ||
      lowerMsg.includes('not found for api version') ||
      lowerMsg.includes('not supported for generatecontent') ||
      lowerMsg.includes('is not found')
    ) {
      const detail =
        jsonErrorMessage ||
        `The selected Gemini model "${targetModel}" is unsupported or unavailable for your API key.`;
      return new ModelProviderError(`Gemini provider error: ${detail}`, {
        code: 'MODEL_NOT_FOUND',
        provider: this.id,
        statusCode: 404,
        upstreamStatus: status,
        isRetryable: false,
      });
    }

    // Rate Limit / Quota Exhausted (retryable with backoff)
    if (status === 429 || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('resource_exhausted')) {
      const detail =
        jsonErrorMessage ||
        'Google Gemini rate limit or quota exceeded (HTTP 429). Please wait a moment and retry.';
      return new ModelProviderError(`Gemini provider error: ${detail}`, {
        code: 'QUOTA_EXHAUSTED',
        provider: this.id,
        statusCode: 429,
        upstreamStatus: status,
        isRetryable: true,
        retryAfterMs,
      });
    }

    // Other 4xx Client/Validation errors (never retry)
    if (status >= 400 && status < 500) {
      const detail = jsonErrorMessage || `Gemini API rejected request (HTTP ${status}).`;
      return new ModelProviderError(`Gemini provider error: ${detail}`, {
        code: 'INVALID_REQUEST',
        provider: this.id,
        statusCode: status,
        upstreamStatus: status,
        isRetryable: false,
      });
    }

    // 500 / 502 / 503 Upstream Server Errors (retryable)
    const serverDetail =
      jsonErrorMessage || `Google Gemini upstream service returned HTTP ${status}.`;
    return new ModelProviderError(`Gemini provider error: ${serverDetail}`, {
      code: 'PROVIDER_UNAVAILABLE',
      provider: this.id,
      statusCode: 502,
      upstreamStatus: status,
      isRetryable: status >= 500,
      retryAfterMs,
    });
  }

  private mapThrownError(err: unknown, didTimeout: boolean, targetModel: string): ModelProviderError {
    if (err instanceof ModelProviderError) {
      return err;
    }

    if (didTimeout) {
      return new ModelProviderError(
        `Google Gemini request to "${targetModel}" timed out waiting for an upstream response. Please retry.`,
        {
          code: 'UPSTREAM_TIMEOUT',
          provider: this.id,
          statusCode: 504,
          isRetryable: true,
        }
      );
    }

    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      return new ModelProviderError('Gemini request was cancelled.', {
        code: 'REQUEST_ABORTED',
        provider: this.id,
        statusCode: 499,
        isRetryable: false,
      });
    }

    const safeMsg = sanitizeSecretText(err instanceof Error ? err.message : 'Network error');
    return new ModelProviderError(`Gemini network error: ${safeMsg}`, {
      code: 'NETWORK_ERROR',
      provider: this.id,
      statusCode: 502,
      isRetryable: true,
    });
  }

  private computeBackoffMs(attempt: number, err: ModelProviderError): number {
    if (err.retryAfterMs !== undefined) {
      return Math.min(err.retryAfterMs, MAX_RETRY_DELAY_MS);
    }
    const exp = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.round(Math.random() * Math.min(150, this.retryBaseDelayMs * 0.25));
    return Math.min(exp + jitter, MAX_RETRY_DELAY_MS);
  }

  private async fetchWithRetry(
    action: 'generateContent' | 'streamGenerateContent',
    targetModel: string,
    payload: Record<string, any>,
    options: ModelExecutionOptions
  ): Promise<Response> {
    const querySuffix = action === 'streamGenerateContent' ? '?alt=sse' : '';
    const endpointPath = `models/${encodeURIComponent(targetModel)}:${action}`;
    const url = `${this.baseUrl}/${endpointPath}${querySuffix}`;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const maxAttempts = this.maxRetries + 1;

    let lastError: ModelProviderError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (options.signal?.aborted) {
        throw new ModelProviderError('Gemini request was cancelled.', {
          code: 'REQUEST_ABORTED',
          provider: this.id,
          statusCode: 499,
          isRetryable: false,
        });
      }

      const attemptStart = Date.now();
      const attemptCtrl = createAttemptController(options.signal, timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey!,
          },
          body: JSON.stringify(payload),
          signal: attemptCtrl.signal,
        });

        const elapsedMs = Date.now() - attemptStart;

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const retryAfter = response.headers?.get?.('Retry-After') || null;
          const mappedError = this.mapHttpError(response.status, errText, targetModel, retryAfter);

          console.warn('[GeminiProvider] Upstream non-OK response', {
            model: targetModel,
            action,
            attempt,
            maxAttempts,
            upstreamStatus: response.status,
            errorCode: mappedError.code,
            isRetryable: mappedError.isRetryable,
            elapsedMs,
          });

          if (mappedError.isRetryable && attempt < maxAttempts) {
            lastError = mappedError;
            const delayMs = this.computeBackoffMs(attempt, mappedError);
            await sleepWithSignal(delayMs, options.signal);
            continue;
          }

          throw mappedError;
        }

        console.info('[GeminiProvider] Upstream connection established', {
          model: targetModel,
          action,
          attempt,
          status: response.status,
          elapsedMs,
        });

        return response;
      } catch (err: unknown) {
        const elapsedMs = Date.now() - attemptStart;
        const mappedError = this.mapThrownError(err, attemptCtrl.didTimeout(), targetModel);

        console.warn('[GeminiProvider] Attempt failed', {
          model: targetModel,
          action,
          attempt,
          maxAttempts,
          errorCode: mappedError.code,
          statusCode: mappedError.statusCode,
          isRetryable: mappedError.isRetryable,
          elapsedMs,
        });

        if (mappedError.isRetryable && attempt < maxAttempts && !options.signal?.aborted) {
          lastError = mappedError;
          const delayMs = this.computeBackoffMs(attempt, mappedError);
          try {
            await sleepWithSignal(delayMs, options.signal);
            continue;
          } catch (sleepErr) {
            throw this.mapThrownError(sleepErr, false, targetModel);
          }
        }

        throw mappedError;
      } finally {
        attemptCtrl.cleanup();
      }
    }

    throw (
      lastError ||
      new ModelProviderError('Gemini request failed after retries.', {
        code: 'PROVIDER_UNAVAILABLE',
        provider: this.id,
        statusCode: 502,
        isRetryable: false,
      })
    );
  }

  private extractTextFromCandidate(candidate: any): string {
    return (
      candidate?.content?.parts
        ?.filter((p: any) => !p?.thought)
        ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        ?.filter(Boolean)
        ?.join('') || ''
    );
  }

  async execute(options: ModelExecutionOptions): Promise<ModelExecutionResult> {
    this.assertConfigured();
    const { targetModel, payload } = this.prepareRequest(options);

    const response = await this.fetchWithRetry('generateContent', targetModel, payload, options);

    const data: any = await response.json();
    const candidate = data?.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      throw new ModelProviderError('Gemini response was blocked by safety filters.', {
        code: 'SAFETY_BLOCKED',
        provider: this.id,
        statusCode: 400,
        isRetryable: false,
      });
    }

    const textPart = this.extractTextFromCandidate(candidate);

    if (!textPart.trim()) {
      const reason = candidate?.finishReason || 'NO_TEXT_RETURNED';
      throw new ModelProviderError(
        `Gemini returned an empty response (finish reason: ${reason}).`,
        {
          code: 'EMPTY_OUTPUT',
          provider: this.id,
          statusCode: 502,
          isRetryable: true,
        }
      );
    }

    return {
      text: textPart.trim(),
      provider: this.id,
      modelId: targetModel,
      finishReason: candidate?.finishReason,
      usage: {
        promptTokens: data?.usageMetadata?.promptTokenCount,
        completionTokens: data?.usageMetadata?.candidatesTokenCount,
        totalTokens: data?.usageMetadata?.totalTokenCount,
      },
    };
  }

  async executeStream(options: ModelExecutionOptions): Promise<ReadableStream<ModelStreamChunk>> {
    this.assertConfigured();
    const { targetModel, payload } = this.prepareRequest(options);
    const providerId = this.id;

    const response = await this.fetchWithRetry('streamGenerateContent', targetModel, payload, options);
    const contentType = response.headers?.get?.('content-type') || '';

    // Handle JSON fallback if upstream or proxy returned non-SSE JSON on streamGenerateContent
    if (!response.body || contentType.includes('application/json')) {
      const data: any = await response.json();
      const chunks = Array.isArray(data) ? data : [data];
      let fullText = '';
      let finishReason: string | undefined;
      let usage:
        | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
        | undefined;

      for (const item of chunks) {
        const candidate = item?.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
          throw new ModelProviderError('Gemini response was blocked by safety filters.', {
            code: 'SAFETY_BLOCKED',
            provider: providerId,
            statusCode: 400,
          });
        }
        fullText += this.extractTextFromCandidate(candidate);
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        if (item?.usageMetadata) {
          usage = {
            promptTokens: item.usageMetadata.promptTokenCount,
            completionTokens: item.usageMetadata.candidatesTokenCount,
            totalTokens: item.usageMetadata.totalTokenCount,
          };
        }
      }

      if (!fullText.trim()) {
        throw new ModelProviderError(
          `Gemini returned an empty response (finish reason: ${finishReason || 'NO_TEXT_RETURNED'}).`,
          {
            code: 'EMPTY_OUTPUT',
            provider: providerId,
            statusCode: 502,
          }
        );
      }

      return new ReadableStream<ModelStreamChunk>({
        start(controller) {
          controller.enqueue({ type: 'delta', text: fullText.trim() });
          controller.enqueue({ type: 'done', finishReason, usage });
          controller.close();
        },
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const extractText = this.extractTextFromCandidate.bind(this);

    return new ReadableStream<ModelStreamChunk>({
      async start(controller) {
        let buffer = '';
        let emittedChars = 0;
        let lastFinishReason: string | undefined;
        let lastUsage:
          | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
          | undefined;

        const processPayload = (rawJson: string) => {
          const trimmed = rawJson.trim();
          if (!trimmed || trimmed === '[DONE]') return;

          let parsed: any;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            return;
          }

          if (parsed?.error) {
            const msg = sanitizeSecretText(parsed.error.message || 'Gemini stream error');
            throw new ModelProviderError(`Gemini provider error: ${msg}`, {
              code: 'PROVIDER_ERROR',
              provider: providerId,
              statusCode: parsed.error.code >= 400 ? parsed.error.code : 502,
              isRetryable: parsed.error.code >= 500 || parsed.error.code === 429,
            });
          }

          const candidate = parsed?.candidates?.[0];
          if (candidate?.finishReason === 'SAFETY') {
            throw new ModelProviderError('Gemini response was blocked by safety filters.', {
              code: 'SAFETY_BLOCKED',
              provider: providerId,
              statusCode: 400,
              isRetryable: false,
            });
          }

          const deltaText = extractText(candidate);
          if (deltaText) {
            emittedChars += deltaText.length;
            controller.enqueue({ type: 'delta', text: deltaText });
          }

          if (candidate?.finishReason) {
            lastFinishReason = candidate.finishReason;
          }

          if (parsed?.usageMetadata) {
            lastUsage = {
              promptTokens: parsed.usageMetadata.promptTokenCount,
              completionTokens: parsed.usageMetadata.candidatesTokenCount,
              totalTokens: parsed.usageMetadata.totalTokenCount,
            };
          }
        };

        try {
          while (true) {
            if (options.signal?.aborted) {
              await reader.cancel().catch(() => {});
              controller.error(
                new ModelProviderError('Gemini stream was cancelled.', {
                  code: 'REQUEST_ABORTED',
                  provider: providerId,
                  statusCode: 499,
                  isRetryable: false,
                })
              );
              return;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                processPayload(line.slice(5));
              }
            }
          }

          // Flush remaining decoded buffer
          const remaining = buffer + decoder.decode();
          if (remaining.trim()) {
            for (const line of remaining.split(/\r?\n/)) {
              if (line.startsWith('data:')) {
                processPayload(line.slice(5));
              }
            }
          }

          if (emittedChars === 0) {
            controller.error(
              new ModelProviderError(
                `Gemini returned an empty stream (finish reason: ${lastFinishReason || 'NO_TEXT_RETURNED'}).`,
                {
                  code: 'EMPTY_OUTPUT',
                  provider: providerId,
                  statusCode: 502,
                  isRetryable: true,
                }
              )
            );
            return;
          }

          controller.enqueue({
            type: 'done',
            finishReason: lastFinishReason,
            usage: lastUsage,
          });
          controller.close();
        } catch (err: unknown) {
          await reader.cancel().catch(() => {});
          if (err instanceof ModelProviderError) {
            controller.error(err);
            return;
          }
          const safeMsg = sanitizeSecretText(err instanceof Error ? err.message : 'Stream interrupted');
          controller.error(
            new ModelProviderError(
              emittedChars > 0
                ? `Gemini response stream was interrupted (${safeMsg}).`
                : `Gemini stream connection failed (${safeMsg}).`,
              {
                code: 'STREAM_INTERRUPTED',
                provider: providerId,
                statusCode: 502,
                isRetryable: true,
              }
            )
          );
        }
      },
      async cancel() {
        await reader.cancel().catch(() => {});
      },
    });
  }
}
