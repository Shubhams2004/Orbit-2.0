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
  Globe,
  ExternalLink,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageItemProps {
  message: ChatMessage;
  isBusy?: boolean;
  onRegenerate?: () => void;
  onApproveAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
}

const ChatMessageItemComponent: React.FC<ChatMessageItemProps> = ({
  message,
  isBusy = false,
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
      className={`w-full max-w-3xl mx-auto py-2.5 px-2 sm:px-0 group ${
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
          <div className="bg-slate-200 hover:bg-slate-300/80 text-slate-900 dark:bg-[#2f2f2f] dark:hover:bg-[#343434] dark:text-neutral-100 rounded-3xl rounded-br-md px-4.5 py-3 sm:px-5 sm:py-3.5 text-[15px] sm:text-[16px] leading-[1.6] shadow-xs transition-colors duration-150 whitespace-pre-wrap select-text">
            {message.content}
          </div>

          <span className="text-[11px] text-slate-500 dark:text-neutral-500 font-mono pr-1 tabular-nums">
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
        <div className="flex gap-3 sm:gap-4 w-full text-[15px] sm:text-[16px] leading-[1.6]">
          {/* Clean Minimalist Assistant Icon */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 text-indigo-600 shadow-xs dark:bg-neutral-900 dark:border-neutral-750 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-violet-400" />
          </div>

          {/* Message Content Body */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Model Tag, Web Intelligence Indicator & Timestamp (Subtle Top Row) */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400 font-sans">
              <span className="font-semibold text-slate-900 dark:text-neutral-200">Orbit</span>
              {message.modelUsed && (
                <span className="text-[10px] text-slate-600 dark:text-neutral-400 font-mono bg-slate-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-neutral-800">
                  {message.modelUsed}
                </span>
              )}
              {message.webSearch?.triggered && (
                <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                  <Globe className="w-3 h-3" />
                  <span>
                    {message.webSearch.sourcesCount > 0
                      ? `Web Verified (${message.webSearch.sourcesCount} sources)`
                      : 'Live Search'}
                  </span>
                  {message.webSearch.cached && (
                    <span className="text-[9px] text-slate-400 dark:text-neutral-500 font-mono">· cached</span>
                  )}
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

            {/* Markdown Content or Initial Streaming Connection Indicator */}
            {(message.content.trim().length > 0 || isStreaming) && (
              <div className="text-slate-800 dark:text-neutral-200 leading-relaxed font-sans select-text">
                {isStreaming && message.content.trim().length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400 py-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span>Connecting to {message.modelUsed || 'model'}...</span>
                  </div>
                ) : (
                  <MarkdownRenderer
                    content={message.content}
                    isStreaming={isStreaming}
                  />
                )}
              </div>
            )}

            {/* Grounded Web Evidence Sources (Inspiration PDF tactile glass cards) */}
            {message.webSearch && message.webSearch.sources && message.webSearch.sources.length > 0 && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-neutral-800/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-2">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Grounded Sources ({message.webSearch.sources.length})</span>
                  {message.webSearch.retrievedAt && (
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono font-normal">
                      · {new Date(message.webSearch.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {message.webSearch.sources.map((src, idx) => (
                    <a
                      key={src.url + idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass-panel p-3 rounded-xl border border-slate-200/80 dark:border-neutral-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors duration-150 group flex items-start gap-2 shadow-2xs"
                    >
                      <div className="w-5 h-5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150 truncate">
                          {src.title}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate mt-0.5">
                          {src.url.replace(/^https?:\/\//, '')}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:text-neutral-500 dark:group-hover:text-neutral-300 shrink-0 mt-1" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Error / Stopped State */}
            {isError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-[13px]">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-medium leading-relaxed">
                      {message.errorMessage || 'Generation failed. Please try again.'}
                    </div>
                    {message.content.trim().length > 0 && (
                      <div className="text-[11px] text-rose-600/80 dark:text-rose-300/80">
                        Partial response preserved above.
                      </div>
                    )}
                  </div>
                </div>
                {onRegenerate && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onRegenerate}
                    className="min-h-[36px] px-3.5 py-1.5 text-xs text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 font-medium cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
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
                      className={`p-3.5 rounded-xl border text-xs transition-colors duration-150 ${
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
                                className="min-h-[36px] px-3 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-neutral-400 dark:hover:text-white dark:bg-neutral-800 dark:hover:bg-neutral-750 rounded-lg transition-colors duration-150 flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>Dismiss</span>
                              </button>
                            )}
                            {onApproveAction && (
                              <button
                                type="button"
                                onClick={() => onApproveAction(action.id)}
                                className="min-h-[36px] px-3.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors duration-150 flex items-center gap-1 shadow-xs cursor-pointer"
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
              <div className="flex items-center gap-1 pt-1 opacity-75 group-hover:opacity-100 transition-opacity duration-150 text-slate-500 dark:text-neutral-400 text-xs">
                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] p-2 sm:p-1.5 flex items-center justify-center hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-850 rounded-lg transition-colors duration-150 cursor-pointer"
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
                    className="min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] p-2 sm:p-1.5 flex items-center justify-center hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-850 rounded-lg transition-colors duration-150 cursor-pointer"
                    title="Regenerate response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Thumbs Up Feedback */}
                <button
                  type="button"
                  onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                  className={`min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] p-2 sm:p-1.5 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer ${
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
                  className={`min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] p-2 sm:p-1.5 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer ${
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

export const ChatMessageItem = React.memo(ChatMessageItemComponent);
