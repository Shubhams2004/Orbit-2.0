import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ModelSelector } from '../components/chat/ModelSelector';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { MessageComposer } from '../components/chat/MessageComposer';
import {
  Sparkles,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  Share2,
  Check,
  FolderGit2,
  Calendar,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const ChatTerminalView: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    activeConversation,
    chatMessages,
    isChatStreaming,
    selectedModelId,
    setSelectedModelId,
    selectConversation,
    createNewConversation,
    renameConversation,
    deleteConversation,
    sendChatMessage,
    stopChatGeneration,
    regenerateMessage,
    approveChatAction,
    rejectChatAction,
    showConfirmDialog,
  } = useWorkspace();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages update or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatStreaming]);

  const handleDeleteConversation = (id: string) => {
    const target = conversations.find((c) => c.id === id);
    showConfirmDialog({
      title: 'Delete Conversation',
      message: `Are you sure you want to delete "${target?.title || 'this conversation'}"? This action cannot be undone.`,
      confirmText: 'Delete Conversation',
      isDestructive: true,
      onConfirm: () => deleteConversation(id),
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const promptSuggestions = [
    {
      label: 'Summarize my pending tasks',
      desc: 'Audit active workloads and overdue deliverables',
    },
    {
      label: 'Create a project plan',
      desc: 'Deconstruct a strategic goal into milestone tracks',
    },
    {
      label: 'Break this goal into actionable tasks',
      desc: 'Formulate leaf deliverables ready for team assignees',
    },
    {
      label: 'Find overdue tasks & suggest resolution',
      desc: 'Auto-calculate rescheduling proposal with SLA rules',
    },
  ];

  return (
    <div className="flex h-[calc(100vh-6.5rem)] rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
      {/* Desktop Conversation History Sidebar */}
      <div className="hidden md:block shrink-0 h-full">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={selectConversation}
          onNewConversation={() => createNewConversation()}
          onRenameConversation={renameConversation}
          onDeleteConversation={handleDeleteConversation}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Mobile Drawer for Conversation History */}
      {isMobileHistoryOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setIsMobileHistoryOpen(false)}
          />
          <div className="relative z-10 w-72 h-full shadow-2xl">
            <ChatSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={(id) => {
                selectConversation(id);
                setIsMobileHistoryOpen(false);
              }}
              onNewConversation={() => {
                createNewConversation();
                setIsMobileHistoryOpen(false);
              }}
              onRenameConversation={renameConversation}
              onDeleteConversation={handleDeleteConversation}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileHistoryOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-neutral-950/60">
        {/* Chat Header Bar */}
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile History Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileHistoryOpen(true)}
              className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-850"
              title="Open Conversation History"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Model Selector Dropdown */}
            <ModelSelector
              currentModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
            />

            <span className="hidden sm:inline text-neutral-700 font-mono">/</span>

            <span className="text-xs text-neutral-400 truncate hidden sm:inline font-medium">
              {activeConversation?.title || 'New Conversation'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Share / Copy thread link */}
            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-850 transition-colors flex items-center gap-1 text-xs"
              title="Share thread"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px] hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* Delete conversation */}
            {activeConversation && (
              <button
                type="button"
                onClick={() => handleDeleteConversation(activeConversation.id)}
                className="p-1.5 text-neutral-400 hover:text-rose-400 rounded-lg hover:bg-neutral-850 transition-colors"
                title="Delete this conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* New Chat shortcut */}
            <button
              type="button"
              onClick={() => createNewConversation()}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-850 transition-colors ml-1"
              title="Start New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream Canvas */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {chatMessages.length === 0 ? (
            /* Empty State Hero (ChatGPT / Claude style) */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-violet-950 border border-violet-800 text-violet-300 flex items-center justify-center shadow-lg mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-neutral-100 tracking-tight">
                How can Orbit assist you today?
              </h2>
              <p className="text-xs text-neutral-400 mt-1 max-w-md leading-relaxed">
                Connect your thoughts, manage deliverables, or invoke autonomous agent tools
                to schedule and audit your workspace.
              </p>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full text-left">
                {promptSuggestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => sendChatMessage(item.label)}
                    className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-xs transition-colors group cursor-pointer"
                  >
                    <div className="font-semibold text-neutral-200 group-hover:text-white transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chatMessages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  onRegenerate={() => regenerateMessage(msg.id)}
                  onApproveAction={approveChatAction}
                  onRejectAction={rejectChatAction}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Multiline Composer Footer */}
        <div className="p-4 sm:px-6 bg-neutral-950/90 border-t border-neutral-800/80 shrink-0">
          <div className="max-w-4xl mx-auto">
            <MessageComposer
              onSendMessage={sendChatMessage}
              onStopGeneration={stopChatGeneration}
              isStreaming={isChatStreaming}
            />

            <div className="mt-2 text-center text-[10px] text-neutral-500">
              Orbit 2.0 AI Terminal · Responses are simulated for this prototype phase · No external API keys required
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
