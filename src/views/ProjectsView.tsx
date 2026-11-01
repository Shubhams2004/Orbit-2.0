import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Project, ProjectStatus } from '../types';
import {
  Plus,
  LayoutGrid,
  List,
  FolderGit2,
  CheckCircle2,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { PriorityIndicator, StatusIndicator } from '../components/common/Indicators';
import { ProjectModal } from '../components/modals/ProjectModal';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    tasks,
    navigateToProjectDetail,
    deleteProject,
    showConfirmDialog,
  } = useWorkspace();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const handleDelete = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirmDialog({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${proj.name}"? Any associated tasks will be detached and marked as unassigned.`,
      confirmText: 'Delete Project',
      isDestructive: true,
      onConfirm: () => deleteProject(proj.id),
    });
  };

  const handleEdit = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToEdit(proj);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-neutral-800/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-100">
            Projects
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Organize roadmaps, team milestones, and track execution velocity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid / List switch */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs dark:bg-neutral-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs dark:bg-neutral-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setProjectToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 text-xs">
        {(['all', 'active', 'in_progress', 'on_hold', 'completed'] as const).map(
          (status) => {
            const count =
              status === 'all'
                ? projects.length
                : projects.filter((p) => p.status === status).length;

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold dark:bg-neutral-800 dark:border-transparent dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-900'
                }`}
              >
                <span className="capitalize">
                  {status.replace('_', ' ')}
                </span>{' '}
                <span className="font-mono text-[11px] opacity-75 tabular-nums">
                  ({count})
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Projects Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            const projTasks = tasks.filter((t) => t.projectId === proj.id);
            const completed = projTasks.filter((t) => t.status === 'done').length;
            const pending = projTasks.length - completed;
            const pct =
              projTasks.length > 0 ? Math.round((completed / projTasks.length) * 100) : 0;

            return (
              <div
                key={proj.id}
                onClick={() => navigateToProjectDetail(proj.id)}
                className="bg-white border border-slate-200 rounded-xl p-4.5 hover:border-slate-300 hover:shadow-sm dark:bg-neutral-900/60 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 transition-all cursor-pointer shadow-xs flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 dark:bg-neutral-800 dark:border-neutral-700 flex items-center justify-center shrink-0">
                        <FolderGit2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-neutral-100 dark:group-hover:text-indigo-300 transition-colors truncate">
                        {proj.name}
                      </h3>
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuId === proj.id && (
                        <div
                          className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-lg shadow-xl p-1 z-30"
                          onMouseLeave={() => setActiveMenuId(null)}
                        >
                          <button
                            onClick={(e) => handleEdit(proj, e)}
                            className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 rounded flex items-center gap-2 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={(e) => handleDelete(proj, e)}
                            className="w-full text-left px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 rounded flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {proj.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-neutral-800/80">
                  {/* Task counts */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                    <div className="flex items-center gap-3">
                      <span>
                        <strong className="text-slate-900 dark:text-neutral-200 font-mono tabular-nums">
                          {completed}
                        </strong>{' '}
                        done
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <strong className="text-slate-900 dark:text-neutral-200 font-mono tabular-nums">
                          {pending}
                        </strong>{' '}
                        pending
                      </span>
                    </div>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 tabular-nums font-medium">
                      {pct}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 w-full bg-slate-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Status & Priority footer */}
                  <div className="mt-3 flex items-center justify-between pt-1">
                    <StatusIndicator status={proj.status} />
                    <PriorityIndicator priority={proj.priority} showLabel={false} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white border border-slate-200 dark:bg-neutral-900/60 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-neutral-800/60">
          {filteredProjects.map((proj) => {
            const projTasks = tasks.filter((t) => t.projectId === proj.id);
            const completed = projTasks.filter((t) => t.status === 'done').length;
            const pct =
              projTasks.length > 0 ? Math.round((completed / projTasks.length) * 100) : 0;

            return (
              <div
                key={proj.id}
                onClick={() => navigateToProjectDetail(proj.id)}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-neutral-850/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <FolderGit2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-neutral-100 dark:group-hover:text-indigo-300 truncate">
                      {proj.name}
                    </h3>
                    <StatusIndicator status={proj.status} />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-neutral-400 line-clamp-1 mt-1 ml-7">
                    {proj.description}
                  </p>
                </div>

                <div className="flex items-center gap-6 shrink-0 text-xs">
                  <div className="w-32 hidden sm:block">
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-neutral-400 mb-1">
                      <span>Progress</span>
                      <span className="font-mono tabular-nums">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <PriorityIndicator priority={proj.priority} />
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:text-neutral-500 dark:group-hover:text-neutral-200 transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setProjectToEdit(null);
        }}
        projectToEdit={projectToEdit}
      />
    </div>
  );
};
