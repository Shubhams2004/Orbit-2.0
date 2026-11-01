import React, { useState } from 'react';
import { ChatMessage, AgentAction } from '../../types';
import {
  Bot,
  User as UserIcon,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Paperclip,
  FileText,
  AlertTriangle,
  X,
  Square,
  ThumbsUp,
  ThumbsDown,
  Share2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  onApproveAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onRegenerate,
  onApproveAction,
  onRejectAction,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const isStopped = message.status === 'stopped';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`w-full max-w-3xl mx-auto py-2.5 px-2 sm:px-0 group animate-in fade-in duration-200 ${
        isUser ? 'flex justify-end' : 'flex justify-start'
      }`}
    >
      {/* ========================================================= */}
      {/* USER MESSAGE (ChatGPT / Claude Style Rounded Bubble)      */}
      {/* ========================================================= */}
      {isUser ? (
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[75%] space-y-1.5">
          {/* Attachments if any */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end mb-1">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 dark:bg-neutral-850 dark:border-neutral-750 dark:text-neutral-300 rounded-xl text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium truncate max-w-[140px]">{att.name}</span>
                  <span className="text-slate-500 dark:text-neutral-500 text-[10px]">({att.size})</span>
                </div>
              ))}
            </div>
          )}

          {/* User Text Bubble */}
          <div className="bg-slate-200 hover:bg-slate-300/80 text-slate-900 dark:bg-[#2f2f2f] dark:hover:bg-[#343434] dark:text-neutral-100 rounded-3xl rounded-br-md px-4.5 py-3 text-[14px] leading-relaxed shadow-xs transition-colors whitespace-pre-wrap select-text">
            {message.content}
          </div>

          <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono pr-1 tabular-nums">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      ) : (
        /* ========================================================= */
        /* ASSISTANT MESSAGE (Claude / ChatGPT Minimal Breathable)    */
        /* ========================================================= */
        <div className="flex gap-3.5 w-full text-[14px] leading-relaxed">
          {/* Clean Minimalist Assistant Icon */}
          <div className="w-7 h-7 rounded-full bg-white border border-slate-200 text-indigo-600 shadow-xs dark:bg-neutral-900 dark:border-neutral-750 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-violet-400" />
          </div>

          {/* Message Content Body */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Model Tag & Timestamp (Subtle Top Row) */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400 font-sans">
              <span className="font-semibold text-slate-900 dark:text-neutral-200">Orbit</span>
              {message.modelUsed && (
                <span className="text-[10px] text-slate-600 dark:text-neutral-400 font-mono bg-slate-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-neutral-800">
                  {message.modelUsed}
                </span>
              )}
              <span className="text-slate-400 dark:text-neutral-600">·</span>
              <span className="font-mono text-slate-500 dark:text-neutral-500 text-[10px] tabular-nums">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Markdown Content */}
            <div className="text-slate-800 dark:text-neutral-200 leading-relaxed font-sans select-text">
              <MarkdownRenderer
                content={message.content}
                isStreaming={isStreaming}
              />
            </div>

            {/* Error / Stopped State */}
            {isError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                  <span>{message.errorMessage || 'Generation failed.'}</span>
                </div>
                {onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="px-2.5 py-1 text-xs text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors font-medium cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {isStopped && (
              <div className="text-xs text-slate-500 dark:text-neutral-500 italic flex items-center gap-1.5 pt-1">
                <Square className="w-3 h-3 text-slate-400 dark:text-neutral-500" />
                <span>Response stopped</span>
              </div>
            )}

            {/* Autonomous Workspace Proposal Card (Claude Artifact Style) */}
            {message.actions && message.actions.length > 0 && (
              <div className="mt-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-neutral-300">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-violet-400" />
                  <span>Workspace Action Proposal ({message.actions.length})</span>
                </div>

                {message.actions.map((action: AgentAction) => {
                  const isApproved = action.status === 'approved';
                  const isRejected = action.status === 'rejected';

                  return (
                    <div
                      key={action.id}
                      className={`p-3.5 rounded-xl border text-xs transition-colors ${
                        isApproved
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-neutral-200'
                          : isRejected
                          ? 'bg-slate-100 border-slate-200 text-slate-400 line-through dark:bg-neutral-900/40 dark:border-neutral-800 dark:text-neutral-400'
                          : 'bg-white border-slate-200 text-slate-900 shadow-xs dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold flex items-center gap-2 text-slate-900 dark:text-neutral-100">
                            <span>{action.title}</span>
                            {isApproved && (
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-1.5 py-0.5 rounded border not-italic">
                                APPLIED
                              </span>
                            )}
                            {isRejected && (
                              <span className="text-[10px] font-mono text-slate-600 bg-slate-200 dark:text-neutral-400 dark:bg-neutral-800 px-1.5 py-0.5 rounded not-italic">
                                REJECTED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-neutral-400 mt-1 leading-relaxed">
                            {action.description}
                          </p>
                        </div>

                        {action.status === 'proposed' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onRejectAction && (
                              <button
                                type="button"
                                onClick={() => onRejectAction(action.id)}
                                className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-neutral-400 dark:hover:text-white dark:bg-neutral-800 dark:hover:bg-neutral-750 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Dismiss</span>
                              </button>
                            )}
                            {onApproveAction && (
                              <button
                                type="button"
                                onClick={() => onApproveAction(action.id)}
                                className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Apply</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quiet Action Toolbar (Claude / ChatGPT Hover Style) */}
            {!isStreaming && (
              <div className="flex items-center gap-1 pt-1 opacity-70 group-hover:opacity-100 transition-opacity text-slate-500 dark:text-neutral-400 text-xs">
                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-850 rounded-lg transition-colors cursor-pointer"
                  title="Copy response"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Regenerate Button */}
                {onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="p-1.5 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-850 rounded-lg transition-colors cursor-pointer"
                    title="Regenerate response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Thumbs Up Feedback */}
                <button
                  type="button"
                  onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    feedback === 'up'
                      ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40'
                      : 'hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-850'
                  }`}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>

                {/* Thumbs Down Feedback */}
                <button
                  type="button"
                  onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    feedback === 'down'
                      ? 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40'
                      : 'hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-850'
                  }`}
                  title="Poor response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
