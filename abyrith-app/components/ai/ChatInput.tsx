'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chat Input Component
 *
 * Textarea with auto-grow, send button, and keyboard shortcuts
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight (content height)
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, [message]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = message.length;
  const maxChars = 2000;
  const showCharCount = charCount > maxChars * 0.8; // Show when 80% full

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-2 items-end">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] max-h-[200px]"
              rows={1}
              maxLength={maxChars}
            />

            {/* Character count indicator */}
            {showCharCount && (
              <div
                className={`absolute bottom-2 right-2 text-xs ${
                  charCount >= maxChars
                    ? 'text-destructive font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {charCount}/{maxChars}
              </div>
            )}
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            size="lg"
            className="h-[52px] px-6"
          >
            Send
          </Button>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Enter</kbd> to send,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
