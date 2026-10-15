import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { AgentMessage, AgentAction } from '../types';
import {
  Bot,
  User as UserIcon,
  Send,
  Sparkles,
  Check,
  X,
  Clock,
  Terminal,
  Cpu,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

export const AgentView: React.FC = () => {
  const {
    agentMessages,
    sendAgentMessage,
    isAgentThinking,
    approveAgentAction,
    rejectAgentAction,
    tasks,
    projects,
  } = useWorkspace();

  const [inputContent, setInputContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages, isAgentThinking]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim() || isAgentThinking) return;

    const message = inputContent;
    setInputContent('');
    await sendAgentMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const promptSuggestions = [
    'Plan my day.',
    'Find overdue tasks.',
    'Break this project into tasks.',
    'Summarize my current workload.',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Workspace Subheader & Simulation Transparency Notice */}
      <div className="pb-3 border-b border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-100">
              AI Agent Workspace
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
              Simulated Autonomous Mode
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Local simulated responses architected for upcoming Cloudflare Workers & D1 edge execution.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Cpu className="w-3.5 h-3.5 text-neutral-400" />
          <span>Local Engine · Zero External API Latency</span>
        </div>
      </div>

      {/* Message History Canvas */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {agentMessages.map((msg: AgentMessage) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs leading-relaxed ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800 text-violet-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-xl p-4 ${
                  isUser
                    ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                    : 'bg-neutral-900/90 text-neutral-200 border border-neutral-800'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-neutral-800/80 text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-300">
                    {isUser ? 'You' : 'Orbit Agent'}
                  </span>
                  <span className="font-mono tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Content with basic markdown-style paragraph rendering */}
                <div className="space-y-2 whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Proposed Actions Container */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-800 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-300">
                      <Terminal className="w-3.5 h-3.5 text-violet-400" />
                      <span>Proposed Action Pipeline ({msg.actions.length})</span>
                    </div>

                    {msg.actions.map((action: AgentAction) => {
                      const isApproved = action.status === 'approved';
                      const isRejected = action.status === 'rejected';

                      return (
                        <div
                          key={action.id}
                          className={`p-3 rounded-lg border text-xs transition-colors ${
                            isApproved
                              ? 'bg-emerald-950/20 border-emerald-800/50 text-neutral-200'
                              : isRejected
                              ? 'bg-neutral-950/40 border-neutral-800/50 text-neutral-400 line-through'
                              : 'bg-neutral-950/70 border-violet-900/40 text-neutral-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold flex items-center gap-2">
                                <span>{action.title}</span>
                                {isApproved && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 not-italic">
                                    APPLIED
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded not-italic">
                                    REJECTED
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                                {action.description}
                              </p>
                            </div>

                            {/* Human-in-the-loop Controls */}
                            {action.status === 'proposed' && (
                              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                <button
                                  type="button"
                                  onClick={() => rejectAgentAction(action.id)}
                                  className="px-2 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-1"
                                  title="Reject proposed changes"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => approveAgentAction(action.id)}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-md transition-colors flex items-center gap-1 shadow-xs"
                                  title="Approve and apply changes to workspace"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isAgentThinking && (
          <div className="flex gap-3 text-xs justify-start animate-in fade-in duration-200">
            <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800 text-violet-300 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-neutral-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              <span>Analyzing workspace context & synthesizing plan...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="pt-2 pb-1.5 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-neutral-500 mr-1">Quick prompts:</span>
          {promptSuggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isAgentThinking}
              onClick={() => sendAgentMessage(prompt)}
              className="px-2.5 py-1 text-[11px] text-neutral-300 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-md transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="pt-2 shrink-0">
        <form
          onSubmit={handleSend}
          className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-2.5 shadow-lg relative focus-within:border-violet-500 transition-colors"
        >
          <textarea
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your command or request (Enter to send, Shift+Enter for new line)..."
            rows={2}
            className="w-full text-xs sm:text-sm bg-transparent border-0 text-neutral-100 placeholder-neutral-500 focus:outline-hidden resize-none pr-12 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[11px] text-neutral-500">
            <div className="flex items-center gap-2">
              <span>Press <kbd className="font-mono text-neutral-400">Enter</kbd> to execute</span>
              <span aria-hidden="true">·</span>
              <span><kbd className="font-mono text-neutral-400">Shift+Enter</kbd> for newline</span>
            </div>

            <button
              type="submit"
              disabled={!inputContent.trim() || isAgentThinking}
              className="p-1.5 text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 rounded-lg transition-colors cursor-pointer"
              title="Send to agent"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
