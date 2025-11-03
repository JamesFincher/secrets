/**
 * Conversation Management Service
 *
 * Handles conversation persistence and retrieval from Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../types/api';
import { ClaudeMessage } from '../types/claude';
import { ConversationContext } from './prompts';

/**
 * Database conversation record
 */
export interface Conversation {
  id: string;
  user_id: string;
  organization_id: string;
  title: string | null;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Database message record
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: {
    model?: string;
    tokens_input?: number;
    tokens_output?: number;
    cost_usd?: number;
  };
  created_at: string;
}

/**
 * Create Supabase client
 */
function getSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  organizationId: string,
  context: ConversationContext,
  env: Env
): Promise<string> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      title: null, // Will be generated from first message
      context: context as unknown as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data.id;
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string,
  env: Env
): Promise<Conversation | null> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Get recent messages for a conversation
 */
export async function getRecentMessages(
  conversationId: string,
  limit: number = 10,
  env: Env
): Promise<Message[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  // Return in chronological order (oldest first)
  return (data as Message[]).reverse();
}

/**
 * Convert database messages to Claude format
 */
export function messagesToClaudeFormat(messages: Message[]): ClaudeMessage[] {
  return messages
    .filter((msg) => msg.role !== 'system') // Claude doesn't use system role in messages
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
}

/**
 * Save a user message
 */
export async function saveUserMessage(
  conversationId: string,
  content: string,
  env: Env
): Promise<string> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content,
      metadata: {},
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save user message: ${error.message}`);
  }

  return data.id;
}

/**
 * Save an assistant message with usage tracking
 */
export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  model: string,
  tokensInput: number,
  tokensOutput: number,
  costUsd: number,
  env: Env
): Promise<string> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content,
      metadata: {
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
      },
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save assistant message: ${error.message}`);
  }

  return data.id;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string,
  env: Env
): Promise<void> {
  const supabase = getSupabaseClient(env);

  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to update conversation title: ${error.message}`);
  }
}

/**
 * Generate conversation title from first message
 */
export function generateTitle(firstMessage: string): string {
  // Simple title generation - take first 50 chars
  const title = firstMessage.substring(0, 50);
  return title.length < firstMessage.length ? `${title}...` : title;
}

/**
 * Build conversation context from database record
 */
export function buildContextFromConversation(
  conversation: Conversation
): ConversationContext {
  const context = conversation.context || {};

  return {
    organizationName: context.organizationName as string | undefined,
    projectName: context.projectName as string | undefined,
    projectId: context.projectId as string | undefined,
    existingSecrets: context.existingSecrets as
      | Array<{ service: string; environment: string }>
      | undefined,
  };
}
