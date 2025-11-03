/**
 * Server-Sent Events (SSE) Client
 *
 * Handles SSE streaming connections for AI responses.
 * Provides automatic reconnection and event parsing.
 */

/**
 * SSE Event types
 */
export type SSEEventType = 'content' | 'metadata' | 'error' | 'done';

/**
 * SSE Event
 */
export interface SSEEvent {
  type: SSEEventType;
  data: any;
}

/**
 * SSE Client options
 */
export interface SSEClientOptions {
  /**
   * Callback for each event
   */
  onEvent: (event: SSEEvent) => void;

  /**
   * Callback when connection opens
   */
  onOpen?: () => void;

  /**
   * Callback when connection closes
   */
  onClose?: () => void;

  /**
   * Callback for errors
   */
  onError?: (error: Error) => void;

  /**
   * Maximum number of reconnection attempts
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Headers to include with the request
   */
  headers?: HeadersInit;
}

/**
 * SSE Client
 *
 * Manages an SSE connection with automatic reconnection
 */
export class SSEClient {
  private url: string;
  private options: Required<SSEClientOptions>;
  private abortController: AbortController | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private retryCount = 0;
  private retryTimeout: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(url: string, options: SSEClientOptions) {
    this.url = url;
    this.options = {
      onEvent: options.onEvent,
      onOpen: options.onOpen || (() => {}),
      onClose: options.onClose || (() => {}),
      onError: options.onError || (() => {}),
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      headers: options.headers || {},
    };
  }

  /**
   * Connect to the SSE stream
   */
  async connect(): Promise<void> {
    if (this.isClosed) {
      throw new Error('SSE client is closed');
    }

    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        headers: this.options.headers,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Connection successful
      this.retryCount = 0;
      this.options.onOpen();

      // Start reading the stream
      this.reader = response.body.getReader();
      await this.readStream();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Connection was cancelled
        return;
      }

      // Connection error
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.options.onError(err);

      // Attempt reconnection
      if (this.retryCount < this.options.maxRetries) {
        this.scheduleReconnect();
      } else {
        this.close();
      }
    }
  }

  /**
   * Read from the stream
   */
  private async readStream(): Promise<void> {
    if (!this.reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await this.reader.read();

        if (done) {
          // Stream ended normally
          this.options.onClose();
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          this.processLine(line);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled
        return;
      }

      // Stream error
      const err = error instanceof Error ? error : new Error('Stream read error');
      this.options.onError(err);

      // Attempt reconnection
      if (this.retryCount < this.options.maxRetries) {
        this.scheduleReconnect();
      } else {
        this.close();
      }
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
    }
  }

  /**
   * Process a single SSE line
   */
  private processLine(line: string): void {
    // Skip empty lines and comments
    if (!line || line.startsWith(':')) {
      return;
    }

    // Parse SSE format: "data: {...}"
    if (line.startsWith('data: ')) {
      const data = line.slice(6); // Remove 'data: ' prefix

      // Handle [DONE] signal
      if (data === '[DONE]') {
        this.options.onEvent({ type: 'done', data: null });
        return;
      }

      // Parse JSON data
      try {
        const parsed = JSON.parse(data);

        // Emit event
        this.options.onEvent({
          type: parsed.type || 'content',
          data: parsed,
        });
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
        this.options.onError(new Error('Invalid SSE data format'));
      }
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.retryCount++;

    // Exponential backoff
    const delay = this.options.retryDelay * Math.pow(2, this.retryCount - 1);

    this.retryTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Close the connection
   */
  close(): void {
    this.isClosed = true;

    // Cancel any pending reconnection
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    // Abort the current request
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Release the reader
    if (this.reader) {
      this.reader.releaseLock();
      this.reader = null;
    }

    this.options.onClose();
  }

  /**
   * Check if the connection is closed
   */
  get closed(): boolean {
    return this.isClosed;
  }
}

/**
 * Simple SSE connection utility
 *
 * For cases where you don't need automatic reconnection
 */
export async function connectSSE(
  url: string,
  options: {
    headers?: HeadersInit;
    onMessage: (data: any) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  }
): Promise<AbortController> {
  const abortController = new AbortController();

  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          options.onComplete?.();
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              options.onComplete?.();
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              options.onMessage(parsed);
            } catch (error) {
              console.error('Failed to parse SSE data:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      options.onError?.(error);
    }
  }

  return abortController;
}
