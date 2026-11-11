import React, { useState, useRef, useEffect } from 'react';
import { ChatAttachment } from '../../types';
import {
  ArrowUp,
  Square,
  Paperclip,
  X,
  FileCode,
  FileText,
  Sparkles,
  Globe,
} from 'lucide-react';

import { ModelSelector } from './ModelSelector';

interface MessageComposerProps {
  onSendMessage: (content: string, attachments: ChatAttachment[]) => void;
  onStopGeneration: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  isWebSearchActive?: boolean;
  onToggleWebSearch?: () => void;
  currentModelId?: string;
  onSelectModel?: (modelId: string) => void;
  onOpenConnectModal?: (provider?: 'gemini' | 'openai' | 'anthropic') => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  disabled = false,
  placeholder = 'Message Orbit...',
  isWebSearchActive = false,
  onToggleWebSearch,
  currentModelId,
  onSelectModel,
  onOpenConnectModal,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea to fit multiline prompts gracefully up to 200px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isStreaming) {
      onStopGeneration();
      return;
    }
    if (!content.trim() && attachments.length === 0) return;

    onSendMessage(content.trim(), attachments);
    setContent('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = Array.from(files).map((f) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      type: f.name.endsWith('.ts') || f.name.endsWith('.sql') || f.name.endsWith('.json')
        ? 'code'
        : 'doc',
      contentSnippet: `File: ${f.name} attached for analysis.`,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const hasValidInput = content.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      {/* Attachment Pills Container */}
      {attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2 px-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 dark:bg-neutral-900 dark:border-neutral-750 dark:text-neutral-200 text-xs shadow-xs"
            >
              {att.type === 'code' ? (
                <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              )}
              <span className="font-medium truncate max-w-[150px]">{att.name}</span>
              <span className="text-slate-400 dark:text-neutral-500 text-[10px]">({att.size})</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white rounded ml-1 cursor-pointer"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Floating Glass Capsule Composer (Inspiration PDF Pages 2, 5, 6, 13) */}
      <form
        onSubmit={handleSubmit}
        className="glass-input rounded-3xl p-3 sm:p-3.5 shadow-lg focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/80 transition-colors duration-150 flex flex-col"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isStreaming ? 'Thinking...' : placeholder}
          rows={1}
          className="w-full px-2.5 py-1.5 bg-transparent text-[16px] sm:text-[15px] text-slate-900 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 resize-none focus:outline-hidden leading-[1.6] max-h-52 min-h-[32px]"
        />

        {/* Bottom Control Bar */}
        <div className="mt-2 flex items-center justify-between pt-1">
          {/* Left Actions (Attachment & Web Search Toggle) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors duration-150 cursor-pointer"
              title="Attach files or code"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Web Search Mode Toggle */}
            {onToggleWebSearch && (
              <button
                type="button"
                onClick={onToggleWebSearch}
                className={`min-h-[44px] px-3.5 flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors duration-150 cursor-pointer ${
                  isWebSearchActive
                    ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800'
                }`}
                title={isWebSearchActive ? 'Web Search: Active (Live intelligence enabled)' : 'Enable Web Search (Search live internet)'}
              >
                <Globe className={`w-3.5 h-3.5 ${isWebSearchActive ? 'text-white' : 'text-slate-500 dark:text-neutral-400'}`} />
                <span className="text-[12px] font-medium hidden sm:inline">Search</span>
              </button>
            )}

            {/* Model & Provider Selector near chat input */}
            {currentModelId && onSelectModel && (
              <ModelSelector
                compact
                currentModelId={currentModelId}
                onSelectModel={onSelectModel}
                onOpenConnectModal={onOpenConnectModal}
              />
            )}
          </div>

          {/* Right Action: Send / Stop Circular Button */}
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 flex items-center justify-center transition-colors duration-150 shadow-md cursor-pointer"
                title="Stop generating"
              >
                <Square className="w-4 h-4 fill-white dark:fill-black" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!hasValidInput || disabled}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors duration-150 shadow-md ${
                  hasValidInput && !disabled
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed opacity-60'
                }`}
                title="Send message (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* ChatGPT / Claude subtle bottom disclaimer */}
      <div className="mt-2 text-center text-xs sm:text-[12px] text-slate-500 dark:text-neutral-500 select-none">
        Orbit can make mistakes. Verify important information.
      </div>
    </div>
  );
};
