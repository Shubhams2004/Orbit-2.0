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
} from 'lucide-react';

interface MessageComposerProps {
  onSendMessage: (content: string, attachments: ChatAttachment[]) => void;
  onStopGeneration: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  disabled = false,
  placeholder = 'Message Orbit...',
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
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-900 border border-neutral-750 text-xs text-neutral-200 shadow-xs"
            >
              {att.type === 'code' ? (
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span className="font-medium truncate max-w-[150px]">{att.name}</span>
              <span className="text-neutral-500 text-[10px]">({att.size})</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 text-neutral-400 hover:text-white rounded ml-1"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Floating ChatGPT / Claude Capsule Composer */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#212121] border border-neutral-750/80 rounded-3xl p-2.5 sm:p-3 shadow-xl focus-within:border-neutral-500 transition-all flex flex-col"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={isStreaming ? 'Thinking...' : placeholder}
          rows={1}
          className="w-full px-2 py-1 bg-transparent text-[14px] text-neutral-100 placeholder-neutral-500 resize-none focus:outline-hidden leading-relaxed max-h-52 min-h-[28px]"
        />

        {/* Bottom Control Bar */}
        <div className="mt-2 flex items-center justify-between pt-1">
          {/* Left Actions (Attachment) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-full transition-colors"
              title="Attach files or code"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          {/* Right Action: Send / Stop Circular Button */}
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="w-8 h-8 rounded-full bg-white text-black hover:bg-neutral-200 flex items-center justify-center transition-all shadow-xs"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-black" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!hasValidInput || disabled}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-xs ${
                  hasValidInput && !disabled
                    ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
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
      <div className="mt-2 text-center text-[11px] text-neutral-500 select-none">
        Orbit can make mistakes. Verify important information.
      </div>
    </div>
  );
};
