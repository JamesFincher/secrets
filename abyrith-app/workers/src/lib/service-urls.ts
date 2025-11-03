/**
 * Service URL Mapping
 *
 * Maps service names to their documentation URLs.
 * Provides fallback URL guessing for unknown services.
 */

import type { ServiceUrls } from '../types/firecrawl';

/**
 * Predefined URL mappings for popular services
 */
export const serviceUrlMap: Record<string, ServiceUrls> = {
  'openai': {
    pricing: 'https://openai.com/pricing',
    gettingStarted: 'https://platform.openai.com/docs/quickstart',
    apiReference: 'https://platform.openai.com/docs/api-reference'
  },
  'anthropic': {
    pricing: 'https://www.anthropic.com/pricing',
    gettingStarted: 'https://docs.anthropic.com/claude/docs/quickstart',
    apiReference: 'https://docs.anthropic.com/claude/reference'
  },
  'stripe': {
    pricing: 'https://stripe.com/pricing',
    gettingStarted: 'https://stripe.com/docs/development/quickstart',
    apiReference: 'https://stripe.com/docs/api'
  },
  'sendgrid': {
    pricing: 'https://sendgrid.com/pricing',
    gettingStarted: 'https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs',
    apiReference: 'https://docs.sendgrid.com/api-reference'
  },
  'resend': {
    pricing: 'https://resend.com/pricing',
    gettingStarted: 'https://resend.com/docs/send-with-nodejs',
    apiReference: 'https://resend.com/docs/api-reference'
  },
  'aws': {
    pricing: 'https://aws.amazon.com/pricing',
    gettingStarted: 'https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html',
    apiReference: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest'
  },
  'twilio': {
    pricing: 'https://www.twilio.com/pricing',
    gettingStarted: 'https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account',
    apiReference: 'https://www.twilio.com/docs/usage/api'
  },
  'github': {
    pricing: 'https://github.com/pricing',
    gettingStarted: 'https://docs.github.com/en/rest/quickstart',
    apiReference: 'https://docs.github.com/en/rest'
  },
  'vercel': {
    pricing: 'https://vercel.com/pricing',
    gettingStarted: 'https://vercel.com/docs/getting-started-with-vercel',
    apiReference: 'https://vercel.com/docs/rest-api'
  },
  'cloudflare': {
    pricing: 'https://www.cloudflare.com/plans',
    gettingStarted: 'https://developers.cloudflare.com/workers/get-started/guide',
    apiReference: 'https://developers.cloudflare.com/api'
  },
  'supabase': {
    pricing: 'https://supabase.com/pricing',
    gettingStarted: 'https://supabase.com/docs/guides/getting-started/quickstarts/nextjs',
    apiReference: 'https://supabase.com/docs/reference/javascript/introduction'
  },
  'google-maps': {
    pricing: 'https://mapsplatform.google.com/pricing',
    gettingStarted: 'https://developers.google.com/maps/get-started',
    apiReference: 'https://developers.google.com/maps/documentation'
  },
  'google-cloud': {
    pricing: 'https://cloud.google.com/pricing',
    gettingStarted: 'https://cloud.google.com/docs/get-started',
    apiReference: 'https://cloud.google.com/apis/docs/overview'
  },
  'mailgun': {
    pricing: 'https://www.mailgun.com/pricing',
    gettingStarted: 'https://documentation.mailgun.com/en/latest/quickstart.html',
    apiReference: 'https://documentation.mailgun.com/en/latest/api_reference.html'
  },
  'postmark': {
    pricing: 'https://postmarkapp.com/pricing',
    gettingStarted: 'https://postmarkapp.com/developer/user-guide/send-email-with-api',
    apiReference: 'https://postmarkapp.com/developer/api/overview'
  },
  'algolia': {
    pricing: 'https://www.algolia.com/pricing',
    gettingStarted: 'https://www.algolia.com/doc/guides/getting-started/quick-start',
    apiReference: 'https://www.algolia.com/doc/api-reference/api-methods'
  },
  'auth0': {
    pricing: 'https://auth0.com/pricing',
    gettingStarted: 'https://auth0.com/docs/quickstart',
    apiReference: 'https://auth0.com/docs/api/authentication'
  },
  'mongodb': {
    pricing: 'https://www.mongodb.com/pricing',
    gettingStarted: 'https://www.mongodb.com/docs/atlas/getting-started',
    apiReference: 'https://www.mongodb.com/docs/atlas/api'
  },
  'planetscale': {
    pricing: 'https://planetscale.com/pricing',
    gettingStarted: 'https://planetscale.com/docs/tutorials/planetscale-quick-start-guide',
    apiReference: 'https://planetscale.com/docs/reference/planetscale-api'
  },
  'railway': {
    pricing: 'https://railway.app/pricing',
    gettingStarted: 'https://docs.railway.app/getting-started',
    apiReference: 'https://docs.railway.app/reference/public-api'
  }
};

/**
 * Get service URLs by name
 */
export function getServiceUrls(serviceName: string): ServiceUrls | null {
  const normalized = serviceName.toLowerCase().trim();
  return serviceUrlMap[normalized] || null;
}

/**
 * Guess service URLs based on common patterns
 * Used as fallback when service not in predefined map
 */
export function guessServiceUrls(serviceName: string): ServiceUrls {
  const normalized = serviceName.toLowerCase().replace(/\s+/g, '');

  return {
    pricing: `https://${normalized}.com/pricing`,
    gettingStarted: `https://docs.${normalized}.com/getting-started`,
    apiReference: `https://docs.${normalized}.com/api`
  };
}

/**
 * Get all supported service names
 */
export function getSupportedServices(): string[] {
  return Object.keys(serviceUrlMap).sort();
}

/**
 * Check if service is explicitly supported
 */
export function isSupportedService(serviceName: string): boolean {
  const normalized = serviceName.toLowerCase().trim();
  return normalized in serviceUrlMap;
}

/**
 * Search for service by partial name match
 * Useful for autocomplete or fuzzy matching
 */
export function searchServices(query: string): string[] {
  const normalized = query.toLowerCase().trim();
  return Object.keys(serviceUrlMap)
    .filter(service => service.includes(normalized))
    .sort();
}
