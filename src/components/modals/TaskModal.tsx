import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { X, Calendar, AlertCircle, FolderGit2 } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  defaultProjectId?: string | null;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultProjectId = null,
}) => {
  const { createTask, updateTask, projects, settings, todayDateStr } = useWorkspace();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState<string>(todayDateStr);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setProjectId(taskToEdit.projectId);
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setDueDate(taskToEdit.dueDate || todayDateStr);
    } else {
      setTitle('');
      setDescription('');
      setProjectId(defaultProjectId);
      setPriority(settings.defaultTaskPriority || 'medium');
      setStatus('todo');
      setDueDate(todayDateStr);
    }
    setError(null);
  }, [taskToEdit, defaultProjectId, settings.defaultTaskPriority, todayDateStr, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    if (taskToEdit) {
      updateTask(taskToEdit.id, {
        title: title.trim(),
        description: description.trim(),
        projectId,
        priority,
        status,
        dueDate: dueDate || null,
      });
    } else {
      createTask({
        title: title.trim(),
        description: description.trim(),
        projectId,
        priority,
        status,
        dueDate: dueDate || null,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 text-neutral-100 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              {taskToEdit ? 'Edit Task' : 'New Task'}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {taskToEdit ? `ID: ${taskToEdit.id}` : 'Create a tracked deliverable'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Audit SOC2 key rotation rules"
              autoFocus
              className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add relevant context, checklists, or links..."
              rows={3}
              className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-neutral-400" />
                Project
              </label>
              <select
                value={projectId || ''}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
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
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {taskToEdit && (
            <div className="pt-2 text-[11px] text-neutral-500 flex items-center justify-between border-t border-neutral-800/60">
              <span>Created {new Date(taskToEdit.createdAt).toLocaleDateString()}</span>
              <span>Updated {new Date(taskToEdit.updatedAt).toLocaleDateString()}</span>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
