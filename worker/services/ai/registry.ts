import { IModelProvider, ModelExecutionOptions, ModelExecutionResult, ModelProviderError } from './types';
import { CloudflareWorkersAiProvider, DEFAULT_CLOUDFLARE_MODEL } from './providers/cloudflare';
import { OpenAiModelProvider } from './providers/openai';
import { GeminiModelProvider } from './providers/gemini';
import { AnthropicModelProvider } from './providers/anthropic';
import type { Env } from '../../types';

export interface RegistryExecutionOptions extends ModelExecutionOptions {
  allowFallback?: boolean;
}

export class ModelProviderRegistry {
  private providers: Map<string, IModelProvider> = new Map();
  private defaultProviderId: string = 'cloudflare';

  registerProvider(provider: IModelProvider, isDefault: boolean = false): this {
    this.providers.set(provider.id, provider);
    if (isDefault) {
      this.defaultProviderId = provider.id;
    }
    return this;
  }

  getProvider(id: string): IModelProvider | undefined {
    return this.providers.get(id);
  }

  getDefaultProvider(): IModelProvider | undefined {
    return this.providers.get(this.defaultProviderId);
  }

  listProviders(): Array<{ id: string; name: string; isConfigured: boolean; isDefault: boolean }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isConfigured: p.isConfigured(),
      isDefault: p.id === this.defaultProviderId,
    }));
  }

  /**
   * Resolves the most appropriate provider for a given model ID.
   * If modelId matches a known provider's capability, returns that provider.
   * Otherwise falls back to the default provider.
   */
  resolveProvider(modelId?: string): IModelProvider {
    if (modelId) {
      for (const provider of this.providers.values()) {
        if (provider.supportsModel(modelId)) {
          return provider;
        }
      }
    }

    const defaultProvider = this.getDefaultProvider();
    if (!defaultProvider) {
      throw new ModelProviderError('No model providers are registered in the registry.', {
        code: 'NO_PROVIDERS_AVAILABLE',
        provider: 'registry',
        statusCode: 500,
      });
    }

    return defaultProvider;
  }

  /**
   * Executes inference through the resolved provider, with optional graceful fallback.
   */
  async execute(options: RegistryExecutionOptions): Promise<ModelExecutionResult> {
    const requestedModel = options.modelId || 'orbit-agent-v2';
    const allowFallback = options.allowFallback !== false; // Default true for system resilience
    const primaryProvider = this.resolveProvider(requestedModel);
    const defaultProvider = this.getDefaultProvider();

    // Check if primary provider is configured
    if (!primaryProvider.isConfigured()) {
      if (allowFallback && defaultProvider && defaultProvider.id !== primaryProvider.id && defaultProvider.isConfigured()) {
        const fallbackResult = await defaultProvider.execute({
          ...options,
          modelId: DEFAULT_CLOUDFLARE_MODEL,
        });

        return {
          ...fallbackResult,
          fallbackUsed: true,
        };
      }

      throw new ModelProviderError(
        `Model provider "${primaryProvider.name}" is not configured on this server.`,
        {
          code: 'PROVIDER_NOT_CONFIGURED',
          provider: primaryProvider.id,
          statusCode: 503,
          isRetryable: false,
        }
      );
    }

    // Attempt primary execution
    try {
      const result = await primaryProvider.execute(options);
      return result;
    } catch (primaryError: unknown) {
      // If primary execution failed and fallback is allowed to the default Cloudflare provider
      if (
        allowFallback &&
        defaultProvider &&
        defaultProvider.id !== primaryProvider.id &&
        defaultProvider.isConfigured()
      ) {
        try {
          const fallbackResult = await defaultProvider.execute({
            ...options,
            modelId: DEFAULT_CLOUDFLARE_MODEL,
          });

          return {
            ...fallbackResult,
            fallbackUsed: true,
          };
        } catch {
          // If fallback also fails, rethrow the original primary error
          throw primaryError;
        }
      }

      throw primaryError;
    }
  }

  /**
   * Factory method to construct and populate registry from Cloudflare Worker Env
   */
  static fromEnv(env: Env): ModelProviderRegistry {
    const registry = new ModelProviderRegistry();

    // 1. Cloudflare Workers AI (Default)
    const cfProvider = new CloudflareWorkersAiProvider(env.AI);
    registry.registerProvider(cfProvider, true);

    // 2. OpenAI Provider (optional)
    const openAiProvider = new OpenAiModelProvider(env.OPENAI_API_KEY);
    registry.registerProvider(openAiProvider);

    // 3. Gemini Provider (optional)
    const geminiProvider = new GeminiModelProvider(env.GEMINI_API_KEY);
    registry.registerProvider(geminiProvider);

    // 4. Anthropic Provider (optional)
    const anthropicProvider = new AnthropicModelProvider(env.ANTHROPIC_API_KEY);
    registry.registerProvider(anthropicProvider);

    return registry;
  }
}
