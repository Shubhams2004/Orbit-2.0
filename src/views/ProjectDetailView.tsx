import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Task, TaskPriority, TaskStatus } from '../types';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  MoreVertical,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { PriorityIndicator, StatusIndicator } from '../components/common/Indicators';
import { TaskModal } from '../components/modals/TaskModal';
import { ProjectModal } from '../components/modals/ProjectModal';

export const ProjectDetailView: React.FC = () => {
  const {
    selectedProjectId,
    projects,
    tasks,
    setCurrentPage,
    deleteProject,
    toggleTaskStatus,
    deleteTask,
    updateTask,
    showConfirmDialog,
    todayDateStr,
  } = useWorkspace();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === selectedProjectId);

  if (!project) {
    return (
      <div className="py-12 text-center text-xs text-neutral-500">
        Project not found.
        <div className="mt-3">
          <button
            onClick={() => setCurrentPage('projects')}
            className="px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-lg"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const completed = projectTasks.filter((t) => t.status === 'done').length;
  const pending = projectTasks.length - completed;
  const pct =
    projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;

  const handleDeleteProject = () => {
    showConfirmDialog({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${project.name}"? All ${projectTasks.length} associated tasks will be preserved and moved to unassigned.`,
      confirmText: 'Delete Project',
      isDestructive: true,
      onConfirm: () => deleteProject(project.id),
    });
  };

  const handleDeleteTask = (task: Task) => {
    showConfirmDialog({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"?`,
      confirmText: 'Delete Task',
      isDestructive: true,
      onConfirm: () => deleteTask(task.id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800/60">
        <button
          onClick={() => setCurrentPage('projects')}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 dark:text-neutral-300 dark:hover:text-white dark:bg-neutral-900 dark:border-neutral-800 dark:hover:bg-neutral-850 rounded-lg shadow-xs transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Project</span>
          </button>
          <button
            onClick={handleDeleteProject}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:bg-rose-500/10 rounded-lg shadow-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Project Meta Card */}
      <div className="bg-white border border-slate-200 text-slate-900 dark:bg-neutral-900/60 dark:border-neutral-800 dark:text-neutral-100 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-100 truncate">
                {project.name}
              </h1>
              <StatusIndicator status={project.status} />
            </div>
            <p className="text-xs text-slate-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
              {project.description || 'No description provided.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <PriorityIndicator priority={project.priority} />
          </div>
        </div>

        {/* Progress & KPIs */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-neutral-500 block">Total Deliverables</span>
            <span className="text-base font-bold font-mono text-slate-900 dark:text-neutral-100 tabular-nums">
              {projectTasks.length}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-neutral-500 block">Completed</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {completed}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-neutral-500 block">Pending</span>
            <span className="text-base font-bold font-mono text-slate-700 dark:text-neutral-300 tabular-nums">
              {pending}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-neutral-500 block">Overall Progress</span>
            <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
              {pct}%
            </span>
          </div>
        </div>

        <div className="mt-3 w-full bg-slate-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Associated Tasks Section */}
      <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Project Tasks</h2>
            <span className="text-xs text-slate-500 dark:text-neutral-500 font-mono tabular-nums">
              ({projectTasks.length})
            </span>
          </div>

          <button
            onClick={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task to Project</span>
          </button>
        </div>

        {projectTasks.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-neutral-500">
            No tasks assigned to this project yet.
            <div className="mt-3">
              <button
                onClick={() => {
                  setTaskToEdit(null);
                  setIsTaskModalOpen(true);
                }}
                className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Create First Task
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-neutral-800/60">
            {projectTasks.map((task) => {
              const isOverdue =
                task.dueDate && task.dueDate < todayDateStr && task.status !== 'done';

              return (
                <div
                  key={task.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-neutral-850/40 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(task.id)}
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                        task.status === 'done'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-indigo-500 dark:border-neutral-600 dark:hover:border-indigo-400'
                      }`}
                    >
                      {task.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <span
                        onClick={() => {
                          setTaskToEdit(task);
                          setIsTaskModalOpen(true);
                        }}
                        className={`text-xs font-medium cursor-pointer hover:underline truncate ${
                          task.status === 'done'
                            ? 'line-through text-slate-400 dark:text-neutral-500'
                            : 'text-slate-800 group-hover:text-slate-900 dark:text-neutral-200 dark:group-hover:text-white'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500 dark:text-neutral-400">
                    {/* Status dropdown */}
                    <select
                      value={task.status}
                      onChange={(e) =>
                        updateTask(task.id, { status: e.target.value as TaskStatus })
                      }
                      className="px-2 py-0.5 text-[11px] bg-slate-50 border border-slate-300 dark:bg-neutral-950 dark:border-neutral-800 rounded text-slate-800 dark:text-neutral-300"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>

                    {/* Due date */}
                    {task.dueDate && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-neutral-400'
                        }`}
                      >
                        {isOverdue ? `Overdue ${task.dueDate}` : task.dueDate}
                      </span>
                    )}

                    <PriorityIndicator priority={task.priority} showLabel={false} />

                    {/* Actions */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuTaskId(
                            activeMenuTaskId === task.id ? null : task.id
                          )
                        }
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-white rounded dark:hover:bg-neutral-800 transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuTaskId === task.id && (
                        <div
                          className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-lg shadow-xl p-1 z-30"
                          onMouseLeave={() => setActiveMenuTaskId(null)}
                        >
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              setTaskToEdit(task);
                              setIsTaskModalOpen(true);
                            }}
                            className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              // Move to unassigned
                              updateTask(task.id, { projectId: null });
                            }}
                            className="w-full text-left px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 rounded"
                          >
                            Unassign
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              handleDeleteTask(task);
                            }}
                            className="w-full text-left px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        defaultProjectId={project.id}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projectToEdit={project}
      />
    </div>
  );
};
