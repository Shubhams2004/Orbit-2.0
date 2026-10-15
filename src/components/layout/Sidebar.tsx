import React, { useState } from 'react';
import { useWorkspace, PageView } from '../../context/WorkspaceContext';
import {
  LayoutDashboard,
  CheckSquare,
  FolderGit2,
  Bot,
  Activity,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onNavigateMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  onNavigateMobile,
}) => {
  const {
    currentPage,
    setCurrentPage,
    tasks,
    projects,
    user,
    openQuickCreate,
    settings,
  } = useWorkspace();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const pendingTaskCount = tasks.filter((t) => t.status !== 'done').length;

  const navItems: Array<{
    id: PageView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tasks', label: 'My Tasks', icon: CheckSquare, count: pendingTaskCount },
    { id: 'projects', label: 'Projects', icon: FolderGit2, count: projects.length },
    { id: 'agent', label: 'AI Chat', icon: Bot },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (page: PageView) => {
    setCurrentPage(page);
    if (onNavigateMobile) onNavigateMobile();
  };

  return (
    <aside
      className={`h-full flex flex-col justify-between border-r transition-all duration-200 select-none ${
        settings.theme === 'dark'
          ? 'bg-neutral-950 border-neutral-800/80 text-neutral-300'
          : 'bg-white border-neutral-200 text-neutral-700'
      } ${isCollapsed ? 'w-18' : 'w-64'}`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-14 px-4 flex items-center justify-between border-b border-neutral-800/60">
          <div
            onClick={() => handleNavClick('overview')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0 tracking-tight">
              O
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <span className="font-semibold text-sm tracking-tight text-neutral-100 dark:text-neutral-100 light:text-neutral-900">
                  Orbit
                </span>
                <span className="ml-1 text-[11px] font-mono font-medium text-indigo-400">
                  2.0
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800/60 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Create Action */}
        <div className="p-3">
          <button
            onClick={() => openQuickCreate('task')}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs ${
              isCollapsed ? 'px-0' : ''
            }`}
            title="Create Task (Ctrl/Cmd+N)"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>New Task</span>}
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="px-2 space-y-0.5 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.id ||
              (item.id === 'projects' && currentPage === 'project_detail');

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-neutral-800/80 text-white font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                }`}
                title={item.label}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-400' : 'text-neutral-400'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className="text-[11px] font-mono text-neutral-400 tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile Card */}
      <div className="p-3 border-t border-neutral-800/60 relative">
        <div
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`flex items-center gap-3 p-1.5 rounded-lg hover:bg-neutral-800/60 cursor-pointer transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <img
            src={user.avatarUrl}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-neutral-700"
          />
          {!isCollapsed && (
            <div className="min-w-0 flex-1 truncate text-left">
              <div className="text-xs font-medium text-neutral-200 truncate">
                {user.name}
              </div>
              <div className="text-[11px] text-neutral-400 truncate">
                {user.role}
              </div>
            </div>
          )}
        </div>

        {/* User Popover Menu */}
        {isUserMenuOpen && (
          <div
            className="absolute bottom-16 left-3 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl p-2 text-xs text-neutral-200 z-50 animate-in fade-in zoom-in-95"
            onMouseLeave={() => setIsUserMenuOpen(false)}
          >
            <div className="px-2.5 py-1.5 border-b border-neutral-800 text-[11px] text-neutral-400">
              Signed in as <span className="text-neutral-200 font-medium">{user.email}</span>
            </div>
            <button
              onClick={() => {
                setIsUserMenuOpen(false);
                handleNavClick('settings');
              }}
              className="w-full text-left px-2.5 py-2 mt-1 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-between"
            >
              <span>Preferences</span>
              <Settings className="w-3.5 h-3.5 text-neutral-400" />
            </button>
            <a
              href="https://workers.cloudflare.com"
              target="_blank"
              rel="noreferrer"
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-between"
            >
              <span>Cloudflare Architecture</span>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
            </a>
            <div className="my-1 border-t border-neutral-800" />
            <button
              onClick={() => {
                setIsUserMenuOpen(false);
                alert('Session locked. Orbit is ready for Cloudflare Workers Auth in next milestone.');
              }}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 flex items-center justify-between"
            >
              <span>Lock Session</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
