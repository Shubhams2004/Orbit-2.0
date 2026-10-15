import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { TaskPriority, TaskStatus, ProjectStatus } from '../../types';
import { X, CheckSquare, FolderGit2, AlertCircle } from 'lucide-react';

export const QuickCreateModal: React.FC = () => {
  const {
    isQuickCreateOpen,
    quickCreateInitialType,
    closeQuickCreate,
    createTask,
    createProject,
    projects,
    settings,
    todayDateStr,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'task' | 'project'>('task');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskDueDate, setTaskDueDate] = useState(todayDateStr);

  // Project form state
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projStatus, setProjStatus] = useState<ProjectStatus>('active');
  const [projPriority, setProjPriority] = useState<TaskPriority>('medium');
  const [projColor, setProjColor] = useState('indigo');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isQuickCreateOpen) {
      setActiveTab(quickCreateInitialType);
      setTaskTitle('');
      setTaskDesc('');
      setTaskProjectId(null);
      setTaskPriority(settings.defaultTaskPriority || 'medium');
      setTaskStatus('todo');
      setTaskDueDate(todayDateStr);

      setProjName('');
      setProjDesc('');
      setProjStatus('active');
      setProjPriority('medium');
      setProjColor('indigo');

      setError(null);
    }
  }, [isQuickCreateOpen, quickCreateInitialType, settings.defaultTaskPriority, todayDateStr]);

  if (!isQuickCreateOpen) return null;

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setError('Please provide a task title');
      return;
    }

    createTask({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      projectId: taskProjectId,
      priority: taskPriority,
      status: taskStatus,
      dueDate: taskDueDate || null,
    });

    closeQuickCreate();
  };

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) {
      setError('Please provide a project name');
      return;
    }

    createProject({
      name: projName.trim(),
      description: projDesc.trim(),
      status: projStatus,
      priority: projPriority,
      color: projColor,
    });

    closeQuickCreate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 text-neutral-100 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('task');
                setError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'task'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('project');
                setError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'project'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          </div>

          <button
            onClick={closeQuickCreate}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'task' ? (
          <form onSubmit={handleTaskSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => {
                  setTaskTitle(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="What needs to be done?"
                autoFocus
                className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Description
              </label>
              <textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Add details, criteria or notes..."
                rows={2}
                className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Project
                </label>
                <select
                  value={taskProjectId || ''}
                  onChange={(e) => setTaskProjectId(e.target.value || null)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="">Unassigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Status
                </label>
                <select
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={closeQuickCreate}
                className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Create Task
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleProjectSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={projName}
                onChange={(e) => {
                  setProjName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. SOC2 Type II Certification"
                autoFocus
                className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Description
              </label>
              <textarea
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                placeholder="Scope, goal, and outcome..."
                rows={2}
                className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Status
                </label>
                <select
                  value={projStatus}
                  onChange={(e) => setProjStatus(e.target.value as ProjectStatus)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="active">Active</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Priority
                </label>
                <select
                  value={projPriority}
                  onChange={(e) => setProjPriority(e.target.value as TaskPriority)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={closeQuickCreate}
                className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Create Project
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
