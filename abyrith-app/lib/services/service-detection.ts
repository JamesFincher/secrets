/**
 * Service Detection & Database
 *
 * Detects services from project names and provides service metadata
 * for the guided acquisition flow.
 */

export interface ServiceInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: 'ai' | 'payments' | 'email' | 'cloud' | 'database' | 'auth' | 'other';
  logoUrl?: string;
  docsUrl: string;
  pricingUrl?: string;
  apiKeysUrl?: string;
  keyFormat?: RegExp; // Regex pattern for API key validation
  keyPrefix?: string; // Common prefix for keys (e.g., "sk-" for OpenAI)
  keywords: string[]; // Keywords for auto-detection
}

/**
 * Service database with 21+ popular services
 */
export const SERVICES: ServiceInfo[] = [
  // AI Services
  {
    id: 'openai',
    name: 'OpenAI',
    slug: 'openai',
    description: 'GPT models, DALL-E, and Whisper APIs',
    category: 'ai',
    docsUrl: 'https://platform.openai.com/docs',
    pricingUrl: 'https://openai.com/pricing',
    apiKeysUrl: 'https://platform.openai.com/api-keys',
    keyFormat: /^sk-(proj-)?[A-Za-z0-9]{32,}$/,
    keyPrefix: 'sk-',
    keywords: ['openai', 'gpt', 'chatgpt', 'dalle', 'whisper', 'ai', 'chat'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    slug: 'anthropic',
    description: 'Claude AI models and APIs',
    category: 'ai',
    docsUrl: 'https://docs.anthropic.com',
    pricingUrl: 'https://www.anthropic.com/pricing',
    apiKeysUrl: 'https://console.anthropic.com/settings/keys',
    keyFormat: /^sk-ant-[A-Za-z0-9-_]{95,}$/,
    keyPrefix: 'sk-ant-',
    keywords: ['anthropic', 'claude', 'ai', 'chat', 'assistant'],
  },

  // Payment Services
  {
    id: 'stripe',
    name: 'Stripe',
    slug: 'stripe',
    description: 'Online payment processing',
    category: 'payments',
    docsUrl: 'https://stripe.com/docs',
    pricingUrl: 'https://stripe.com/pricing',
    apiKeysUrl: 'https://dashboard.stripe.com/apikeys',
    keyFormat: /^(sk|pk)_(test|live)_[A-Za-z0-9]{24,}$/,
    keyPrefix: 'sk_',
    keywords: ['stripe', 'payment', 'checkout', 'billing', 'subscription'],
  },

  // Email Services
  {
    id: 'sendgrid',
    name: 'SendGrid',
    slug: 'sendgrid',
    description: 'Email delivery service',
    category: 'email',
    docsUrl: 'https://docs.sendgrid.com',
    pricingUrl: 'https://sendgrid.com/pricing',
    apiKeysUrl: 'https://app.sendgrid.com/settings/api_keys',
    keyFormat: /^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/,
    keyPrefix: 'SG.',
    keywords: ['sendgrid', 'email', 'mail', 'smtp', 'transactional'],
  },
  {
    id: 'resend',
    name: 'Resend',
    slug: 'resend',
    description: 'Email API for developers',
    category: 'email',
    docsUrl: 'https://resend.com/docs',
    pricingUrl: 'https://resend.com/pricing',
    apiKeysUrl: 'https://resend.com/api-keys',
    keyFormat: /^re_[A-Za-z0-9]{24,}$/,
    keyPrefix: 're_',
    keywords: ['resend', 'email', 'mail', 'smtp', 'transactional'],
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    slug: 'mailgun',
    description: 'Email automation service',
    category: 'email',
    docsUrl: 'https://documentation.mailgun.com',
    pricingUrl: 'https://www.mailgun.com/pricing',
    apiKeysUrl: 'https://app.mailgun.com/app/account/security/api_keys',
    keywords: ['mailgun', 'email', 'mail', 'smtp'],
  },
  {
    id: 'postmark',
    name: 'Postmark',
    slug: 'postmark',
    description: 'Transactional email delivery',
    category: 'email',
    docsUrl: 'https://postmarkapp.com/developer',
    pricingUrl: 'https://postmarkapp.com/pricing',
    keywords: ['postmark', 'email', 'mail', 'transactional'],
  },

  // Cloud Platforms
  {
    id: 'aws',
    name: 'AWS',
    slug: 'aws',
    description: 'Amazon Web Services',
    category: 'cloud',
    docsUrl: 'https://docs.aws.amazon.com',
    pricingUrl: 'https://aws.amazon.com/pricing',
    apiKeysUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
    keywords: ['aws', 'amazon', 'cloud', 's3', 'ec2', 'lambda'],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    slug: 'vercel',
    description: 'Frontend cloud platform',
    category: 'cloud',
    docsUrl: 'https://vercel.com/docs',
    apiKeysUrl: 'https://vercel.com/account/tokens',
    keywords: ['vercel', 'deployment', 'hosting', 'nextjs', 'frontend'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    slug: 'cloudflare',
    description: 'CDN and edge computing',
    category: 'cloud',
    docsUrl: 'https://developers.cloudflare.com',
    pricingUrl: 'https://www.cloudflare.com/plans',
    apiKeysUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    keywords: ['cloudflare', 'cdn', 'workers', 'edge', 'dns'],
  },
  {
    id: 'heroku',
    name: 'Heroku',
    slug: 'heroku',
    description: 'Cloud application platform',
    category: 'cloud',
    docsUrl: 'https://devcenter.heroku.com',
    pricingUrl: 'https://www.heroku.com/pricing',
    keywords: ['heroku', 'deployment', 'hosting', 'dyno'],
  },
  {
    id: 'railway',
    name: 'Railway',
    slug: 'railway',
    description: 'Infrastructure platform',
    category: 'cloud',
    docsUrl: 'https://docs.railway.app',
    pricingUrl: 'https://railway.app/pricing',
    keywords: ['railway', 'deployment', 'hosting', 'infrastructure'],
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    slug: 'digitalocean',
    description: 'Cloud infrastructure provider',
    category: 'cloud',
    docsUrl: 'https://docs.digitalocean.com',
    pricingUrl: 'https://www.digitalocean.com/pricing',
    apiKeysUrl: 'https://cloud.digitalocean.com/account/api/tokens',
    keywords: ['digitalocean', 'cloud', 'droplet', 'infrastructure'],
  },

  // Database Services
  {
    id: 'supabase',
    name: 'Supabase',
    slug: 'supabase',
    description: 'Open source Firebase alternative',
    category: 'database',
    docsUrl: 'https://supabase.com/docs',
    pricingUrl: 'https://supabase.com/pricing',
    apiKeysUrl: 'https://app.supabase.com/project/_/settings/api',
    keywords: ['supabase', 'database', 'postgres', 'auth', 'realtime'],
  },
  {
    id: 'mongodb',
    name: 'MongoDB Atlas',
    slug: 'mongodb',
    description: 'Cloud database service',
    category: 'database',
    docsUrl: 'https://docs.atlas.mongodb.com',
    pricingUrl: 'https://www.mongodb.com/pricing',
    keywords: ['mongodb', 'database', 'nosql', 'atlas'],
  },
  {
    id: 'planetscale',
    name: 'PlanetScale',
    slug: 'planetscale',
    description: 'MySQL-compatible serverless database',
    category: 'database',
    docsUrl: 'https://planetscale.com/docs',
    pricingUrl: 'https://planetscale.com/pricing',
    keywords: ['planetscale', 'database', 'mysql', 'serverless'],
  },

  // Communication
  {
    id: 'twilio',
    name: 'Twilio',
    slug: 'twilio',
    description: 'SMS and voice API',
    category: 'other',
    docsUrl: 'https://www.twilio.com/docs',
    pricingUrl: 'https://www.twilio.com/pricing',
    apiKeysUrl: 'https://console.twilio.com/project/api-keys',
    keywords: ['twilio', 'sms', 'voice', 'phone', 'messaging'],
  },

  // Authentication
  {
    id: 'auth0',
    name: 'Auth0',
    slug: 'auth0',
    description: 'Authentication and authorization platform',
    category: 'auth',
    docsUrl: 'https://auth0.com/docs',
    pricingUrl: 'https://auth0.com/pricing',
    keywords: ['auth0', 'authentication', 'oauth', 'auth', 'login'],
  },

  // Search & Other
  {
    id: 'algolia',
    name: 'Algolia',
    slug: 'algolia',
    description: 'Search and discovery API',
    category: 'other',
    docsUrl: 'https://www.algolia.com/doc',
    pricingUrl: 'https://www.algolia.com/pricing',
    apiKeysUrl: 'https://www.algolia.com/account/api-keys',
    keywords: ['algolia', 'search', 'indexing', 'discovery'],
  },
  {
    id: 'github',
    name: 'GitHub',
    slug: 'github',
    description: 'Developer platform and version control',
    category: 'other',
    docsUrl: 'https://docs.github.com',
    apiKeysUrl: 'https://github.com/settings/tokens',
    keywords: ['github', 'git', 'repository', 'version control'],
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    slug: 'google-maps',
    description: 'Maps and location services',
    category: 'other',
    docsUrl: 'https://developers.google.com/maps/documentation',
    pricingUrl: 'https://mapsplatform.google.com/pricing',
    apiKeysUrl: 'https://console.cloud.google.com/apis/credentials',
    keywords: ['google', 'maps', 'location', 'geocoding', 'places'],
  },
];

/**
 * Get service by slug
 */
export function getServiceBySlug(slug: string): ServiceInfo | null {
  return SERVICES.find((s) => s.slug === slug) || null;
}

/**
 * Get service by ID
 */
export function getServiceById(id: string): ServiceInfo | null {
  return SERVICES.find((s) => s.id === id) || null;
}

/**
 * Search services by query
 */
export function searchServices(query: string): ServiceInfo[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return SERVICES;

  return SERVICES.filter((service) => {
    return (
      service.name.toLowerCase().includes(lowerQuery) ||
      service.description.toLowerCase().includes(lowerQuery) ||
      service.keywords.some((k) => k.includes(lowerQuery))
    );
  });
}

/**
 * Detect service from project name or context
 */
export function detectService(
  projectName: string,
  context?: string
): ServiceInfo | null {
  const searchText = `${projectName} ${context || ''}`.toLowerCase();

  // Find service with matching keywords
  for (const service of SERVICES) {
    for (const keyword of service.keywords) {
      if (searchText.includes(keyword)) {
        return service;
      }
    }
  }

  return null;
}

/**
 * Validate API key format for a service
 */
export function validateKeyFormat(
  serviceId: string,
  key: string
): { valid: boolean; error?: string } {
  const service = getServiceById(serviceId);
  if (!service) {
    return { valid: true }; // Unknown service, allow any format
  }

  if (!service.keyFormat) {
    return { valid: true }; // No format specified, allow any format
  }

  const valid = service.keyFormat.test(key);
  if (!valid) {
    let errorMessage = `Invalid ${service.name} API key format.`;
    if (service.keyPrefix) {
      errorMessage += ` Expected format starts with "${service.keyPrefix}"`;
    }
    return { valid: false, error: errorMessage };
  }

  return { valid: true };
}

/**
 * Get services by category
 */
export function getServicesByCategory(
  category: ServiceInfo['category']
): ServiceInfo[] {
  return SERVICES.filter((s) => s.category === category);
}

/**
 * Get popular services (top 8 for quick selection)
 */
export function getPopularServices(): ServiceInfo[] {
  return SERVICES.slice(0, 8);
}
