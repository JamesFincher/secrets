'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import type { Message } from '@/lib/stores/ai-store';

interface ChatMessageProps {
  message: Message;
}

/**
 * Chat Message Component
 *
 * Displays a single message with appropriate styling based on role
 *
 * SECURITY: Uses react-markdown with rehype-sanitize to prevent XSS attacks.
 * All user and AI content is sanitized before rendering.
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // System messages (centered, muted)
  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }

  // User and assistant messages
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] md:max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground ml-auto'
              : 'bg-muted text-foreground'
          }`}
        >
          {/* Message content with secure markdown rendering */}
          <div className="text-sm break-words prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-2 prose-code:text-xs">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight, rehypeSanitize]}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Metadata (model, tokens) - only for assistant */}
          {!isUser && message.metadata && (
            <div className="mt-2 pt-2 border-t border-muted-foreground/20 text-xs text-muted-foreground">
              {message.metadata.model && (
                <span className="mr-3">Model: {message.metadata.model}</span>
              )}
              {message.metadata.tokens && (
                <span>Tokens: {message.metadata.tokens}</span>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs text-muted-foreground mt-1 px-2 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

/**
 * REMOVED: formatMessageContent function
 *
 * Previously used dangerous regex-based HTML generation with dangerouslySetInnerHTML.
 * This created an XSS vulnerability where malicious content could execute scripts.
 *
 * SECURITY FIX: Replaced with react-markdown + rehype-sanitize plugin.
 * Now all content is properly sanitized before rendering.
 */

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // For older messages, show date
  return timestamp.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
