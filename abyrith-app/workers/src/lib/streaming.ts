/**
 * Server-Sent Events (SSE) Streaming Handler
 *
 * Handles streaming responses from Claude API to client
 */

import { StreamEvent, ClaudeUsage } from '../types/claude';

/**
 * SSE message types
 */
export type SSEMessageType = 'start' | 'chunk' | 'complete' | 'error';

/**
 * SSE message
 */
export interface SSEMessage {
  type: SSEMessageType;
  conversationId?: string;
  content?: string;
  usage?: ClaudeUsage;
  cost?: number;
  error?: string;
}

/**
 * Format SSE message
 */
export function formatSSE(message: SSEMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
}

/**
 * Transform Claude streaming response to SSE format
 */
export class ClaudeStreamTransformer extends TransformStream<Uint8Array, string> {
  private buffer: string = '';
  private totalUsage: ClaudeUsage = { input_tokens: 0, output_tokens: 0 };

  constructor() {
    super({
      transform: (chunk, controller) => {
        // Decode chunk
        const decoder = new TextDecoder();
        this.buffer += decoder.decode(chunk, { stream: true });

        // Split on newlines
        const lines = this.buffer.split('\n');

        // Keep last incomplete line in buffer
        this.buffer = lines.pop() || '';

        // Process complete lines
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              this.handleStreamEvent(data, controller);
            } catch (error) {
              console.error('Failed to parse SSE data:', error);
            }
          }
        }
      },

      flush: (controller) => {
        // Send final usage data
        if (this.totalUsage.input_tokens > 0 || this.totalUsage.output_tokens > 0) {
          const completeMessage: SSEMessage = {
            type: 'complete',
            usage: this.totalUsage,
          };
          controller.enqueue(formatSSE(completeMessage));
        }
      },
    });
  }

  private handleStreamEvent(event: StreamEvent, controller: TransformStreamDefaultController<string>) {
    switch (event.type) {
      case 'content_block_delta':
        if (event.delta?.type === 'text_delta' && event.delta.text) {
          const chunkMessage: SSEMessage = {
            type: 'chunk',
            content: event.delta.text,
          };
          controller.enqueue(formatSSE(chunkMessage));
        }
        break;

      case 'message_delta':
        // Track usage
        if (event.usage) {
          this.totalUsage.input_tokens += event.usage.input_tokens || 0;
          this.totalUsage.output_tokens += event.usage.output_tokens || 0;
        }
        break;

      case 'message_stop':
        // Message complete
        break;

      default:
        // Ignore other event types
        break;
    }
  }
}

/**
 * Create a streaming response from Claude API response
 */
export async function createStreamingResponse(
  claudeStream: ReadableStream,
  conversationId: string
): Promise<Response> {
  const { readable, writable } = new TransformStream();

  // Start message
  const encoder = new TextEncoder();
  const writer = writable.getWriter();
  const startMessage: SSEMessage = {
    type: 'start',
    conversationId,
  };
  await writer.write(encoder.encode(formatSSE(startMessage)));
  writer.releaseLock();

  // Pipe Claude stream through transformer
  claudeStream
    .pipeThrough(new ClaudeStreamTransformer())
    .pipeThrough(new TextEncoderStream())
    .pipeTo(writable)
    .catch((error) => {
      console.error('Streaming error:', error);
    });

  return new Response(readable, {
    headers: createSSEHeaders(),
  });
}

/**
 * Create error SSE message
 */
export function createErrorSSE(error: string): string {
  const errorMessage: SSEMessage = {
    type: 'error',
    error,
  };
  return formatSSE(errorMessage);
}

/**
 * Create a fallback non-streaming response
 */
export function createNonStreamingResponse(
  content: string,
  conversationId: string,
  usage?: ClaudeUsage,
  cost?: number
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Start message
      const startMessage: SSEMessage = {
        type: 'start',
        conversationId,
      };
      controller.enqueue(encoder.encode(formatSSE(startMessage)));

      // Content as single chunk
      const chunkMessage: SSEMessage = {
        type: 'chunk',
        content,
      };
      controller.enqueue(encoder.encode(formatSSE(chunkMessage)));

      // Complete message
      const completeMessage: SSEMessage = {
        type: 'complete',
        usage,
        cost,
      };
      controller.enqueue(encoder.encode(formatSSE(completeMessage)));

      controller.close();
    },
  });

  return new Response(stream, {
    headers: createSSEHeaders(),
  });
}
