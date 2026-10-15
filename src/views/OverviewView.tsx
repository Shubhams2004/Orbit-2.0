import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  FolderGit2,
  Plus,
  Bot,
  Activity as ActivityIcon,
} from 'lucide-react';
import { PriorityIndicator } from '../components/common/Indicators';

export const OverviewView: React.FC = () => {
  const {
    user,
    metrics,
    tasks,
    projects,
    activities,
    setCurrentPage,
    navigateToProjectDetail,
    toggleTaskStatus,
    openQuickCreate,
    sendAgentMessage,
    todayDateStr,
  } = useWorkspace();

  const [aiPrompt, setAiPrompt] = useState('');

  // Priority tasks: Urgent or High that are not done, ordered by due date
  const priorityTasks = tasks
    .filter((t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high'))
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 4);

  // Upcoming deadlines (next non-done tasks)
  const upcomingDeadlines = tasks
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    .slice(0, 5);

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    const promptToSend = aiPrompt;
    setAiPrompt('');
    setCurrentPage('agent');
    sendAgentMessage(promptToSend);
  };

  const runQuickPrompt = (prompt: string) => {
    setCurrentPage('agent');
    sendAgentMessage(prompt);
  };

  return (
    <div className="space-y-6">
      {/* Greeting and Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-neutral-800/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-100">
            Good morning, {user.name.split(' ')[0]}
          </h1>
          <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Wednesday, October 14, 2026</span>
            <span aria-hidden="true">·</span>
            <span>Workload Nominal</span>
          </p>
        </div>

        <button
          onClick={() => openQuickCreate('task')}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Prominent AI Assistant Command Center Entry */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-medium text-violet-400 mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Orbit AI Command Center</span>
          <span className="text-neutral-500 text-[11px]">· Simulated Local Agent</span>
        </div>

        <form onSubmit={handleAiSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask Orbit to plan your day, audit overdue items, or decompose a project..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Engage Agent</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-neutral-500 mr-1">Suggested:</span>
          {[
            'Plan my day.',
            'Find overdue tasks.',
            'Break this project into tasks.',
            'Summarize my current workload.',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => runQuickPrompt(prompt)}
              className="px-2.5 py-1 text-[11px] text-neutral-300 bg-neutral-800/80 hover:bg-neutral-800 hover:text-white rounded-md transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Core Metrics Derived Directly From Real State */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Due Today */}
        <div
          onClick={() => setCurrentPage('tasks')}
          className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Due Today</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-neutral-100 tabular-nums">
            {metrics.tasksDueToday}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Target: Oct 14</span>
            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400" />
          </div>
        </div>

        {/* Overdue */}
        <div
          onClick={() => setCurrentPage('tasks')}
          className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Overdue Tasks</span>
            <AlertCircle className={`w-4 h-4 ${metrics.overdueTasks > 0 ? 'text-rose-400' : 'text-neutral-500'}`} />
          </div>
          <div className={`mt-2 text-2xl font-bold font-mono tabular-nums ${metrics.overdueTasks > 0 ? 'text-rose-400' : 'text-neutral-100'}`}>
            {metrics.overdueTasks}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Requires triage</span>
            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400" />
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setCurrentPage('tasks')}
          className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-neutral-100 tabular-nums">
            {metrics.completedTasks}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Of {metrics.totalTasks} total</span>
            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400" />
          </div>
        </div>

        {/* Overall Completion Rate */}
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Completion Rate</span>
            <span className="font-mono text-xs text-indigo-400 tabular-nums font-semibold">
              {metrics.completionPercentage}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-neutral-100 tabular-nums">
            {metrics.completionPercentage}%
          </div>
          <div className="mt-2 w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics.completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid: Priorities & Deadlines vs Projects & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Priorities and Deadlines */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Priorities */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-100">
                  Today's Priorities
                </h2>
                <span className="text-xs text-neutral-500 font-mono tabular-nums">
                  ({priorityTasks.length})
                </span>
              </div>
              <button
                onClick={() => setCurrentPage('tasks')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 divide-y divide-neutral-800/60">
              {priorityTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500">
                  No high priority items pending. All urgent goals completed!
                </div>
              ) : (
                priorityTasks.map((t) => {
                  const isOverdue = t.dueDate && t.dueDate < todayDateStr;
                  const proj = projects.find((p) => p.id === t.projectId);

                  return (
                    <div
                      key={t.id}
                      className="py-3 flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleTaskStatus(t.id)}
                          className="mt-0.5 w-4 h-4 rounded-sm border border-neutral-600 hover:border-indigo-400 hover:bg-indigo-500/10 flex items-center justify-center shrink-0 transition-colors"
                          title="Mark complete"
                        >
                          {t.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-neutral-200 group-hover:text-white transition-colors truncate">
                            {t.title}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                            {proj && (
                              <span
                                onClick={() => navigateToProjectDetail(proj.id)}
                                className="hover:text-neutral-200 cursor-pointer text-indigo-400"
                              >
                                {proj.name}
                              </span>
                            )}
                            {proj && <span aria-hidden="true">·</span>}
                            <span
                              className={`tabular-nums font-mono ${
                                isOverdue ? 'text-rose-400 font-medium' : 'text-neutral-400'
                              }`}
                            >
                              {isOverdue ? `Overdue (${t.dueDate})` : `Due ${t.dueDate}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <PriorityIndicator priority={t.priority} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h2 className="text-sm font-semibold text-neutral-100">
                Upcoming Deadlines
              </h2>
              <span className="text-xs text-neutral-500 font-mono">Next 5 deliverables</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800/80 text-neutral-500 font-medium">
                    <th className="pb-2 font-normal">Task</th>
                    <th className="pb-2 font-normal">Project</th>
                    <th className="pb-2 font-normal">Due Date</th>
                    <th className="pb-2 font-normal text-right">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {upcomingDeadlines.map((t) => {
                    const proj = projects.find((p) => p.id === t.projectId);
                    const isOverdue = t.dueDate && t.dueDate < todayDateStr;

                    return (
                      <tr key={t.id} className="hover:bg-neutral-850/40 transition-colors">
                        <td className="py-2.5 pr-2 font-medium text-neutral-200 max-w-xs truncate">
                          {t.title}
                        </td>
                        <td className="py-2.5 pr-2 text-neutral-400 max-w-[120px] truncate">
                          {proj ? proj.name : 'Unassigned'}
                        </td>
                        <td
                          className={`py-2.5 pr-2 font-mono tabular-nums ${
                            isOverdue ? 'text-rose-400 font-medium' : 'text-neutral-400'
                          }`}
                        >
                          {t.dueDate}
                        </td>
                        <td className="py-2.5 text-right">
                          <PriorityIndicator priority={t.priority} showLabel={false} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Projects Progress & Activity Feed */}
        <div className="lg:col-span-5 space-y-6">
          {/* Projects Progress */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-neutral-100">
                  Projects Progress
                </h2>
              </div>
              <button
                onClick={() => setCurrentPage('projects')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>All Projects</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-3.5">
              {projects.slice(0, 4).map((p) => {
                const projTasks = tasks.filter((t) => t.projectId === p.id);
                const compTasks = projTasks.filter((t) => t.status === 'done').length;
                const pct =
                  projTasks.length > 0 ? Math.round((compTasks / projTasks.length) * 100) : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => navigateToProjectDetail(p.id)}
                    className="p-2.5 rounded-lg hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-200 group-hover:text-white truncate">
                        {p.name}
                      </span>
                      <span className="font-mono text-neutral-400 tabular-nums">
                        {compTasks}/{projTasks.length} ({pct}%)
                      </span>
                    </div>

                    <div className="mt-2 w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold text-neutral-100">
                  Recent Activity
                </h2>
              </div>
              <button
                onClick={() => setCurrentPage('activity')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>Timeline</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="text-xs">
                  <div className="flex items-center justify-between text-neutral-200 font-medium">
                    <span className="truncate">{act.title}</span>
                    <span className="text-[10px] text-neutral-500 font-mono tabular-nums shrink-0 ml-2">
                      {new Date(act.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                    {act.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
