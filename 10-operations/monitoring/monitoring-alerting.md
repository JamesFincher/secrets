---
Document: Monitoring and Alerting - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: DevOps Team
Status: Draft
Dependencies: 06-backend/cloudflare-workers/architecture.md, 06-backend/supabase/setup-guide.md, 02-architecture/system-overview.md
---

# Monitoring and Alerting Operations Runbook

## Overview

This runbook documents the monitoring and alerting infrastructure for the Abyrith platform, covering application metrics, performance monitoring, error tracking, and incident response procedures. It provides comprehensive guidance for setting up observability across Cloudflare Workers, Supabase, and the Next.js frontend.

**Purpose:** Ensure platform reliability through proactive monitoring, early anomaly detection, and rapid incident response.

**Frequency:** Continuous monitoring with weekly review of metrics and monthly optimization.

**Estimated Time:** Initial setup: 4-6 hours | Ongoing monitoring: 30 min/day review

**Risk Level:** Critical (production availability and user experience)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Monitoring Architecture](#monitoring-architecture)
5. [Cloudflare Analytics Setup](#cloudflare-analytics-setup)
6. [Supabase Monitoring](#supabase-monitoring)
7. [Application-Level Metrics](#application-level-metrics)
8. [Error Tracking with Sentry](#error-tracking-with-sentry)
9. [Alert Configuration](#alert-configuration)
10. [Dashboards and Visualization](#dashboards-and-visualization)
11. [Incident Response Procedures](#incident-response-procedures)
12. [Performance Baselines](#performance-baselines)
13. [Troubleshooting](#troubleshooting)
14. [Post-Procedure](#post-procedure)
15. [Communication](#communication)
16. [Dependencies](#dependencies)
17. [References](#references)
18. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Setting up monitoring for a new environment (staging, production)
- Configuring alerts for new services or features
- Investigating performance degradation or errors
- Responding to production incidents
- Conducting monthly monitoring health checks
- Onboarding new team members to operations

**Do NOT use this runbook when:**
- Making code changes (refer to development documentation)
- Deploying new features (use deployment runbook)
- Managing user accounts (use admin procedures)

### Scope

**What this covers:**
- Cloudflare Workers monitoring and analytics
- Supabase database and API monitoring
- Frontend application performance metrics
- Error tracking and reporting
- Alert configuration and incident response
- Dashboard setup and maintenance

**What this does NOT cover:**
- Security monitoring and intrusion detection (see `10-operations/security/security-monitoring.md`)
- Cost monitoring and optimization (separate financial operations)
- User behavior analytics (product analytics domain)
- Compliance audit logging (see `08-features/audit-logs.md`)

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Cloudflare Dashboard - Admin access to Abyrith account
- [ ] Supabase Dashboard - Owner or Admin access
- [ ] Sentry - Admin access (if using error tracking)
- [ ] PagerDuty or equivalent - Alerting system access
- [ ] Slack - Access to #alerts and #incidents channels

**Credentials:**
- [ ] Cloudflare API token (read/write for analytics)
- [ ] Supabase API keys (service_role for metrics access)
- [ ] Sentry DSN and auth token
- [ ] PagerDuty integration key
- [ ] Slack webhook URLs

**How to request access:**
Contact Engineering Lead or DevOps team via Slack #ops-access-requests channel.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
cloudflare --version  # Should be 3.x or higher
supabase --version    # Should be 1.x or higher
curl --version        # For API testing
jq --version          # For JSON parsing
```

**Installation:**
```bash
# If tools are missing
npm install -g wrangler  # Cloudflare CLI
npm install -g supabase  # Supabase CLI
brew install jq          # JSON processor (macOS)
```

### Required Knowledge

**You should understand:**
- Basic HTTP status codes and what they mean
- Database query performance concepts (indexes, query plans)
- Time-series metrics and percentiles (p50, p95, p99)
- Incident severity classification
- When to escalate vs. self-resolve issues

**Reference documentation:**
- `02-architecture/system-overview.md` - Platform architecture
- `10-operations/incidents/incident-response.md` - Incident procedures
- `TECH-STACK.md` - Technology specifications

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication
- [ ] Notify team in #ops channel: "Setting up monitoring for [environment]"
- [ ] Create tracking ticket: [Project Management System]
- [ ] Document monitoring endpoints for team reference

### 2. Environment Verification
- [ ] Confirm target environment (staging/production)
- [ ] Verify services are deployed and running
- [ ] Check existing monitoring setup (if any)
- [ ] Review current baseline metrics

### 3. Access Verification
- [ ] Test Cloudflare Dashboard access
- [ ] Test Supabase Dashboard access
- [ ] Verify API credentials are valid
- [ ] Confirm Slack webhook responds

### 4. Planning
- [ ] Define performance baselines (see section below)
- [ ] Identify critical metrics for your use case
- [ ] Determine alert thresholds
- [ ] Assign on-call rotation (if applicable)

### 5. Documentation
- [ ] Review this entire runbook
- [ ] Prepare incident response contacts
- [ ] Have rollback plan ready (if modifying existing setup)

---

## Monitoring Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Users / Clients                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              Cloudflare Pages (Frontend)             │
│  - Web Analytics (Page views, performance)           │
│  - Real User Monitoring (RUM)                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ API Calls
                       ▼
┌─────────────────────────────────────────────────────┐
│           Cloudflare Workers (API Gateway)           │
│  - Request metrics (count, latency, errors)          │
│  - CPU time tracking                                 │
│  - Rate limiting events                              │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ Database Queries
                       ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + Auth)            │
│  - Database metrics (connections, queries, errors)   │
│  - Auth events (logins, failures)                    │
│  - Storage usage                                     │
└─────────────────────────────────────────────────────┘

                       │
                       │ Error Reports
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Sentry (Optional)                  │
│  - Frontend errors and performance                   │
│  - Backend errors (Workers)                          │
│  - Release tracking                                  │
└─────────────────────────────────────────────────────┘

                       │
                       │ Alerts
                       ▼
┌─────────────────────────────────────────────────────┐
│              Alert Routing (PagerDuty)               │
│  - Critical: Page on-call engineer                   │
│  - Warning: Slack notification                       │
│  - Info: Log to monitoring channel                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
            Slack #alerts, #incidents
```

### Key Components

**Component 1: Cloudflare Analytics**
- **Purpose:** Monitor frontend and Workers performance
- **Metrics:** Request count, latency, status codes, bandwidth
- **Retention:** 30 days (free tier), 3+ months (paid)
- **Access:** Cloudflare Dashboard > Analytics

**Component 2: Supabase Monitoring**
- **Purpose:** Monitor database and API health
- **Metrics:** Database connections, query performance, auth events, API requests
- **Retention:** 7 days (free tier), 30+ days (paid)
- **Access:** Supabase Dashboard > Reports

**Component 3: Sentry (Optional)**
- **Purpose:** Error tracking and performance monitoring
- **Metrics:** Error rates, stack traces, user sessions, transaction performance
- **Retention:** 90 days (configurable)
- **Access:** Sentry Dashboard

**Component 4: Custom Metrics**
- **Purpose:** Application-specific business metrics
- **Implementation:** Workers KV + custom logging
- **Metrics:** Secret access counts, AI assistant usage, encryption operations
- **Retention:** 30 days in KV, longer in logs

---

## Cloudflare Analytics Setup

### Step 1: Enable Web Analytics

**Purpose:** Track frontend performance and user traffic

**Commands:**
```bash
# Log in to Cloudflare via CLI
wrangler login

# Enable Web Analytics for Pages deployment
wrangler pages deployment list --project-name=abyrith-frontend

# Web Analytics is automatically enabled for Cloudflare Pages
# Verify in Dashboard: Cloudflare > Web Analytics > abyrith.com
```

**Expected output:**
```
✅ Web Analytics enabled for abyrith.com
  Tracking ID: [generated-id]
```

**Manual Dashboard Setup:**
1. Navigate to Cloudflare Dashboard
2. Go to "Web Analytics"
3. Select your site (abyrith.com)
4. Copy the Site Tag (for verification)
5. Verify JavaScript snippet is loaded on all pages

**Metrics Available:**
- **Page views** - Total visits to each page
- **Unique visitors** - Distinct users (cookieless)
- **Page load time** - Time to fully load page
- **Core Web Vitals:**
  - LCP (Largest Contentful Paint) - should be < 2.5s
  - FID (First Input Delay) - should be < 100ms
  - CLS (Cumulative Layout Shift) - should be < 0.1
- **Bounce rate** - Users leaving without interaction
- **Top pages** - Most visited routes

**Time:** ~5 minutes

---

### Step 2: Enable Workers Analytics

**Purpose:** Monitor API performance and errors

**Commands:**
```bash
# Workers Analytics is automatically enabled
# Check current metrics via API
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "query": "SELECT status, COUNT(*) FROM workers_logs WHERE timestamp > NOW() - INTERVAL '\''1'\'' HOUR GROUP BY status"
  }'
```

**Expected output:**
```json
{
  "data": [
    {"status": 200, "count": 15234},
    {"status": 404, "count": 45},
    {"status": 500, "count": 2}
  ],
  "success": true
}
```

**Dashboard Access:**
1. Cloudflare Dashboard > Workers & Pages
2. Select your Worker (e.g., `abyrith-api-gateway`)
3. Click "Metrics" tab
4. View real-time and historical data

**Key Metrics to Monitor:**
- **Requests per second** - Traffic volume
- **Success rate** - % of 2xx responses (target: > 99.5%)
- **Error rate** - % of 5xx responses (target: < 0.5%)
- **CPU time** - Execution duration (target: < 50ms p95)
- **Subrequests** - API calls to Supabase

**Time:** ~10 minutes

---

### Step 3: Configure Custom Metrics in Workers

**Purpose:** Track application-specific events

**Implementation:**
Add custom logging to your Workers:

```typescript
// In your Worker code
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const start = Date.now();
    const url = new URL(request.url);

    try {
      // Your API logic here
      const response = await handleRequest(request, env);

      // Log successful request
      logMetric(env, {
        path: url.pathname,
        method: request.method,
        status: response.status,
        duration: Date.now() - start,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      // Log error
      logError(env, {
        path: url.pathname,
        method: request.method,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

function logMetric(env: Env, metric: object): void {
  // Write to Analytics Engine (if available)
  if (env.ANALYTICS) {
    env.ANALYTICS.writeDataPoint(metric);
  }

  // Also log to console (visible in Cloudflare Logs)
  console.log(JSON.stringify({ type: 'metric', ...metric }));
}

function logError(env: Env, error: object): void {
  console.error(JSON.stringify({ type: 'error', ...error }));

  // Optionally send to external error tracking
  if (env.SENTRY_DSN) {
    // Send to Sentry
  }
}
```

**Deploy updated Worker:**
```bash
wrangler deploy
```

**Verification:**
```bash
# View live logs
wrangler tail abyrith-api-gateway --format=pretty

# Should see metrics logged for each request
```

**Time:** ~30 minutes

---

## Supabase Monitoring

### Step 1: Database Performance Monitoring

**Purpose:** Monitor PostgreSQL health and query performance

**Dashboard Access:**
1. Supabase Dashboard > Your Project
2. Click "Reports" in left sidebar
3. View "Database" tab

**Key Metrics:**

**Database Connections:**
```sql
-- Run in SQL Editor to check current connections
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity
WHERE datname = current_database();
```

**Target:** Active connections < 80% of max (Supabase free tier: < 40 connections)

**Expected output:**
```
total_connections | active_connections | idle_connections
        15        |         3          |       12
```

---

**Slow Queries:**
```sql
-- Identify slow queries (> 1 second)
SELECT
  userid,
  datname,
  query,
  calls,
  total_time / 1000 as total_seconds,
  mean_time / 1000 as mean_seconds,
  max_time / 1000 as max_seconds
FROM pg_stat_statements
WHERE mean_time > 1000  -- 1 second
ORDER BY mean_time DESC
LIMIT 10;
```

**Target:** Mean query time < 100ms for 95% of queries

---

**Cache Hit Ratio:**
```sql
-- Check cache effectiveness
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

**Target:** Cache hit ratio > 99%

**Expected output:**
```
heap_read | heap_hit | cache_hit_ratio
   1000   | 99000    |      0.99
```

---

**Table Sizes:**
```sql
-- Monitor table growth
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY size_bytes DESC;
```

**Action:** Alert if any table exceeds expected growth rate

---

### Step 2: API Request Monitoring

**Purpose:** Monitor Supabase API usage and errors

**Dashboard View:**
1. Supabase Dashboard > Reports > API
2. View request volume, latency, error rates

**Key Metrics:**
- **API requests per hour** - Track usage trends
- **API response time** - p50, p95, p99 (target: p95 < 200ms)
- **Error rate** - 4xx and 5xx responses (target: < 1%)
- **Authentication events** - Login success/failure rate

**API Health Check:**
```bash
# Test API responsiveness
time curl -X GET \
  "https://[project-ref].supabase.co/rest/v1/organizations?select=count" \
  -H "apikey: [anon-key]" \
  -H "Authorization: Bearer [user-jwt]"
```

**Expected output:**
```bash
[{"count": 42}]
real    0m0.089s  # Should be < 200ms
```

**Time:** ~15 minutes

---

### Step 3: Authentication Monitoring

**Purpose:** Track auth events and anomalies

**Dashboard View:**
Supabase Dashboard > Authentication > Users (shows recent activity)

**Key Metrics:**
```sql
-- Failed login attempts in last 24 hours
SELECT
  email,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM auth.audit_log_entries
WHERE action = 'login'
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY email
HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;
```

**Alert:** Multiple failed logins may indicate brute force attack

---

**Active Sessions:**
```sql
-- Count active user sessions
SELECT
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_sessions
FROM auth.sessions
WHERE expires_at > NOW();
```

**Time:** ~10 minutes

---

### Step 4: Storage Monitoring (if using Supabase Storage)

**Purpose:** Track storage usage for avatars, exports, etc.

**Dashboard View:**
Supabase Dashboard > Storage > Usage

**API Query:**
```bash
# Get storage metrics
curl -X GET \
  "https://[project-ref].supabase.co/storage/v1/buckets" \
  -H "apikey: [service-role-key]" \
  -H "Authorization: Bearer [service-role-key]"
```

**Key Metrics:**
- **Total storage used** (MB/GB)
- **Number of files**
- **Bandwidth used** (downloads)

**Alert:** Storage > 80% of plan limit

**Time:** ~5 minutes

---

## Application-Level Metrics

### Step 1: Frontend Performance Monitoring

**Purpose:** Track client-side performance and errors

**Implementation:**
Add performance monitoring to Next.js app:

```typescript
// app/layout.tsx or _app.tsx
import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Report Web Vitals
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(sendToAnalytics);
        getFID(sendToAnalytics);
        getFCP(sendToAnalytics);
        getLCP(sendToAnalytics);
        getTTFB(sendToAnalytics);
      });
    }
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}

function sendToAnalytics(metric: any) {
  // Send to your analytics endpoint
  const body = JSON.stringify(metric);
  const url = '/api/analytics/web-vitals';

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
  } else {
    fetch(url, { body, method: 'POST', keepalive: true });
  }
}
```

**API Endpoint to receive metrics:**
```typescript
// app/api/analytics/web-vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const metric = await request.json();

  // Log to Workers KV or external service
  console.log('Web Vital:', metric);

  // Optionally store in Workers KV for aggregation
  // await env.METRICS_KV.put(`vitals:${metric.id}`, JSON.stringify(metric), {
  //   expirationTtl: 86400 // 24 hours
  // });

  return NextResponse.json({ success: true });
}
```

**Key Metrics:**
- **LCP (Largest Contentful Paint)** - Target: < 2.5s
- **FID (First Input Delay)** - Target: < 100ms
- **CLS (Cumulative Layout Shift)** - Target: < 0.1
- **FCP (First Contentful Paint)** - Target: < 1.8s
- **TTFB (Time to First Byte)** - Target: < 600ms

**Time:** ~45 minutes

---

### Step 2: Business Metrics Tracking

**Purpose:** Monitor application-specific KPIs

**Implementation:**
Add custom event tracking:

```typescript
// lib/analytics.ts
export class AnalyticsService {
  static async trackSecretAccess(secretId: string, userId: string, source: 'ui' | 'mcp' | 'api') {
    // Log secret access event
    await fetch('/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        event: 'secret_accessed',
        secret_id: secretId,
        user_id: userId,
        source,
        timestamp: new Date().toISOString()
      })
    });
  }

  static async trackAIQuery(query: string, model: string, durationMs: number) {
    // Log AI assistant usage
    await fetch('/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        event: 'ai_query',
        model,
        duration_ms: durationMs,
        timestamp: new Date().toISOString()
      })
    });
  }

  static async trackEncryptionOperation(operation: 'encrypt' | 'decrypt', durationMs: number) {
    // Log encryption performance
    await fetch('/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        event: 'encryption_operation',
        operation,
        duration_ms: durationMs,
        timestamp: new Date().toISOString()
      })
    });
  }
}
```

**Key Business Metrics:**
- **Secret access frequency** - Daily/weekly active secrets
- **AI assistant usage** - Queries per day, model distribution
- **MCP requests** - Claude Code/Cursor integration usage
- **Encryption operations** - Performance of client-side crypto
- **User onboarding funnel** - Signup → First project → First secret

**Time:** ~1 hour

---

### Step 3: Rate Limiting Metrics

**Purpose:** Monitor API abuse and rate limit effectiveness

**Implementation:**
Track rate limit events in Workers:

```typescript
// In rate limiting middleware
export async function rateLimit(request: Request, env: Env): Promise<Response | null> {
  const clientId = getClientId(request); // IP or user ID
  const key = `ratelimit:${clientId}`;

  const current = await env.KV.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= MAX_REQUESTS_PER_MINUTE) {
    // Log rate limit exceeded
    console.warn(JSON.stringify({
      type: 'rate_limit_exceeded',
      client_id: clientId,
      current_count: count,
      timestamp: new Date().toISOString()
    }));

    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': MAX_REQUESTS_PER_MINUTE.toString(),
        'X-RateLimit-Remaining': '0'
      }
    });
  }

  await env.KV.put(key, (count + 1).toString(), { expirationTtl: 60 });
  return null; // Allow request
}
```

**Metrics to Track:**
- **Rate limit hits per hour** - Track abusive clients
- **Top offending IPs/users** - Investigate patterns
- **False positives** - Legitimate users hitting limits

**Time:** ~30 minutes

---

## Error Tracking with Sentry

### Step 1: Install Sentry (Optional but Recommended)

**Purpose:** Centralized error tracking with stack traces

**Installation:**
```bash
# Install Sentry SDKs
pnpm add @sentry/nextjs @sentry/node
```

**Configuration:**
```bash
# Initialize Sentry
npx @sentry/wizard@latest -i nextjs
```

Follow wizard prompts to configure.

**Manual Configuration:**
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }
    return event;
  }
});
```

```typescript
// sentry.server.config.ts (for Workers)
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  tracesSampleRate: 0.2 // 20% of transactions
});
```

**Time:** ~20 minutes

---

### Step 2: Frontend Error Tracking

**Purpose:** Catch React errors and unhandled exceptions

**Error Boundary:**
```typescript
// components/ErrorBoundary.tsx
import * as Sentry from '@sentry/nextjs';
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong.</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Wrap your app:
```typescript
// app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

**Time:** ~15 minutes

---

### Step 3: Backend Error Tracking

**Purpose:** Catch Workers and API errors

**Implementation:**
```typescript
// In your Worker
import * as Sentry from '@sentry/node';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      // Report to Sentry
      Sentry.captureException(error, {
        tags: {
          handler: 'fetch',
          url: request.url
        },
        extra: {
          method: request.method,
          headers: Object.fromEntries(request.headers)
        }
      });

      // Return error response
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
```

**Key Sentry Features:**
- **Stack traces** - Full error context
- **Breadcrumbs** - Events leading to error
- **Release tracking** - Errors per deployment
- **User context** - Which users affected
- **Performance monitoring** - Transaction traces

**Time:** ~15 minutes

---

## Alert Configuration

### Step 1: Define Alert Thresholds

**Purpose:** Establish clear alert criteria

**Critical Alerts (Page on-call engineer):**
- **Service down** - 5xx error rate > 10% for 5 minutes
- **Database connection pool exhausted** - Active connections > 95%
- **API response time** - p95 > 5 seconds for 10 minutes
- **Zero requests** - No traffic for 5 minutes (possible outage)

**Warning Alerts (Slack notification):**
- **High error rate** - 5xx errors > 1% for 10 minutes
- **Slow database queries** - p95 > 1 second
- **High CPU usage** - Workers CPU time > 100ms p95
- **Cache hit ratio low** - Database cache hits < 90%
- **Rate limit abuse** - > 100 rate limit hits per hour

**Info Alerts (Log to monitoring channel):**
- **Authentication failures** - > 50 failed logins per hour
- **New user signups** - For awareness
- **Storage approaching limit** - > 80% of quota

---

### Step 2: Configure PagerDuty Integration

**Purpose:** Route critical alerts to on-call engineer

**Setup:**
1. Create PagerDuty account (if not exists)
2. Create service integration for Abyrith
3. Get integration key

**Cloudflare Notifications:**
```bash
# Set up via Cloudflare Dashboard:
# 1. Go to Notifications
# 2. Create new notification
# 3. Select event type (e.g., "Worker error rate")
# 4. Add PagerDuty as destination
```

**Manual API:**
```bash
# Create Cloudflare notification via API
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/alerting/v3/policies" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "High Worker Error Rate",
    "alert_type": "workers_alert",
    "description": "Alert when Worker 5xx errors exceed threshold",
    "enabled": true,
    "filters": {
      "services": ["abyrith-api-gateway"],
      "event_type": ["error_rate_exceeded"]
    },
    "mechanisms": {
      "pagerduty": [{
        "integration_key": "{pagerduty_key}"
      }]
    }
  }'
```

**Time:** ~30 minutes

---

### Step 3: Configure Slack Notifications

**Purpose:** Send non-critical alerts to team channel

**Setup Slack Incoming Webhook:**
1. Go to Slack App Settings
2. Create Incoming Webhook
3. Select channel (#alerts)
4. Copy webhook URL

**Cloudflare Integration:**
```bash
# Add Slack to Cloudflare notifications
# Dashboard: Notifications > Add destination > Slack
# Paste webhook URL
```

**Custom Alerts from Workers:**
```typescript
// Send alert to Slack from Worker
async function sendSlackAlert(message: string, env: Env) {
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Abyrith Alert: ${message}`,
      username: 'Abyrith Monitoring',
      icon_emoji: ':warning:'
    })
  });
}

// Usage
if (errorRate > 0.01) {
  await sendSlackAlert(
    `High error rate detected: ${(errorRate * 100).toFixed(2)}% over last 10 minutes`,
    env
  );
}
```

**Alert Message Format:**
```
🚨 [SEVERITY] Alert Type
Environment: production
Metric: [metric_name]
Current Value: [value]
Threshold: [threshold]
Time: [timestamp]
Dashboard: [link]
Runbook: [link to this doc]
```

**Time:** ~20 minutes

---

### Step 4: Configure Email Alerts (Fallback)

**Purpose:** Backup notification method

**Setup:**
1. Cloudflare Dashboard > Notifications
2. Add email destination
3. Verify email address
4. Add to alert policies

**Email is used for:**
- Daily/weekly summary reports
- Backup when Slack/PagerDuty unavailable
- Compliance notifications

**Time:** ~10 minutes

---

## Dashboards and Visualization

### Step 1: Cloudflare Dashboard Bookmarks

**Purpose:** Quick access to key metrics

**Bookmarks to create:**
1. **Workers Overview:**
   - URL: `https://dash.cloudflare.com/workers`
   - Shows: All Workers, request volume, errors

2. **Pages Analytics:**
   - URL: `https://dash.cloudflare.com/pages`
   - Shows: Frontend performance, deployments

3. **Web Analytics:**
   - URL: `https://dash.cloudflare.com/web-analytics`
   - Shows: User traffic, page views, Core Web Vitals

---

### Step 2: Supabase Reports Dashboard

**Purpose:** Database and API health at a glance

**Dashboard Views:**
1. **Database Tab:**
   - Connections, queries, cache hits
   - Refresh every 5 minutes

2. **API Tab:**
   - Request volume, latency, errors
   - Auth events

3. **Logs Tab:**
   - Real-time logs for debugging
   - Filter by level (error, warning, info)

---

### Step 3: Custom Grafana Dashboard (Advanced)

**Purpose:** Unified view of all metrics

**Setup (Optional):**
If you need advanced visualization:

1. Deploy Grafana (self-hosted or cloud)
2. Add data sources:
   - Cloudflare (via API)
   - Supabase (via API)
   - Sentry (via plugin)
3. Create dashboard with panels:
   - Request rate over time
   - Error rate by endpoint
   - Database connections
   - p95 latency
   - Active users

**Time:** ~2 hours (advanced setup)

---

### Step 4: Daily Operations Dashboard

**Purpose:** Morning health check view

**Create a simple HTML dashboard:**

```html
<!-- dashboard.html - host on Cloudflare Pages -->
<!DOCTYPE html>
<html>
<head>
  <title>Abyrith Operations Dashboard</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    .metric { padding: 10px; margin: 10px; border: 1px solid #ccc; }
    .good { background: #d4edda; }
    .warning { background: #fff3cd; }
    .critical { background: #f8d7da; }
  </style>
</head>
<body>
  <h1>Abyrith Operations Dashboard</h1>
  <div id="metrics"></div>

  <script>
    async function loadMetrics() {
      // Fetch metrics from your API
      const response = await fetch('/api/metrics/summary');
      const metrics = await response.json();

      // Render metrics
      const container = document.getElementById('metrics');
      container.innerHTML = metrics.map(m => `
        <div class="metric ${m.status}">
          <h3>${m.name}</h3>
          <p>Current: ${m.value} | Threshold: ${m.threshold}</p>
          <p>Last updated: ${new Date(m.timestamp).toLocaleString()}</p>
        </div>
      `).join('');
    }

    loadMetrics();
    setInterval(loadMetrics, 60000); // Refresh every minute
  </script>
</body>
</html>
```

**Metrics to display:**
- ✅ API uptime (last 24h)
- ✅ Error rate (< 0.5%)
- ✅ Database connections (< 80%)
- ✅ Average response time (< 200ms)
- ✅ Active users (current count)

**Time:** ~1 hour

---

## Incident Response Procedures

### Step 1: Incident Detection

**How incidents are detected:**
1. **Automated alerts** - PagerDuty page or Slack notification
2. **User reports** - Support tickets or social media
3. **Manual discovery** - During monitoring review
4. **External monitors** - Third-party uptime services

**Initial Response (within 5 minutes):**
- [ ] Acknowledge alert in PagerDuty
- [ ] Post in #incidents Slack channel
- [ ] Open incident tracking ticket
- [ ] Begin investigation

---

### Step 2: Incident Severity Classification

**P0 - Critical (All hands on deck):**
- Platform completely unavailable
- Data breach or security incident
- Data loss affecting users
- **Response time:** Immediate
- **Resolution target:** < 1 hour

**P1 - High (On-call + backup):**
- Major feature unavailable
- Performance severely degraded (> 5s response times)
- High error rate (> 10%)
- **Response time:** Within 15 minutes
- **Resolution target:** < 4 hours

**P2 - Medium (On-call handles):**
- Minor feature degraded
- Elevated error rate (1-5%)
- Performance impact for some users
- **Response time:** Within 1 hour
- **Resolution target:** < 24 hours

**P3 - Low (Next business day):**
- Cosmetic issues
- Non-critical bugs
- Performance optimization opportunities
- **Response time:** Next business day
- **Resolution target:** < 1 week

---

### Step 3: Incident Response Flow

**Phase 1: Assess (0-5 minutes)**
1. Check dashboards (Cloudflare, Supabase, Sentry)
2. Review recent deployments or changes
3. Determine severity level
4. Identify affected services and users

**Phase 2: Communicate (5-10 minutes)**
1. Post status in #incidents: "Investigating [issue]"
2. Update status page (if customer-facing)
3. Notify stakeholders (product, support)
4. Set up war room (Slack huddle or Zoom)

**Phase 3: Mitigate (10 minutes - ?)
1. Apply immediate fix if known
2. Rollback recent deployment if suspected
3. Scale resources if capacity issue
4. Enable maintenance mode if necessary

**Phase 4: Resolve (Ongoing)**
1. Implement proper fix
2. Test fix in staging
3. Deploy to production
4. Monitor for 30 minutes post-fix

**Phase 5: Post-Mortem (Within 48 hours)**
1. Write incident report (see template below)
2. Identify root cause
3. Document lessons learned
4. Create action items to prevent recurrence
5. Share with team

---

### Step 4: Incident Communication Templates

**Initial Announcement:**
```
🚨 INCIDENT: [Brief Description]
Status: Investigating
Severity: [P0/P1/P2/P3]
Impact: [What's affected]
Started: [Time]
Lead: @[engineer]
Updates: Every 15 minutes
```

**Progress Update:**
```
📊 UPDATE: [Issue description]
Status: [Investigating/Mitigating/Resolved]
Progress: [What's been done]
ETA: [Estimated resolution]
Next update: [Time]
```

**Resolution:**
```
✅ RESOLVED: [Issue description]
Duration: [Total time]
Root cause: [Brief explanation]
Fix: [What was done]
Post-mortem: [Link or "Coming within 48h"]
Thank you for your patience!
```

---

### Step 5: Common Incident Scenarios

**Scenario 1: Database Connection Pool Exhausted**

**Symptoms:**
- Errors: "remaining connection slots reserved for non-replication superuser connections"
- API requests timing out

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

**Solution:**
```sql
-- Terminate idle connections (if safe)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';
```

**Prevention:**
- Configure connection pooling (PgBouncer)
- Set connection timeouts
- Monitor connection growth trends

---

**Scenario 2: High Worker Error Rate**

**Symptoms:**
- Cloudflare alerts: 5xx errors spiking
- Users reporting "Internal Server Error"

**Diagnosis:**
```bash
# View Worker logs
wrangler tail abyrith-api-gateway --status=error
```

**Common causes:**
- Supabase API key expired or invalid
- Rate limiting external API (Claude, FireCrawl)
- Database down or unreachable
- Code bug in recent deployment

**Solution:**
- Rollback to previous version: `wrangler rollback`
- Check environment variables: `wrangler secret list`
- Verify external services operational

---

**Scenario 3: Slow API Response Times**

**Symptoms:**
- p95 latency > 5 seconds
- Users reporting "app is slow"

**Diagnosis:**
```sql
-- Check slow queries
SELECT query, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

**Common causes:**
- Missing database indexes
- N+1 query problem
- Database CPU/memory maxed out
- Cloudflare Workers hitting CPU limits

**Solution:**
- Add missing indexes
- Optimize queries (use `EXPLAIN ANALYZE`)
- Upgrade Supabase plan (if resource-constrained)
- Cache frequently accessed data

---

**Scenario 4: Authentication Service Down**

**Symptoms:**
- Users can't log in
- Auth API returning errors

**Diagnosis:**
- Check Supabase status page: https://status.supabase.com
- Test auth endpoint manually

**Solution:**
- If Supabase outage: Enable maintenance mode, communicate to users
- If configuration issue: Review auth settings, check secrets
- If JWT expired: Verify JWT secret and expiration settings

---

## Performance Baselines

### Target Metrics (Production)

**API Performance:**
- **p50 response time:** < 100ms
- **p95 response time:** < 200ms
- **p99 response time:** < 500ms
- **Success rate:** > 99.5%
- **Error rate:** < 0.5%

**Database Performance:**
- **Query p95:** < 100ms
- **Connection pool usage:** < 80%
- **Cache hit ratio:** > 99%
- **Active connections:** < 40 (free tier)

**Frontend Performance:**
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **Time to Interactive:** < 3.5s

**Business Metrics:**
- **Active users (DAU):** [Baseline depends on growth stage]
- **Secret access success rate:** > 99%
- **AI assistant query success rate:** > 95%
- **MCP request approval time:** < 5 minutes (human approval)

**Availability:**
- **Uptime target:** 99.9% (< 43 minutes downtime per month)

---

### Establishing Baselines

**Week 1-2 (Observation Period):**
1. Deploy monitoring to production
2. Collect data without alerts
3. Identify normal patterns
4. Document peak vs. off-peak metrics

**Week 3 (Set Thresholds):**
1. Calculate p50, p95, p99 for key metrics
2. Add 20-30% buffer for alert thresholds
3. Enable alerts starting with critical only
4. Tune over next 2 weeks

**Quarterly Reviews:**
- Review baselines as traffic grows
- Adjust thresholds to match new normal
- Identify optimization opportunities
- Update documentation

---

## Troubleshooting

### Issue 1: Cloudflare Analytics Not Showing Data

**Symptoms:**
```
Dashboard shows "No data available"
```

**Cause:** Beacon may be blocked by ad blockers or privacy settings

**Solution:**
1. Verify Web Analytics is enabled for your site
2. Check browser console for errors
3. Test from different network/browser
4. Ensure JavaScript is not blocked
5. Wait up to 5 minutes for data to appear

**If still not working:**
```bash
# Verify via API
curl -X GET \
  "https://api.cloudflare.com/client/v4/zones/{zone_id}/analytics/dashboard" \
  -H "Authorization: Bearer {api_token}"
```

---

### Issue 2: Supabase Dashboard Shows High Query Times

**Symptoms:**
```
Query p95 suddenly increased from 50ms to 500ms
```

**Cause:** Missing index, increased data volume, or query plan changed

**Solution:**
```sql
-- Identify the slow query
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 5;

-- Analyze the query
EXPLAIN ANALYZE [your slow query here];

-- Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';

-- If index missing, add it:
CREATE INDEX idx_secrets_project_id ON secrets(project_id);
```

---

### Issue 3: Sentry Not Receiving Errors

**Symptoms:**
```
Known errors not appearing in Sentry dashboard
```

**Cause:** Incorrect DSN, errors not being captured, or sampling rate too low

**Solution:**
```typescript
// Verify DSN is correct
console.log('Sentry DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN);

// Test Sentry manually
import * as Sentry from '@sentry/nextjs';

Sentry.captureException(new Error('Test error from monitoring setup'));

// Check sampling rate (should be > 0)
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1 // Should be between 0.01 - 1.0
});
```

**Verify in Sentry Dashboard:**
- Go to Projects > Abyrith
- Check "Issues" tab for test error
- If not appearing, check DSN and redeploy

---

### Issue 4: Alerts Not Triggering

**Symptoms:**
```
Known issue occurred but no alert was sent
```

**Cause:** Alert not configured, threshold too high, or delivery method failed

**Solution:**
1. **Verify alert configuration:**
   - Cloudflare Dashboard > Notifications
   - Check alert is enabled
   - Verify threshold is reasonable

2. **Test delivery method:**
   ```bash
   # Test Slack webhook
   curl -X POST {SLACK_WEBHOOK_URL} \
     -H 'Content-Type: application/json' \
     -d '{"text": "Test alert from monitoring setup"}'

   # Test PagerDuty
   curl -X POST https://events.pagerduty.com/v2/enqueue \
     -H 'Content-Type: application/json' \
     -d '{
       "routing_key": "{PAGERDUTY_KEY}",
       "event_action": "trigger",
       "payload": {
         "summary": "Test alert",
         "severity": "info",
         "source": "monitoring-test"
       }
     }'
   ```

3. **Review alert history:**
   - Cloudflare Dashboard > Notifications > History
   - Check if alert was generated but delivery failed

---

### Emergency Contacts

**If you need help:**

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| On-Call Engineer | PagerDuty | Immediate |
| Engineering Lead | Slack @eng-lead | If no response in 15 min |
| CTO/Tech Lead | Phone: [Number] | P0 incidents only |
| Supabase Support | support@supabase.io | Service issues |
| Cloudflare Support | Dashboard > Support | Platform issues |

---

## Post-Procedure

### Cleanup

**After successful monitoring setup:**
```bash
# No cleanup needed - monitoring is always-on
# But verify no test data is polluting metrics

# Remove test events (if any)
# Example: Delete test Sentry errors
# Sentry Dashboard > Project Settings > Data > Delete Test Events
```

---

### Documentation

**Update these documents:**
- [ ] This runbook (if issues/improvements identified)
- [ ] `10-operations/incidents/incident-response.md` (if procedures changed)
- [ ] Team wiki with dashboard links
- [ ] On-call rotation schedule

---

### Post-Setup Verification

**24 Hours After Setup:**
- [ ] Verify all dashboards showing data
- [ ] Test one alert by manually triggering condition
- [ ] Review metrics for anomalies
- [ ] Confirm team can access dashboards

**1 Week After Setup:**
- [ ] Review alert noise (too many false positives?)
- [ ] Adjust thresholds if needed
- [ ] Add missing metrics identified during week
- [ ] Document any issues encountered

**1 Month After Setup:**
- [ ] Comprehensive monitoring review
- [ ] Optimize slow queries identified
- [ ] Update baselines based on actual traffic
- [ ] Training session for new team members

---

### Communication

**Notify:**
- [ ] Team in #ops channel: "Monitoring setup complete for [environment]"
- [ ] Document dashboard URLs in team wiki
- [ ] Share on-call schedule
- [ ] Send summary email to stakeholders (if enterprise setup)

**Summary Email Template:**
```
Subject: Monitoring & Alerting Setup Complete - Abyrith [Environment]

Team,

Monitoring and alerting is now fully configured for Abyrith [environment].

Key Links:
- Cloudflare Dashboard: [URL]
- Supabase Reports: [URL]
- Sentry Dashboard: [URL]
- Operations Dashboard: [URL]

Alert Channels:
- Critical: PagerDuty → On-call engineer
- Warning: Slack #alerts
- Info: Logged to #monitoring

Performance Baselines:
- API p95 latency: < 200ms
- Error rate: < 0.5%
- Database connections: < 80%

On-Call Rotation:
[Link to schedule]

Runbook:
10-operations/monitoring/monitoring-alerting.md

Questions? Reach out in #ops.

Thanks!
[Your Name]
```

---

### Monitoring Health Checks

**Weekly:**
- [ ] Review error trends (increasing/decreasing?)
- [ ] Check for new slow queries
- [ ] Verify all alerts still relevant
- [ ] Review incident history

**Monthly:**
- [ ] Full metrics review with team
- [ ] Optimize alert thresholds
- [ ] Update baselines for growth
- [ ] Performance optimization sprint planning

**Quarterly:**
- [ ] Comprehensive monitoring audit
- [ ] Review and update this runbook
- [ ] Evaluate new monitoring tools
- [ ] Training refresher for team

---

## Communication

### Communication Templates

**Pre-Setup Announcement:**
```
📢 Monitoring Setup Scheduled

When: [Date/Time]
Duration: ~4 hours
Environment: [staging/production]
Impact: No user impact expected
Purpose: Setting up comprehensive monitoring and alerting

Updates: This channel
```

---

**During Setup:**
```
🔧 Monitoring Setup In Progress

Status: [Current step, e.g., "Configuring Cloudflare Analytics"]
Progress: 60% complete
ETA: ~1 hour remaining

All systems operational. No user impact.
```

---

**Completion:**
```
✅ Monitoring Setup Complete

Environment: [environment]
Duration: [actual time]
Status: Success

Dashboards:
- Cloudflare: [URL]
- Supabase: [URL]
- Operations: [URL]

Alert channels configured:
- Critical → PagerDuty
- Warning → Slack #alerts

Monitoring is now active. Baselines will be established over next 2 weeks.
```

---

**Rollback Announcement:**
```
⚠️ Monitoring Setup Issue

Issue encountered: [brief explanation]
Action taken: Reverted to previous configuration
Impact: Monitoring temporarily unavailable for [component]

Investigation underway. Will retry after fix identified.
Incident ticket: [link]
```

---

## Dependencies

### Technical Dependencies

**Must exist before monitoring setup:**
- [ ] `02-architecture/system-overview.md` - Understand system components
- [ ] `06-backend/cloudflare-workers/architecture.md` - Workers deployment
- [ ] `06-backend/supabase/setup-guide.md` - Database configuration
- [ ] Working production/staging environment

**Systems involved:**
- Cloudflare Workers (API layer monitoring)
- Cloudflare Pages (Frontend monitoring)
- Supabase (Database and auth monitoring)
- Sentry (Error tracking - optional)
- PagerDuty (Alerting - optional)
- Slack (Team notifications)

---

### Team Dependencies

**Requires coordination with:**
- Engineering team - For dashboard access and alert configuration
- Operations team - For incident response procedures
- Product team - For business metrics definition
- Security team - For security event monitoring

---

## References

### Internal Documentation
- `10-operations/incidents/incident-response.md` - Incident procedures
- `02-architecture/system-overview.md` - System architecture
- `TECH-STACK.md` - Technology specifications
- `06-backend/cloudflare-workers/architecture.md` - Workers setup
- `06-backend/supabase/setup-guide.md` - Supabase configuration

### External Resources
- [Cloudflare Analytics Documentation](https://developers.cloudflare.com/analytics/)
- [Supabase Monitoring Guide](https://supabase.com/docs/guides/platform/metrics)
- [Sentry Documentation](https://docs.sentry.io/)
- [PagerDuty Best Practices](https://www.pagerduty.com/resources/learn/incident-response-process/)
- [Web Vitals Guide](https://web.dev/vitals/)
- [PostgreSQL Monitoring](https://www.postgresql.org/docs/current/monitoring.html)

### Tools Documentation
- [Cloudflare Workers Observability](https://developers.cloudflare.com/workers/observability/)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
- [Grafana Dashboards](https://grafana.com/docs/)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | DevOps Team | Initial monitoring and alerting runbook |

---

## Notes

### Future Enhancements
- Implement custom Grafana dashboard for unified view
- Add automated anomaly detection using ML
- Integrate with cost monitoring for budget alerts
- Implement distributed tracing with OpenTelemetry
- Add synthetic monitoring (external uptime checks)
- Create mobile app for on-call engineers

### Known Limitations
- Cloudflare free tier: 30-day analytics retention
- Supabase free tier: 7-day log retention
- Sentry free tier: 5k events/month
- Manual configuration required for some alerts

### Lessons Learned
- Set realistic alert thresholds to avoid alert fatigue
- Test alerts regularly to ensure they work
- Document on-call procedures clearly
- Review baselines quarterly as traffic grows
- Keep dashboards simple and focused

### Next Review Date
2025-11-30 (Monthly review) | 2026-01-30 (Quarterly comprehensive review)
