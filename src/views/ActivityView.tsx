import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ActivityEvent, ActivityEventType } from '../types';
import {
  CheckCircle2,
  Clock,
  PlusCircle,
  FolderGit2,
  Bot,
  Trash2,
  Check,
  Filter,
  Calendar,
} from 'lucide-react';

export const ActivityView: React.FC = () => {
  const { activities } = useWorkspace();
  const [filterType, setFilterType] = useState<'all' | 'task' | 'project' | 'agent'>('all');

  const filteredActivities = activities.filter((act) => {
    if (filterType === 'all') return true;
    return act.entityType === filterType;
  });

  const getEventIcon = (type: ActivityEventType) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'task_created':
        return <PlusCircle className="w-4 h-4 text-sky-400" />;
      case 'task_deleted':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      case 'project_created':
      case 'project_updated':
        return <FolderGit2 className="w-4 h-4 text-indigo-400" />;
      case 'agent_run_completed':
        return <Bot className="w-4 h-4 text-violet-400" />;
      case 'agent_action_approved':
        return <Check className="w-4 h-4 text-emerald-400" />;
      default:
        return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-800/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">
            Activity Timeline
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Audit trail of workspace interactions, completed goals, and agent workflow dispatches.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
          {(['all', 'task', 'project', 'agent'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterType(filter)}
              className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                filterType === filter
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {filter === 'all' ? 'All Activity' : `${filter}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 shadow-xs">
        {filteredActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No activity events recorded for this filter.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-neutral-800">
            {filteredActivities.map((act) => {
              const eventDate = new Date(act.timestamp);
              const formattedDate = eventDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = eventDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={act.id} className="relative group">
                  {/* Dot / Icon */}
                  <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                    {getEventIcon(act.type)}
                  </div>

                  <div className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-200 group-hover:text-white transition-colors">
                          {act.title}
                        </span>
                        {act.isMockDevelopment && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                            Seed Data
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-neutral-400 tabular-nums shrink-0">
                        {formattedDate} · {formattedTime}
                      </div>
                    </div>

                    <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
