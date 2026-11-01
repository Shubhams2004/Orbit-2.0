import React from 'react';
import { useWorkspace, PageView } from '../../context/WorkspaceContext';
import {
  LayoutDashboard,
  CheckSquare,
  FolderGit2,
  Bot,
  Activity,
  Settings,
  X,
  Plus,
  Globe,
} from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  const { currentPage, setCurrentPage, tasks, projects, user, openQuickCreate } = useWorkspace();

  if (!isOpen) return null;

  const pendingTaskCount = tasks.filter((t) => t.status !== 'done').length;

  const navItems: Array<{
    id: PageView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare, count: pendingTaskCount },
    { id: 'projects', label: 'Projects', icon: FolderGit2, count: projects.length },
    { id: 'agent', label: 'AI Chat', icon: Bot },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'landing', label: 'Landing Page', icon: Globe },
  ];

  const handleNav = (page: PageView) => {
    setCurrentPage(page);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative w-72 max-w-[80vw] bg-white border-r border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 h-full p-4 flex flex-col justify-between text-slate-800 dark:text-neutral-200 z-10 shadow-2xl">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                O
              </div>
              <span className="font-semibold text-sm text-slate-900 dark:text-neutral-100">Orbit 2.0</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <button
              onClick={() => {
                onClose();
                openQuickCreate('task');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>

          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentPage === item.id ||
                (item.id === 'projects' && currentPage === 'project_detail');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-neutral-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-850'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[11px] font-mono text-slate-400 dark:text-neutral-500 tabular-nums">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-neutral-800 flex items-center gap-3">
          <img
            src={user.avatarUrl}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-300 dark:ring-neutral-700"
          />
          <div className="min-w-0 flex-1 truncate">
            <div className="text-xs font-medium text-slate-800 dark:text-neutral-200 truncate">{user.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-neutral-500 truncate">{user.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
