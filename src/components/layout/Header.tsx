import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  Menu,
  ChevronRight,
  Check,
  ExternalLink,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    currentPage,
    setCurrentPage,
    selectedProjectId,
    projects,
    settings,
    updateSettings,
    setCommandPaletteOpen,
    openQuickCreate,
    activities,
    user,
    firebaseUser,
    openAuthModal,
    logoutUser,
  } = useWorkspace();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [readActivityIds, setReadActivityIds] = useState<Set<string>>(new Set());

  // Determine breadcrumb label
  const getBreadcrumb = () => {
    switch (currentPage) {
      case 'overview':
        return 'Overview';
      case 'tasks':
        return 'My Tasks';
      case 'projects':
        return 'Projects';
      case 'project_detail': {
        const proj = projects.find((p) => p.id === selectedProjectId);
        return proj ? proj.name : 'Project Details';
      }
      case 'agent':
        return 'AI Chat Terminal';
      case 'activity':
        return 'Activity Timeline';
      case 'settings':
        return 'Settings';
      default:
        return 'Workspace';
    }
  };

  const unreadActivities = activities.filter((a) => !readActivityIds.has(a.id));

  const markAllRead = () => {
    setReadActivityIds(new Set(activities.map((a) => a.id)));
  };

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-30 select-none">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-neutral-400 truncate">
          <span
            onClick={() => setCurrentPage('overview')}
            className="hover:text-neutral-200 cursor-pointer hidden sm:inline"
          >
            Orbit
          </span>
          <ChevronRight className="w-3.5 h-3.5 hidden sm:inline text-neutral-600" />
          {currentPage === 'project_detail' && (
            <>
              <span
                onClick={() => setCurrentPage('projects')}
                className="hover:text-neutral-200 cursor-pointer"
              >
                Projects
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
            </>
          )}
          <span className="font-semibold text-neutral-100 truncate">
            {getBreadcrumb()}
          </span>
        </div>
      </div>

      {/* Middle: Global Search Trigger */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-neutral-400 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
            <span>Search tasks, projects, or ask agent...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-neutral-500 bg-neutral-950 border border-neutral-800 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions, Notifications, Theme, User */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Mobile search trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="sm:hidden p-2 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors"
          title="Search (⌘K)"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Quick Create Button */}
        <button
          onClick={() => openQuickCreate('task')}
          className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5"
          title="Create task"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">New</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800/80 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadActivities.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
            )}
          </button>

          {isNotificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-3 text-xs text-neutral-200 z-50 animate-in fade-in zoom-in-95"
              onMouseLeave={() => setIsNotificationsOpen(false)}
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                <span className="font-semibold text-neutral-100">Notifications</span>
                {unreadActivities.length > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {activities.slice(0, 5).map((act) => {
                  const isUnread = !readActivityIds.has(act.id);
                  return (
                    <div
                      key={act.id}
                      onClick={() => {
                        setReadActivityIds((prev) => new Set([...prev, act.id]));
                        setCurrentPage('activity');
                        setIsNotificationsOpen(false);
                      }}
                      className={`p-2 rounded-lg cursor-pointer transition-colors ${
                        isUnread ? 'bg-neutral-800/80' : 'hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="font-medium text-neutral-100 flex items-center justify-between">
                        <span className="truncate">{act.title}</span>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 ml-2" />
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 line-clamp-2 mt-0.5">
                        {act.description}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-1 font-mono tabular-nums">
                        {new Date(act.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setIsNotificationsOpen(false);
                  setCurrentPage('activity');
                }}
                className="w-full text-center pt-2 mt-2 border-t border-neutral-800 text-[11px] text-neutral-400 hover:text-neutral-200 block"
              >
                View all activity timeline →
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800/80 transition-colors"
          title={`Switch to ${settings.theme === 'dark' ? 'Light' : 'Dark'} theme`}
        >
          {settings.theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-neutral-600" />
          )}
        </button>

        {/* Authentication Action / User Profile */}
        {firebaseUser ? (
          <div className="flex items-center gap-2 ml-1">
            <div
              onClick={() => setCurrentPage('settings')}
              className="cursor-pointer shrink-0 flex items-center gap-2 group"
              title={`Signed in as ${firebaseUser.email}`}
            >
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover ring-1 ring-neutral-700 group-hover:ring-indigo-500 transition-all"
              />
              <span className="text-xs font-medium text-neutral-300 group-hover:text-white hidden lg:inline max-w-[120px] truncate">
                {user.name}
              </span>
            </div>
            <button
              onClick={() => logoutUser()}
              className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-neutral-800/80 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
