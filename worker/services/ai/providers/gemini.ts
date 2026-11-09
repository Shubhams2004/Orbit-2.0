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
        'Gemini API key is not configured on this Worker. Please configure GEMINI_API_KEY in Worker environment variables.',
        {
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: this.id,
          statusCode: 503,
          isRetryable: false,
        }
      );
    }

    const targetModel = options.modelId || 'gemini-2.5-flash';

    // Separate system prompt from conversational contents if present
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const conversationMessages = options.messages.filter((m) => m.role !== 'system');

    const systemInstruction =
      systemMessages.length > 0
        ? {
            parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }],
          }
        : undefined;

    const contents = conversationMessages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const url = `${this.baseUrl}/models/${targetModel}:generateContent?key=${encodeURIComponent(this.apiKey!)}`;

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
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          parsedMessage = errJson.error.message;
        }
      } catch {}

      throw new ModelProviderError(`Gemini provider error: ${parsedMessage}`, {
        code: response.status === 401 || response.status === 403 ? 'AUTHENTICATION_FAILED' : 'PROVIDER_ERROR',
        provider: this.id,
        statusCode: response.status >= 500 ? 502 : response.status,
        isRetryable: response.status >= 500 || response.status === 429,
      });
    }

    const data: any = await response.json();
    const candidate = data?.candidates?.[0];
    const textPart = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';

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
