import { ModelOption, ProviderConnection, ModelCategory, ModelStatus, ModelAvailability } from '../types';
import { apiClient } from './apiClient';

export interface IModelProviderService {
  getAvailableModels(forceDiscovery?: boolean): Promise<ModelOption[]>;
  getModelById(id: string): Promise<ModelOption | undefined>;
  getDefaultModel(): Promise<ModelOption>;
  getProviders(): Promise<ProviderConnection[]>;
  connectProvider(provider: string, apiKey: string, preferredModel?: string): Promise<{ success: boolean; keyHint: string; preferredModel?: string }>;
  disconnectProvider(provider: string): Promise<boolean>;
  discoverModels(): Promise<{ models: ModelOption[]; discoveryStatus: Record<string, boolean> }>;
  getCatalogUpdatedAt(): string | null;
  getDiscoveryStatus(): Record<string, boolean>;
  checkModelLifecycle(modelId: string): { isAvailable: boolean; isDeprecated: boolean; notice?: string; replacementId?: string };
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
  // 1. Orbit Core (Cloudflare Workers AI - Default)
  {
    id: 'orbit-agent-v2',
    name: 'Orbit Agent v2 (Llama 3.1 8B)',
    provider: 'Orbit Core',
    providerKey: 'cloudflare',
    badge: 'Agent Native',
    description: 'Zero-cost native workspace orchestration, task triage, and high-speed execution.',
    contextWindow: '128k',
    contextTokens: 131072,
    maxOutputTokens: 4096,
    category: 'fast',
    categoryLabel: 'Fast',
    modalities: ['text'],
    reasoningCapability: 'agentic',
    status: 'stable',
    isAgentCapable: true,
    isDefault: true,
    isConfigured: true,
    availability: 'available',
    recommendedUse: 'Daily workspace management, triage, and instant conversational assistance.',
  },

  // 2. Google Gemini Models
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    providerKey: 'gemini',
    badge: 'Fast Reasoning',
    description: 'High-speed flagship with adaptive reasoning, multimodal input, and 1M context.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 8192,
    category: 'balanced',
    categoryLabel: 'Balanced',
    modalities: ['text', 'image', 'audio', 'video'],
    reasoningCapability: 'advanced',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'High-throughput reasoning, large documents, audio/video analysis, and everyday coding.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    providerKey: 'gemini',
    badge: 'Deep Context',
    description: 'Deep analytical model with 2M context for complex logic, full-repo analysis, and STEM research.',
    contextWindow: '2M',
    contextTokens: 2097152,
    maxOutputTokens: 8192,
    category: 'reasoning',
    categoryLabel: 'Advanced Reasoning',
    modalities: ['text', 'image', 'audio', 'video'],
    reasoningCapability: 'advanced',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Complex codebase refactoring, multi-document synthesis, and scientific proofs.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    providerKey: 'gemini',
    badge: 'Ultra Fast',
    description: 'Lightweight, ultra-low latency model engineered for instant chat and high-volume tasks.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 4096,
    category: 'fast',
    categoryLabel: 'Fast',
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'preview',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Rapid conversational responses, content summarization, and budget-friendly automation.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google',
    providerKey: 'gemini',
    badge: 'Next-Gen Preview',
    description: 'Experimental next-gen architecture preview with enhanced reasoning and multi-sensory comprehension.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 8192,
    category: 'specialized',
    categoryLabel: 'Specialized',
    modalities: ['text', 'image', 'video'],
    reasoningCapability: 'advanced',
    status: 'preview',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Testing early frontier model capabilities and next-generation reasoning features.',
  },

  // 3. OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerKey: 'openai',
    badge: 'Omni Multimodal',
    description: 'Omni multimodal flagship with fast output and high general intelligence.',
    contextWindow: '128k',
    contextTokens: 128000,
    maxOutputTokens: 4096,
    category: 'balanced',
    categoryLabel: 'Balanced',
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'General-purpose knowledge work, structured output, and conversational workflows.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    providerKey: 'openai',
    badge: 'Fast & Lightweight',
    description: 'Affordable, low-latency small omni model for fast everyday tasks and routine queries.',
    contextWindow: '128k',
    contextTokens: 128000,
    maxOutputTokens: 4096,
    category: 'fast',
    categoryLabel: 'Fast',
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Fast replies, simple script writing, email drafts, and quick data parsing.',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'OpenAI',
    providerKey: 'openai',
    badge: 'STEM Reasoning',
    description: 'High-speed reasoning model with deliberate thinking for math, coding, and STEM precision.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 100000,
    category: 'reasoning',
    categoryLabel: 'Advanced Reasoning',
    modalities: ['text'],
    reasoningCapability: 'advanced',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Algorithmic problem solving, complex debug sessions, and mathematical logic.',
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'OpenAI',
    providerKey: 'openai',
    badge: 'Deep Reasoning',
    description: 'Full-scale deep thinking model that reasons step-by-step before answering complex questions.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 100000,
    category: 'reasoning',
    categoryLabel: 'Advanced Reasoning',
    modalities: ['text', 'image'],
    reasoningCapability: 'advanced',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Architecture reviews, hard algorithmic challenges, and multi-constraint reasoning.',
  },

  // 4. Anthropic Claude Models
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    providerKey: 'anthropic',
    badge: 'Hybrid Reasoning',
    description: 'Hybrid reasoning flagship with extended thinking, elite software engineering, and agentic workflows.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    category: 'coding',
    categoryLabel: 'Coding & Agentic',
    modalities: ['text', 'image'],
    reasoningCapability: 'hybrid',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Full-stack software engineering, architectural system design, and autonomous tool use.',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    providerKey: 'anthropic',
    badge: 'Agentic Coding',
    description: 'Benchmark-leading coding and analytical model with nuanced writing and visual reasoning.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    category: 'coding',
    categoryLabel: 'Coding & Agentic',
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'Frontend component creation, technical documentation, and nuanced copy.',
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    providerKey: 'anthropic',
    badge: 'High-Speed Claude',
    description: 'Ultra-fast Claude model delivering Sonnet-level speed for rapid coding and responsive chat.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    category: 'fast',
    categoryLabel: 'Fast',
    modalities: ['text'],
    reasoningCapability: 'standard',
    status: 'stable',
    isAgentCapable: true,
    isDefault: false,
    isConfigured: false,
    availability: 'requires_key',
    recommendedUse: 'High-speed code autocompletion, real-time responses, and quick classification.',
  },
];

const LOCAL_DEPRECATED_MAP: Record<string, { replacementId: string; notice: string }> = {
  'gpt-3.5-turbo': {
    replacementId: 'gpt-4o-mini',
    notice: 'GPT-3.5 Turbo is retired. Orbit has upgraded to GPT-4o mini.',
  },
  'gpt-4': {
    replacementId: 'gpt-4o',
    notice: 'GPT-4 is legacy. Upgraded to GPT-4o for speed and expanded context.',
  },
  'claude-2.1': {
    replacementId: 'claude-3-5-haiku',
    notice: 'Claude 2.1 is retired. Upgraded to Claude 3.5 Haiku.',
  },
  'gemini-1.0-pro': {
    replacementId: 'gemini-2.5-flash',
    notice: 'Gemini 1.0 Pro is retired. Upgraded to Gemini 2.5 Flash.',
  },
  'gemini-1.5-flash': {
    replacementId: 'gemini-2.5-flash',
    notice: 'Gemini 1.5 Flash is superseded by Gemini 2.5 Flash.',
  },
};

export class ModelProviderService implements IModelProviderService {
  private cachedModels: ModelOption[] = [...AVAILABLE_MODELS];
  private cachedProviders: ProviderConnection[] = [...BASELINE_PROVIDERS];
  private catalogUpdatedAt: string | null = null;
  private discoveryStatus: Record<string, boolean> = {
    gemini: false,
    openai: false,
    anthropic: false,
    cloudflare: true,
  };
  private deprecatedMap: Record<string, { replacementId: string; notice: string }> = { ...LOCAL_DEPRECATED_MAP };

  async getAvailableModels(forceDiscovery = false): Promise<ModelOption[]> {
    try {
      const url = forceDiscovery ? '/api/v1/ai/models?discover=true' : '/api/v1/ai/models';
      const data = await apiClient.get<{
        models: any[];
        catalogUpdatedAt?: string;
        discoveryStatus?: Record<string, boolean>;
        deprecated?: Record<string, { replacementId: string; notice: string }>;
      }>(url);

      if (data && Array.isArray(data.models)) {
        if (data.catalogUpdatedAt) {
          this.catalogUpdatedAt = data.catalogUpdatedAt;
        }
        if (data.discoveryStatus) {
          this.discoveryStatus = data.discoveryStatus;
        }
        if (data.deprecated) {
          this.deprecatedMap = { ...this.deprecatedMap, ...data.deprecated };
        }

        // Map rich server-side models directly into frontend catalog
        this.cachedModels = data.models.map((serverModel) => {
          const localFallback = AVAILABLE_MODELS.find((m) => m.id === serverModel.id);
          const providerKey = (serverModel.providerKey || serverModel.provider) as 'cloudflare' | 'gemini' | 'openai' | 'anthropic';
          const providerDisplay =
            serverModel.providerName ||
            (providerKey === 'cloudflare'
              ? 'Orbit Core'
              : providerKey === 'gemini'
              ? 'Google'
              : providerKey === 'openai'
              ? 'OpenAI'
              : providerKey === 'anthropic'
              ? 'Anthropic'
              : serverModel.provider || 'AI');

          return {
            id: serverModel.id,
            name: serverModel.name || localFallback?.name || serverModel.id,
            provider: providerDisplay,
            providerKey,
            badge: serverModel.badge || localFallback?.badge || (serverModel.category ? serverModel.categoryLabel : 'AI Model'),
            description: serverModel.description || localFallback?.description || '',
            contextWindow: serverModel.contextWindow || localFallback?.contextWindow || '128k',
            contextTokens: serverModel.contextTokens || localFallback?.contextTokens,
            maxOutputTokens: serverModel.maxOutputTokens || localFallback?.maxOutputTokens,
            category: (serverModel.category || localFallback?.category || 'balanced') as ModelCategory,
            categoryLabel: serverModel.categoryLabel || localFallback?.categoryLabel || 'Balanced',
            modalities: serverModel.modalities || localFallback?.modalities || ['text'],
            reasoningCapability: serverModel.reasoningCapability || localFallback?.reasoningCapability || 'standard',
            status: (serverModel.status || localFallback?.status || 'stable') as ModelStatus,
            isAgentCapable: Boolean(serverModel.isAgentCapable ?? localFallback?.isAgentCapable ?? true),
            isDefault: Boolean(serverModel.isDefault),
            isConfigured: Boolean(serverModel.isConfigured),
            isDiscovered: Boolean(serverModel.isDiscovered),
            availability: (serverModel.availability || (serverModel.isConfigured ? 'available' : 'requires_key')) as ModelAvailability,
            recommendedUse: serverModel.recommendedUse || localFallback?.recommendedUse,
          };
        });
      }
    } catch {
      // Retain cached models or fallback if network error
    }
    return this.cachedModels;
  }

  async discoverModels(): Promise<{ models: ModelOption[]; discoveryStatus: Record<string, boolean> }> {
    try {
      const data = await apiClient.post<{
        models: any[];
        catalogUpdatedAt?: string;
        discoveryStatus?: Record<string, boolean>;
      }>('/api/v1/ai/models/discover', {});

      if (data && Array.isArray(data.models)) {
        if (data.catalogUpdatedAt) {
          this.catalogUpdatedAt = data.catalogUpdatedAt;
        }
        if (data.discoveryStatus) {
          this.discoveryStatus = data.discoveryStatus;
        }
        await this.getAvailableModels();
      }
    } catch {
      // Fallback
    }

    return {
      models: this.cachedModels,
      discoveryStatus: this.discoveryStatus,
    };
  }

  async getModelById(id: string): Promise<ModelOption | undefined> {
    const models = await this.getAvailableModels();
    return models.find((m) => m.id === id) || models[0];
  }

  async getDefaultModel(): Promise<ModelOption> {
    const models = await this.getAvailableModels();
    return models.find((m) => m.isDefault) || models[0] || AVAILABLE_MODELS[0];
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
    await this.getAvailableModels(true);

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

  getCatalogUpdatedAt(): string | null {
    return this.catalogUpdatedAt;
  }

  getDiscoveryStatus(): Record<string, boolean> {
    return this.discoveryStatus;
  }

  checkModelLifecycle(modelId: string): {
    isAvailable: boolean;
    isDeprecated: boolean;
    notice?: string;
    replacementId?: string;
  } {
    if (this.deprecatedMap[modelId]) {
      return {
        isAvailable: false,
        isDeprecated: true,
        notice: this.deprecatedMap[modelId].notice,
        replacementId: this.deprecatedMap[modelId].replacementId,
      };
    }

    const model = this.cachedModels.find((m) => m.id === modelId);
    if (!model) {
      return {
        isAvailable: false,
        isDeprecated: false,
        notice: `Model "${modelId}" is not in the active catalog.`,
        replacementId: 'orbit-agent-v2',
      };
    }

    if (model.providerKey !== 'cloudflare' && !model.isConfigured) {
      return {
        isAvailable: false,
        isDeprecated: false,
        notice: `${model.name} requires an API key from ${model.provider}.`,
      };
    }

    return {
      isAvailable: true,
      isDeprecated: false,
    };
  }
}

export const modelProviderService = new ModelProviderService();
