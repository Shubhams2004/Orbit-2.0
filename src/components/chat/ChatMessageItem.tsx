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
      className={`flex gap-3 text-xs leading-relaxed group animate-in fade-in duration-150 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800 text-violet-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <Bot className="w-4 h-4" />
        </div>
      )}

      {/* Main Message Box */}
      <div
        className={`max-w-3xl rounded-xl p-4 transition-colors ${
          isUser
            ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/80 shadow-xs'
            : 'bg-neutral-900/90 text-neutral-200 border border-neutral-800 shadow-xs'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-neutral-800/80 text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200">
              {isUser ? 'You' : 'Orbit Assistant'}
            </span>
            {message.modelUsed && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-950 border border-neutral-800 text-neutral-400">
                {message.modelUsed}
              </span>
            )}
          </div>

          <span className="font-mono tabular-nums text-[10px] text-neutral-500">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* User Attachments (if any) */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-950/80 border border-neutral-700 rounded-md text-[11px] text-neutral-300"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium">{att.name}</span>
                <span className="text-neutral-500 text-[10px]">({att.size})</span>
              </div>
            ))}
          </div>
        )}

        {/* Content Body with Markdown and Code Blocks */}
        <MarkdownRenderer
          content={message.content}
          isStreaming={isStreaming}
        />

        {/* Error / Stopped State */}
        {isError && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{message.errorMessage || 'Generation failed.'}</span>
            </div>
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="px-2 py-1 text-xs text-white bg-rose-600 hover:bg-rose-500 rounded transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {isStopped && (
          <div className="mt-2 text-[11px] text-neutral-500 italic flex items-center gap-1">
            <Square className="w-3 h-3 text-neutral-500" />
            <span>Generation stopped</span>
          </div>
        )}

        {/* Proposed Agent Actions Container */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-200">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Autonomous Workspace Proposal ({message.actions.length})</span>
            </div>

            {message.actions.map((action: AgentAction) => {
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
                      : 'bg-neutral-950/80 border-violet-900/40 text-neutral-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <span>{action.title}</span>
                        {isApproved && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 not-italic">
                            APPLIED TO WORKSPACE
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.2 rounded not-italic">
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onRejectAction && (
                          <button
                            type="button"
                            onClick={() => onRejectAction(action.id)}
                            className="px-2 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-1"
                            title="Reject proposed changes"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        )}
                        {onApproveAction && (
                          <button
                            type="button"
                            onClick={() => onApproveAction(action.id)}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-md transition-colors flex items-center gap-1 shadow-xs"
                            title="Approve and apply changes to workspace"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve & Apply</span>
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

        {/* Message Actions Footer (Copy, Regenerate) */}
        {!isStreaming && !isUser && (
          <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
                title="Copy response text"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
                  title="Regenerate this response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>

            <span className="text-[10px] text-neutral-500">
              Prototype Mock Response
            </span>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <UserIcon className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
