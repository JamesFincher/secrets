/**
 * Streaming Indicator Component
 *
 * Shows different states during AI response generation
 */

import { Loader2, Sparkles } from 'lucide-react';

/**
 * Streaming indicator props
 */
export interface StreamingIndicatorProps {
  /**
   * Indicator state
   * - thinking: AI is processing the request
   * - streaming: AI is generating response
   */
  state?: 'thinking' | 'streaming';

  /**
   * Custom message
   */
  message?: string;

  /**
   * Show icon
   */
  showIcon?: boolean;
}

/**
 * Streaming Indicator Component
 */
export function StreamingIndicator({
  state = 'thinking',
  message,
  showIcon = true,
}: StreamingIndicatorProps) {
  const defaultMessage =
    state === 'thinking' ? 'AI is thinking...' : 'AI is responding...';

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-lg border border-dashed">
      {showIcon && (
        <>
          {state === 'thinking' ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          )}
        </>
      )}
      <span className="text-sm text-muted-foreground">
        {message || defaultMessage}
      </span>
      <div className="flex gap-1">
        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
          .
        </span>
        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>
          .
        </span>
        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>
          .
        </span>
      </div>
    </div>
  );
}

/**
 * Inline streaming indicator (smaller, for chat bubbles)
 */
export function InlineStreamingIndicator({ state = 'streaming' }: { state?: 'thinking' | 'streaming' }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {state === 'thinking' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3 animate-pulse" />
      )}
      <div className="flex gap-0.5">
        <span className="animate-bounce text-xs" style={{ animationDelay: '0ms' }}>
          .
        </span>
        <span className="animate-bounce text-xs" style={{ animationDelay: '150ms' }}>
          .
        </span>
        <span className="animate-bounce text-xs" style={{ animationDelay: '300ms' }}>
          .
        </span>
      </div>
    </div>
  );
}

/**
 * Progress indicator for long operations
 */
export function ProgressIndicator({
  message,
  progress,
}: {
  message: string;
  progress?: number;
}) {
  return (
    <div className="w-full px-4 py-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{message}</span>
        {progress !== undefined && (
          <span className="text-xs text-muted-foreground">{progress}%</span>
        )}
      </div>
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
