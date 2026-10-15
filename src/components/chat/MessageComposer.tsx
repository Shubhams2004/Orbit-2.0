import React, { useState, useRef, useEffect } from 'react';
import { ChatAttachment } from '../../types';
import {
  Send,
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
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
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

  // Simulated file upload
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
      contentSnippet: `File: ${f.name} uploaded for contextual analysis.`,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="w-full">
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
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-750 text-xs text-neutral-200 animate-in fade-in"
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

      {/* Multiline Composer Box */}
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 shadow-lg focus-within:border-violet-500/80 transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            isStreaming
              ? 'Model is streaming response...'
              : 'Message Orbit AI or ask to plan, triage, or break down tasks... (Enter to send, Shift+Enter for newline)'
          }
          rows={1}
          className="w-full text-xs sm:text-sm bg-transparent border-0 text-neutral-100 placeholder-neutral-500 focus:outline-hidden resize-none leading-relaxed max-h-48"
        />

        {/* Composer Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 mt-1">
          {/* Left Actions: Attachments */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
              title="Attach document or code snippet"
            >
              <Paperclip className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">Attach</span>
            </button>

            <span className="text-[11px] text-neutral-500 hidden md:inline">
              Markdown & code blocks supported
            </span>
          </div>

          {/* Right Action: Send / Stop */}
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={disabled || (!content.trim() && attachments.length === 0)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 rounded-lg transition-colors shadow-xs cursor-pointer"
                title="Send message"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
