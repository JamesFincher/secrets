/**
 * AI Chat Endpoint Handler
 *
 * POST /api/v1/ai/chat
 * Handles chat messages to the AI Secret Assistant
 */

import { Context } from 'hono';
import { Env, AuthUser, ErrorCode, HttpStatus } from '../types/api';
import { ApiError } from '../middleware/error-handler';
import {
  createConversation,
  getConversation,
  getRecentMessages,
  saveUserMessage,
  saveAssistantMessage,
  messagesToClaudeFormat,
  buildContextFromConversation,
  updateConversationTitle,
  generateTitle,
} from '../services/conversation';
import {
  buildSystemPrompt,
  isSimpleQuery,
  ConversationContext,
} from '../services/prompts';
import {
  selectClaudeModel,
  buildClaudeRequest,
  callClaudeStream,
  callClaude,
  extractTextContent,
} from '../services/claude';
import { calculateUsageWithCost } from '../lib/token-tracker';
import {
  createStreamingResponse,
  createNonStreamingResponse,
  createErrorSSE,
} from '../lib/streaming';
import { ClaudeMessage } from '../types/claude';

/**
 * Chat request body
 */
interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: ConversationContext;
  stream?: boolean; // Default: true
}

/**
 * Validate chat request
 */
function validateChatRequest(body: unknown): ChatRequest {
  if (!body || typeof body !== 'object') {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid request body',
      HttpStatus.BAD_REQUEST
    );
  }

  const request = body as Partial<ChatRequest>;

  if (!request.message || typeof request.message !== 'string') {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Message is required and must be a string',
      HttpStatus.BAD_REQUEST
    );
  }

  if (request.message.length === 0) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Message cannot be empty',
      HttpStatus.BAD_REQUEST
    );
  }

  if (request.message.length > 10000) {
    throw new ApiError(
      ErrorCode.VALIDATION_ERROR,
      'Message is too long (max 10,000 characters)',
      HttpStatus.BAD_REQUEST
    );
  }

  return {
    message: request.message,
    conversationId: request.conversationId,
    context: request.context,
    stream: request.stream ?? true,
  };
}

/**
 * Main chat handler
 */
export async function handleAiChat(c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>) {
  try {
    // Get authenticated user
    const user = c.get('user');
    const env = c.env;

    // Parse and validate request
    const body = await c.req.json();
    const request = validateChatRequest(body);

    // Get or create conversation
    let conversationId = request.conversationId;
    let context: ConversationContext = request.context || {};

    if (conversationId) {
      // Load existing conversation
      const conversation = await getConversation(conversationId, env);

      if (!conversation) {
        throw new ApiError(
          ErrorCode.NOT_FOUND,
          'Conversation not found',
          HttpStatus.NOT_FOUND
        );
      }

      // Verify ownership (user_id matches)
      if (conversation.user_id !== user.id) {
        throw new ApiError(
          ErrorCode.FORBIDDEN,
          'You do not have access to this conversation',
          HttpStatus.FORBIDDEN
        );
      }

      // Merge context from conversation
      context = {
        ...buildContextFromConversation(conversation),
        ...context,
      };
    } else {
      // Create new conversation
      if (!user.organizationId) {
        throw new ApiError(
          ErrorCode.VALIDATION_ERROR,
          'User must belong to an organization',
          HttpStatus.BAD_REQUEST
        );
      }

      conversationId = await createConversation(
        user.id,
        user.organizationId,
        context,
        env
      );
    }

    // Save user message
    await saveUserMessage(conversationId, request.message, env);

    // Update conversation title if first message
    const existingMessages = await getRecentMessages(conversationId, 2, env);
    if (existingMessages.length === 1) {
      // First message (only the one we just saved)
      const title = generateTitle(request.message);
      await updateConversationTitle(conversationId, title, env);
    }

    // Get recent messages for context
    const recentMessages = await getRecentMessages(conversationId, 10, env);
    const claudeMessages = messagesToClaudeFormat(recentMessages);

    // Add current message
    const currentMessage: ClaudeMessage = {
      role: 'user',
      content: request.message,
    };
    claudeMessages.push(currentMessage);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context);

    // Select model
    const model = selectClaudeModel(request.message, claudeMessages.length);

    // Build Claude request
    const claudeRequest = buildClaudeRequest(claudeMessages, systemPrompt, model, {
      stream: request.stream,
    });

    // Handle streaming vs non-streaming
    if (request.stream) {
      // Stream response
      try {
        const claudeStream = await callClaudeStream(claudeRequest, env);

        // Create SSE response
        const response = await createStreamingResponse(claudeStream, conversationId);

        // Note: We'll save the assistant message after streaming completes
        // For now, the frontend will need to send the complete response back
        // or we'll implement a callback mechanism

        return response;
      } catch (error) {
        console.error('Streaming error:', error);

        // Fallback to non-streaming
        const fallbackRequest = { ...claudeRequest, stream: false };
        const claudeResponse = await callClaude(fallbackRequest, env);
        const content = extractTextContent(claudeResponse);

        // Save assistant message
        const usage = calculateUsageWithCost(model, claudeResponse.usage);
        await saveAssistantMessage(
          conversationId,
          content,
          model,
          usage.input_tokens,
          usage.output_tokens,
          usage.cost_usd,
          env
        );

        return createNonStreamingResponse(
          content,
          conversationId,
          claudeResponse.usage,
          usage.cost_usd
        );
      }
    } else {
      // Non-streaming response
      const claudeResponse = await callClaude(claudeRequest, env);
      const content = extractTextContent(claudeResponse);

      // Save assistant message
      const usage = calculateUsageWithCost(model, claudeResponse.usage);
      await saveAssistantMessage(
        conversationId,
        content,
        model,
        usage.input_tokens,
        usage.output_tokens,
        usage.cost_usd,
        env
      );

      return createNonStreamingResponse(
        content,
        conversationId,
        claudeResponse.usage,
        usage.cost_usd
      );
    }
  } catch (error) {
    console.error('AI chat error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    // Return error as SSE for streaming clients
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(createErrorSSE(errorMessage)));
        controller.close();
      },
    });

    return new Response(errorStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}
