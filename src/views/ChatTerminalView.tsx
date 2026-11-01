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
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  Compass,
  Code2,
  ListTodo,
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
      title: 'Plan a 2-week MVP sprint',
      subtitle: 'Break down milestones, user stories, and priority deliverables',
      icon: ListTodo,
    },
    {
      title: 'Audit SOC 2 Type II compliance',
      subtitle: 'Review access control, perimeter security, and audit retention',
      icon: Compass,
    },
    {
      title: 'Decompose project into tasks',
      subtitle: 'Generate actionable engineering items with realistic due dates',
      icon: Code2,
    },
    {
      title: 'Triage active workspace workload',
      subtitle: 'Find overdue bottlenecks and auto-calculate resolution plans',
      icon: Clock,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)] rounded-2xl border border-slate-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 overflow-hidden shadow-2xl">
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

      {/* Main Chat Canvas (ChatGPT / Claude Style) */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-50/50 dark:bg-[#171717] relative">
        {/* Top Minimalist Header */}
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200 dark:border-neutral-800/60 bg-white/90 dark:bg-[#171717]/90 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile History Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileHistoryOpen(true)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              title="Open Conversation History"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Model Selector Pill */}
            <ModelSelector
              currentModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
            />

            <span className="text-slate-300 dark:text-neutral-700 hidden sm:inline">/</span>

            <span className="text-xs text-slate-600 dark:text-neutral-400 truncate hidden sm:inline font-medium max-w-[200px]">
              {activeConversation?.title || 'New Chat'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Share / Copy thread link */}
            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 text-xs"
              title="Share thread"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] hidden sm:inline font-medium">Copied</span>
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
                className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                title="Delete this conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* New Chat shortcut */}
            <button
              type="button"
              onClick={() => createNewConversation()}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors ml-1"
              title="Start New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {chatMessages.length === 0 ? (
            /* Claude / ChatGPT Signature Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-12 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-indigo-600 dark:bg-neutral-900 dark:border-neutral-750 dark:text-indigo-400 flex items-center justify-center shadow-md mb-4">
                <Sparkles className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-neutral-100 tracking-tight font-sans">
                Where should we begin?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 mt-2 max-w-md leading-relaxed font-sans">
                Ask Orbit to structure a project roadmap, triage pending tasks, or brainstorm architecture solutions.
              </p>

              {/* Clean Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full text-left">
                {promptSuggestions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => sendChatMessage(item.title)}
                      className="p-4 rounded-2xl bg-white hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300 dark:bg-neutral-900/60 dark:hover:bg-neutral-850 dark:border-neutral-800 dark:hover:border-neutral-700 text-xs transition-all group cursor-pointer shadow-2xs text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" />
                        <span className="font-semibold text-slate-800 group-hover:text-slate-900 dark:text-neutral-200 dark:group-hover:text-white transition-colors">
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed">
                        {item.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto w-full">
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
            </div>
          )}
        </div>

        {/* Floating Bottom Composer with Gradient Backing */}
        <div className="p-4 sm:px-6 bg-linear-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#171717] dark:via-[#171717]/95 dark:to-transparent shrink-0">
          <MessageComposer
            onSendMessage={sendChatMessage}
            onStopGeneration={stopChatGeneration}
            isStreaming={isChatStreaming}
          />
        </div>
      </div>
    </div>
  );
};
