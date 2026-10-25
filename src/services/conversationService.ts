import { Conversation } from '../types';
import { apiClient } from './apiClient';

export interface CreateConversationDTO {
  title?: string;
  modelId?: string;
}

export interface IConversationService {
  getConversations(): Promise<Conversation[]>;
  createConversation(dto?: CreateConversationDTO): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation>;
  deleteConversation(id: string): Promise<boolean>;
  renameConversation(id: string, newTitle: string): Promise<Conversation>;
  generateTitleFromPrompt(prompt: string): string;
}

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_plan_today',
    title: 'Daily Workflow & SLA Triage',
    createdAt: '2026-10-14T08:30:00.000Z',
    updatedAt: '2026-10-14T09:30:00.000Z',
    modelId: 'orbit-agent-v2',
    isPinned: true,
    messageCount: 3,
  },
  {
    id: 'conv_soc2_audit',
    title: 'SOC2 Type II Audit Preparation',
    createdAt: '2026-10-13T14:15:00.000Z',
    updatedAt: '2026-10-13T16:45:00.000Z',
    modelId: 'claude-3-7-sonnet',
    isPinned: false,
    messageCount: 4,
  },
];

export const DEMO_CONVERSATION_IDS = ['conv_plan_today', 'conv_soc2_audit'];

export const isDemoConversationId = (id?: string | null): boolean => {
  if (!id) return false;
  return (
    DEMO_CONVERSATION_IDS.includes(id) ||
    id === 'conv_cf_workers' ||
    INITIAL_CONVERSATIONS.some((c) => c.id === id)
  );
};

/**
 * Production API Conversation Service
 * Dispatches real HTTP requests to Cloudflare Workers API (/api/v1/conversations).
 */
export class ApiConversationService implements IConversationService {
  generateTitleFromPrompt(prompt: string): string {
    const cleaned = prompt
      .replace(/^(\s*["'])+|(["']\s*)+$/g, '')
      .replace(/[\n\r]+/g, ' ')
      .trim();

    if (!cleaned) return 'New Conversation';
    if (cleaned.length <= 36) return cleaned;
    return `${cleaned.slice(0, 36).trim()}...`;
  }

  async getConversations(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>('/api/v1/conversations');
  }

  async createConversation(dto?: CreateConversationDTO): Promise<Conversation> {
    return apiClient.post<Conversation>('/api/v1/conversations', {
      title: dto?.title || 'New Conversation',
      modelId: dto?.modelId || 'orbit-agent-v2',
    });
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    return apiClient.patch<Conversation>(`/api/v1/conversations/${id}`, updates);
  }

  async deleteConversation(id: string): Promise<boolean> {
    await apiClient.delete(`/api/v1/conversations/${id}`);
    return true;
  }

  async renameConversation(id: string, newTitle: string): Promise<Conversation> {
    return this.updateConversation(id, { title: newTitle.trim() });
  }
}

/**
 * Mock Conversation Service for offline fallback
 */
export class MockConversationService implements IConversationService {
  private storageKey = 'orbit_conversations_v2';

  generateTitleFromPrompt(prompt: string): string {
    const cleaned = prompt.replace(/[\n\r]+/g, ' ').trim();
    if (!cleaned) return 'New Conversation';
    return cleaned.length <= 36 ? cleaned : `${cleaned.slice(0, 36).trim()}...`;
  }

  private load(): Conversation[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) return JSON.parse(stored);
    } catch {}
    return INITIAL_CONVERSATIONS;
  }

  private save(list: Conversation[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch {}
  }

  async getConversations(): Promise<Conversation[]> {
    return this.load();
  }

  async createConversation(dto?: CreateConversationDTO): Promise<Conversation> {
    const list = this.load();
    const now = new Date().toISOString();
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: dto?.title || 'New Conversation',
      modelId: dto?.modelId || 'orbit-agent-v2',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    this.save([newConv, ...list]);
    return newConv;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const list = this.load();
    const updated = list.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c));
    this.save(updated);
    return updated.find((c) => c.id === id)!;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const list = this.load();
    this.save(list.filter((c) => c.id !== id));
    return true;
  }

  async renameConversation(id: string, newTitle: string): Promise<Conversation> {
    return this.updateConversation(id, { title: newTitle.trim() });
  }
}

export const conversationService: IConversationService = new ApiConversationService();
