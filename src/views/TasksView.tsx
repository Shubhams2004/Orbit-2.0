import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Task, TaskPriority, TaskStatus } from '../types';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  LayoutList,
  Kanban,
  CheckCircle2,
  Circle,
  Clock,
  MoreVertical,
  Trash2,
  Edit2,
  Calendar,
  AlertCircle,
  FolderGit2,
} from 'lucide-react';
import { PriorityIndicator } from '../components/common/Indicators';
import { TaskModal } from '../components/modals/TaskModal';

type SortOption = 'dueDate' | 'priority' | 'createdAt';
type ViewMode = 'list' | 'board';

export const TasksView: React.FC = () => {
  const {
    tasks,
    projects,
    toggleTaskStatus,
    updateTask,
    deleteTask,
    showConfirmDialog,
    todayDateStr,
    settings,
  } = useWorkspace();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(settings.defaultTaskView || 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Active menu state
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

  // Priority ranking for sorting
  const priorityRank: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Filtered & Sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Search filter
        if (
          searchQuery &&
          !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !task.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'all' && task.status !== statusFilter) {
          return false;
        }

        // Priority filter
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
          return false;
        }

        // Project filter
        if (projectFilter === 'unassigned' && task.projectId !== null) {
          return false;
        } else if (
          projectFilter !== 'all' &&
          projectFilter !== 'unassigned' &&
          task.projectId !== projectFilter
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'dueDate') {
          if (!a.dueDate) diff = 1;
          else if (!b.dueDate) diff = -1;
          else diff = a.dueDate.localeCompare(b.dueDate);
        } else if (sortBy === 'priority') {
          diff = priorityRank[b.priority] - priorityRank[a.priority];
        } else if (sortBy === 'createdAt') {
          diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [tasks, searchQuery, statusFilter, priorityFilter, projectFilter, sortBy, sortOrder]);

  const handleDeleteTask = (task: Task) => {
    showConfirmDialog({
      title: 'Delete Task',
      message: `Are you sure you want to permanently delete "${task.title}"? This action cannot be undone.`,
      confirmText: 'Delete Task',
      isDestructive: true,
      onConfirm: () => deleteTask(task.id),
    });
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleCreateTask = () => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-800/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">
            My Tasks
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage your daily workflow, status pipelines, and deliverable commitments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="List View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Board View"
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tasks by keyword..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 text-xs"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-neutral-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 text-xs focus:outline-hidden"
            >
              <option value="all">All</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-neutral-500">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 text-xs focus:outline-hidden"
            >
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Project filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-neutral-500">Project:</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 text-xs focus:outline-hidden max-w-[130px] truncate"
            >
              <option value="all">All Projects</option>
              <option value="unassigned">Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 border-l border-neutral-800 pl-2">
            <span className="text-[11px] text-neutral-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 text-xs focus:outline-hidden"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="createdAt">Created</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 text-neutral-400 hover:text-white rounded bg-neutral-950 border border-neutral-800"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: List View OR Board View */}
      {viewMode === 'list' ? (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No tasks match your current filter criteria.
              <div className="mt-3">
                <button
                  onClick={handleCreateTask}
                  className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
                >
                  Create New Task
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/60">
              {filteredTasks.map((task) => {
                const isOverdue =
                  task.dueDate && task.dueDate < todayDateStr && task.status !== 'done';
                const proj = projects.find((p) => p.id === task.projectId);

                return (
                  <div
                    key={task.id}
                    className="p-3.5 hover:bg-neutral-850/50 transition-colors flex items-center justify-between gap-4 group"
                  >
                    {/* Checkbox and Title */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleTaskStatus(task.id)}
                        className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
                          task.status === 'done'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-neutral-600 hover:border-indigo-400'
                        }`}
                        title={task.status === 'done' ? 'Mark Incomplete' : 'Mark Complete'}
                      >
                        {task.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => handleEditTask(task)}
                            className={`text-xs font-medium cursor-pointer hover:underline truncate ${
                              task.status === 'done'
                                ? 'line-through text-neutral-500'
                                : 'text-neutral-200 group-hover:text-white'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata tags: Project, Due Date, Priority */}
                    <div className="flex items-center gap-4 shrink-0 text-xs text-neutral-400">
                      {/* Project info */}
                      <span className="hidden sm:inline-block text-[11px] max-w-[120px] truncate text-neutral-400">
                        {proj ? proj.name : 'Unassigned'}
                      </span>

                      {/* Due date */}
                      {task.dueDate && (
                        <div
                          className={`flex items-center gap-1 font-mono text-[11px] tabular-nums ${
                            isOverdue ? 'text-rose-400 font-semibold' : 'text-neutral-400'
                          }`}
                        >
                          {isOverdue && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
                          <span>{isOverdue ? `Overdue ${task.dueDate}` : task.dueDate}</span>
                        </div>
                      )}

                      {/* Priority */}
                      <PriorityIndicator priority={task.priority} />

                      {/* Row Actions Menu */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenuTaskId(activeMenuTaskId === task.id ? null : task.id)
                          }
                          className="p-1 text-neutral-400 hover:text-neutral-200 rounded hover:bg-neutral-800"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {activeMenuTaskId === task.id && (
                          <div
                            className="absolute right-0 mt-1 w-36 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-1 z-30"
                            onMouseLeave={() => setActiveMenuTaskId(null)}
                          >
                            <button
                              onClick={() => {
                                setActiveMenuTaskId(null);
                                handleEditTask(task);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 rounded flex items-center gap-2"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit Task</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuTaskId(null);
                                handleDeleteTask(task);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded flex items-center gap-2"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
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
      ) : (
        /* Board View (Kanban columns: Todo, In Progress, Done) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((colStatus) => {
            const columnTasks = filteredTasks.filter((t) => t.status === colStatus);
            const colTitle =
              colStatus === 'todo'
                ? 'To Do'
                : colStatus === 'in_progress'
                ? 'In Progress'
                : 'Done';

            return (
              <div
                key={colStatus}
                className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 flex flex-col min-h-[450px]"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800/80 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-200">
                      {colTitle}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500 tabular-nums">
                      ({columnTasks.length})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setTaskToEdit(null);
                      setIsTaskModalOpen(true);
                    }}
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                    title="Add task to this column"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-neutral-500 border border-dashed border-neutral-800/80 rounded-lg">
                      No tasks in {colTitle}
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const isOverdue =
                        task.dueDate && task.dueDate < todayDateStr && task.status !== 'done';
                      const proj = projects.find((p) => p.id === task.projectId);

                      return (
                        <div
                          key={task.id}
                          className="p-3 bg-neutral-950/80 border border-neutral-800/90 rounded-lg hover:border-neutral-700 transition-colors shadow-2xs group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              onClick={() => handleEditTask(task)}
                              className="text-xs font-medium text-neutral-200 hover:text-white cursor-pointer line-clamp-2"
                            >
                              {task.title}
                            </span>
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setActiveMenuTaskId(
                                    activeMenuTaskId === task.id ? null : task.id
                                  )
                                }
                                className="p-1 text-neutral-500 hover:text-neutral-300 rounded"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </button>

                              {activeMenuTaskId === task.id && (
                                <div
                                  className="absolute right-0 mt-1 w-32 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl p-1 z-30"
                                  onMouseLeave={() => setActiveMenuTaskId(null)}
                                >
                                  <button
                                    onClick={() => {
                                      setActiveMenuTaskId(null);
                                      handleEditTask(task);
                                    }}
                                    className="w-full text-left px-2 py-1 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 rounded"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuTaskId(null);
                                      handleDeleteTask(task);
                                    }}
                                    className="w-full text-left px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-3 pt-2 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400">
                            <span className="truncate max-w-[90px]">
                              {proj ? proj.name : 'Unassigned'}
                            </span>
                            <div className="flex items-center gap-2">
                              {task.dueDate && (
                                <span
                                  className={`font-mono tabular-nums ${
                                    isOverdue ? 'text-rose-400 font-semibold' : ''
                                  }`}
                                >
                                  {task.dueDate.slice(5)}
                                </span>
                              )}
                              <PriorityIndicator priority={task.priority} showLabel={false} />
                            </div>
                          </div>

                          {/* Quick Column State mover */}
                          <div className="mt-2 pt-1 flex items-center justify-between text-[10px] text-neutral-500">
                            <span>Move to:</span>
                            <div className="flex items-center gap-1">
                              {colStatus !== 'todo' && (
                                <button
                                  onClick={() => updateTask(task.id, { status: 'todo' })}
                                  className="px-1.5 py-0.5 hover:text-neutral-300 hover:bg-neutral-800 rounded"
                                >
                                  To Do
                                </button>
                              )}
                              {colStatus !== 'in_progress' && (
                                <button
                                  onClick={() => updateTask(task.id, { status: 'in_progress' })}
                                  className="px-1.5 py-0.5 hover:text-neutral-300 hover:bg-neutral-800 rounded"
                                >
                                  Progress
                                </button>
                              )}
                              {colStatus !== 'done' && (
                                <button
                                  onClick={() => updateTask(task.id, { status: 'done' })}
                                  className="px-1.5 py-0.5 hover:text-emerald-400 hover:bg-neutral-800 rounded"
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Edit / Create Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
      />
    </div>
  );
};
