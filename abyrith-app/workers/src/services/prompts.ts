/**
 * Prompt Engineering Service
 *
 * System prompts and context building for the AI Secret Assistant
 */

/**
 * Base system prompt for all Claude interactions
 */
export const BASE_SYSTEM_PROMPT = `You are the AI Secret Assistant for Abyrith, a secrets management platform. Your role is to help users understand, acquire, and manage API keys and developer secrets.

Core Principles:
1. SIMPLICITY: Explain everything like you're talking to a 5-year-old, then add technical details
2. EDUCATION: Don't just give answers - teach users WHY and HOW
3. HONESTY: If you don't know something, say so and offer to research it
4. SECURITY: Always promote security best practices
5. COST AWARENESS: Always mention pricing and costs upfront

Your personality:
- Friendly and encouraging, never condescending
- Patient with beginners
- Technical when appropriate for experienced users
- Proactive in suggesting better approaches

What you can do:
- Explain what API keys are and how they work
- Generate step-by-step instructions to acquire any API key
- Research pricing, limits, and features of API services
- Compare different services and recommend best fit
- Help troubleshoot issues during acquisition
- Teach security best practices

What you CANNOT do:
- Access or decrypt the user's actual secret values
- Sign up for services on behalf of users
- Make API calls to external services (except for research)
- Make financial decisions for users

Format your responses:
- Use markdown for structure (headings, lists, code blocks)
- Break complex topics into digestible chunks
- Use examples and analogies
- Include checkpoints and verification steps
- Highlight warnings and important notes with ⚠️
- Use emojis sparingly for emphasis (✅ ❌ 💡 ⚠️)

Remember: Users range from complete beginners to experienced developers. Adjust your communication style based on their questions and responses.`;

/**
 * Context for the conversation
 */
export interface ConversationContext {
  organizationName?: string;
  projectName?: string;
  projectId?: string;
  existingSecrets?: Array<{
    service: string;
    environment: string;
  }>;
}

/**
 * Build context section from conversation metadata
 */
export function buildContextSection(context: ConversationContext): string {
  const parts: string[] = [];

  if (context.organizationName) {
    parts.push(`Organization: ${context.organizationName}`);
  }

  if (context.projectName) {
    parts.push(`Current project: ${context.projectName}`);
  }

  if (context.existingSecrets && context.existingSecrets.length > 0) {
    parts.push('\nExisting API keys in this project:');
    context.existingSecrets.forEach((secret) => {
      parts.push(`- ${secret.service} (${secret.environment})`);
    });
  }

  return parts.length > 0 ? '\n' + parts.join('\n') + '\n' : '';
}

/**
 * Build complete system prompt with context
 */
export function buildSystemPrompt(context?: ConversationContext): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (context) {
    const contextSection = buildContextSection(context);
    if (contextSection) {
      prompt += '\n\nCurrent Context:' + contextSection;
    }
  }

  return prompt;
}

/**
 * Detect if query is a simple FAQ
 */
export function isSimpleQuery(message: string): boolean {
  const simpleKeywords = [
    'what is',
    'what are',
    'how does',
    'explain',
    'define',
    'meaning of',
    'difference between',
  ];

  const lowerMessage = message.toLowerCase();
  return (
    simpleKeywords.some((kw) => lowerMessage.includes(kw)) && message.length < 100
  );
}

/**
 * Detect if query requires deep thinking
 */
export function requiresDeepThinking(message: string): boolean {
  const complexKeywords = [
    'design',
    'architecture',
    'optimize',
    'compare multiple',
    'best approach',
    'tradeoffs',
    'plan',
    'strategy',
  ];

  const lowerMessage = message.toLowerCase();
  return complexKeywords.some((kw) => lowerMessage.includes(kw));
}

/**
 * Detect if query needs web research
 */
export function needsResearch(message: string): boolean {
  const researchKeywords = [
    'how to get',
    'acquire',
    'api key for',
    'sign up for',
    'pricing for',
    'cost of',
    'compare',
    'difference between',
    'best api for',
    'recommend',
  ];

  const lowerMessage = message.toLowerCase();
  return researchKeywords.some((kw) => lowerMessage.includes(kw));
}

/**
 * Extract service name from user message
 */
export function extractServiceName(message: string): string | null {
  // Common patterns:
  // "I need an OpenAI API key"
  // "How to get Stripe API key"
  // "What's the pricing for SendGrid?"

  const lowerMessage = message.toLowerCase();

  // List of known services to detect
  const services = [
    'openai',
    'stripe',
    'sendgrid',
    'mailgun',
    'twilio',
    'aws',
    'google cloud',
    'azure',
    'firebase',
    'supabase',
    'cloudflare',
    'vercel',
    'netlify',
    'github',
    'gitlab',
    'anthropic',
    'claude',
    'resend',
    'postmark',
  ];

  for (const service of services) {
    if (lowerMessage.includes(service)) {
      return service;
    }
  }

  return null;
}
