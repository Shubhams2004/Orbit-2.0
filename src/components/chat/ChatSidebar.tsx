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
  Pin,
  ChevronLeft,
  ChevronRight,
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

  if (isCollapsed) {
    return (
      <div className="h-full w-14 bg-neutral-950 border-r border-neutral-800/80 p-2 flex flex-col items-center justify-between select-none">
        <div className="space-y-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-850 transition-colors"
            title="Expand chat history"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNewConversation}
            className="p-2 text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
            title="New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-64 sm:w-72 bg-neutral-950 border-r border-neutral-800/80 flex flex-col justify-between select-none">
      <div className="p-3 flex-1 flex flex-col min-h-0">
        {/* Header & New Chat Button */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-neutral-200">Conversations</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewConversation}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
              title="New Conversation (Ctrl/Cmd+Shift+O)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-850"
              title="Collapse history"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter / Search input */}
        <div className="my-2.5 relative">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 mt-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No conversations found.
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => !isEditing && onSelectConversation(conv.id)}
                  className={`group px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-neutral-850 text-white font-medium border border-neutral-750'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-violet-400' : 'text-neutral-500'
                      }`}
                    />

                    {isEditing ? (
                      <form
                        onSubmit={(e) => saveRename(conv.id, e)}
                        className="flex items-center gap-1 min-w-0 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-xs bg-neutral-950 border border-indigo-500 rounded text-neutral-100 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={(e) => saveRename(conv.id, e)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1 text-neutral-400 hover:text-neutral-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <span className="truncate">{conv.title}</span>
                    )}
                  </div>

                  {/* Actions (visible on hover or active) */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => startRename(conv, e)}
                        className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                        title="Rename conversation"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="p-1 text-neutral-400 hover:text-rose-400 rounded hover:bg-neutral-800"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-neutral-800/80 text-[11px] text-neutral-500 flex items-center justify-between">
        <span>{conversations.length} total threads</span>
        <span className="font-mono">Local Storage</span>
      </div>
    </div>
  );
};
