import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Project, ProjectStatus, TaskPriority } from '../../types';
import { X, AlertCircle } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500' },
  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projectToEdit,
}) => {
  const { createProject, updateProject } = useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [color, setColor] = useState('indigo');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description);
      setStatus(projectToEdit.status);
      setPriority(projectToEdit.priority);
      setColor(projectToEdit.color || 'indigo');
    } else {
      setName('');
      setDescription('');
      setStatus('active');
      setPriority('medium');
      setColor('indigo');
    }
    setError(null);
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (projectToEdit) {
      updateProject(projectToEdit.id, {
        name: name.trim(),
        description: description.trim(),
        status,
        priority,
        color,
      });
    } else {
      createProject({
        name: name.trim(),
        description: description.trim(),
        status,
        priority,
        color,
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
              {projectToEdit ? 'Edit Project' : 'New Project'}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {projectToEdit ? `ID: ${projectToEdit.id}` : 'Group tasks into a strategic milestone'}
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
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Platform 2.0 Architecture"
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
              placeholder="Key objectives, scope, or delivery timeline..."
              rows={3}
              className="w-full px-3.5 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="active">Active</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

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
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Color Accent
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                    color === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

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
              {projectToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
