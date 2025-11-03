/**
 * Claude API Client Service
 *
 * Handles all communication with Anthropic Claude API
 */

import {
  ClaudeRequest,
  ClaudeResponse,
  ClaudeMessage,
  ClaudeModel,
  ClaudeError,
} from '../types/claude';
import { Env } from '../types/api';

/**
 * Claude API Configuration
 */
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Select appropriate Claude model based on query complexity
 */
export function selectClaudeModel(
  userMessage: string,
  conversationLength: number
): ClaudeModel {
  const message = userMessage.toLowerCase();

  // Simple FAQ → Haiku (fast + cheap)
  const faqKeywords = [
    'what is',
    'what are',
    'how does',
    'explain',
    'define',
    'meaning of',
  ];

  if (faqKeywords.some((kw) => message.includes(kw)) && message.length < 100) {
    return 'claude-3-5-haiku-20241022';
  }

  // Acquisition flow or comparisons → Sonnet
  const complexKeywords = [
    'how to get',
    'show me how',
    'step by step',
    'compare',
    'recommend',
  ];

  if (complexKeywords.some((kw) => message.includes(kw))) {
    return 'claude-3-5-sonnet-20241022';
  }

  // Long conversation → Sonnet for consistency
  if (conversationLength > 10) {
    return 'claude-3-5-sonnet-20241022';
  }

  // Default → Haiku for efficiency
  return 'claude-3-5-haiku-20241022';
}

/**
 * Call Claude API with retry logic
 */
export async function callClaude(
  request: ClaudeRequest,
  env: Env,
  maxRetries: number = 3
): Promise<ClaudeResponse> {
  const apiKey = env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = (await response.json()) as ClaudeResponse;
        return data;
      }

      // Handle specific error codes
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        console.warn(`Claude API rate limited. Retrying after ${retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status === 529) {
        // Overloaded - exponential backoff
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`Claude API overloaded. Retrying after ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Non-retriable error
      const errorData = (await response.json()) as ClaudeError;
      throw new Error(
        `Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      );
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff for network errors
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.error(`Claude API call failed (attempt ${attempt}):`, error);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error('Max retries exceeded for Claude API');
}

/**
 * Call Claude API with streaming
 */
export async function callClaudeStream(
  request: ClaudeRequest,
  env: Env
): Promise<ReadableStream> {
  const apiKey = env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as ClaudeError;
    throw new Error(
      `Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
    );
  }

  if (!response.body) {
    throw new Error('No response body from Claude API');
  }

  return response.body;
}

/**
 * Build Claude API request
 */
export function buildClaudeRequest(
  messages: ClaudeMessage[],
  systemPrompt: string,
  model?: ClaudeModel,
  options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }
): ClaudeRequest {
  return {
    model: model || 'claude-3-5-haiku-20241022',
    max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
    messages,
    system: systemPrompt,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
    stream: options?.stream ?? false,
  };
}

/**
 * Extract text content from Claude response
 */
export function extractTextContent(response: ClaudeResponse): string {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
