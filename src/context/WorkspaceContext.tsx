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
import {
  conversationService,
  INITIAL_CONVERSATIONS,
  isDemoConversationId,
} from '../services/conversationService';
import { chatService } from '../services/chatService';
import { taskService, MockTaskService } from '../services/taskService';
import { projectService, MockProjectService } from '../services/projectService';
import { apiClient, ApiError, isProductionEnv } from '../services/apiClient';
import {
  auth,
  logout as firebaseLogout,
  onIdTokenChanged,
  FirebaseUser,
} from '../lib/firebase';

export type PageView =
  | 'landing'
  | 'overview'
  | 'tasks'
  | 'projects'
  | 'project_detail'
  | 'agent' // AI Chat & Agent Workspace
  | 'activity'
  | 'settings'
  | 'profile';

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
  updateUser: (updated: Partial<User>) => void;
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;

  // Firebase Authentication
  firebaseUser: FirebaseUser | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  logoutUser: () => Promise<void>;

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
  sendChatMessage: (
    content: string,
    attachments?: ChatAttachment[],
    webSearch?: boolean,
    options?: { isRetry?: boolean; replaceErrorMsgId?: string }
  ) => Promise<void>;
  stopChatGeneration: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  approveChatAction: (actionId: string) => void;
  rejectChatAction: (actionId: string) => void;
  isWebSearchActive: boolean;
  setWebSearchActive: (active: boolean | ((prev: boolean) => boolean)) => void;

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

export interface RouteState {
  page: PageView;
  projectId: string | null;
}

export function parsePath(pathname: string): RouteState | null {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/' || clean === '/landing') {
    return { page: 'landing', projectId: null };
  }
  if (clean === '/overview' || clean === '/dashboard') {
    return { page: 'overview', projectId: null };
  }
  if (clean === '/tasks') {
    return { page: 'tasks', projectId: null };
  }
  if (clean === '/projects') {
    return { page: 'projects', projectId: null };
  }
  if (clean.startsWith('/projects/')) {
    const parts = clean.split('/');
    if (parts.length === 3 && parts[2]) {
      return { page: 'project_detail', projectId: decodeURIComponent(parts[2]) };
    }
    return null;
  }
  if (clean === '/chat' || clean === '/agent') {
    return { page: 'agent', projectId: null };
  }
  if (clean === '/activity') {
    return { page: 'activity', projectId: null };
  }
  if (clean === '/settings') {
    return { page: 'settings', projectId: null };
  }
  if (clean === '/profile' || clean === '/user-profile') {
    return { page: 'profile', projectId: null };
  }

  return null;
}

export function routeToPath(page: PageView, projectId?: string | null): string {
  switch (page) {
    case 'landing':
      return '/';
    case 'overview':
      return '/overview';
    case 'tasks':
      return '/tasks';
    case 'projects':
      return '/projects';
    case 'project_detail':
      return projectId ? `/projects/${encodeURIComponent(projectId)}` : '/projects';
    case 'agent':
      return '/chat';
    case 'activity':
      return '/activity';
    case 'settings':
      return '/settings';
    case 'profile':
      return '/profile';
    default:
      return '/';
  }
}

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation: Synchronize currentPage with window.location.pathname & browser history
  const initialRoute = useMemo((): RouteState => {
    if (typeof window === 'undefined') {
      return { page: 'landing', projectId: null };
    }
    const parsed = parsePath(window.location.pathname);
    if (parsed) {
      return parsed;
    }
    // Invalid route: redirect gracefully to landing page (Requirement 4)
    if (window.location.pathname !== '/') {
      window.history.replaceState({ page: 'landing', projectId: null }, '', '/');
    }
    return { page: 'landing', projectId: null };
  }, []);

  const [currentPage, setCurrentPageState] = useState<PageView>(initialRoute.page);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialRoute.projectId);

  const setCurrentPage = (page: PageView) => {
    const targetPath = routeToPath(page, page === 'project_detail' ? selectedProjectId : null);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState(
        { page, projectId: page === 'project_detail' ? selectedProjectId : null },
        '',
        targetPath
      );
    }
    setCurrentPageState(page);
  };

  const navigateToProjectDetail = (projectId: string) => {
    setSelectedProjectId(projectId);
    const targetPath = routeToPath('project_detail', projectId);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ page: 'project_detail', projectId }, '', targetPath);
    }
    setCurrentPageState('project_detail');
  };

  // Browser back/forward navigation support (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const parsed = parsePath(window.location.pathname);
      if (parsed) {
        setCurrentPageState(parsed.page);
        setSelectedProjectId(parsed.projectId);
      } else {
        window.history.replaceState({ page: 'landing', projectId: null }, '', '/');
        setCurrentPageState('landing');
        setSelectedProjectId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Settings
  const [settings, setSettings] = useState<UserSettings>(() => settingsService.getSettings());

  // User & Firebase Authentication State
  const [user, setUser] = useState<User>(() => {
    try {
      const stored = localStorage.getItem('orbit_user_profile_v2');
      if (stored) {
        return { ...INITIAL_USER, ...JSON.parse(stored) };
      }
    } catch {}
    return INITIAL_USER;
  });

  const updateUser = (updated: Partial<User>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('orbit_user_profile_v2', JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const logoutUser = async () => {
    try {
      await firebaseLogout();
    } catch {}
    apiClient.setAuthToken('');
    setCurrentAuthTokenState('');
    setUser(INITIAL_USER);
    setFirebaseUser(null);
    setConversations([]);
    setActiveConversationId('');
    setChatMessages([]);
    try {
      localStorage.removeItem('orbit_bearer_token');
      localStorage.removeItem('orbit_conversations_v2');
    } catch {}
    await refreshData();
  };

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

  // Chat Terminal State - never load demo seed conversation IDs for authenticated users
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_conversations_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: any) => !isDemoConversationId(c?.id));
        }
      }
    } catch {}
    return [];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>('');

  const [selectedModelId, setSelectedModelIdState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('orbit_active_model_preference');
      if (stored && stored.trim()) return stored.trim();
    } catch {}
    return 'orbit-agent-v2';
  });

  const setSelectedModelId = (newModelId: string) => {
    if (!newModelId || !newModelId.trim()) return;
    const cleanId = newModelId.trim();
    setSelectedModelIdState(cleanId);

    const userKey = firebaseUser?.uid || user?.id;
    try {
      localStorage.setItem('orbit_active_model_preference', cleanId);
      if (userKey) {
        localStorage.setItem(`orbit_model_pref_${userKey}`, cleanId);
      }
    } catch {}

    // Save to userSettings
    setSettings((prev) => {
      const updated = { ...prev, defaultChatModel: cleanId };
      settingsService.saveSettings(updated, userKey);
      return updated;
    });

    // If an active conversation is open, update its model override
    if (activeConversationId && !isDemoConversationId(activeConversationId)) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, modelId: cleanId } : c))
      );
      conversationService.updateConversation(activeConversationId, { modelId: cleanId }).catch(() => {});
    }

    // Persist to backend user preferences
    apiClient.put('/api/v1/ai/preferences', { defaultModel: cleanId }).catch(() => {});
  };

  const [isWebSearchActive, setWebSearchActive] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef<boolean>(false);
  const lastLoadedConvIdRef = useRef<string>('');

  // Load backend data from Cloudflare Worker API
  const refreshData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const isAuth = Boolean(
        firebaseUser !== null || (!isProductionEnv() && apiClient.getAuthToken()?.trim())
      );

      const [fetchedTasks, fetchedProjects, fetchedConvs] = await Promise.all([
        taskService.getTasks(),
        projectService.getProjects(),
        isAuth ? conversationService.getConversations() : Promise.resolve([]),
      ]);

      if (Array.isArray(fetchedTasks)) {
        setTasks(fetchedTasks);
      }
      if (Array.isArray(fetchedProjects)) {
        setProjects(fetchedProjects);
      }

      if (isAuth && Array.isArray(fetchedConvs)) {
        // Filter out any demo conversations so demo IDs are never used for authenticated users
        const userConversations = fetchedConvs.filter(
          (c) => !isDemoConversationId(c.id)
        );
        setConversations(userConversations);

        // Reset stale active conversation state and select a conversation belonging to that user
        setActiveConversationId((prevActive) => {
          if (
            prevActive &&
            !isDemoConversationId(prevActive) &&
            userConversations.some((c) => c.id === prevActive)
          ) {
            return prevActive;
          }
          return userConversations.length > 0 ? userConversations[0].id : '';
        });
      } else if (!isAuth) {
        setConversations([]);
        setActiveConversationId('');
        setChatMessages([]);
      }

      setBackendStatus('connected');
    } catch (err: unknown) {
      // In local development before worker is spawned, fallback to seed records
      setBackendStatus('offline_fallback');
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Auth Observer: Continuously synchronizes authenticated user and token
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          apiClient.setAuthToken(idToken);
          setCurrentAuthTokenState(idToken);
          setUser((prev) => ({
            ...prev,
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || prev.name,
            email: fbUser.email || prev.email,
          }));

          // Restore user-isolated settings & AI model preference
          const userSettings = settingsService.getSettings(fbUser.uid);
          setSettings(userSettings);

          const storedUserPref = localStorage.getItem(`orbit_model_pref_${fbUser.uid}`);
          if (storedUserPref && storedUserPref.trim()) {
            setSelectedModelIdState(storedUserPref.trim());
            localStorage.setItem('orbit_active_model_preference', storedUserPref.trim());
          } else if (userSettings.defaultChatModel && userSettings.defaultChatModel.trim()) {
            setSelectedModelIdState(userSettings.defaultChatModel.trim());
          } else {
            // Restore from server user preferences
            apiClient
              .get<{ defaultModel?: string }>('/api/v1/ai/preferences')
              .then((res) => {
                if (res?.defaultModel && res.defaultModel.trim()) {
                  setSelectedModelIdState(res.defaultModel.trim());
                  localStorage.setItem(`orbit_model_pref_${fbUser.uid}`, res.defaultModel.trim());
                  localStorage.setItem('orbit_active_model_preference', res.defaultModel.trim());
                }
              })
              .catch(() => {});
          }
        } catch {}
      } else {
        // Clear stale development or cached tokens when Firebase has no authenticated user
        const currentTok = apiClient.getAuthToken();
        if (currentTok) {
          apiClient.setAuthToken('');
          setCurrentAuthTokenState('');
          try {
            localStorage.removeItem('orbit_bearer_token');
          } catch {}
        }
        setConversations([]);
        setActiveConversationId('');
        setChatMessages([]);
        setSelectedModelIdState('orbit-agent-v2');
        try {
          localStorage.removeItem('orbit_conversations_v2');
          localStorage.removeItem('orbit_active_model_preference');
        } catch {}
      }
      refreshData();
    });

    return () => unsubscribe();
  }, []);

  const testBackendHealth = async () => {
    return apiClient.get<{ status: string; hasDbBinding: boolean; environment: string }>(
      '/api/v1/health'
    );
  };

  // Load chat messages when active conversation changes (never clobber an active stream or error bubble)
  useEffect(() => {
    if (!activeConversationId) {
      lastLoadedConvIdRef.current = '';
      return;
    }

    const conv = conversations.find((c) => c.id === activeConversationId);
    if (conv && conv.modelId && conv.modelId.trim() && conv.modelId !== 'orbit-agent-v2') {
      setSelectedModelIdState(conv.modelId.trim());
    }

    if (isSendingRef.current || activeConversationId === lastLoadedConvIdRef.current) {
      return;
    }

    let cancelled = false;
    const loadingConvId = activeConversationId;
    lastLoadedConvIdRef.current = loadingConvId;

    chatService.getMessages(loadingConvId).then((msgs) => {
      if (!cancelled && !isSendingRef.current) {
        setChatMessages(msgs);
      }
    });

    return () => {
      cancelled = true;
    };
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
      const userKey = firebaseUser?.uid || user?.id;
      settingsService.saveSettings(updated, userKey);
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
    const effectiveModel = modelId || selectedModelId;
    const newConv = await conversationService.createConversation({
      title: title || 'New Conversation',
      modelId: effectiveModel,
    });
    setConversations((prev) => [
      newConv,
      ...prev.filter((c) => c.id !== newConv.id && !isDemoConversationId(c.id)),
    ]);
    setActiveConversationId(newConv.id);
    setSelectedModelIdState(effectiveModel);
    setChatMessages([]);
    return newConv;
  };

  const renameConversation = async (id: string, newTitle: string) => {
    if (!isDemoConversationId(id)) {
      try {
        await conversationService.renameConversation(id, newTitle);
      } catch {}
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  const deleteConversation = async (id: string) => {
    if (!isDemoConversationId(id)) {
      try {
        await conversationService.deleteConversation(id);
      } catch {}
    }
    const updated = conversations.filter((c) => c.id !== id && !isDemoConversationId(c.id));
    setConversations(updated);
    if (activeConversationId === id) {
      if (updated.length > 0) {
        setActiveConversationId(updated[0].id);
      } else {
        setActiveConversationId('');
        setChatMessages([]);
      }
    }
  };

  const stopChatGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSendingRef.current = false;
    setIsChatStreaming(false);
  };

  const sendChatMessage = async (
    content: string,
    attachments: ChatAttachment[] = [],
    webSearch?: boolean,
    options?: { isRetry?: boolean; replaceErrorMsgId?: string }
  ) => {
    if (!content.trim() && attachments.length === 0) return;
    if (isChatStreaming || isSendingRef.current) return;

    const isRetry = Boolean(options?.isRetry);
    const replaceErrorMsgId = options?.replaceErrorMsgId;

    // Use explicit parameter if passed, otherwise use current toggle state
    const effectiveWebSearch = webSearch !== undefined ? webSearch : isWebSearchActive;

    // Require authentication before sending chat requests
    const hasValidAuth = firebaseUser !== null || (!isProductionEnv() && Boolean(currentAuthToken?.trim()));
    if (!hasValidAuth) {
      openAuthModal('login');
      setApiError('Authentication is required to use Orbit AI chat. Please sign in to your account.');
      return;
    }

    // Stop using demo/seed conversation IDs for authenticated server requests
    let targetConvId = activeConversationId;
    if (isDemoConversationId(targetConvId)) {
      targetConvId = '';
    }

    // Verify conversation exists in the user's conversation list
    const targetConv = targetConvId ? conversations.find((c) => c.id === targetConvId) : undefined;
    if (!targetConv) {
      targetConvId = '';
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isSendingRef.current = true;
    setIsChatStreaming(true);
    setApiError(null);

    const nowTs = Date.now();
    const tempUserMsgId = `msg_u_${nowTs}`;
    const tempAssistantMsgId = `msg_a_${nowTs}`;

    try {
      const tempAssistantMsg: ChatMessage = {
        id: tempAssistantMsgId,
        conversationId: targetConvId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        modelUsed: selectedModelId,
        status: 'streaming',
      };

      if (isRetry) {
        // Preserve the existing user message and replace only the failed assistant message
        setChatMessages((prev) => {
          const withoutTarget = replaceErrorMsgId
            ? prev.filter((m) => m.id !== replaceErrorMsgId)
            : prev;
          return [...withoutTarget, tempAssistantMsg];
        });
      } else {
        const tempUserMsg: ChatMessage = {
          id: tempUserMsgId,
          conversationId: targetConvId,
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
          modelUsed: selectedModelId,
          attachments,
          status: 'complete',
        };
        setChatMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
      }

      const assistantResult = await chatService.sendMessage({
        conversationId: targetConvId,
        content,
        modelId: selectedModelId,
        attachments,
        webSearch: effectiveWebSearch,
        retry: isRetry,
        signal: abortController.signal,
        tasksContext: tasks,
        projectsContext: projects,
        onMeta: (meta) => {
          if (meta.conversationId) {
            targetConvId = meta.conversationId;
            lastLoadedConvIdRef.current = meta.conversationId;
            if (meta.conversationId !== activeConversationId) {
              setActiveConversationId(meta.conversationId);
            }
          }
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsgId
                ? {
                    ...m,
                    conversationId: meta.conversationId || m.conversationId,
                    modelUsed: meta.model || m.modelUsed,
                    provider: meta.provider || m.provider,
                    webSearch: meta.webSearch || m.webSearch,
                  }
                : m
            )
          );
        },
        onChunk: (accumulated, meta) => {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsgId
                ? {
                    ...m,
                    content: accumulated,
                    modelUsed: meta?.model || m.modelUsed,
                    provider: meta?.provider || m.provider,
                    webSearch: meta?.webSearch || m.webSearch,
                  }
                : m
            )
          );
        },
      });

      const finalConvId = assistantResult?.conversationId || targetConvId;

      if (finalConvId) {
        lastLoadedConvIdRef.current = finalConvId;
        if (finalConvId !== activeConversationId) {
          setActiveConversationId(finalConvId);
        }
      }

      // Re-fetch conversations from the authenticated server API to ensure sidebar has new conversation
      try {
        const refreshedConvs = await conversationService.getConversations();
        if (Array.isArray(refreshedConvs)) {
          const userConvs = refreshedConvs.filter((c) => !isDemoConversationId(c.id));
          setConversations(userConvs);
        }
      } catch {}

      if (assistantResult?.status === 'stopped') {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantMsgId
              ? {
                  ...m,
                  content: assistantResult.content,
                  status: 'stopped',
                }
              : m
          )
        );
      } else if (finalConvId) {
        const refreshed = await chatService.getMessages(finalConvId);
        if (refreshed.length > 0) {
          setChatMessages(refreshed);
        }
      }

      const act = activityService.logActivity({
        type: 'agent_run_completed',
        title: 'AI Conversation Message',
        description: `Executed query via ${selectedModelId}: "${content.slice(0, 40)}"`,
        entityType: 'agent',
      });
      setActivities((prev) => [act, ...prev]);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to communicate with AI chat service.';
      const errDetails = (err instanceof ApiError ? err.details : {}) as Record<string, any> | undefined;
      const partialText = typeof errDetails?.partialText === 'string' ? errDetails.partialText : '';
      const errConvId = typeof errDetails?.conversationId === 'string' ? errDetails.conversationId : targetConvId;
      const errProvider = typeof errDetails?.provider === 'string' ? errDetails.provider : undefined;
      const errRetryable = errDetails?.retryable !== false;

      if (errConvId) {
        lastLoadedConvIdRef.current = errConvId;
        if (errConvId !== activeConversationId) {
          setActiveConversationId(errConvId);
        }
      }

      setApiError(errorMsg);

      // If unauthorized, forbidden, or token expired, open AuthModal for the user
      const isAuthIssue =
        (err instanceof ApiError && (err.status === 401 || err.status === 403) && err.code !== 'AUTHENTICATION_FAILED') ||
        errorMsg.toLowerCase().includes('token expired') ||
        errorMsg.toLowerCase().includes('firebase');

      if (isAuthIssue) {
        openAuthModal('login');
      }

      // Preserve the original user prompt and render a clean, retryable error card (plus any partial response)
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantMsgId
            ? {
                ...m,
                conversationId: errConvId || m.conversationId,
                content: partialText || '',
                provider: errProvider || m.provider,
                status: 'error',
                errorMessage: errorMsg,
                retryable: errRetryable,
              }
            : m
        )
      );
    } finally {
      isSendingRef.current = false;
      setIsChatStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const regenerateMessage = async (messageId: string) => {
    if (isChatStreaming || isSendingRef.current) return;

    const targetIndex = chatMessages.findIndex((m) => m.id === messageId);
    let targetUserMsg: ChatMessage | undefined;

    if (targetIndex > 0) {
      for (let i = targetIndex - 1; i >= 0; i--) {
        if (chatMessages[i].role === 'user') {
          targetUserMsg = chatMessages[i];
          break;
        }
      }
    }

    if (!targetUserMsg) {
      targetUserMsg = [...chatMessages].reverse().find((m) => m.role === 'user');
    }

    if (targetUserMsg) {
      await sendChatMessage(targetUserMsg.content, targetUserMsg.attachments || [], undefined, {
        isRetry: true,
        replaceErrorMsgId: messageId,
      });
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
    if (!firebaseUser && !isProductionEnv() && !apiClient.getAuthToken()) {
      setConversations(INITIAL_CONVERSATIONS);
      setActiveConversationId(INITIAL_CONVERSATIONS[0]?.id || '');
    } else {
      setConversations([]);
      setActiveConversationId('');
      setChatMessages([]);
    }
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
        updateUser,
        settings,
        updateSettings,
        // Firebase Authentication
        firebaseUser,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        logoutUser,
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
        isWebSearchActive,
        setWebSearchActive,
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
