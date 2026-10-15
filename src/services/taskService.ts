import { Task, TaskPriority, TaskStatus } from '../types';
import { apiClient } from './apiClient';

export interface CreateTaskDTO {
  title: string;
  description?: string;
  projectId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  projectId?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
}

export interface ITaskService {
  getTasks(params?: { status?: string; priority?: string; projectId?: string }): Promise<Task[]>;
  getTaskById(id: string): Promise<Task>;
  createTask(dto: CreateTaskDTO): Promise<Task>;
  updateTask(id: string, dto: UpdateTaskDTO): Promise<Task>;
  deleteTask(id: string): Promise<boolean>;
  toggleTaskStatus(id: string, currentStatus: TaskStatus): Promise<Task>;
}

/**
 * Production API Task Service
 * Dispatches real HTTP requests to Cloudflare Workers API (/api/v1/tasks).
 */
export class ApiTaskService implements ITaskService {
  async getTasks(params?: { status?: string; priority?: string; projectId?: string }): Promise<Task[]> {
    return apiClient.get<Task[]>('/api/v1/tasks', params);
  }

  async getTaskById(id: string): Promise<Task> {
    return apiClient.get<Task>(`/api/v1/tasks/${id}`);
  }

  async createTask(dto: CreateTaskDTO): Promise<Task> {
    return apiClient.post<Task>('/api/v1/tasks', {
      title: dto.title,
      description: dto.description || '',
      projectId: dto.projectId,
      priority: dto.priority || 'medium',
      status: dto.status || 'todo',
      dueDate: dto.dueDate || null,
    });
  }

  async updateTask(id: string, dto: UpdateTaskDTO): Promise<Task> {
    return apiClient.patch<Task>(`/api/v1/tasks/${id}`, dto);
  }

  async deleteTask(id: string): Promise<boolean> {
    await apiClient.delete(`/api/v1/tasks/${id}`);
    return true;
  }

  async toggleTaskStatus(id: string, currentStatus: TaskStatus): Promise<Task> {
    const nextStatus: TaskStatus = currentStatus === 'done' ? 'todo' : 'done';
    return this.updateTask(id, { status: nextStatus });
  }
}

/**
 * Mock Task Service for local fallback/testing
 */
export class MockTaskService implements ITaskService {
  async getTasks(): Promise<Task[]> {
    return [];
  }

  async getTaskById(id: string): Promise<Task> {
    return {
      id,
      title: 'Mock Task',
      description: '',
      projectId: null,
      priority: 'medium',
      status: 'todo',
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createTask(dto: CreateTaskDTO): Promise<Task> {
    const now = new Date().toISOString();
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      projectId: dto.projectId !== undefined ? dto.projectId : null,
      priority: dto.priority || 'medium',
      status: dto.status || 'todo',
      dueDate: dto.dueDate || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateTask(id: string, dto: UpdateTaskDTO): Promise<Task> {
    const now = new Date().toISOString();
    return {
      id,
      title: dto.title ?? '',
      description: dto.description ?? '',
      projectId: dto.projectId ?? null,
      priority: dto.priority ?? 'medium',
      status: dto.status ?? 'todo',
      dueDate: dto.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteTask(_id: string): Promise<boolean> {
    return true;
  }

  async toggleTaskStatus(id: string, currentStatus: TaskStatus): Promise<Task> {
    return {
      id,
      title: '',
      description: '',
      projectId: null,
      priority: 'medium',
      status: currentStatus === 'done' ? 'todo' : 'done',
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const taskService: ITaskService = new ApiTaskService();
