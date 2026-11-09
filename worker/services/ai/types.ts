/**
 * Provider-Independent AI Model System Interface & Types
 *
 * Defines unified interfaces for model execution across multiple AI providers:
 * - Cloudflare Workers AI (Llama 3.1 8B Instruct Fast - default)
 * - OpenAI (GPT-4o, etc.)
 * - Google Gemini (Gemini 2.5 Flash / Pro, etc.)
 * - Anthropic (Claude 3.7 Sonnet, etc.)
 * - Custom / Self-hosted compatible APIs
 */

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelExecutionOptions {
  messages: ModelMessage[];
  maxTokens?: number;
  temperature?: number;
  modelId?: string;
  signal?: AbortSignal;
}

export interface ModelExecutionResult {
  text: string;
  provider: string;
  modelId: string;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  fallbackUsed?: boolean;
}

export interface IModelProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  supportsModel(modelId: string): boolean;
  execute(options: ModelExecutionOptions): Promise<ModelExecutionResult>;
}

export class ModelProviderError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly statusCode: number;
  readonly isRetryable: boolean;

  constructor(message: string, options: { code: string; provider: string; statusCode?: number; isRetryable?: boolean }) {
    super(message);
    this.name = 'ModelProviderError';
    this.code = options.code;
    this.provider = options.provider;
    this.statusCode = options.statusCode || 500;
    this.isRetryable = options.isRetryable || false;
  }
}
