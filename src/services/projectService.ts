import { Project, ProjectStatus, TaskPriority } from '../types';
import { apiClient } from './apiClient';

export interface CreateProjectDTO {
  name: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  priority?: TaskPriority;
}

export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  priority?: TaskPriority;
}

export interface IProjectService {
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project>;
  createProject(dto: CreateProjectDTO): Promise<Project>;
  updateProject(id: string, dto: UpdateProjectDTO): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;
}

/**
 * Production API Project Service
 * Dispatches real HTTP requests to Cloudflare Workers API (/api/v1/projects).
 */
export class ApiProjectService implements IProjectService {
  async getProjects(): Promise<Project[]> {
    return apiClient.get<Project[]>('/api/v1/projects');
  }

  async getProjectById(id: string): Promise<Project> {
    return apiClient.get<Project>(`/api/v1/projects/${id}`);
  }

  async createProject(dto: CreateProjectDTO): Promise<Project> {
    return apiClient.post<Project>('/api/v1/projects', {
      name: dto.name,
      description: dto.description || '',
      color: dto.color || 'indigo',
      status: dto.status || 'active',
      priority: dto.priority || 'medium',
    });
  }

  async updateProject(id: string, dto: UpdateProjectDTO): Promise<Project> {
    return apiClient.patch<Project>(`/api/v1/projects/${id}`, dto);
  }

  async deleteProject(id: string): Promise<boolean> {
    await apiClient.delete(`/api/v1/projects/${id}`);
    return true;
  }
}

/**
 * Mock Project Service for local fallback/testing
 */
export class MockProjectService implements IProjectService {
  async getProjects(): Promise<Project[]> {
    return [];
  }

  async getProjectById(id: string): Promise<Project> {
    return {
      id,
      name: 'Mock Project',
      description: '',
      color: 'indigo',
      status: 'active',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async createProject(dto: CreateProjectDTO): Promise<Project> {
    const now = new Date().toISOString();
    return {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      color: dto.color || 'indigo',
      status: dto.status || 'active',
      priority: dto.priority || 'medium',
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateProject(id: string, dto: UpdateProjectDTO): Promise<Project> {
    const now = new Date().toISOString();
    return {
      id,
      name: dto.name || '',
      description: dto.description || '',
      color: dto.color || 'indigo',
      status: dto.status || 'active',
      priority: dto.priority || 'medium',
      createdAt: now,
      updatedAt: now,
    };
  }

  async deleteProject(_id: string): Promise<boolean> {
    return true;
  }
}

export const projectService: IProjectService = new ApiProjectService();
