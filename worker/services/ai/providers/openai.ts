import { IModelProvider, ModelExecutionOptions, ModelExecutionResult, ModelProviderError } from '../types';

export class OpenAiModelProvider implements IModelProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3');
  }

  async execute(options: ModelExecutionOptions): Promise<ModelExecutionResult> {
    if (!this.isConfigured()) {
      throw new ModelProviderError(
        'OpenAI API key is not configured on this Worker. Please configure OPENAI_API_KEY in Worker environment variables.',
        {
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: this.id,
          statusCode: 503,
          isRetryable: false,
        }
      );
    }

    const targetModel = options.modelId || 'gpt-4o';

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: options.messages,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = `OpenAI API returned HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          parsedMessage = errJson.error.message;
        }
      } catch {}

      throw new ModelProviderError(`OpenAI provider error: ${parsedMessage}`, {
        code: response.status === 401 ? 'AUTHENTICATION_FAILED' : 'PROVIDER_ERROR',
        provider: this.id,
        statusCode: response.status >= 500 ? 502 : response.status,
        isRetryable: response.status >= 500 || response.status === 429,
      });
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';

    return {
      text: content.trim(),
      provider: this.id,
      modelId: targetModel,
      finishReason: data?.choices?.[0]?.finish_reason,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
      },
    };
  }
}
