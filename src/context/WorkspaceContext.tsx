import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  User,
  Project,
  Task,
  ActivityEvent,
  AgentMessage,
  AgentRun,
  AgentAction,
  UserSettings,
  TaskPriority,
  TaskStatus,
  ProjectStatus,
  Conversation,
  ChatMessage,
  ChatAttachment,
} from '../types';
import {
  INITIAL_USER,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_ACTIVITIES,
  INITIAL_AGENT_MESSAGES,
} from '../data/mockData';
import { settingsService } from '../services/settingsService';
import { activityService } from '../services/activityService';
import { agentService } from '../services/agentService';
import { conversationService, INITIAL_CONVERSATIONS } from '../services/conversationService';
import { chatService } from '../services/chatService';
import { taskService, MockTaskService } from '../services/taskService';
import { projectService, MockProjectService } from '../services/projectService';
import { apiClient } from '../services/apiClient';

export type PageView =
  | 'overview'
  | 'tasks'
  | 'projects'
  | 'project_detail'
  | 'agent' // AI Chat & Agent Workspace
  | 'activity'
  | 'settings';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

interface WorkspaceContextType {
  // Navigation
  currentPage: PageView;
  setCurrentPage: (page: PageView) => void;
  selectedProjectId: string | null;
  navigateToProjectDetail: (projectId: string) => void;

  // User & Settings
  user: User;
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;

  // Backend & Connection State
  isLoading: boolean;
  apiError: string | null;
  clearApiError: () => void;
  backendStatus: 'connected' | 'offline_fallback' | 'loading';
  currentAuthToken: string;
  setCurrentAuthToken: (token: string) => void;
  refreshData: () => Promise<void>;
  testBackendHealth: () => Promise<{ status: string; hasDbBinding: boolean; environment: string }>;

  // Workspace Data
  tasks: Task[];
  projects: Project[];
  activities: ActivityEvent[];
  agentMessages: AgentMessage[];
  agentRuns: AgentRun[];
  isAgentThinking: boolean;

  // Metrics (Derived)
  metrics: {
    tasksDueToday: number;
    overdueTasks: number;
    completedTasks: number;
    totalTasks: number;
    completionPercentage: number;
    inProgressTasks: number;
  };

  // Task Actions
  createTask: (data: {
    title: string;
    description?: string;
    projectId?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
  }) => Promise<Task>;
  updateTask: (
    id: string,
    data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string) => Promise<void>;

  // Project Actions
  createProject: (data: {
    name: string;
    description: string;
    color?: string;
    priority?: TaskPriority;
    status?: ProjectStatus;
  }) => Promise<Project>;
  updateProject: (
    id: string,
    data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Agent Actions
  sendAgentMessage: (content: string) => Promise<void>;
  approveAgentAction: (actionId: string) => void;
  rejectAgentAction: (actionId: string) => void;

  // Chat Terminal State & Actions
  conversations: Conversation[];
  activeConversationId: string;
  activeConversation?: Conversation;
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  selectConversation: (id: string) => void;
  createNewConversation: (title?: string, modelId?: string) => Promise<Conversation>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendChatMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  stopChatGeneration: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  approveChatAction: (actionId: string) => void;
  rejectChatAction: (actionId: string) => void;

  // UI Dialogs
  isQuickCreateOpen: boolean;
  quickCreateInitialType: 'task' | 'project';
  openQuickCreate: (type?: 'task' | 'project') => void;
  closeQuickCreate: () => void;

  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  confirmDialog: ConfirmDialogState;
  showConfirmDialog: (config: Omit<ConfirmDialogState, 'isOpen'>) => void;
  closeConfirmDialog: () => void;

  todayDateStr: string;
  resetToSampleData: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const TODAY_DATE = '2026-10-14';

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation
  const [currentPage, setCurrentPage] = useState<PageView>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<UserSettings>(() => settingsService.getSettings());

  // User
  const [user] = useState<User>(INITIAL_USER);

  // Backend connection state
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline_fallback' | 'loading'>('loading');
  const [currentAuthToken, setCurrentAuthTokenState] = useState<string>(() => apiClient.getAuthToken());

  const setCurrentAuthToken = (token: string) => {
    apiClient.setAuthToken(token);
    setCurrentAuthTokenState(token);
    refreshData();
  };

  const clearApiError = () => {
    setApiError(null);
  };

  // Core Data State
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_tasks_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_TASKS;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_projects_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_PROJECTS;
  });

  const [activities, setActivities] = useState<ActivityEvent[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_activities_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_ACTIVITIES;
  });

  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_agent_messages_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_AGENT_MESSAGES;
  });

  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Chat Terminal State
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_conversations_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(
    INITIAL_CONVERSATIONS[0]?.id || 'conv_plan_today'
  );

  const [selectedModelId, setSelectedModelId] = useState<string>(
    INITIAL_CONVERSATIONS[0]?.modelId || 'orbit-agent-v2'
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load initial backend data from Cloudflare Worker API
  const refreshData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [fetchedTasks, fetchedProjects] = await Promise.all([
        taskService.getTasks(),
        projectService.getProjects(),
      ]);

      if (Array.isArray(fetchedTasks)) {
        setTasks(fetchedTasks);
      }
      if (Array.isArray(fetchedProjects)) {
        setProjects(fetchedProjects);
      }
      setBackendStatus('connected');
    } catch (err: unknown) {
      // In local development before worker is spawned, fallback to seed records
      setBackendStatus('offline_fallback');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const testBackendHealth = async () => {
    return apiClient.get<{ status: string; hasDbBinding: boolean; environment: string }>(
      '/api/v1/health'
    );
  };

  // Load chat messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      chatService.getMessages(activeConversationId).then((msgs) => {
        setChatMessages(msgs);
      });
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (conv) {
        setSelectedModelId(conv.modelId || 'orbit-agent-v2');
      }
    }
  }, [activeConversationId, conversations]);

  // UI Dialog state
  const [isQuickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateInitialType, setQuickCreateInitialType] = useState<'task' | 'project'>('task');
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Sync theme with HTML class
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [settings.theme]);

  // Persist non-sensitive user preferences & local state cache
  useEffect(() => {
    try {
      localStorage.setItem('orbit_tasks_v2', JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('orbit_projects_v2', JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('orbit_activities_v2', JSON.stringify(activities));
    } catch {}
  }, [activities]);

  useEffect(() => {
    try {
      localStorage.setItem('orbit_conversations_v2', JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      settingsService.saveSettings(updated);
      return updated;
    });
  };

  // Keyboard shortcut listener: Cmd/Ctrl+K for global command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateToProjectDetail = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('project_detail');
  };

  // Derive metrics reactively
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const tasksDueToday = tasks.filter(
      (t) => t.dueDate === TODAY_DATE && t.status !== 'done'
    ).length;
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.dueDate < TODAY_DATE && t.status !== 'done'
    ).length;
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      tasksDueToday,
      overdueTasks,
      completedTasks,
      totalTasks,
      completionPercentage,
      inProgressTasks,
    };
  }, [tasks]);

  // Task Actions
  const createTask = async (data: {
    title: string;
    description?: string;
    projectId?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
  }): Promise<Task> => {
    setApiError(null);
    try {
      const created = await taskService.createTask(data);
      setTasks((prev) => [created, ...prev]);

      const newActivity = activityService.logActivity({
        type: 'task_created',
        title: 'Task Created',
        description: `Created task "${created.title}"`,
        entityId: created.id,
        entityType: 'task',
      });
      setActivities((prev) => [newActivity, ...prev]);
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setApiError(message);

      // If backend offline in dev sandbox, use mock fallback
      if (backendStatus === 'offline_fallback') {
        const fallback = await new MockTaskService().createTask(data);
        setTasks((prev) => [fallback, ...prev]);
        return fallback;
      }
      throw err;
    }
  };

  const updateTask = async (
    id: string,
    data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> => {
    setApiError(null);
    try {
      const updated = await taskService.updateTask(id, data);
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updated, updatedAt: new Date().toISOString() } : t))
      );

      const target = tasks.find((t) => t.id === id);
      if (target) {
        const act = activityService.logActivity({
          type: data.status === 'done' ? 'task_completed' : 'task_updated',
          title: data.status === 'done' ? 'Task Completed' : 'Task Updated',
          description:
            data.status === 'done'
              ? `Completed "${target.title}"`
              : `Updated "${target.title}"`,
          entityId: id,
          entityType: 'task',
        });
        setActivities((prev) => [act, ...prev]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      setApiError(message);

      if (backendStatus === 'offline_fallback') {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t))
        );
      } else {
        throw err;
      }
    }
  };

  const deleteTask = async (id: string): Promise<void> => {
    setApiError(null);
    try {
      await taskService.deleteTask(id);
      const target = tasks.find((t) => t.id === id);
      setTasks((prev) => prev.filter((t) => t.id !== id));

      if (target) {
        const act = activityService.logActivity({
          type: 'task_deleted',
          title: 'Task Deleted',
          description: `Removed "${target.title}"`,
          entityId: id,
          entityType: 'task',
        });
        setActivities((prev) => [act, ...prev]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete task';
      setApiError(message);

      if (backendStatus === 'offline_fallback') {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } else {
        throw err;
      }
    }
  };

  const toggleTaskStatus = async (id: string): Promise<void> => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    const nextStatus: TaskStatus = target.status === 'done' ? 'todo' : 'done';
    await updateTask(id, { status: nextStatus });
  };

  // Project Actions
  const createProject = async (data: {
    name: string;
    description: string;
    color?: string;
    priority?: TaskPriority;
    status?: ProjectStatus;
  }): Promise<Project> => {
    setApiError(null);
    try {
      const created = await projectService.createProject(data);
      setProjects((prev) => [created, ...prev]);

      const act = activityService.logActivity({
        type: 'project_created',
        title: 'Project Created',
        description: `Created project "${created.name}"`,
        entityId: created.id,
        entityType: 'project',
      });
      setActivities((prev) => [act, ...prev]);

      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setApiError(message);

      if (backendStatus === 'offline_fallback') {
        const fallback = await new MockProjectService().createProject(data);
        setProjects((prev) => [fallback, ...prev]);
        return fallback;
      }
      throw err;
    }
  };

  const updateProject = async (
    id: string,
    data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> => {
    setApiError(null);
    try {
      const updated = await projectService.updateProject(id, data);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated, updatedAt: new Date().toISOString() } : p))
      );

      const target = projects.find((p) => p.id === id);
      if (target) {
        const act = activityService.logActivity({
          type: 'project_updated',
          title: 'Project Updated',
          description: `Updated project "${target.name}"`,
          entityId: id,
          entityType: 'project',
        });
        setActivities((prev) => [act, ...prev]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update project';
      setApiError(message);

      if (backendStatus === 'offline_fallback') {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
        );
      } else {
        throw err;
      }
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    setApiError(null);
    try {
      await projectService.deleteProject(id);
      const target = projects.find((p) => p.id === id);

      setTasks((prev) =>
        prev.map((t) => (t.projectId === id ? { ...t, projectId: null } : t))
      );
      setProjects((prev) => prev.filter((p) => p.id !== id));

      if (target) {
        const act = activityService.logActivity({
          type: 'project_updated',
          title: 'Project Removed',
          description: `Deleted "${target.name}". Associated tasks moved to unassigned.`,
          entityId: id,
          entityType: 'project',
        });
        setActivities((prev) => [act, ...prev]);
      }

      if (selectedProjectId === id) {
        setSelectedProjectId(null);
        setCurrentPage('projects');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      setApiError(message);

      if (backendStatus === 'offline_fallback') {
        setTasks((prev) =>
          prev.map((t) => (t.projectId === id ? { ...t, projectId: null } : t))
        );
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (selectedProjectId === id) {
          setSelectedProjectId(null);
          setCurrentPage('projects');
        }
      } else {
        throw err;
      }
    }
  };

  // Agent Actions
  const sendAgentMessage = async (content: string) => {
    if (!content.trim()) return;
    await sendChatMessage(content);
  };

  const approveAgentAction = (actionId: string) => {
    approveChatAction(actionId);
  };

  const rejectAgentAction = (actionId: string) => {
    rejectChatAction(actionId);
  };

  // Chat Terminal Actions
  const selectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const createNewConversation = async (
    title?: string,
    modelId?: string
  ): Promise<Conversation> => {
    const newConv = await conversationService.createConversation({
      title: title || 'New Conversation',
      modelId: modelId || selectedModelId,
    });
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setChatMessages([]);
    return newConv;
  };

  const renameConversation = async (id: string, newTitle: string) => {
    await conversationService.renameConversation(id, newTitle);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  const deleteConversation = async (id: string) => {
    await conversationService.deleteConversation(id);
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    if (activeConversationId === id) {
      if (updated.length > 0) {
        setActiveConversationId(updated[0].id);
      } else {
        const fresh = await conversationService.createConversation({
          title: 'New Conversation',
          modelId: selectedModelId,
        });
        setConversations([fresh]);
        setActiveConversationId(fresh.id);
      }
    }
  };

  const stopChatGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsChatStreaming(false);
  };

  const sendChatMessage = async (
    content: string,
    attachments: ChatAttachment[] = []
  ) => {
    if (!content.trim() && attachments.length === 0) return;
    if (isChatStreaming) return;

    let targetConvId = activeConversationId;
    let targetConv = conversations.find((c) => c.id === targetConvId);

    if (!targetConv) {
      targetConv = await createNewConversation(
        conversationService.generateTitleFromPrompt(content),
        selectedModelId
      );
      targetConvId = targetConv.id;
    } else if (
      targetConv.title === 'New Conversation' ||
      chatMessages.length === 0
    ) {
      const generatedTitle = conversationService.generateTitleFromPrompt(content);
      renameConversation(targetConvId, generatedTitle);
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsChatStreaming(true);

    try {
      const tempUserMsg: ChatMessage = {
        id: `msg_u_${Date.now()}`,
        conversationId: targetConvId,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        modelUsed: selectedModelId,
        attachments,
        status: 'complete',
      };

      const tempAssistantMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        conversationId: targetConvId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        modelUsed: selectedModelId,
        status: 'streaming',
      };

      setChatMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);

      await chatService.sendMessage({
        conversationId: targetConvId,
        content,
        modelId: selectedModelId,
        attachments,
        signal: abortController.signal,
        tasksContext: tasks,
        projectsContext: projects,
        onChunk: (accumulated) => {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsg.id ? { ...m, content: accumulated } : m
            )
          );
        },
      });

      const refreshed = await chatService.getMessages(targetConvId);
      setChatMessages(refreshed);

      const act = activityService.logActivity({
        type: 'agent_run_completed',
        title: 'AI Conversation Message',
        description: `Executed query via ${selectedModelId}: "${content.slice(0, 40)}"`,
        entityType: 'agent',
      });
      setActivities((prev) => [act, ...prev]);
    } finally {
      setIsChatStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const regenerateMessage = async (_messageId: string) => {
    const lastUserMsg = [...chatMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      await sendChatMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  };

  const approveChatAction = (actionId: string) => {
    let targetAction: AgentAction | undefined;

    setChatMessages((prev) =>
      prev.map((msg) => {
        if (!msg.actions) return msg;
        const updated = msg.actions.map((act) => {
          if (act.id === actionId) {
            targetAction = act;
            return { ...act, status: 'approved' as const };
          }
          return act;
        });
        return { ...msg, actions: updated };
      })
    );

    if (targetAction) {
      if (targetAction.type === 'reschedule_task') {
        const { taskId, newDueDate, newPriority } = targetAction.data;
        if (taskId) {
          updateTask(taskId, {
            ...(newDueDate ? { dueDate: newDueDate } : {}),
            ...(newPriority ? { priority: newPriority } : {}),
          });
        }
      } else if (targetAction.type === 'update_priority') {
        const { taskId, newPriority } = targetAction.data;
        if (taskId && newPriority) {
          updateTask(taskId, { priority: newPriority });
        }
      } else if (
        targetAction.type === 'batch_create' ||
        targetAction.type === 'create_task'
      ) {
        const list = targetAction.data.tasksToCreate || [];
        list.forEach((t) => {
          createTask({
            title: t.title,
            description: t.description,
            projectId: t.projectId ?? null,
            priority: t.priority,
            dueDate: t.dueDate ?? TODAY_DATE,
          });
        });
      }

      const act = activityService.logActivity({
        type: 'agent_action_approved',
        title: 'Agent Action Approved',
        description: `Approved and applied "${targetAction.title}" to workspace`,
        entityType: 'agent',
      });
      setActivities((prev) => [act, ...prev]);
    }
  };

  const rejectChatAction = (actionId: string) => {
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (!msg.actions) return msg;
        const updated = msg.actions.map((act) => {
          if (act.id === actionId) {
            return { ...act, status: 'rejected' as const };
          }
          return act;
        });
        return { ...msg, actions: updated };
      })
    );
  };

  const openQuickCreate = (type: 'task' | 'project' = 'task') => {
    setQuickCreateInitialType(type);
    setQuickCreateOpen(true);
  };

  const closeQuickCreate = () => {
    setQuickCreateOpen(false);
  };

  const showConfirmDialog = (config: Omit<ConfirmDialogState, 'isOpen'>) => {
    setConfirmDialog({
      ...config,
      isOpen: true,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const resetToSampleData = () => {
    setTasks(INITIAL_TASKS);
    setProjects(INITIAL_PROJECTS);
    setActivities(INITIAL_ACTIVITIES);
    setAgentMessages(INITIAL_AGENT_MESSAGES);
    setConversations(INITIAL_CONVERSATIONS);
    setActiveConversationId(INITIAL_CONVERSATIONS[0].id);
    localStorage.removeItem('orbit_tasks_v2');
    localStorage.removeItem('orbit_projects_v2');
    localStorage.removeItem('orbit_activities_v2');
    localStorage.removeItem('orbit_agent_messages_v2');
    localStorage.removeItem('orbit_conversations_v2');
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <WorkspaceContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        selectedProjectId,
        navigateToProjectDetail,
        user,
        settings,
        updateSettings,
        // Backend & Connection State
        isLoading,
        apiError,
        clearApiError,
        backendStatus,
        currentAuthToken,
        setCurrentAuthToken,
        refreshData,
        testBackendHealth,
        // Workspace Data
        tasks,
        projects,
        activities,
        agentMessages,
        agentRuns,
        isAgentThinking,
        metrics,
        createTask,
        updateTask,
        deleteTask,
        toggleTaskStatus,
        createProject,
        updateProject,
        deleteProject,
        sendAgentMessage,
        approveAgentAction,
        rejectAgentAction,
        // Chat Terminal
        conversations,
        activeConversationId,
        activeConversation,
        chatMessages,
        isChatStreaming,
        selectedModelId,
        setSelectedModelId,
        selectConversation,
        createNewConversation,
        renameConversation,
        deleteConversation,
        sendChatMessage,
        stopChatGeneration,
        regenerateMessage,
        approveChatAction,
        rejectChatAction,
        // UI
        isQuickCreateOpen,
        quickCreateInitialType,
        openQuickCreate,
        closeQuickCreate,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        confirmDialog,
        showConfirmDialog,
        closeConfirmDialog,
        todayDateStr: TODAY_DATE,
        resetToSampleData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
