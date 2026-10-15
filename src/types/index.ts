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

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string
  modelUsed?: string;
  attachments?: ChatAttachment[];
  actions?: AgentAction[];
  status?: 'streaming' | 'complete' | 'error' | 'stopped';
  errorMessage?: string;
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

export interface ModelOption {
  id: string;
  name: string;
  provider: 'Anthropic' | 'OpenAI' | 'Google' | 'Orbit Core';
  badge: string;
  description: string;
  contextWindow: string;
  isAgentCapable: boolean;
  isDefault?: boolean;
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
