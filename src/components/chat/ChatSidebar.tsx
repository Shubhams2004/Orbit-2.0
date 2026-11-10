import React, { useState } from 'react';
import { Conversation } from '../../types';
import {
  Plus,
  MessageSquare,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const saveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  // Collapsed Minimal Strip
  if (isCollapsed) {
    return (
      <div className="h-full w-14 bg-white border-r border-slate-200 dark:bg-neutral-950 dark:border-neutral-800/80 p-2 flex flex-col items-center justify-between select-none">
        <div className="space-y-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-850 rounded-lg transition-colors cursor-pointer"
            title="Expand chat history"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNewConversation}
            className="p-2 text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs cursor-pointer"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-64 sm:w-68 bg-white border-r border-slate-200 dark:bg-neutral-950 dark:border-neutral-800/80 flex flex-col justify-between select-none font-sans text-xs">
      <div className="p-3 flex-1 flex flex-col min-h-0">
        {/* Top: + New Chat Pill Button (ChatGPT / Claude Style) */}
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={onNewConversation}
            className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-900 font-medium transition-colors shadow-xs group dark:bg-neutral-900 dark:hover:bg-neutral-850 dark:border-neutral-800 dark:text-neutral-200 dark:hover:text-white cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:text-neutral-400 dark:group-hover:text-white transition-colors" />
              <span>New chat</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono hidden sm:inline">⌘N</span>
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-850 rounded-xl transition-colors shrink-0 cursor-pointer"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search input (if > 3 conversations) */}
        {conversations.length > 3 && (
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500 dark:focus:border-neutral-600 transition-colors"
            />
          </div>
        )}

        {/* Section Label */}
        <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
          Recent Chats
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-neutral-500 text-xs">
              {searchQuery ? 'No matching conversations' : 'No chats yet'}
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 min-h-[40px] rounded-xl cursor-pointer transition-colors duration-150 ${
                    isActive
                      ? 'bg-indigo-50 border border-indigo-200/60 text-indigo-900 font-medium dark:bg-neutral-850 dark:border-transparent dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-900/60'
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => saveRename(conv.id, e)}
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        autoFocus
                        className="flex-1 px-2 py-0.5 bg-white dark:bg-neutral-900 border border-indigo-500 rounded text-xs text-slate-900 dark:text-white focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-400'}`} />
                        <span className="truncate text-xs">{conv.title}</span>
                      </div>

                      {/* Hover action buttons (Rename, Delete) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => startRename(conv, e)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:text-neutral-400 dark:hover:text-white rounded dark:hover:bg-neutral-800 cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:text-neutral-400 dark:hover:text-rose-400 rounded dark:hover:bg-neutral-800 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Profile Strip */}
      <div className="p-3 border-t border-slate-200 dark:border-neutral-800/80 flex items-center justify-between text-slate-600 dark:text-neutral-400">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-600/30 dark:border-indigo-500/40 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
            O
          </div>
          <div className="min-w-0 truncate">
            <span className="text-xs text-slate-900 dark:text-neutral-200 font-semibold truncate block">Orbit Workspace</span>
            <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono block">Llama 3.1 Fast</span>
          </div>
        </div>
      </div>
    </div>
  );
};
