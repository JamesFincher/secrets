/**
 * Claude API Types
 *
 * Type definitions for Anthropic Claude API integration
 */

/**
 * Claude API Models
 */
export type ClaudeModel =
  | 'claude-3-5-haiku-20241022' // Fast, cheap - simple queries
  | 'claude-3-5-sonnet-20241022'; // Balanced - most conversations

/**
 * Message role in conversation
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Content block in a message
 */
export interface ContentBlock {
  type: 'text';
  text: string;
}

/**
 * Message in conversation
 */
export interface ClaudeMessage {
  role: MessageRole;
  content: string | ContentBlock[];
}

/**
 * Claude API Request
 */
export interface ClaudeRequest {
  model: ClaudeModel;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
  temperature?: number;
  stream?: boolean;
}

/**
 * Token usage from Claude API
 */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * Claude API Response (non-streaming)
 */
export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: string | null;
  usage: ClaudeUsage;
}

/**
 * Claude API Error Response
 */
export interface ClaudeError {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

/**
 * Streaming event types
 */
export type StreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop';

/**
 * Streaming event
 */
export interface StreamEvent {
  type: StreamEventType;
  message?: Partial<ClaudeResponse>;
  content_block?: ContentBlock;
  delta?: {
    type: 'text_delta';
    text: string;
  };
  usage?: ClaudeUsage;
}

/**
 * Model pricing (per 1M tokens)
 */
export interface ModelPricing {
  input: number; // $ per 1M input tokens
  output: number; // $ per 1M output tokens
}

/**
 * Model pricing table
 */
export const MODEL_PRICING: Record<ClaudeModel, ModelPricing> = {
  'claude-3-5-haiku-20241022': {
    input: 0.25,
    output: 1.25,
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
  },
};
