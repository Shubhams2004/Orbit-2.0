import { ModelOption } from '../types';

export interface IModelProviderService {
  getAvailableModels(): Promise<ModelOption[]>;
  getModelById(id: string): Promise<ModelOption | undefined>;
  getDefaultModel(): Promise<ModelOption>;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'orbit-agent-v2',
    name: 'Orbit Autonomous Agent v2',
    provider: 'Orbit Core',
    badge: 'Agent Native',
    description: 'Specialized for workspace orchestration, task triage, and multi-step plan execution.',
    contextWindow: '128k',
    isAgentCapable: true,
    isDefault: true,
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    badge: 'Hybrid Reasoning',
    description: 'High-depth technical architectural reasoning and code generation with thoughtful prose.',
    contextWindow: '200k',
    isAgentCapable: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    badge: 'Omni Multimodal',
    description: 'Fast, versatile conversational assistant with multi-turn instruction following.',
    contextWindow: '128k',
    isAgentCapable: true,
  },
  {
    id: 'gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    badge: 'Long Context',
    description: 'Exceptional context reasoning over large repositories and complex project roadmaps.',
    contextWindow: '1M',
    isAgentCapable: true,
  },
];

export class MockModelProviderService implements IModelProviderService {
  async getAvailableModels(): Promise<ModelOption[]> {
    return AVAILABLE_MODELS;
  }

  async getModelById(id: string): Promise<ModelOption | undefined> {
    return AVAILABLE_MODELS.find((m) => m.id === id) || AVAILABLE_MODELS[0];
  }

  async getDefaultModel(): Promise<ModelOption> {
    return AVAILABLE_MODELS[0];
  }
}

export const modelProviderService = new MockModelProviderService();
