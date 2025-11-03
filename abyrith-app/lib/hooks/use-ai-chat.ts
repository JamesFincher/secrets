/**
 * useAiChat Hook
 *
 * React hook for managing AI chat interactions.
 * Handles streaming responses, loading states, and error handling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAIStore } from '@/lib/stores/ai-store';
import {
  streamMessage,
  sendMessage,
  AIAPIError,
  type SendMessageRequest,
  type SendMessageResponse,
  type ProjectContext,
} from '@/lib/api/ai';

/**
 * Hook options
 */
export interface UseAiChatOptions {
  /**
   * Conversation ID (required)
   */
  conversationId: string;

  /**
   * Enable streaming (default: true)
   */
  streaming?: boolean;

  /**
   * Project context
   */
  projectContext?: ProjectContext;

  /**
   * Callback when message is sent
   */
  onMessageSent?: (message: string) => void;

  /**
   * Callback when response is received
   */
  onResponseReceived?: (response: string) => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: AIAPIError) => void;
}

/**
 * Hook return value
 */
export interface UseAiChatReturn {
  /**
   * Send a message
   */
  sendMessage: (message: string) => Promise<void>;

  /**
   * Is a message being sent/received?
   */
  isLoading: boolean;

  /**
   * Is a response being streamed?
   */
  isStreaming: boolean;

  /**
   * Current error, if any
   */
  error: AIAPIError | null;

  /**
   * Retry the last failed message
   */
  retry: () => Promise<void>;

  /**
   * Cancel the current streaming request
   */
  cancel: () => void;
}

/**
 * useAiChat Hook
 */
export function useAiChat(options: UseAiChatOptions): UseAiChatReturn {
  const {
    conversationId,
    streaming = true,
    projectContext,
    onMessageSent,
    onResponseReceived,
    onError,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<AIAPIError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  const { addMessage, setTyping } = useAIStore();

  /**
   * Cancel the current streaming request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
      setTyping(false);
    }
  }, [setTyping]);

  /**
   * Send a message (streaming)
   */
  const sendStreamingMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);
      setIsStreaming(true);
      setError(null);
      setTyping(true);

      // Add user message to conversation
      addMessage({
        role: 'user',
        content: message,
        metadata: {
          context: projectContext,
        },
      });

      onMessageSent?.(message);

      const request: SendMessageRequest = {
        message,
        conversationId,
        projectContext,
      };

      let streamedContent = '';
      const tempMessageId = `temp-${Date.now()}`;

      try {
        abortControllerRef.current = await streamMessage(
          request,
          // onChunk
          (chunk: string) => {
            streamedContent += chunk;

            // Update or add streaming message
            addMessage({
              role: 'assistant',
              content: streamedContent,
              metadata: {
                model: 'claude-3-5-sonnet-20241022',
              },
            });
          },
          // onComplete
          (response: SendMessageResponse) => {
            setIsStreaming(false);
            setIsLoading(false);
            setTyping(false);
            onResponseReceived?.(response.content);
          },
          // onError
          (err: AIAPIError) => {
            setError(err);
            setIsStreaming(false);
            setIsLoading(false);
            setTyping(false);
            onError?.(err);
          }
        );
      } catch (err) {
        const apiError =
          err instanceof AIAPIError
            ? err
            : new AIAPIError('Failed to send message', 0, 'UNKNOWN_ERROR');
        setError(apiError);
        setIsStreaming(false);
        setIsLoading(false);
        setTyping(false);
        onError?.(apiError);
      }
    },
    [
      conversationId,
      projectContext,
      addMessage,
      setTyping,
      onMessageSent,
      onResponseReceived,
      onError,
    ]
  );

  /**
   * Send a message (non-streaming)
   */
  const sendNonStreamingMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);
      setError(null);
      setTyping(true);

      // Add user message to conversation
      addMessage({
        role: 'user',
        content: message,
        metadata: {
          context: projectContext,
        },
      });

      onMessageSent?.(message);

      const request: SendMessageRequest = {
        message,
        conversationId,
        projectContext,
      };

      try {
        const response = await sendMessage(request);

        // Add AI response to conversation
        addMessage({
          role: 'assistant',
          content: response.content,
          metadata: {
            model: response.model,
            tokens: response.tokens.total,
          },
        });

        setIsLoading(false);
        setTyping(false);
        onResponseReceived?.(response.content);
      } catch (err) {
        const apiError =
          err instanceof AIAPIError
            ? err
            : new AIAPIError('Failed to send message', 0, 'UNKNOWN_ERROR');
        setError(apiError);
        setIsLoading(false);
        setTyping(false);
        onError?.(apiError);
      }
    },
    [
      conversationId,
      projectContext,
      addMessage,
      setTyping,
      onMessageSent,
      onResponseReceived,
      onError,
    ]
  );

  /**
   * Send a message
   */
  const send = useCallback(
    async (message: string) => {
      lastMessageRef.current = message;

      if (streaming) {
        await sendStreamingMessage(message);
      } else {
        await sendNonStreamingMessage(message);
      }
    },
    [streaming, sendStreamingMessage, sendNonStreamingMessage]
  );

  /**
   * Retry the last failed message
   */
  const retry = useCallback(async () => {
    if (lastMessageRef.current) {
      await send(lastMessageRef.current);
    }
  }, [send]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    sendMessage: send,
    isLoading,
    isStreaming,
    error,
    retry,
    cancel,
  };
}
