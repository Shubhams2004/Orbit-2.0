import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  Search,
  CheckSquare,
  FolderGit2,
  Bot,
  Activity,
  Settings,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import { PriorityIndicator } from '../common/Indicators';

export const CommandPaletteModal: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setCurrentPage,
    navigateToProjectDetail,
    tasks,
    projects,
    sendAgentMessage,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Results computation
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: Array<{
      id: string;
      category: 'Pages' | 'Tasks' | 'Projects' | 'AI Commands';
      title: string;
      subtitle?: string;
      icon: React.ReactNode;
      onSelect: () => void;
      meta?: React.ReactNode;
    }> = [];

    // AI suggestions if query is typed
    if (q) {
      items.push({
        id: 'ai_query',
        category: 'AI Commands',
        title: `Ask Orbit Agent: "${query}"`,
        subtitle: 'Run autonomous workflow via local simulated agent',
        icon: <Bot className="w-4 h-4 text-violet-400" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          setCurrentPage('agent');
          sendAgentMessage(query);
        },
      });
    }

    // Matching tasks
    const matchedTasks = tasks
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
      .slice(0, 5);

    matchedTasks.forEach((t) => {
      items.push({
        id: `task_${t.id}`,
        category: 'Tasks',
        title: t.title,
        subtitle: t.dueDate ? `Due ${t.dueDate} · Status: ${t.status}` : `Status: ${t.status}`,
        icon: <CheckSquare className="w-4 h-4 text-neutral-400" />,
        meta: <PriorityIndicator priority={t.priority} showLabel={false} />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          setCurrentPage('tasks');
        },
      });
    });

    // Matching projects
    const matchedProjects = projects
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
      .slice(0, 4);

    matchedProjects.forEach((p) => {
      items.push({
        id: `proj_${p.id}`,
        category: 'Projects',
        title: p.name,
        subtitle: p.description,
        icon: <FolderGit2 className="w-4 h-4 text-indigo-400" />,
        onSelect: () => {
          setCommandPaletteOpen(false);
          navigateToProjectDetail(p.id);
        },
      });
    });

    // Navigation pages
    const pages = [
      { name: 'Overview', page: 'overview' as const, icon: LayoutDashboard },
      { name: 'My Tasks', page: 'tasks' as const, icon: CheckSquare },
      { name: 'Projects', page: 'projects' as const, icon: FolderGit2 },
      { name: 'AI Agent Workspace', page: 'agent' as const, icon: Bot },
      { name: 'Activity Timeline', page: 'activity' as const, icon: Activity },
      { name: 'Workspace Settings', page: 'settings' as const, icon: Settings },
    ];

    pages
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .forEach((p) => {
        const IconComponent = p.icon;
        items.push({
          id: `page_${p.page}`,
          category: 'Pages',
          title: `Go to ${p.name}`,
          icon: <IconComponent className="w-4 h-4 text-neutral-400" />,
          onSelect: () => {
            setCommandPaletteOpen(false);
            setCurrentPage(p.page);
          },
        });
      });

    return items;
  }, [query, tasks, projects, setCurrentPage, navigateToProjectDetail, setCommandPaletteOpen, sendAgentMessage]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % (results.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden text-neutral-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-800 gap-3">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, pages, or ask the agent..."
            className="w-full text-sm bg-transparent border-0 text-neutral-100 placeholder-neutral-500 focus:outline-hidden"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No matching tasks or commands found.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-300 hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="truncate">
                      <div className="font-medium truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.meta}
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-neutral-800/80 bg-neutral-950/40 text-[11px] text-neutral-500 flex items-center justify-between">
          <span>Navigate with ↑ / ↓</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
};
