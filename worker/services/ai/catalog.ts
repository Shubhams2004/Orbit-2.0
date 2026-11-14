/**
 * Orbit 2.0 AI Model Catalog & Dynamic Discovery Service
 *
 * Provides a unified, up-to-date catalog of AI models across:
 * - Orbit Core (Cloudflare Workers AI - Llama 3.1 8B Instruct Fast)
 * - Google Gemini (Gemini 3.1 Pro Preview, Gemini 3 Flash Preview, Gemini 3.1 Flash-Lite Preview, Gemini 3.8 Flash)
 * - OpenAI (GPT-4o, GPT-4o mini, o3-mini, o1)
 * - Anthropic (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
 *
 * Implements:
 * 1. Curated, official production models with verified context windows and capabilities.
 * 2. Clear distinction of stable vs preview/experimental models.
 * 3. Categorization into Fast, Balanced, Advanced Reasoning, Coding & Agentic, Specialized.
 * 4. Dynamic discovery verifying accessible models via official provider APIs when BYOK key is provided.
 * 5. Resilient fallback to curated catalog when live discovery is unconfigured or unavailable.
 * 6. Deprecated/restricted model detection, safe migration helpers, and lifecycle metadata.
 */

import type { Env } from '../../types';

export type ModelCategory = 'fast' | 'balanced' | 'reasoning' | 'coding' | 'specialized';
export type ModelStatus = 'stable' | 'preview' | 'experimental' | 'deprecated';
export type ModelAvailability = 'available' | 'requires_key' | 'unavailable' | 'deprecated';

export interface ModelMetadata {
  id: string;
  name: string;
  provider: 'cloudflare' | 'gemini' | 'openai' | 'anthropic';
  providerName: string;
  category: ModelCategory;
  categoryLabel: string;
  description: string;
  contextWindow: string; // Human-readable e.g. "128k", "200k", "1M"
  contextTokens: number;
  maxOutputTokens: number;
  modalities: Array<'text' | 'image' | 'audio' | 'video'>;
  reasoningCapability: 'standard' | 'advanced' | 'hybrid' | 'agentic';
  status: ModelStatus;
  isDefault?: boolean;
  isConfigured?: boolean;
  isDiscovered?: boolean;
  availability: ModelAvailability;
  deprecatedNotice?: string;
  recommendedUse: string;
}

/**
 * Curated official fallback catalog.
 * Verified against official documentation:
 * - Google AI Studio / Gemini API (https://ai.google.dev/gemini-api/docs/models)
 *   - gemini-3.1-pro-preview (1M input / 65,536 output)
 *   - gemini-3-flash-preview (1M input / 65,536 output)
 *   - gemini-3.1-flash-lite-preview (1M input / 65,536 output)
 *   - gemini-3.8-flash (1M input / 65,536 output)
 * - OpenAI API docs (GPT-4o, GPT-4o mini, o3-mini, o1)
 * - Anthropic API docs (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
 * - Cloudflare Workers AI (Llama 3.1 8B Instruct Fast)
 */
export const OFFICIAL_MODEL_CATALOG: ModelMetadata[] = [
  // 1. Orbit Core (Cloudflare Workers AI - Default)
  {
    id: 'orbit-agent-v2',
    name: 'Orbit Agent v2 (Llama 3.1 8B)',
    provider: 'cloudflare',
    providerName: 'Orbit Core',
    category: 'fast',
    categoryLabel: 'Fast',
    description: 'Zero-cost native workspace orchestration, task triage, and high-speed execution.',
    contextWindow: '128k',
    contextTokens: 131072,
    maxOutputTokens: 4096,
    modalities: ['text'],
    reasoningCapability: 'agentic',
    status: 'stable',
    isDefault: true,
    isConfigured: true,
    availability: 'available',
    recommendedUse: 'Daily workspace management, triage, and instant conversational assistance.',
  },

  // 2. Google Gemini Models (Current Official Gemini 3 / 3.1 Family)
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    provider: 'gemini',
    providerName: 'Google Gemini',
    category: 'balanced',
    categoryLabel: 'Balanced',
    description: 'Frontier-class Gemini 3 speed and reasoning balance with 1M context and multimodal understanding.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    modalities: ['text', 'image', 'audio', 'video'],
    reasoningCapability: 'advanced',
    status: 'preview',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Fast, high-intelligence daily chat, coding assistance, and multimodal analysis.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    provider: 'gemini',
    providerName: 'Google Gemini',
    category: 'reasoning',
    categoryLabel: 'Advanced Reasoning',
    description: 'Flagship Gemini 3.1 reasoning model for complex software engineering, STEM analysis, and deep thinking with 1M context.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    modalities: ['text', 'image', 'audio', 'video'],
    reasoningCapability: 'advanced',
    status: 'preview',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Complex codebase architecture, deep reasoning, multi-document synthesis, and STEM proofs.',
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash-Lite Preview',
    provider: 'gemini',
    providerName: 'Google Gemini',
    category: 'fast',
    categoryLabel: 'Fast',
    description: 'Ultra-low latency, cost-efficient Gemini 3.1 multimodal model built for rapid responses.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    modalities: ['text', 'image', 'audio', 'video'],
    reasoningCapability: 'standard',
    status: 'preview',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Instant replies, lightweight summarization, and high-frequency conversational tasks.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'gemini',
    providerName: 'Google Gemini',
    category: 'coding',
    categoryLabel: 'Coding & Agentic',
    description: 'High-efficiency Gemini Flash workhorse engineered for long-horizon software engineering and agentic tasks.',
    contextWindow: '1M',
    contextTokens: 1048576,
    maxOutputTokens: 65536,
    modalities: ['text', 'image', 'audio', 'video'],
    reasoningCapability: 'advanced',
    status: 'preview',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Long-horizon coding workflows, tool-assisted reasoning, and multi-sensory prompts.',
  },

  // 3. OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    providerName: 'OpenAI',
    category: 'balanced',
    categoryLabel: 'Balanced',
    description: 'Omni multimodal flagship with fast output and high general intelligence.',
    contextWindow: '128k',
    contextTokens: 128000,
    maxOutputTokens: 4096,
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'General-purpose knowledge work, structured output, and conversational workflows.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    providerName: 'OpenAI',
    category: 'fast',
    categoryLabel: 'Fast',
    description: 'Affordable, low-latency small omni model for fast everyday tasks and routine queries.',
    contextWindow: '128k',
    contextTokens: 128000,
    maxOutputTokens: 4096,
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Fast replies, simple script writing, email drafts, and quick data parsing.',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    providerName: 'OpenAI',
    category: 'reasoning',
    categoryLabel: 'Advanced Reasoning',
    description: 'High-speed reasoning model with deliberate thinking for math, coding, and STEM precision.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 100000,
    modalities: ['text'],
    reasoningCapability: 'advanced',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Algorithmic problem solving, complex debug sessions, and mathematical logic.',
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    providerName: 'OpenAI',
    category: 'reasoning',
    categoryLabel: 'Advanced Reasoning',
    description: 'Full-scale deep thinking model that reasons step-by-step before answering complex questions.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 100000,
    modalities: ['text', 'image'],
    reasoningCapability: 'advanced',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Architecture reviews, hard algorithmic challenges, and multi-constraint reasoning.',
  },

  // 4. Anthropic Claude Models
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
    category: 'coding',
    categoryLabel: 'Coding & Agentic',
    description: 'Hybrid reasoning flagship with extended thinking, elite software engineering, and agentic workflows.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    modalities: ['text', 'image'],
    reasoningCapability: 'hybrid',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Full-stack software engineering, architectural system design, and autonomous tool use.',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
    category: 'coding',
    categoryLabel: 'Coding & Agentic',
    description: 'Benchmark-leading coding and analytical model with nuanced writing and visual reasoning.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    modalities: ['text', 'image'],
    reasoningCapability: 'standard',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'Frontend component creation, technical documentation, and nuanced copy.',
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    providerName: 'Anthropic',
    category: 'fast',
    categoryLabel: 'Fast',
    description: 'Ultra-fast Claude model delivering Sonnet-level speed for rapid coding and responsive chat.',
    contextWindow: '200k',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    modalities: ['text'],
    reasoningCapability: 'standard',
    status: 'stable',
    isDefault: false,
    availability: 'requires_key',
    recommendedUse: 'High-speed code autocompletion, real-time responses, and quick classification.',
  },
];

/**
 * Known deprecated, retired, or new-user-restricted model identifiers mapped to active replacements.
 */
export const DEPRECATED_MODEL_MAP: Record<string, { replacementId: string; notice: string }> = {
  'gpt-3.5-turbo': {
    replacementId: 'gpt-4o-mini',
    notice: 'GPT-3.5 Turbo is legacy. Upgraded to GPT-4o mini for faster and higher quality responses.',
  },
  'gpt-4': {
    replacementId: 'gpt-4o',
    notice: 'Legacy GPT-4 has been replaced by GPT-4o for improved speed and context capability.',
  },
  'claude-2.1': {
    replacementId: 'claude-3-5-haiku',
    notice: 'Claude 2.1 is retired. Upgraded to Claude 3.5 Haiku for lower latency and better output.',
  },
  'claude-3-opus-20240229': {
    replacementId: 'claude-3-7-sonnet',
    notice: 'Claude 3 Opus is superseded by Claude 3.7 Sonnet with hybrid reasoning.',
  },
  'gemini-2.5-pro': {
    replacementId: 'gemini-3.1-pro-preview',
    notice: 'Gemini 2.5 Pro is no longer available to new users. Migrated to Gemini 3.1 Pro Preview.',
  },
  'gemini-2.5-flash': {
    replacementId: 'gemini-3-flash-preview',
    notice: 'Gemini 2.5 Flash is restricted for new accounts. Migrated to Gemini 3 Flash Preview.',
  },
  'gemini-2.5-flash-lite': {
    replacementId: 'gemini-3.1-flash-lite-preview',
    notice: 'Gemini 2.5 Flash-Lite is restricted for new accounts. Migrated to Gemini 3.1 Flash-Lite Preview.',
  },
  'gemini-1.0-pro': {
    replacementId: 'gemini-3.1-pro-preview',
    notice: 'Gemini 1.0 Pro is retired. Migrated to Gemini 3.1 Pro Preview.',
  },
  'gemini-1.5-pro': {
    replacementId: 'gemini-3.1-pro-preview',
    notice: 'Gemini 1.5 Pro is retired. Migrated to Gemini 3.1 Pro Preview.',
  },
  'gemini-2.0-pro': {
    replacementId: 'gemini-3.1-pro-preview',
    notice: 'Gemini 2.0 Pro is retired. Migrated to Gemini 3.1 Pro Preview.',
  },
  'gemini-pro': {
    replacementId: 'gemini-3.1-pro-preview',
    notice: 'Legacy Gemini Pro is retired. Migrated to Gemini 3.1 Pro Preview.',
  },
  'gemini-1.5-flash': {
    replacementId: 'gemini-3-flash-preview',
    notice: 'Gemini 1.5 Flash is retired. Migrated to Gemini 3 Flash Preview.',
  },
  'gemini-2.0-flash': {
    replacementId: 'gemini-3-flash-preview',
    notice: 'Gemini 2.0 Flash is retired. Migrated to Gemini 3 Flash Preview.',
  },
  'gemini-2.0-flash-thinking': {
    replacementId: 'gemini-3-flash-preview',
    notice: 'Gemini 2.0 Flash Thinking is retired. Migrated to Gemini 3 Flash Preview.',
  },
};

/**
 * Safely migrates a saved model ID if it references a retired or restricted model.
 * Valid active model selections are returned completely unchanged.
 */
export function resolveActiveModelSelection(modelId?: string | null): {
  modelId: string;
  migratedFrom?: string;
  notice?: string;
} {
  if (!modelId || !modelId.trim()) {
    return { modelId: 'orbit-agent-v2' };
  }
  const normalized = modelId.trim().replace(/^models\//, '');
  const entry = DEPRECATED_MODEL_MAP[normalized];
  if (entry) {
    return {
      modelId: entry.replacementId,
      migratedFrom: normalized,
      notice: entry.notice,
    };
  }
  return { modelId: normalized };
}

/**
 * Dynamic discovery helper for Google Gemini models via official API.
 * GET https://generativelanguage.googleapis.com/v1beta/models with x-goog-api-key header.
 */
export async function discoverGeminiModels(apiKey: string, timeoutMs = 3500): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data: any = await res.json();
    if (!data || !Array.isArray(data.models)) return [];

    // Filter only non-deprecated models supporting generateContent and normalize name (remove 'models/' prefix)
    return data.models
      .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => (m.name || '').replace(/^models\//, ''))
      .filter((id: string) => id.startsWith('gemini-') && !DEPRECATED_MODEL_MAP[id]);
  } catch {
    return [];
  }
}

/**
 * Dynamic discovery helper for OpenAI models via official API.
 * GET https://api.openai.com/v1/models with Authorization: Bearer KEY
 */
export async function discoverOpenAiModels(apiKey: string, timeoutMs = 3500): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data: any = await res.json();
    if (!data || !Array.isArray(data.data)) return [];

    // Filter chat and reasoning models (exclude embeddings, whisper, tts, dall-e, moderations)
    return data.data
      .map((m: any) => m.id as string)
      .filter((id: string) => typeof id === 'string' && (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3')));
  } catch {
    return [];
  }
}

/**
 * Dynamic discovery helper for Anthropic models via official API.
 * GET https://api.anthropic.com/v1/models with x-api-key: KEY
 */
export async function discoverAnthropicModels(apiKey: string, timeoutMs = 3500): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data: any = await res.json();
    if (!data || !Array.isArray(data.data)) return [];

    return data.data
      .map((m: any) => m.id as string)
      .filter((id: string) => typeof id === 'string' && id.startsWith('claude-'));
  } catch {
    return [];
  }
}

export interface CatalogDiscoveryResult {
  models: ModelMetadata[];
  catalogUpdatedAt: string;
  discoveryStatus: {
    gemini: boolean;
    openai: boolean;
    anthropic: boolean;
    cloudflare: boolean;
  };
}

/**
 * Generates the unified model catalog for an authenticated user.
 * Combines curated production models with live dynamic discovery results when keys are present.
 */
export async function getUnifiedModelCatalog(
  env: Env,
  userCredentials?: Map<string, { apiKey: string; preferredModel?: string }>,
  options: { performLiveDiscovery?: boolean } = {}
): Promise<CatalogDiscoveryResult> {
  const performDiscovery = options.performLiveDiscovery !== false;
  const isCloudflareReady = Boolean(env.AI);

  const geminiKey = userCredentials?.get('gemini')?.apiKey || env.GEMINI_API_KEY;
  const openAiKey = userCredentials?.get('openai')?.apiKey || env.OPENAI_API_KEY;
  const anthropicKey = userCredentials?.get('anthropic')?.apiKey || env.ANTHROPIC_API_KEY;

  const isGeminiConfigured = Boolean(geminiKey && geminiKey.trim().length > 0);
  const isOpenAiConfigured = Boolean(openAiKey && openAiKey.trim().length > 0);
  const isAnthropicConfigured = Boolean(anthropicKey && anthropicKey.trim().length > 0);

  // Live discovery results map
  const discoveredModels = new Map<string, Set<string>>();
  const discoveryStatus = {
    gemini: false,
    openai: false,
    anthropic: false,
    cloudflare: isCloudflareReady,
  };

  if (performDiscovery) {
    const discoveryPromises: Array<Promise<void>> = [];

    if (isGeminiConfigured && geminiKey) {
      discoveryPromises.push(
        discoverGeminiModels(geminiKey).then((list) => {
          if (list.length > 0) {
            discoveredModels.set('gemini', new Set(list));
            discoveryStatus.gemini = true;
          }
        })
      );
    }

    if (isOpenAiConfigured && openAiKey) {
      discoveryPromises.push(
        discoverOpenAiModels(openAiKey).then((list) => {
          if (list.length > 0) {
            discoveredModels.set('openai', new Set(list));
            discoveryStatus.openai = true;
          }
        })
      );
    }

    if (isAnthropicConfigured && anthropicKey) {
      discoveryPromises.push(
        discoverAnthropicModels(anthropicKey).then((list) => {
          if (list.length > 0) {
            discoveredModels.set('anthropic', new Set(list));
            discoveryStatus.anthropic = true;
          }
        })
      );
    }

    if (discoveryPromises.length > 0) {
      await Promise.allSettled(discoveryPromises);
    }
  }

  // Construct unified model list
  const models: ModelMetadata[] = OFFICIAL_MODEL_CATALOG.map((base) => {
    let isConfigured = false;
    let availability: ModelAvailability = 'requires_key';
    let isDiscovered = false;

    if (base.provider === 'cloudflare') {
      isConfigured = isCloudflareReady;
      availability = isCloudflareReady ? 'available' : 'unavailable';
      isDiscovered = isCloudflareReady;
    } else if (base.provider === 'gemini') {
      isConfigured = isGeminiConfigured;
      const discoveredSet = discoveredModels.get('gemini');
      if (discoveredSet) {
        // If live discovery succeeded, verify if the model is in user's account
        isDiscovered = true;
        const existsInAccount = discoveredSet.has(base.id) || Array.from(discoveredSet).some((id) => id.startsWith(base.id));
        availability = existsInAccount ? 'available' : 'unavailable';
      } else {
        availability = isConfigured ? 'available' : 'requires_key';
      }
    } else if (base.provider === 'openai') {
      isConfigured = isOpenAiConfigured;
      const discoveredSet = discoveredModels.get('openai');
      if (discoveredSet) {
        isDiscovered = true;
        const existsInAccount = discoveredSet.has(base.id) || Array.from(discoveredSet).some((id) => id.startsWith(base.id));
        availability = existsInAccount ? 'available' : 'unavailable';
      } else {
        availability = isConfigured ? 'available' : 'requires_key';
      }
    } else if (base.provider === 'anthropic') {
      isConfigured = isAnthropicConfigured;
      const discoveredSet = discoveredModels.get('anthropic');
      if (discoveredSet) {
        isDiscovered = true;
        const existsInAccount = discoveredSet.has(base.id) || Array.from(discoveredSet).some((id) => id.startsWith(base.id));
        availability = existsInAccount ? 'available' : 'unavailable';
      } else {
        availability = isConfigured ? 'available' : 'requires_key';
      }
    }

    return {
      ...base,
      isConfigured,
      availability,
      isDiscovered,
    };
  });

  return {
    models,
    catalogUpdatedAt: new Date().toISOString(),
    discoveryStatus,
  };
}
