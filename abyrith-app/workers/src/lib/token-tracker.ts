/**
 * Token Usage Tracking
 *
 * Calculates costs and tracks token usage for Claude API calls
 */

import { ClaudeUsage, ClaudeModel, MODEL_PRICING } from '../types/claude';

/**
 * Token usage with cost calculation
 */
export interface TokenUsageWithCost extends ClaudeUsage {
  model: ClaudeModel;
  cost_usd: number;
  total_tokens: number;
}

/**
 * Calculate cost in USD for token usage
 */
export function calculateCost(model: ClaudeModel, usage: ClaudeUsage): number {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    console.warn(`Unknown model pricing: ${model}`);
    return 0;
  }

  // Pricing is per 1M tokens
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Calculate usage with cost
 */
export function calculateUsageWithCost(
  model: ClaudeModel,
  usage: ClaudeUsage
): TokenUsageWithCost {
  return {
    ...usage,
    model,
    total_tokens: usage.input_tokens + usage.output_tokens,
    cost_usd: calculateCost(model, usage),
  };
}

/**
 * Format cost as currency
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    // Show more precision for very small amounts
    return `$${costUsd.toFixed(6)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Estimate tokens in text (rough approximation)
 * Claude uses ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if cost exceeds threshold
 */
export function exceedsThreshold(
  costUsd: number,
  threshold: number
): boolean {
  return costUsd > threshold;
}
