/**
 * AI API Client
 *
 * Handles communication with the Cloudflare Workers AI endpoint.
 * Supports both streaming (SSE) and non-streaming responses.
 * Includes guided acquisition endpoints for API key acquisition flow.
 */

import { supabase } from './supabase';
import type { Message, Conversation, AcquisitionStep } from '@/lib/stores/ai-store';
import type { ServiceInfo } from '@/lib/services/service-detection';

/**
 * Base configuration
 */
const getApiUrl = () => {
  // Use environment variable or fallback to localhost in development
  return process.env.NEXT_PUBLIC_WORKERS_URL || 'http://localhost:8787';
};

/**
 * API Error class
 */
export class AIAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AIAPIError';
  }
}

/**
 * Get authentication headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new AIAPIError('Not authenticated', 401, 'UNAUTHORIZED');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

/**
 * Project context for AI requests
 */
export interface ProjectContext {
  projectId?: string;
  environmentId?: string;
  secretId?: string;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  projectContext?: ProjectContext;
  model?: string;
}

/**
 * Send message response
 */
export interface SendMessageResponse {
  conversationId: string;
  messageId: string;
  content: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Conversation response
 */
export interface ConversationResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  environmentId?: string;
  messageCount: number;
}

/**
 * Message response
 */
export interface MessageResponse {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    context?: ProjectContext;
  };
}

/**
 * Send a message to the AI (non-streaming)
 */
export async function sendMessage(
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  const url = `${getApiUrl()}/api/v1/ai/chat`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        throw new AIAPIError(
          'Rate limit exceeded. Please try again in a few moments.',
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }

      throw new AIAPIError(
        errorData.error?.message || 'Failed to send message',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    // Network or other errors
    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Stream a message from the AI (SSE)
 *
 * @param request - Message request
 * @param onChunk - Callback for each chunk of the response
 * @param onComplete - Callback when streaming completes
 * @param onError - Callback for errors
 * @returns Abort controller to cancel the stream
 */
export async function streamMessage(
  request: SendMessageRequest,
  onChunk: (chunk: string) => void,
  onComplete: (response: SendMessageResponse) => void,
  onError: (error: AIAPIError) => void
): Promise<AbortController> {
  const url = `${getApiUrl()}/api/v1/ai/chat/stream`;
  const headers = await getAuthHeaders();
  const abortController = new AbortController();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        onError(
          new AIAPIError(
            'Rate limit exceeded. Please try again in a few moments.',
            429,
            'RATE_LIMIT_EXCEEDED'
          )
        );
        return abortController;
      }

      onError(
        new AIAPIError(
          errorData.error?.message || 'Failed to send message',
          response.status,
          errorData.error?.code
        )
      );
      return abortController;
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      onError(new AIAPIError('No response body', 500, 'NO_RESPONSE_BODY'));
      return abortController;
    }

    let buffer = '';
    let fullContent = '';
    let metadata: SendMessageResponse | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Stream complete
          if (metadata) {
            onComplete(metadata);
          }
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix

            if (data === '[DONE]') {
              // Stream complete signal
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content') {
                // Content chunk
                const chunk = parsed.content;
                fullContent += chunk;
                onChunk(chunk);
              } else if (parsed.type === 'metadata') {
                // Metadata (conversation ID, token counts, etc.)
                metadata = {
                  ...parsed,
                  content: fullContent,
                };
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled
        return abortController;
      }

      onError(
        new AIAPIError(
          'Stream error occurred',
          500,
          'STREAM_ERROR'
        )
      );
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof AIAPIError) {
      onError(error);
    } else {
      onError(
        new AIAPIError(
          'Network error. Please check your connection and try again.',
          0,
          'NETWORK_ERROR'
        )
      );
    }
  }

  return abortController;
}

/**
 * Get conversation history
 */
export async function getConversation(
  conversationId: string
): Promise<{ conversation: ConversationResponse; messages: MessageResponse[] }> {
  const url = `${getApiUrl()}/api/v1/ai/conversations/${conversationId}`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIAPIError(
        errorData.error?.message || 'Failed to load conversation',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * List all conversations
 */
export async function listConversations(
  options?: {
    projectId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ConversationResponse[]> {
  const params = new URLSearchParams();
  if (options?.projectId) params.set('projectId', options.projectId);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());

  const url = `${getApiUrl()}/api/v1/ai/conversations?${params.toString()}`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIAPIError(
        errorData.error?.message || 'Failed to load conversations',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Create a new conversation
 */
export async function createConversation(
  title: string,
  projectContext?: ProjectContext
): Promise<ConversationResponse> {
  const url = `${getApiUrl()}/api/v1/ai/conversations`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, ...projectContext }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIAPIError(
        errorData.error?.message || 'Failed to create conversation',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const url = `${getApiUrl()}/api/v1/ai/conversations/${conversationId}`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIAPIError(
        errorData.error?.message || 'Failed to delete conversation',
        response.status,
        errorData.error?.code
      );
    }
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * ============================================================================
 * Guided Acquisition API Functions
 * ============================================================================
 */

/**
 * Generate acquisition steps for a service
 */
export async function generateAcquisitionSteps(
  service: ServiceInfo,
  documentation?: string
): Promise<AcquisitionStep[]> {
  const url = `${getApiUrl()}/api/v1/ai/acquisition/generate-steps`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        service: {
          id: service.id,
          name: service.name,
          docsUrl: service.docsUrl,
          apiKeysUrl: service.apiKeysUrl,
        },
        documentation,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIAPIError(
        errorData.error?.message || 'Failed to generate acquisition steps',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data.steps;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Scrape service documentation
 */
export async function scrapeServiceDocumentation(
  serviceSlug: string,
  forceRefresh = false
): Promise<{
  markdown: string;
  scrapedAt: string;
  cached: boolean;
}> {
  const url = `${getApiUrl()}/api/v1/scrape`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        service: serviceSlug,
        forceRefresh,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        throw new AIAPIError(
          'Rate limit exceeded. Please wait 30 seconds between scrape requests.',
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }

      throw new AIAPIError(
        errorData.error?.message || 'Failed to scrape documentation',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Explain pricing using AI
 */
export async function explainPricing(
  service: ServiceInfo,
  documentation: string
): Promise<string> {
  const url = `${getApiUrl()}/api/v1/ai/acquisition/explain-pricing`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        service: {
          id: service.id,
          name: service.name,
        },
        documentation,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIAPIError(
        errorData.error?.message || 'Failed to explain pricing',
        response.status,
        errorData.error?.code
      );
    }

    const data = await response.json();
    return data.data.explanation;
  } catch (error) {
    if (error instanceof AIAPIError) {
      throw error;
    }

    throw new AIAPIError(
      'Network error. Please check your connection and try again.',
      0,
      'NETWORK_ERROR'
    );
  }
}
