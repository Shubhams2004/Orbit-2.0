import { IModelProvider, ModelExecutionOptions, ModelExecutionResult, ModelProviderError } from '../types';

export class GeminiModelProvider implements IModelProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('gemini-') || modelId.includes('gemini');
  }

  async execute(options: ModelExecutionOptions): Promise<ModelExecutionResult> {
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

    const targetModel = (options.modelId || 'gemini-2.5-flash').replace(/^models\//, '');

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

    // 3. Build generationConfig
    const generationConfig: Record<string, any> = {
      maxOutputTokens: options.maxTokens || 2048,
    };

    // Google Gemini guidelines: Do not send temperature to gemini-3.8-* or gemini-4-* models
    const isReasoningOrPreview =
      targetModel.includes('gemini-3.8') ||
      targetModel.includes('gemini-4') ||
      targetModel.includes('thinking');

    if (!isReasoningOrPreview && options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }

    const body: Record<string, any> = {
      contents,
      generationConfig,
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const url = `${this.baseUrl}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(
      this.apiKey!
    )}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = `Gemini API returned HTTP ${response.status}`;
      let specificCode = 'PROVIDER_ERROR';

      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          parsedMessage = errJson.error.message;
        }
        const lower = parsedMessage.toLowerCase();
        if (
          errJson?.error?.status === 'INVALID_ARGUMENT' &&
          (lower.includes('api key') || lower.includes('api_key'))
        ) {
          specificCode = 'AUTHENTICATION_FAILED';
        }
      } catch {}

      const lowerMsg = parsedMessage.toLowerCase();
      if (
        response.status === 401 ||
        response.status === 403 ||
        lowerMsg.includes('api_key_invalid') ||
        lowerMsg.includes('api key not valid') ||
        lowerMsg.includes('api key invalid')
      ) {
        specificCode = 'AUTHENTICATION_FAILED';
      } else if (response.status === 404 || lowerMsg.includes('not found')) {
        specificCode = 'MODEL_NOT_FOUND';
      } else if (response.status === 429 || lowerMsg.includes('quota') || lowerMsg.includes('rate limit')) {
        specificCode = 'QUOTA_EXHAUSTED';
      }

      throw new ModelProviderError(`Gemini provider error: ${parsedMessage}`, {
        code: specificCode,
        provider: this.id,
        statusCode: specificCode === 'AUTHENTICATION_FAILED' ? 401 : response.status >= 500 ? 502 : response.status,
        isRetryable: response.status >= 500 || response.status === 429,
      });
    }

    const data: any = await response.json();
    const candidate = data?.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      throw new ModelProviderError('Gemini response was blocked by safety filters.', {
        code: 'SAFETY_BLOCKED',
        provider: this.id,
        statusCode: 400,
      });
    }

    const textPart =
      candidate?.content?.parts
        ?.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('') || '';

    if (!textPart.trim()) {
      const reason = candidate?.finishReason || 'NO_TEXT_RETURNED';
      throw new ModelProviderError(
        `Gemini returned an empty response (finish reason: ${reason}).`,
        {
          code: 'EMPTY_OUTPUT',
          provider: this.id,
          statusCode: 502,
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
}

