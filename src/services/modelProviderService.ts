import { ModelOption, ProviderConnection } from '../types';
import { apiClient } from './apiClient';

export interface IModelProviderService {
  getAvailableModels(): Promise<ModelOption[]>;
  getModelById(id: string): Promise<ModelOption | undefined>;
  getDefaultModel(): Promise<ModelOption>;
  getProviders(): Promise<ProviderConnection[]>;
  connectProvider(provider: string, apiKey: string, preferredModel?: string): Promise<{ success: boolean; keyHint: string; preferredModel?: string }>;
  disconnectProvider(provider: string): Promise<boolean>;
}

export const BASELINE_PROVIDERS: ProviderConnection[] = [
  {
    id: 'cloudflare',
    name: 'Orbit Core (Cloudflare Workers AI)',
    isDefault: true,
    byokSupported: false,
    isConfigured: true,
    preferredModel: 'orbit-agent-v2',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    isDefault: false,
    byokSupported: true,
    isConfigured: false,
    preferredModel: 'gemini-2.5-flash',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    isDefault: false,
    byokSupported: true,
    isConfigured: false,
    preferredModel: 'gpt-4o',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    isDefault: false,
    byokSupported: true,
    isConfigured: false,
    preferredModel: 'claude-3-7-sonnet',
  },
];

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'orbit-agent-v2',
    name: 'Orbit Autonomous Agent v2',
    provider: 'Orbit Core',
    providerKey: 'cloudflare',
    badge: 'Agent Native',
    description: 'Specialized for workspace orchestration, task triage, and multi-step plan execution. Fast & built-in.',
    contextWindow: '128k',
    isAgentCapable: true,
    isDefault: true,
    isConfigured: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    providerKey: 'gemini',
    badge: 'Fast Reasoning',
    description: 'Ultra-low latency Google intelligence with large context reasoning.',
    contextWindow: '1M',
    isAgentCapable: true,
    isConfigured: false,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    providerKey: 'gemini',
    badge: 'Deep Context',
    description: 'Exceptional context reasoning over large repositories and complex project roadmaps.',
    contextWindow: '1M',
    isAgentCapable: true,
    isConfigured: false,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerKey: 'openai',
    badge: 'Omni Multimodal',
    description: 'Fast, versatile conversational assistant with multi-turn instruction following.',
    contextWindow: '128k',
    isAgentCapable: true,
    isConfigured: false,
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'OpenAI',
    providerKey: 'openai',
    badge: 'Reasoning Effort',
    description: 'High-speed reasoning model specialized for coding, math, and STEM logic.',
    contextWindow: '200k',
    isAgentCapable: true,
    isConfigured: false,
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    providerKey: 'anthropic',
    badge: 'Hybrid Reasoning',
    description: 'High-depth technical architectural reasoning and code generation with thoughtful prose.',
    contextWindow: '200k',
    isAgentCapable: true,
    isConfigured: false,
  },
];

export class ModelProviderService implements IModelProviderService {
  private cachedModels: ModelOption[] = [...AVAILABLE_MODELS];
  private cachedProviders: ProviderConnection[] = [...BASELINE_PROVIDERS];

  async getAvailableModels(): Promise<ModelOption[]> {
    try {
      const data = await apiClient.get<{
        models: Array<{ id: string; name: string; provider: string; isDefault: boolean; isConfigured: boolean }>;
      }>('/api/v1/ai/models');

      if (data && Array.isArray(data.models)) {
        // Merge configuration flags from server
        this.cachedModels = AVAILABLE_MODELS.map((local) => {
          const match = data.models.find((m) => m.id === local.id);
          return {
            ...local,
            isConfigured: match ? match.isConfigured : local.isDefault || false,
          };
        });
      }
    } catch {
      // Fallback to local cache
    }
    return this.cachedModels;
  }

  async getModelById(id: string): Promise<ModelOption | undefined> {
    const models = await this.getAvailableModels();
    return models.find((m) => m.id === id) || models[0];
  }

  async getDefaultModel(): Promise<ModelOption> {
    return AVAILABLE_MODELS[0];
  }

  async getProviders(): Promise<ProviderConnection[]> {
    try {
      const data = await apiClient.get<{ providers: ProviderConnection[] }>('/api/v1/ai/providers');
      if (data && Array.isArray(data.providers)) {
        this.cachedProviders = data.providers;
        return this.cachedProviders;
      }
    } catch {
      // Return cached/baseline providers on network interruption
    }
    return this.cachedProviders;
  }

  async connectProvider(
    provider: string,
    apiKey: string,
    preferredModel?: string
  ): Promise<{ success: boolean; keyHint: string; preferredModel?: string }> {
    const res = await apiClient.post<{
      success: boolean;
      provider: string;
      keyHint: string;
      preferredModel?: string;
    }>('/api/v1/ai/providers/connect', {
      provider,
      apiKey,
      preferredModel,
    });

    // Refresh model catalog & providers cache after successful connection
    await this.getProviders();
    await this.getAvailableModels();

    return res;
  }

  async disconnectProvider(provider: string): Promise<boolean> {
    const res = await apiClient.delete<{
      success: boolean;
      disconnected: boolean;
    }>(`/api/v1/ai/providers/${provider}`);

    // Refresh model catalog & providers cache after disconnection
    await this.getProviders();
    await this.getAvailableModels();

    return Boolean(res?.disconnected ?? true);
  }
}

export const modelProviderService = new ModelProviderService();
