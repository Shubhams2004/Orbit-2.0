import { IModelProvider, ModelExecutionOptions, ModelExecutionResult, ModelProviderError } from '../types';

export class AnthropicModelProvider implements IModelProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic Claude';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('claude-') || modelId.includes('anthropic');
  }

  async execute(options: ModelExecutionOptions): Promise<ModelExecutionResult> {
    if (!this.isConfigured()) {
      throw new ModelProviderError(
        'Anthropic API key is not configured on this Worker. Please configure ANTHROPIC_API_KEY in Worker environment variables.',
        {
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: this.id,
          statusCode: 503,
          isRetryable: false,
        }
      );
    }

    const requested = options.modelId || 'claude-3-7-sonnet-20250219';
    const aliasMap: Record<string, string> = {
      'claude-3-7-sonnet': 'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
    };
    const targetModel = aliasMap[requested] || requested;

    // Separate system messages
    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const conversationMessages = options.messages.filter((m) => m.role !== 'system');

    const systemPrompt = systemMessages
      .map((m) => m.content.trim())
      .filter(Boolean)
      .join('\n\n');

    // Anthropic API strictly requires alternating turns: user, assistant, user, assistant...
    interface AnthropicMessage {
      role: 'user' | 'assistant';
      content: string;
    }
    const formattedMessages: AnthropicMessage[] = [];

    for (const msg of conversationMessages) {
      const text = (msg.content || '').trim();
      if (!text) continue;
      const role: 'user' | 'assistant' = msg.role === 'assistant' ? 'assistant' : 'user';
      const last = formattedMessages[formattedMessages.length - 1];

      if (last && last.role === role) {
        last.content += `\n\n${text}`;
      } else {
        formattedMessages.push({ role, content: text });
      }
    }

    if (formattedMessages.length > 0 && formattedMessages[0].role !== 'user') {
      formattedMessages.unshift({ role: 'user', content: 'Hello' });
    }
    if (formattedMessages.length === 0) {
      formattedMessages.push({ role: 'user', content: 'Hello' });
    }

    const body: Record<string, any> = {
      model: targetModel,
      messages: formattedMessages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = `Anthropic API returned HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          parsedMessage = errJson.error.message;
        }
      } catch {}

      throw new ModelProviderError(`Anthropic provider error: ${parsedMessage}`, {
        code: response.status === 401 ? 'AUTHENTICATION_FAILED' : 'PROVIDER_ERROR',
        provider: this.id,
        statusCode: response.status >= 500 ? 502 : response.status,
        isRetryable: response.status >= 500 || response.status === 429,
      });
    }

    const data: any = await response.json();
    const textContent =
      data?.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('') || '';

    return {
      text: textContent.trim(),
      provider: this.id,
      modelId: options.modelId || targetModel,
      finishReason: data?.stop_reason,
      usage: {
        promptTokens: data?.usage?.input_tokens,
        completionTokens: data?.usage?.output_tokens,
        totalTokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
      },
    };
  }
}
