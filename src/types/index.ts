/**
 * Orbit 2.0 Core Type Definitions
 * Architecture ready for future Cloudflare Workers & Cloudflare D1 integration.
 */

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  initials: string;
  bio?: string;
  statusMessage?: string;
  avatarAnimation?: 'pulse' | 'glow' | 'spin' | 'orbit' | 'wave' | 'none';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string | null; // null represents unassigned
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null; // ISO YYYY-MM-DD
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type ProjectStatus = 'active' | 'in_progress' | 'on_hold' | 'completed';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string; // Tailwind color token or hex
  icon?: string;
  status: ProjectStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export type ActivityEventType =
  | 'task_created'
  | 'task_completed'
  | 'task_updated'
  | 'task_deleted'
  | 'project_created'
  | 'project_updated'
  | 'agent_run_completed'
  | 'agent_action_approved'
  | 'conversation_created';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  timestamp: string; // ISO string
  entityId?: string;
  entityType?: 'task' | 'project' | 'agent' | 'conversation';
  isMockDevelopment?: boolean; // indicates baseline seed data
}

export type AgentActionType =
  | 'create_task'
  | 'reschedule_task'
  | 'update_priority'
  | 'batch_create'
  | 'mark_complete';

export interface ProposedTaskData {
  title: string;
  description: string;
  projectId?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
}

export interface AgentAction {
  id: string;
  type: AgentActionType;
  title: string;
  description: string;
  data: {
    taskId?: string;
    taskTitle?: string;
    newDueDate?: string;
    newPriority?: TaskPriority;
    tasksToCreate?: ProposedTaskData[];
  };
  status: 'proposed' | 'approved' | 'rejected' | 'completed';
}

export interface AgentRun {
  id: string;
  prompt: string;
  timestamp: string;
  status: 'thinking' | 'formulating' | 'requires_approval' | 'completed' | 'failed';
  actions: AgentAction[];
  toolCallsSummary: string[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  runId?: string;
  actions?: AgentAction[];
  isSimulated?: boolean;
}

// ==========================================
// AI Chat Terminal & Conversation Types
// ==========================================

export interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: 'file' | 'image' | 'code' | 'doc';
  contentSnippet?: string;
}

export interface WebSearchSource {
  title: string;
  url: string;
  publishedDate?: string;
}

export interface WebSearchMetadata {
  triggered: boolean;
  sourcesCount: number;
  sources: WebSearchSource[];
  retrievedAt?: string | null;
  cached?: boolean;
  notice?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string
  modelUsed?: string;
  provider?: string;
  fallbackUsed?: boolean;
  attachments?: ChatAttachment[];
  actions?: AgentAction[];
  webSearch?: WebSearchMetadata;
  status?: 'streaming' | 'complete' | 'error' | 'stopped';
  errorMessage?: string;
  retryable?: boolean;
  isSimulated?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  modelId: string;
  isPinned?: boolean;
  messageCount?: number;
}

export interface ProviderConnection {
  id: 'cloudflare' | 'gemini' | 'openai' | 'anthropic';
  name: string;
  isDefault: boolean;
  byokSupported: boolean;
  isConfigured: boolean;
  keyHint?: string;
  preferredModel?: string;
  updatedAt?: string;
}

export type ModelCategory = 'fast' | 'balanced' | 'reasoning' | 'coding' | 'specialized';
export type ModelStatus = 'stable' | 'preview' | 'experimental' | 'deprecated';
export type ModelAvailability = 'available' | 'requires_key' | 'unavailable' | 'deprecated';

export interface ModelOption {
  id: string;
  name: string;
  provider: 'Anthropic' | 'OpenAI' | 'Google' | 'Orbit Core' | string;
  providerKey?: 'cloudflare' | 'gemini' | 'openai' | 'anthropic';
  badge: string;
  description: string;
  contextWindow: string;
  contextTokens?: number;
  maxOutputTokens?: number;
  category?: ModelCategory;
  categoryLabel?: string;
  modalities?: Array<'text' | 'image' | 'audio' | 'video'>;
  reasoningCapability?: 'standard' | 'advanced' | 'hybrid' | 'agentic';
  status?: ModelStatus;
  isAgentCapable: boolean;
  isDefault?: boolean;
  isConfigured?: boolean;
  isDiscovered?: boolean;
  availability?: ModelAvailability;
  deprecatedNotice?: string;
  recommendedUse?: string;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  accentColor: string;
  defaultTaskPriority: TaskPriority;
  defaultTaskView: 'list' | 'board';
  startOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY';
  requireAgentApproval: boolean;
  autoSuggestPrompts: boolean;
  defaultChatModel: string;
}
