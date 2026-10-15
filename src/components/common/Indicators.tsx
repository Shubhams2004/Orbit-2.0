import React from 'react';
import { TaskPriority, TaskStatus, ProjectStatus } from '../../types';
import { AlertCircle, AlertTriangle, ArrowUp, ArrowDown, CheckCircle2, Clock, Circle } from 'lucide-react';

interface PriorityIndicatorProps {
  priority: TaskPriority;
  showLabel?: boolean;
  className?: string;
}

export const PriorityIndicator: React.FC<PriorityIndicatorProps> = ({
  priority,
  showLabel = true,
  className = '',
}) => {
  const config = {
    urgent: {
      label: 'Urgent',
      icon: AlertCircle,
      textColor: 'text-rose-500 dark:text-rose-400',
    },
    high: {
      label: 'High',
      icon: ArrowUp,
      textColor: 'text-amber-500 dark:text-amber-400',
    },
    medium: {
      label: 'Medium',
      icon: ArrowUp,
      textColor: 'text-indigo-500 dark:text-indigo-400',
    },
    low: {
      label: 'Low',
      icon: ArrowDown,
      textColor: 'text-neutral-500 dark:text-neutral-400',
    },
  }[priority];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.textColor} ${className}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

interface StatusIndicatorProps {
  status: TaskStatus | ProjectStatus;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, className = '' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'done':
      case 'completed':
        return {
          label: status === 'done' ? 'Done' : 'Completed',
          icon: CheckCircle2,
          color: 'text-emerald-500 dark:text-emerald-400',
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          icon: Clock,
          color: 'text-sky-500 dark:text-sky-400',
        };
      case 'on_hold':
        return {
          label: 'On Hold',
          icon: AlertTriangle,
          color: 'text-amber-500 dark:text-amber-400',
        };
      case 'active':
        return {
          label: 'Active',
          icon: Circle,
          color: 'text-emerald-500 dark:text-emerald-400',
        };
      case 'todo':
      default:
        return {
          label: 'To Do',
          icon: Circle,
          color: 'text-neutral-400 dark:text-neutral-500',
        };
    }
  };

  const { label, icon: Icon, color } = getStatusConfig();

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color} ${className}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};
