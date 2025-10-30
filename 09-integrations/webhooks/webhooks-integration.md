---
Document: Webhooks System - Integration Guide
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Backend Team
Status: Draft
Dependencies: 05-api/api-rest-design.md, 03-security/security-model.md, 04-database/schemas/audit-logs.md, TECH-STACK.md, GLOSSARY.md
---

# Webhooks System Integration

## Overview

This document defines Abyrith's webhook system for sending real-time notifications to external services when important events occur in the platform. The system enables integrations with Slack, email, custom endpoints, and other services, allowing teams to receive immediate alerts about secret access, team changes, and security events while maintaining zero-knowledge security architecture.

**External Service:** Webhook receivers (Slack, Discord, custom HTTP endpoints)

**Integration Type:** Outbound HTTP webhook notifications

**Status:** Active - Planned for Phase 5 (Post-MVP)

---

## Table of Contents

1. [Integration Purpose](#integration-purpose)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Configuration](#configuration)
5. [Event Types](#event-types)
6. [Webhook Payload Format](#webhook-payload-format)
7. [Implementation Details](#implementation-details)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Monitoring](#monitoring)
11. [Security Considerations](#security-considerations)
12. [Cost & Rate Limits](#cost--rate-limits)
13. [Troubleshooting](#troubleshooting)
14. [Dependencies](#dependencies)
15. [References](#references)
16. [Change Log](#change-log)

---

## Integration Purpose

### Business Value

**What it enables:**
- Real-time notifications when secrets are accessed or modified
- Team awareness of security events without constantly checking dashboard
- Integration with existing team communication tools (Slack, Discord, email)
- Automated workflows triggered by Abyrith events
- Compliance monitoring and alerting

**User benefits:**
- **For Solo Developers:** Email alerts when API keys are accessed
- **For Development Teams:** Slack notifications for team member changes
- **For Enterprise:** Custom webhook integrations with SIEM systems and incident response tools
- **For Security Teams:** Immediate alerts on suspicious activity

### Technical Purpose

**Responsibilities:**
- Send HTTP POST requests to registered webhook endpoints when events occur
- Sign payloads with HMAC for authenticity verification
- Retry failed deliveries with exponential backoff
- Log all webhook delivery attempts for debugging
- Support multiple webhook endpoints per organization
- Filter events based on webhook subscription preferences

**Integration Points:**
- Triggered by audit log events (secret access, team changes)
- Processed by Cloudflare Workers (edge-based delivery)
- Monitored via webhook delivery logs in Supabase

---

## Architecture

### System Diagram

```
┌────────────────────────────────────────────────────────┐
│          Abyrith Platform Events                       │
│  • Secret accessed                                     │
│  • Secret created/updated/deleted                      │
│  • Team member added/removed                           │
│  • Production secret accessed                          │
│  • MCP request approved/denied                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ Event triggers
                 ▼
┌────────────────────────────────────────────────────────┐
│      Cloudflare Worker: Webhook Dispatcher            │
│  ┌──────────────────────────────────────────────────┐ │
│  │  1. Receive event from audit log trigger         │ │
│  │  2. Query webhook subscriptions for org          │ │
│  │  3. Format payload based on event type           │ │
│  │  4. Generate HMAC signature                      │ │
│  │  5. Send HTTP POST to webhook endpoints          │ │
│  │  6. Log delivery status (success/failure)        │ │
│  │  7. Retry on failure (exponential backoff)       │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────┬───────────────────────────────────────┘
                 │
                 │ HTTPS POST with HMAC signature
                 ▼
         ┌───────┴───────┐
         │               │
         ▼               ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────┐
│ Slack API    │  │ Custom Endpoint  │  │ Email (SMTP)│
│ (slack.com)  │  │ (customer server)│  │ (SendGrid)  │
└──────────────┘  └──────────────────┘  └─────────────┘
```

### Data Flow

**Outbound (Abyrith → External Service):**
1. Event occurs in Abyrith (e.g., secret accessed)
2. Audit log entry created in PostgreSQL
3. Database trigger or Worker polls for new events
4. Worker queries `webhook_subscriptions` table for active webhooks
5. Worker formats event payload (JSON)
6. Worker generates HMAC signature using webhook secret
7. Worker sends HTTP POST to webhook URL
8. External service receives and verifies signature
9. Worker logs delivery status (success/failure, response code, timestamp)
10. On failure, Worker schedules retry (exponential backoff: 1s, 5s, 30s, 5m, 30m)

**Inbound (External Service → Abyrith):**
- No inbound webhooks in MVP (future: webhook validation endpoints)

### Components Involved

**Frontend:**
- `WebhookSettingsPage.tsx` - UI for managing webhook subscriptions
- `WebhookTestButton.tsx` - Test webhook delivery

**Backend:**
- `webhook-dispatcher.worker.ts` - Cloudflare Worker for webhook delivery
- `webhook-retry.worker.ts` - Scheduled worker for retrying failed deliveries
- Database table: `webhook_subscriptions` - Stores webhook configurations
- Database table: `webhook_deliveries` - Logs all delivery attempts

**External:**
- Slack Incoming Webhooks
- Discord Webhooks
- Email service (SendGrid)
- Customer HTTPS endpoints

---

## Authentication

### Authentication Method

**Type:** HMAC-SHA256 Signature

**How it works:**
1. Abyrith generates a random webhook secret (256-bit) when user creates webhook subscription
2. Secret is stored encrypted in database and displayed to user once
3. For each webhook delivery, Abyrith generates HMAC-SHA256 signature:
   ```
   signature = HMAC-SHA256(webhook_secret, request_body)
   ```
4. Signature included in `X-Abyrith-Signature` header
5. Receiver recomputes signature using their stored secret and compares
6. If signatures match, webhook is authentic and unmodified

### Credentials Management

**Where credentials are stored:**
- **Development:** Local Supabase database, encrypted with test key
- **Staging:** Supabase database, encrypted with staging encryption key
- **Production:** Supabase database, encrypted with production encryption key

**Credential Format:**
```typescript
interface WebhookSubscription {
  id: string;                    // UUID
  organization_id: string;       // Organization UUID
  url: string;                   // Webhook endpoint URL
  secret: string;                // Encrypted webhook secret (hex string)
  events: string[];              // Event types to subscribe to
  active: boolean;               // Enable/disable
  created_at: string;            // ISO 8601 timestamp
  created_by: string;            // User UUID
}
```

### Obtaining Credentials

**Step 1: Create Webhook Subscription**

User navigates to Settings > Webhooks > Add Webhook:

```typescript
// Frontend request
POST /api/webhooks
{
  "url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
  "events": ["secret.accessed", "secret.created", "member.added"],
  "name": "Slack Security Alerts"
}

// Response
{
  "id": "webhook_uuid",
  "url": "https://hooks.slack.com/...",
  "secret": "whsec_a1b2c3d4e5f6...",  // Shown once!
  "events": ["secret.accessed", "secret.created", "member.added"],
  "active": true,
  "created_at": "2025-10-30T12:00:00Z"
}
```

**Step 2: Store Secret Securely**

User copies webhook secret and stores it in their receiving application's environment:

```bash
# In receiver application
ABYRITH_WEBHOOK_SECRET=whsec_a1b2c3d4e5f6...
```

**Step 3: Verify Webhook Signature**

Receiver validates incoming webhooks:

```typescript
// Receiver application code
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express endpoint
app.post('/webhooks/abyrith', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-abyrith-signature'];
  const payload = req.body.toString('utf8');

  if (!verifyWebhookSignature(payload, signature, process.env.ABYRITH_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  const event = JSON.parse(payload);
  console.log('Received event:', event.type);

  res.status(200).send('OK');
});
```

---

## Configuration

### Environment Variables

**Required:**
```bash
SUPABASE_URL=https://example.supabase.co          # Supabase project URL
SUPABASE_SERVICE_KEY=xxx                          # Service role key
WEBHOOK_ENCRYPTION_KEY=xxx                        # 256-bit key for encrypting webhook secrets
SENDGRID_API_KEY=xxx                              # For email webhooks (optional)
```

**Optional:**
```bash
WEBHOOK_TIMEOUT=30000                             # Request timeout in ms (default: 30s)
WEBHOOK_MAX_RETRIES=5                             # Max retry attempts (default: 5)
WEBHOOK_RETRY_BACKOFF_BASE=1000                   # Initial retry delay in ms (default: 1s)
WEBHOOK_MAX_BODY_SIZE=1048576                     # Max payload size (default: 1MB)
```

### Configuration File

**Location:** `workers/webhook-dispatcher/config.ts`

**Structure:**
```typescript
interface WebhookConfig {
  timeout: number;              // HTTP request timeout (ms)
  maxRetries: number;           // Maximum retry attempts
  retryBackoffBase: number;     // Initial backoff delay (ms)
  maxBodySize: number;          // Maximum payload size (bytes)
  rateLimitPerOrg: number;      // Max webhooks per hour per org
  supportedEvents: string[];    // Allowed event types
}
```

**Example:**
```typescript
const config: WebhookConfig = {
  timeout: 30000,               // 30 seconds
  maxRetries: 5,
  retryBackoffBase: 1000,       // 1 second
  maxBodySize: 1048576,         // 1 MB
  rateLimitPerOrg: 1000,        // 1000 webhooks per hour
  supportedEvents: [
    'secret.created',
    'secret.accessed',
    'secret.updated',
    'secret.deleted',
    'secret.rotated',
    'member.added',
    'member.removed',
    'member.role_changed',
    'project.created',
    'project.archived',
    'mcp.request_approved',
    'mcp.request_denied',
    'security.suspicious_activity'
  ]
};
```

---

## Event Types

### Secret Events

**`secret.created`**
- **When:** A new secret is created
- **Payload includes:** Secret metadata (name, service, environment), creator info
- **Example use case:** Notify team when production secrets are added

**`secret.accessed`**
- **When:** A secret is viewed or decrypted
- **Payload includes:** Secret metadata, accessor info, IP address, user agent
- **Example use case:** Alert security team when production secrets are accessed

**`secret.updated`**
- **When:** A secret value is changed
- **Payload includes:** Secret metadata, updater info, change timestamp
- **Example use case:** Notify team of secret changes requiring coordination

**`secret.deleted`**
- **When:** A secret is permanently deleted
- **Payload includes:** Secret metadata, deleter info, deletion timestamp
- **Example use case:** Alert team of secret removals

**`secret.rotated`**
- **When:** A secret is rotated (new value generated)
- **Payload includes:** Secret metadata, rotator info, rotation timestamp
- **Example use case:** Trigger deployment workflows to update services

### Team Events

**`member.added`**
- **When:** A new team member is invited or joins
- **Payload includes:** New member info, inviter info, role assigned
- **Example use case:** Welcome message in Slack, security review trigger

**`member.removed`**
- **When:** A team member is removed or leaves
- **Payload includes:** Removed member info, remover info, removal reason
- **Example use case:** Audit trail, revoke access to external systems

**`member.role_changed`**
- **When:** A team member's role is changed
- **Payload includes:** Member info, old role, new role, changer info
- **Example use case:** Security review for privilege escalations

### Project Events

**`project.created`**
- **When:** A new project is created
- **Payload includes:** Project metadata, creator info
- **Example use case:** Initialize project in external systems

**`project.archived`**
- **When:** A project is archived
- **Payload includes:** Project metadata, archiver info, archive timestamp
- **Example use case:** Clean up external integrations

### MCP Events

**`mcp.request_approved`**
- **When:** An MCP secret request is approved
- **Payload includes:** Secret metadata, requester (AI tool), approver, approval timestamp
- **Example use case:** Audit AI tool access, security monitoring

**`mcp.request_denied`**
- **When:** An MCP secret request is denied
- **Payload includes:** Secret metadata, requester (AI tool), denier, denial reason
- **Example use case:** Track denied access attempts

### Security Events

**`security.suspicious_activity`**
- **When:** Suspicious activity detected (multiple failed access attempts, unusual access patterns)
- **Payload includes:** Activity details, user info, IP address, threat score
- **Example use case:** Immediate security team alert

---

## Webhook Payload Format

### Standard Webhook Payload

**All webhooks follow this structure:**

```typescript
interface WebhookPayload {
  id: string;                    // Unique webhook delivery ID (UUID)
  type: string;                  // Event type (e.g., "secret.accessed")
  version: string;               // Webhook schema version (e.g., "1.0")
  timestamp: string;             // ISO 8601 timestamp when event occurred
  organization_id: string;       // Organization UUID
  event: EventData;              // Event-specific data
  metadata: WebhookMetadata;     // Additional context
}

interface WebhookMetadata {
  environment: 'production' | 'staging' | 'development';
  request_id: string;            // Original request ID that triggered event
  webhook_subscription_id: string; // Webhook subscription UUID
}
```

### Event Payload Examples

**Example 1: `secret.accessed`**

```json
{
  "id": "wh_7f8e9d0c1b2a3456",
  "type": "secret.accessed",
  "version": "1.0",
  "timestamp": "2025-10-30T12:34:56.789Z",
  "organization_id": "org_a1b2c3d4e5f6",
  "event": {
    "secret": {
      "id": "secret_550e8400e29b41d4",
      "name": "OPENAI_API_KEY",
      "service": "OpenAI",
      "environment": "production",
      "project_id": "project_f47ac10b58cc",
      "project_name": "RecipeApp"
    },
    "accessor": {
      "user_id": "user_f47ac10b58cc4372",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "developer"
    },
    "access_details": {
      "ip_address": "203.0.113.42",
      "user_agent": "Mozilla/5.0...",
      "access_method": "web_ui",
      "timestamp": "2025-10-30T12:34:56.789Z"
    }
  },
  "metadata": {
    "environment": "production",
    "request_id": "req_9b0c1d2e3f4g5678",
    "webhook_subscription_id": "webhook_abc123"
  }
}
```

**Example 2: `member.added`**

```json
{
  "id": "wh_1a2b3c4d5e6f7890",
  "type": "member.added",
  "version": "1.0",
  "timestamp": "2025-10-30T14:00:00.000Z",
  "organization_id": "org_a1b2c3d4e5f6",
  "event": {
    "member": {
      "user_id": "user_9876543210abcdef",
      "email": "newdev@example.com",
      "name": "New Developer",
      "role": "developer"
    },
    "inviter": {
      "user_id": "user_f47ac10b58cc4372",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "admin"
    },
    "projects_granted": [
      {
        "project_id": "project_f47ac10b58cc",
        "project_name": "RecipeApp",
        "role": "developer"
      }
    ]
  },
  "metadata": {
    "environment": "production",
    "request_id": "req_abc123def456",
    "webhook_subscription_id": "webhook_abc123"
  }
}
```

**Example 3: `security.suspicious_activity`**

```json
{
  "id": "wh_suspicious_12345",
  "type": "security.suspicious_activity",
  "version": "1.0",
  "timestamp": "2025-10-30T15:30:00.000Z",
  "organization_id": "org_a1b2c3d4e5f6",
  "event": {
    "alert_type": "multiple_failed_access",
    "severity": "high",
    "description": "5 failed secret access attempts in 2 minutes",
    "user": {
      "user_id": "user_suspicious123",
      "email": "suspicious@example.com",
      "name": "Suspicious User"
    },
    "details": {
      "failed_attempts": 5,
      "time_window_minutes": 2,
      "ip_addresses": ["203.0.113.42", "203.0.113.43"],
      "attempted_secrets": [
        "STRIPE_SECRET_KEY",
        "AWS_ACCESS_KEY",
        "DATABASE_PASSWORD"
      ]
    },
    "recommended_action": "Review user activity and consider revoking access"
  },
  "metadata": {
    "environment": "production",
    "request_id": "req_security_alert",
    "webhook_subscription_id": "webhook_security"
  }
}
```

### Slack-Specific Formatting

For Slack webhook URLs, Abyrith can optionally format payloads as Slack Block Kit:

```json
{
  "text": "Secret accessed in production",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔑 Production Secret Accessed"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Secret:*\nOPENAI_API_KEY"
        },
        {
          "type": "mrkdwn",
          "text": "*Project:*\nRecipeApp"
        },
        {
          "type": "mrkdwn",
          "text": "*Accessed by:*\njane@example.com"
        },
        {
          "type": "mrkdwn",
          "text": "*When:*\n<!date^1730292896^{date_short_pretty} at {time}|2025-10-30 12:34:56>"
        }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Audit Log"
          },
          "url": "https://app.abyrith.com/audit?event_id=evt_123"
        }
      ]
    }
  ]
}
```

---

## Implementation Details

### Integration Code

**File:** `workers/webhook-dispatcher/index.ts`

**Implementation:**

```typescript
// Webhook dispatcher worker
interface WebhookDispatcherEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WEBHOOK_ENCRYPTION_KEY: string;
  KV: KVNamespace;  // For rate limiting
}

interface WebhookDeliveryRequest {
  subscription_id: string;
  event_id: string;
  payload: WebhookPayload;
}

export default {
  async fetch(request: Request, env: WebhookDispatcherEnv): Promise<Response> {
    // Parse incoming webhook delivery request
    const deliveryRequest: WebhookDeliveryRequest = await request.json();

    // Fetch webhook subscription details
    const subscription = await getWebhookSubscription(
      deliveryRequest.subscription_id,
      env
    );

    if (!subscription || !subscription.active) {
      return new Response('Webhook subscription not found or inactive', { status: 404 });
    }

    // Check rate limit
    const rateLimitKey = `ratelimit:webhook:${subscription.organization_id}`;
    const currentCount = await env.KV.get(rateLimitKey);
    if (currentCount && parseInt(currentCount) > 1000) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Increment rate limit counter
    await env.KV.put(
      rateLimitKey,
      String(parseInt(currentCount || '0') + 1),
      { expirationTtl: 3600 }  // 1 hour
    );

    // Decrypt webhook secret
    const webhookSecret = await decryptWebhookSecret(
      subscription.secret,
      env.WEBHOOK_ENCRYPTION_KEY
    );

    // Generate HMAC signature
    const payloadString = JSON.stringify(deliveryRequest.payload);
    const signature = await generateHMAC(payloadString, webhookSecret);

    // Send webhook
    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Abyrith-Signature': signature,
          'X-Abyrith-Delivery-ID': deliveryRequest.event_id,
          'X-Abyrith-Event-Type': deliveryRequest.payload.type,
          'User-Agent': 'Abyrith-Webhooks/1.0'
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000)  // 30s timeout
      });

      // Log successful delivery
      await logWebhookDelivery(env, {
        subscription_id: subscription.id,
        event_id: deliveryRequest.event_id,
        status: 'success',
        http_status: response.status,
        response_body: await response.text().catch(() => ''),
        attempt: 1,
        timestamp: new Date().toISOString()
      });

      return new Response('Webhook delivered', { status: 200 });

    } catch (error) {
      // Log failed delivery
      await logWebhookDelivery(env, {
        subscription_id: subscription.id,
        event_id: deliveryRequest.event_id,
        status: 'failed',
        error: error.message,
        attempt: 1,
        timestamp: new Date().toISOString()
      });

      // Schedule retry
      await scheduleRetry(env, deliveryRequest, 1);

      return new Response('Webhook delivery failed, scheduled retry', { status: 500 });
    }
  }
};

// Helper functions
async function generateHMAC(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getWebhookSubscription(
  subscriptionId: string,
  env: WebhookDispatcherEnv
): Promise<WebhookSubscription | null> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/webhook_subscriptions?id=eq.${subscriptionId}`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  const subscriptions = await response.json();
  return subscriptions[0] || null;
}

async function logWebhookDelivery(
  env: WebhookDispatcherEnv,
  delivery: WebhookDeliveryLog
): Promise<void> {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/webhook_deliveries`,
    {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(delivery)
    }
  );
}

async function scheduleRetry(
  env: WebhookDispatcherEnv,
  request: WebhookDeliveryRequest,
  attempt: number
): Promise<void> {
  if (attempt >= 5) {
    // Max retries reached, give up
    return;
  }

  // Exponential backoff: 1s, 5s, 30s, 5m, 30m
  const delays = [1000, 5000, 30000, 300000, 1800000];
  const delay = delays[attempt];

  // Schedule retry using Cloudflare Queues or Durable Objects
  // (Implementation depends on Cloudflare Workers feature choice)
  await fetch(`${env.WEBHOOK_RETRY_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...request,
      retry_attempt: attempt + 1,
      scheduled_for: Date.now() + delay
    })
  });
}
```

### Data Transformation

**Internal Event Format → Webhook Payload:**

```typescript
// Internal audit log event (database record)
interface AuditLogEvent {
  id: string;
  timestamp: string;
  user_id: string;
  action: string;                // 'secret.read', 'secret.create', etc.
  resource_type: string;          // 'secret', 'member', 'project'
  resource_id: string;
  organization_id: string;
  metadata: object;               // Event-specific details
}

// Transform to webhook payload
function transformToWebhookPayload(
  event: AuditLogEvent,
  subscription: WebhookSubscription
): WebhookPayload {
  return {
    id: generateWebhookDeliveryId(),
    type: event.action,
    version: '1.0',
    timestamp: event.timestamp,
    organization_id: event.organization_id,
    event: formatEventData(event),
    metadata: {
      environment: determineEnvironment(event),
      request_id: event.id,
      webhook_subscription_id: subscription.id
    }
  };
}

function formatEventData(event: AuditLogEvent): EventData {
  // Event-specific formatting based on action type
  switch (event.action) {
    case 'secret.read':
      return {
        secret: extractSecretInfo(event),
        accessor: extractUserInfo(event),
        access_details: extractAccessDetails(event)
      };

    case 'member.added':
      return {
        member: extractNewMemberInfo(event),
        inviter: extractInviterInfo(event),
        projects_granted: extractProjectAccess(event)
      };

    // ... other event types

    default:
      return event.metadata;
  }
}
```

---

## Error Handling

### Error Types

**Error 1: Network Timeout**
- **When:** Webhook endpoint doesn't respond within 30 seconds
- **External Code:** N/A (timeout)
- **Internal Code:** `WEBHOOK_TIMEOUT`
- **Recovery:** Retry with exponential backoff (up to 5 attempts)

**Error 2: HTTP 4xx (Client Error)**
- **When:** Webhook endpoint returns 400-499 status code
- **External Code:** 400, 401, 403, 404, etc.
- **Internal Code:** `WEBHOOK_CLIENT_ERROR`
- **Recovery:**
  - 404 Not Found: Disable webhook after 3 consecutive failures
  - 401/403: Notify user of authentication issue
  - Other 4xx: Do not retry (permanent failure)

**Error 3: HTTP 5xx (Server Error)**
- **When:** Webhook endpoint returns 500-599 status code
- **External Code:** 500, 502, 503, 504, etc.
- **Internal Code:** `WEBHOOK_SERVER_ERROR`
- **Recovery:** Retry with exponential backoff (up to 5 attempts)

**Error 4: Invalid Signature Verification Failure**
- **When:** Receiver rejects webhook due to signature mismatch
- **External Code:** 401 Unauthorized
- **Internal Code:** `WEBHOOK_SIGNATURE_REJECTED`
- **Recovery:** Log incident, notify webhook owner to check secret

**Error 5: Rate Limit Exceeded**
- **When:** Organization sends more than 1000 webhooks per hour
- **External Code:** N/A (internal limit)
- **Internal Code:** `WEBHOOK_RATE_LIMIT_EXCEEDED`
- **Recovery:** Queue webhooks, resume when rate limit resets

### Retry Strategy

**Retry Policy:**
- **Attempts:** 5 maximum
- **Backoff:** Exponential with jitter
- **Max wait:** 30 minutes

**Retriable Errors:**
- `NETWORK_TIMEOUT` - Temporary network issue
- `HTTP_502` - Bad Gateway (temporary)
- `HTTP_503` - Service Unavailable (temporary)
- `HTTP_504` - Gateway Timeout (temporary)

**Non-Retriable Errors:**
- `HTTP_400` - Bad Request (permanent)
- `HTTP_401` - Unauthorized (configuration issue)
- `HTTP_404` - Not Found (endpoint removed)
- `HTTP_410` - Gone (endpoint permanently removed)

**Implementation:**

```typescript
async function retryWithBackoff(
  deliveryFn: () => Promise<Response>,
  maxAttempts: number = 5
): Promise<Response> {
  const delays = [1000, 5000, 30000, 300000, 1800000]; // 1s, 5s, 30s, 5m, 30m

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await deliveryFn();

      // Success or non-retriable error
      if (response.ok || response.status < 500) {
        return response;
      }

      // Server error, retry if attempts remain
      if (attempt < maxAttempts - 1) {
        const delay = delays[attempt];
        await sleep(delay);
        continue;
      }

      return response; // Max attempts reached

    } catch (error) {
      // Network error or timeout
      if (attempt < maxAttempts - 1) {
        const delay = delays[attempt];
        await sleep(delay);
        continue;
      }

      throw error; // Max attempts reached
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Testing

### Unit Tests

**Test File:** `workers/webhook-dispatcher/webhook-dispatcher.test.ts`

**Mock Setup:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateHMAC, deliverWebhook } from './webhook-dispatcher';

describe('Webhook Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct HMAC signature', async () => {
    const payload = JSON.stringify({ type: 'secret.accessed', data: {} });
    const secret = 'test_secret_key';

    const signature = await generateHMAC(payload, secret);

    expect(signature).toHaveLength(64); // SHA-256 hex string
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should deliver webhook with correct headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'OK'
    });
    global.fetch = mockFetch;

    const subscription = {
      id: 'sub_123',
      url: 'https://example.com/webhook',
      secret: 'encrypted_secret',
      active: true
    };

    const payload = {
      id: 'wh_123',
      type: 'secret.accessed',
      version: '1.0',
      timestamp: '2025-10-30T12:00:00Z',
      organization_id: 'org_123',
      event: {},
      metadata: {}
    };

    await deliverWebhook(subscription, payload, mockEnv);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Abyrith-Signature': expect.any(String),
          'X-Abyrith-Delivery-ID': 'wh_123',
          'X-Abyrith-Event-Type': 'secret.accessed'
        })
      })
    );
  });

  it('should retry on server error', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = mockFetch;

    await deliverWebhookWithRetry(subscription, payload, mockEnv);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should not retry on client error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    global.fetch = mockFetch;

    await deliverWebhookWithRetry(subscription, payload, mockEnv);

    expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
  });
});
```

### Integration Tests

**Test Scenario 1: End-to-End Webhook Delivery**

```typescript
describe('Webhook Integration', () => {
  it('should deliver webhook when secret is accessed', async () => {
    // 1. Create webhook subscription
    const subscription = await createWebhookSubscription({
      url: 'http://localhost:3001/test-webhook',
      events: ['secret.accessed']
    });

    // 2. Start test webhook receiver
    const receivedWebhooks = [];
    const testServer = createTestWebhookServer((payload, signature) => {
      receivedWebhooks.push({ payload, signature });
    });

    // 3. Access a secret (trigger event)
    await accessSecret('secret_123');

    // 4. Wait for webhook delivery
    await waitFor(() => receivedWebhooks.length > 0, { timeout: 5000 });

    // 5. Verify webhook received
    expect(receivedWebhooks).toHaveLength(1);
    expect(receivedWebhooks[0].payload.type).toBe('secret.accessed');

    // 6. Verify signature
    const isValid = verifySignature(
      receivedWebhooks[0].payload,
      receivedWebhooks[0].signature,
      subscription.secret
    );
    expect(isValid).toBe(true);

    // Cleanup
    testServer.close();
  });
});
```

### Manual Testing

**Test in development:**

```bash
# 1. Start local webhook receiver
npx ngrok http 3001

# 2. Create webhook subscription pointing to ngrok URL
curl -X POST http://localhost:54321/rest/v1/webhook_subscriptions \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/webhook",
    "events": ["secret.accessed"],
    "name": "Test Webhook"
  }'

# 3. Access a secret in UI or via API
curl -X GET http://localhost:54321/rest/v1/secrets/secret_123 \
  -H "Authorization: Bearer YOUR_JWT"

# 4. Check ngrok dashboard for incoming webhook
# Verify signature manually:
echo -n '{"type":"secret.accessed",...}' | openssl dgst -sha256 -hmac 'YOUR_WEBHOOK_SECRET'
```

**Verify:**
- [x] Webhook received within 5 seconds of event
- [x] Signature header present and valid
- [x] Payload structure matches schema
- [x] Event data accurate and complete
- [x] Retry works on temporary failures

---

## Monitoring

### Metrics to Track

**Request Metrics:**
- **Webhook deliveries per hour** (by organization, by event type)
- **Success rate** (percentage of 200/201/202 responses)
- **Error rate** (percentage of 4xx/5xx responses)
- **Average latency** (time from event to delivery)
- **Retry rate** (percentage of webhooks requiring retry)

**Business Metrics:**
- **Active webhook subscriptions** (total, by organization)
- **Most common event types** (what events are users monitoring?)
- **Average webhooks per organization** (usage patterns)
- **Webhook churn** (subscriptions created vs. deleted)

### Logging

**Log Level:** INFO for normal operations, WARN for retries, ERROR for failures

**Logged Events:**
- Webhook delivery initiated
- Webhook delivery succeeded (with status code, latency)
- Webhook delivery failed (with error, status code, retry scheduled)
- Webhook subscription created/updated/deleted
- Rate limit exceeded

**Log Format:**

```typescript
{
  event: 'webhook.delivered',
  webhook_subscription_id: 'sub_123',
  event_type: 'secret.accessed',
  url: 'https://example.com/webhook',
  status: 'success',
  http_status: 200,
  latency_ms: 234,
  attempt: 1,
  organization_id: 'org_123',
  timestamp: '2025-10-30T12:34:56.789Z'
}
```

### Alerts

**Alert 1: High Webhook Failure Rate**
- **Condition:** More than 10% of webhooks failing for an organization over 5 minutes
- **Severity:** P2
- **Action:** Notify organization admin via email, check webhook endpoint health

**Alert 2: Webhook Endpoint Consistently Failing**
- **Condition:** Specific webhook URL failing 100% of requests for 15 minutes
- **Severity:** P3
- **Action:** Auto-disable webhook, send notification to creator with instructions to update endpoint

**Alert 3: Rate Limit Approaching**
- **Condition:** Organization at 80% of webhook rate limit (800/1000 per hour)
- **Severity:** P4
- **Action:** Send in-app notification, suggest increasing limit or filtering events

**Alert 4: Webhook Signature Rejections**
- **Condition:** Multiple webhooks rejected due to invalid signature
- **Severity:** P2
- **Action:** Notify webhook creator, suggest regenerating secret

---

## Security Considerations

### Data Privacy

**Data sent to external service:**
- Secret metadata (name, service, environment) - **NOT** the secret value
- User information (email, name, role)
- Event details (timestamp, action, IP address)
- Organization information

**Is it PII?**
- Yes: Email addresses, user names, IP addresses
- **Necessary?** Yes, required for audit trails and identifying who performed actions
- **GDPR compliance:** Users consent to webhook integrations; data is necessary for legitimate interest (security monitoring)

**Data received from external service:**
- HTTP status codes
- Response headers
- Response body (for debugging failed deliveries)
- Stored temporarily (24 hours) in webhook delivery logs

**How is it stored?**
- Webhook delivery logs in PostgreSQL
- RLS policies restrict access to organization members
- Logs auto-deleted after 30 days (configurable)

### Credential Security

**How credentials are protected:**
- **Storage:** Webhook secrets encrypted at rest using AES-256-GCM
- **Access control:** Only webhook creator and organization owners can view/rotate secrets
- **Rotation policy:** Secrets can be rotated on-demand; old secret remains valid for 24 hours during transition

**Secret Lifecycle:**
1. Generated: 256-bit random secret, base64-encoded
2. Displayed once: Shown to user immediately after creation
3. Stored encrypted: AES-256-GCM encryption using platform encryption key
4. Rotated: New secret generated, old secret deprecated after grace period
5. Revoked: Webhook subscription deleted, secret permanently destroyed

### Compliance

**GDPR (General Data Protection Regulation):**
- ✅ Right to access: Users can view all webhook subscriptions and delivery logs
- ✅ Right to deletion: Deleting webhook subscription removes all associated data
- ✅ Data minimization: Only necessary event data included in webhooks
- ✅ Consent: Users explicitly create webhook subscriptions (implied consent)
- ⚠️ Third-party data sharing: Webhook receiver must have own privacy policy

**SOC 2:**
- ✅ Audit trails: All webhook deliveries logged with timestamp, status, user
- ✅ Access control: Webhook management restricted to authorized users
- ✅ Encryption in transit: All webhooks sent over HTTPS
- ✅ Signature verification: HMAC ensures authenticity and integrity

### Threat Model

**Threat 1: Webhook Replay Attack**
- **Scenario:** Attacker captures webhook and replays it later
- **Mitigation:**
  - Include timestamp in payload
  - Receivers should reject webhooks older than 5 minutes
  - Include unique delivery ID (idempotency key)
- **Status:** Mitigated (documented in receiver best practices)

**Threat 2: Man-in-the-Middle**
- **Scenario:** Attacker intercepts webhook in transit
- **Mitigation:**
  - HTTPS enforced for all webhook URLs
  - Certificate verification
  - Reject HTTP webhooks (only HTTPS allowed)
- **Status:** Mitigated

**Threat 3: Webhook Secret Compromise**
- **Scenario:** Attacker obtains webhook secret, sends fake webhooks
- **Mitigation:**
  - Secrets encrypted at rest
  - Secret rotation capability
  - Monitor for unusual webhook patterns from external sources
- **Status:** Partially mitigated (secret rotation is manual)

**Threat 4: Webhook Endpoint as Attack Vector**
- **Scenario:** Malicious user creates webhook pointing to internal services (SSRF)
- **Mitigation:**
  - Block private IP ranges (10.x.x.x, 192.168.x.x, localhost)
  - Block cloud metadata endpoints (169.254.169.254)
  - URL validation before saving subscription
- **Status:** Mitigated

---

## Cost & Rate Limits

### Pricing Model

**Pricing structure:**
- **Free tier:** 100 webhook deliveries per day
- **Pro tier:** 1,000 webhook deliveries per day ($10/month)
- **Enterprise tier:** Unlimited webhooks (custom pricing)
- **Overage:** $0.01 per webhook beyond tier limit

**Estimated monthly cost:**
- Solo developers: $0 (within free tier)
- Small teams (10-20 webhooks/day): $0
- Medium teams (100-500 webhooks/day): $10/month
- Large teams (1000+ webhooks/day): $10-50/month

### Rate Limits

**Limits:**
- **Per organization:** 1,000 webhooks per hour (soft limit)
- **Per webhook endpoint:** 100 requests per minute (prevents runaway loops)
- **Global:** 100,000 webhooks per hour (platform capacity)

**How we handle limits:**
- **Queueing:** Webhooks exceeding hourly limit are queued (delivered next hour)
- **Throttling:** If queue exceeds 10,000, oldest webhooks dropped (FIFO)
- **Notification:** Organization admin notified when approaching limit (80%)

**Monitoring usage:**
- Dashboard shows webhook usage (last 7 days, current hour)
- Alert when approaching tier limit
- Option to upgrade tier or filter events

**Rate Limit Headers (not applicable for outbound webhooks):**
N/A - Abyrith sends webhooks; receivers may have their own rate limits

---

## Troubleshooting

### Issue 1: Webhooks Not Receiving

**Symptoms:**
```
Dashboard shows "Delivered: 200 OK" but webhook endpoint never received request
```

**Cause:** Firewall or load balancer blocking Cloudflare IP ranges

**Solution:**
```bash
# Whitelist Cloudflare IP ranges
# https://www.cloudflare.com/ips/

# Example nginx config
allow 173.245.48.0/20;
allow 103.21.244.0/22;
# ... (all Cloudflare ranges)
deny all;

# Verify Cloudflare connection
curl -I https://your-webhook-endpoint.com
# Should show "cf-ray" header if behind Cloudflare
```

### Issue 2: Signature Verification Failing

**Symptoms:**
```
Error: "Invalid webhook signature"
Webhook delivery shows 401 Unauthorized
```

**Cause:** Incorrect secret or payload transformation

**Solution:**
```typescript
// Verify you're using raw request body, not parsed JSON
// WRONG:
const body = JSON.stringify(req.body); // Re-serialization may differ

// CORRECT:
const body = await request.text(); // Raw request body
const signature = req.headers['x-abyrith-signature'];

// Verify signature
const expectedSignature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(body)  // Use raw body, not re-serialized
  .digest('hex');

if (signature !== expectedSignature) {
  console.error('Signature mismatch!');
  console.log('Received:', signature);
  console.log('Expected:', expectedSignature);
}
```

### Issue 3: Webhook Delays

**Symptoms:**
```
Webhooks arrive 5-10 minutes after event occurs
```

**Cause:** Retry backoff due to previous failures

**Solution:**
1. Check webhook delivery logs for failures
2. Verify endpoint is responding within 30 seconds
3. Check endpoint returns 2xx status code
4. Temporarily disable webhook, fix endpoint, re-enable
5. Test with "Send Test Webhook" button in settings

### Issue 4: Duplicate Webhooks

**Symptoms:**
```
Same event received multiple times
```

**Cause:** Receiver not responding, causing retries, or receiver processing too slow

**Solution:**
```typescript
// Implement idempotency using delivery ID
const processedWebhooks = new Set(); // Or use Redis

app.post('/webhook', async (req, res) => {
  const deliveryId = req.headers['x-abyrith-delivery-id'];

  // Check if already processed
  if (processedWebhooks.has(deliveryId)) {
    return res.status(200).send('Already processed');
  }

  // Process webhook
  await handleWebhook(req.body);

  // Mark as processed
  processedWebhooks.add(deliveryId);

  // Respond quickly (< 5 seconds)
  res.status(200).send('OK');
});
```

### Debug Mode

**Enable debug logging:**

```bash
# In Abyrith dashboard
Settings > Webhooks > [Your Webhook] > Enable Debug Logs

# Or via API
curl -X PATCH https://api.abyrith.com/v1/webhooks/sub_123 \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"debug": true}'
```

**What gets logged:**
- Full request payload (JSON)
- Request headers
- Response status and body
- Signature computation details
- Retry attempts and delays

**Debug logs retained for 7 days, then auto-deleted**

---

## Dependencies

### Technical Dependencies

**Must exist before integration:**
- [x] `05-api/api-rest-design.md` - REST API patterns for webhook management
- [x] `03-security/security-model.md` - HMAC signature implementation
- [ ] `04-database/schemas/audit-logs.md` - Audit log events trigger webhooks
- [ ] `04-database/schemas/webhook-subscriptions.md` - Webhook configuration storage

**External Dependencies:**
- Cloudflare Workers - Webhook dispatcher runtime
- Cloudflare Workers KV - Rate limiting storage
- Supabase PostgreSQL - Webhook subscriptions and delivery logs
- SendGrid - Email webhook delivery (optional)

### Feature Dependencies

**Required by features:**
- `08-features/notifications/slack-integration.md` - Slack-specific webhook formatting
- `08-features/notifications/email-alerts.md` - Email notifications via webhooks
- `10-operations/monitoring/webhook-monitoring.md` - Webhook health dashboards

---

## References

### Internal Documentation
- `05-api/api-rest-design.md` - REST API standards
- `03-security/security-model.md` - Security architecture
- `TECH-STACK.md` - Technology stack (Cloudflare Workers)
- `GLOSSARY.md` - Webhook, HMAC definitions

### External Resources
- [Webhook Best Practices](https://webhooks.fyi/) - Industry standards
- [HMAC Signatures](https://www.ietf.org/rfc/rfc2104.txt) - RFC 2104 specification
- [Slack Webhook Documentation](https://api.slack.com/messaging/webhooks) - Slack integration
- [Discord Webhook Guide](https://discord.com/developers/docs/resources/webhook) - Discord integration
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) - Platform constraints

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Backend Team | Initial webhooks integration documentation |

---

## Notes

### Future Improvements
- **Webhook transforms:** Allow users to customize payload format (JSONPath, templates)
- **Webhook batching:** Combine multiple events into single webhook (reduce noise)
- **Webhook filters:** Advanced filtering using SQL-like syntax
- **Webhook replay:** Re-send webhooks from history (for debugging)
- **Webhook signing algorithms:** Support RSA signatures in addition to HMAC
- **Inbound webhooks:** Accept webhooks from external services (e.g., secret rotation triggers)

### Known Limitations
- Maximum payload size: 1 MB (Cloudflare Workers limit)
- Maximum retry duration: 30 minutes (5 attempts)
- Delivery logs retained for 30 days only
- No support for custom HTTP methods (POST only)
- No support for custom headers (security risk)

### Integration Examples

**Slack Integration:**
```bash
# Get Slack webhook URL
https://api.slack.com/messaging/webhooks

# Add to Abyrith
Settings > Webhooks > Add Webhook
URL: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
Events: secret.accessed, member.added, security.suspicious_activity
Format: Slack Block Kit (auto-detected)
```

**Email Integration:**
```bash
# Use Abyrith's built-in email webhooks
Settings > Webhooks > Add Webhook
Type: Email
To: security-team@example.com
Events: secret.accessed, security.suspicious_activity
Subject: [Abyrith Alert] {event.type}
```

**Custom SIEM Integration:**
```bash
# Example: Splunk HEC (HTTP Event Collector)
URL: https://splunk.example.com:8088/services/collector
Headers:
  Authorization: Splunk YOUR_HEC_TOKEN
Events: All (for comprehensive logging)
Format: JSON (raw)
```
