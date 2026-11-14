import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ModelSelector } from '../components/chat/ModelSelector';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { MessageComposer } from '../components/chat/MessageComposer';
import { ByokConnectModal } from '../components/chat/ByokConnectModal';
import { modelProviderService } from '../services/modelProviderService';
import { AiOrb } from '../components/common/AiOrb';
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
  Wand2,
  Brain,
  Search,
  CheckCheck,
} from 'lucide-react';

export const ChatTerminalView: React.FC = () => {
  const {
    user,
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
    isWebSearchActive,
    setWebSearchActive,
  } = useWorkspace();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isByokModalOpen, setIsByokModalOpen] = useState(false);
  const [byokModalProvider, setByokModalProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');

  const handleOpenByokModal = (provider?: 'gemini' | 'openai' | 'anthropic') => {
    if (provider) setByokModalProvider(provider);
    setIsByokModalOpen(true);
  };

  const modelLifecycle = useMemo(() => {
    return modelProviderService.checkModelLifecycle(selectedModelId);
  }, [selectedModelId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(chatMessages.length);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  // Smooth scroll when new message is sent or received
  useEffect(() => {
    if (chatMessages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      isNearBottomRef.current = true;
    }
    prevMessageCountRef.current = chatMessages.length;
  }, [chatMessages.length]);

  // Non-blocking RAF auto-scroll during streaming (avoids layout thrashing and respects manual scroll-up)
  useEffect(() => {
    if (!isChatStreaming || !isNearBottomRef.current) return;
    const el = messagesContainerRef.current;
    if (!el) return;

    const rafId = requestAnimationFrame(() => {
      if (isNearBottomRef.current && messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(rafId);
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
    <div className="flex h-full rounded-2xl md:rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/70 dark:bg-neutral-950/70 overflow-hidden shadow-2xl backdrop-blur-xl">
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

      {/* Main Chat Canvas (Inspiration PDF Cortex AI & ChatGPT/Claude Style) */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-50/40 dark:bg-[#121214]/60 relative">
        {/* Top Minimalist Header */}
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-neutral-900/50 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile History Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileHistoryOpen(true)}
              className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors duration-150 cursor-pointer"
              title="Open Conversation History"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Model Selector Pill */}
            <ModelSelector
              currentModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              onOpenConnectModal={handleOpenByokModal}
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
              className="min-h-[38px] px-2.5 py-1.5 text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors duration-150 flex items-center gap-1 text-xs cursor-pointer"
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
                className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors duration-150 cursor-pointer"
                title="Delete this conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* New Chat shortcut */}
            <button
              type="button"
              onClick={() => createNewConversation()}
              className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors duration-150 cursor-pointer ml-1"
              title="Start New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Model Lifecycle / Availability Warning Banner */}
        {(!modelLifecycle.isAvailable || modelLifecycle.isDeprecated) && (
          <div className="px-4 py-2.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">{modelLifecycle.notice}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {modelLifecycle.replacementId ? (
                <button
                  type="button"
                  onClick={() => setSelectedModelId(modelLifecycle.replacementId!)}
                  className="px-2.5 py-1 rounded-lg font-semibold bg-amber-600 text-white hover:bg-amber-700 text-[11px] transition-colors cursor-pointer"
                >
                  Switch to Active Model
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenByokModal()}
                  className="px-2.5 py-1 rounded-lg font-semibold bg-amber-600 text-white hover:bg-amber-700 text-[11px] transition-colors cursor-pointer"
                >
                  Connect API Key
                </button>
              )}
            </div>
          </div>
        )}

        {/* Message Stream Area with Scroll Container Hook */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6"
        >
          {chatMessages.length === 0 ? (
            /* Cortex / Prospectory Luminous AI Canvas (Inspiration PDF Pages 3, 5, 12, 13) */
            <div className="min-h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-8">
              <AiOrb size="lg" isThinking={isChatStreaming} className="mb-5" />

              <div className="space-y-1.5 mb-5">
                <span className="text-xs font-semibold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                  {user.name ? `Hello, ${user.name}` : 'Welcome Creator'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-neutral-100 tracking-tight">
                  How can I assist your workspace today?
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
                  Plan complex milestones, audit security compliance, or let Orbit formulate autonomous task executions.
                </p>
              </div>

              {/* Quick Mode / Capabilities Pills (Inspiration PDF Page 13 & Page 2) */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
                {[
                  { label: 'Live Web Search', icon: Search, prompt: 'What are the latest Cloudflare Workers and serverless AI releases in 2026?', forceWeb: true },
                  { label: 'Deeper Research', icon: Search, prompt: 'Perform a deep dive research on edge database performance and ACID transactions.' },
                  { label: 'Creative Brainstorm', icon: Wand2, prompt: 'Brainstorm 5 innovative feature additions for a SaaS productivity tool.' },
                  { label: 'Synthesize Data', icon: Brain, prompt: 'Synthesize my active workspace workload and summarize key bottlenecks.' },
                  { label: 'Check Compliance', icon: CheckCheck, prompt: 'Audit SOC 2 Type II controls and generate an audit checklist.' },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => {
                        if (pill.forceWeb) setWebSearchActive(true);
                        sendChatMessage(pill.prompt, [], pill.forceWeb);
                      }}
                      className="glass-pill min-h-[40px] px-3.5 py-2 rounded-full text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-2xs"
                    >
                      <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Clean Frosted Glass Suggestion Cards (Inspiration PDF Page 2 & 13) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {promptSuggestions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => sendChatMessage(item.title)}
                      className="glass-panel p-4 rounded-2xl text-xs transition-colors duration-150 hover:border-indigo-400/60 dark:hover:border-indigo-500/40 group cursor-pointer text-left shadow-2xs"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-colors duration-150" />
                        </div>
                        <span className="font-semibold text-slate-800 group-hover:text-slate-900 dark:text-neutral-200 dark:group-hover:text-white transition-colors duration-150">
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed pl-9">
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
                  isBusy={isChatStreaming}
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
            isWebSearchActive={isWebSearchActive}
            onToggleWebSearch={() => setWebSearchActive((prev) => !prev)}
            currentModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            onOpenConnectModal={handleOpenByokModal}
          />
        </div>
      </div>

      {/* In-Chat Compact BYOK Connection Modal */}
      <ByokConnectModal
        isOpen={isByokModalOpen}
        onClose={() => setIsByokModalOpen(false)}
        initialProvider={byokModalProvider}
        currentModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
      />
    </div>
  );
};
