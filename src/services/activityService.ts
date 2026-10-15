import { ActivityEvent, ActivityEventType } from '../types';

export interface LogActivityDTO {
  type: ActivityEventType;
  title: string;
  description: string;
  entityId?: string;
  entityType?: 'task' | 'project' | 'agent';
}

export interface IActivityService {
  logActivity(dto: LogActivityDTO): ActivityEvent;
}

export class MockActivityService implements IActivityService {
  logActivity(dto: LogActivityDTO): ActivityEvent {
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      timestamp: new Date().toISOString(),
      entityId: dto.entityId,
      entityType: dto.entityType,
      isMockDevelopment: false,
    };
  }
}

export const activityService = new MockActivityService();
