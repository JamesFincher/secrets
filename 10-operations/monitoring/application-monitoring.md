---
Document: Application Monitoring - Operations Runbook
Version: 1.0.0
Last Updated: 2025-10-30
Owner: DevOps Team
Status: Draft
Dependencies: 10-operations/monitoring/monitoring-alerting.md, 06-backend/cloudflare-workers/workers-architecture.md, 07-frontend/frontend-architecture.md, 02-architecture/system-overview.md
---

# Application Monitoring Operations Runbook

## Overview

This runbook provides comprehensive procedures for application-level monitoring of the Abyrith platform, focusing on metrics collection, dashboard configuration, and alerting rules for business-critical application metrics beyond infrastructure monitoring. It covers frontend performance monitoring, backend API metrics, business KPIs, user journey tracking, and application-specific health indicators.

**Purpose:** Enable proactive application performance monitoring, early detection of user-impacting issues, and data-driven optimization through comprehensive metrics collection and visualization.

**Frequency:** Continuous real-time monitoring with daily metric reviews and weekly performance optimization analysis

**Estimated Time:**
- Initial setup: 6-8 hours
- Dashboard configuration: 2-3 hours
- Alert rules setup: 1-2 hours
- Ongoing monitoring: 30 min/day review

**Risk Level:** Medium-High (application performance directly impacts user experience and business metrics)

---

## Table of Contents

1. [When to Use This Runbook](#when-to-use-this-runbook)
2. [Prerequisites](#prerequisites)
3. [Pre-Flight Checklist](#pre-flight-checklist)
4. [Application Monitoring Architecture](#application-monitoring-architecture)
5. [Frontend Metrics Collection](#frontend-metrics-collection)
6. [Backend API Metrics](#backend-api-metrics)
7. [Business Metrics Tracking](#business-metrics-tracking)
8. [User Journey Monitoring](#user-journey-monitoring)
9. [Dashboard Configuration](#dashboard-configuration)
10. [Alerting Rules Setup](#alerting-rules-setup)
11. [Performance Baselines](#performance-baselines)
12. [Troubleshooting](#troubleshooting)
13. [Post-Procedure](#post-procedure)
14. [Communication](#communication)
15. [Dependencies](#dependencies)
16. [References](#references)
17. [Change Log](#change-log)

---

## When to Use This Runbook

### Triggers

**Use this runbook when:**
- Setting up application monitoring for new environments (development, staging, production)
- Configuring custom dashboards for application metrics
- Creating alert rules for business-critical KPIs
- Investigating application performance degradation
- Analyzing user experience metrics
- Optimizing application performance based on metrics
- Preparing for capacity planning
- Creating executive performance reports

**Do NOT use this runbook when:**
- Setting up infrastructure monitoring (use `10-operations/monitoring/monitoring-alerting.md`)
- Responding to production incidents (use `10-operations/incidents/incident-response.md`)
- Managing security events (use `10-operations/security/security-runbook.md`)
- Deploying new features (use `10-operations/deployment/deployment-pipeline.md`)

### Scope

**What this covers:**
- Frontend performance metrics (Core Web Vitals, user interactions)
- Backend API metrics (endpoint latency, error rates, throughput)
- Business KPIs (user growth, feature adoption, conversion rates)
- User journey tracking (onboarding funnel, feature usage patterns)
- Application-specific health indicators (encryption performance, AI response times)
- Custom dashboard configuration
- Application-level alerting rules
- Performance optimization workflows

**What this does NOT cover:**
- Infrastructure monitoring (Cloudflare Analytics, Supabase metrics) - see `10-operations/monitoring/monitoring-alerting.md`
- Error tracking and stack traces (Sentry integration) - see monitoring-alerting.md
- Security monitoring and audit logs - see `10-operations/security/security-runbook.md`
- Cost monitoring and budget tracking
- User behavior analytics for product decisions

---

## Prerequisites

### Required Access

**Systems:**
- [ ] Cloudflare Dashboard - Admin access for Workers Analytics Engine
- [ ] Supabase Dashboard - Read access to analytics database
- [ ] GitHub repository - Write access for metric collection code
- [ ] Grafana Cloud (optional) - Admin access for dashboard creation
- [ ] Slack - Access to #monitoring and #alerts channels

**Credentials:**
- [ ] Cloudflare API token (Analytics Engine read/write)
- [ ] Supabase service role key (for analytics queries)
- [ ] GitHub personal access token (for deployment)
- [ ] Grafana API key (if using Grafana Cloud)
- [ ] Slack webhook URLs for alerts

**How to request access:**
Contact DevOps team lead via Slack #ops-access-requests channel. Provide justification for analytics access level needed.

### Required Tools

**Local tools:**
```bash
# Verify you have these installed
node --version         # Should be 20.x LTS
pnpm --version         # Should be 8.x
wrangler --version     # Should be latest
curl --version         # For API testing
jq --version          # For JSON parsing
```

**Installation:**
```bash
# If tools are missing
npm install -g wrangler  # Cloudflare CLI
brew install jq          # JSON processor (macOS)
```

### Required Knowledge

**You should understand:**
- Application performance metrics (LCP, FID, CLS, TTFB)
- API latency percentiles (p50, p95, p99)
- Business KPIs and conversion funnels
- Time-series data visualization
- Statistical analysis (mean, median, standard deviation)
- Alert threshold tuning to avoid fatigue

**Reference documentation:**
- `10-operations/monitoring/monitoring-alerting.md` - Infrastructure monitoring setup
- `07-frontend/frontend-architecture.md` - Frontend performance targets
- `06-backend/cloudflare-workers/workers-architecture.md` - API architecture
- Web Vitals: https://web.dev/vitals/

---

## Pre-Flight Checklist

**Complete before starting:**

### 1. Communication

- [ ] Notify team in #ops channel: "Setting up application monitoring for [environment]"
- [ ] Create tracking ticket: [Project Management System]
- [ ] Document monitoring objectives and KPIs to track

### 2. Environment Verification

- [ ] Confirm target environment (staging/production)
- [ ] Verify application is deployed and running
- [ ] Check existing monitoring setup (infrastructure layer)
- [ ] Review current performance baselines

### 3. Access Verification

- [ ] Test Cloudflare Dashboard access
- [ ] Test Cloudflare Analytics Engine write access
- [ ] Verify Supabase analytics database exists
- [ ] Confirm Slack webhook responds

### 4. Planning

- [ ] Define application metrics to track (frontend, backend, business)
- [ ] Identify critical user journeys to monitor
- [ ] Determine alert thresholds for each metric
- [ ] Plan dashboard layout and visualizations

### 5. Documentation

- [ ] Review this entire runbook
- [ ] Review frontend and backend architecture docs
- [ ] Understand performance targets for all layers
- [ ] Have rollback plan ready (if modifying existing setup)

---

## Application Monitoring Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Devices                          │
│  - Desktop Browsers (Chrome, Firefox, Safari)                │
│  - Mobile Browsers (iOS Safari, Chrome Android)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS Requests
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (Next.js on Cloudflare Pages)      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Client-Side Metrics Collection                │  │
│  │  • web-vitals library (LCP, FID, CLS, TTFB, INP)     │  │
│  │  • Custom React hooks (usePerformanceTracking)       │  │
│  │  • User interaction events (clicks, form submits)     │  │
│  │  • Navigation timing (page load, route changes)      │  │
│  │  • Resource timing (API calls, asset loading)        │  │
│  │  • Error boundaries (React errors)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         │ navigator.sendBeacon()             │
│                         │ or fetch() keepalive              │
│                         ▼                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          Backend (Cloudflare Workers API Gateway)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Metrics Collection Middleware                 │  │
│  │  • Request timing (duration per endpoint)             │  │
│  │  • HTTP status codes (2xx, 4xx, 5xx rates)           │  │
│  │  • Endpoint throughput (requests/second)              │  │
│  │  • Database query timing                              │  │
│  │  • External API latency (Claude, FireCrawl)          │  │
│  │  • Rate limiting events                               │  │
│  │  • Cache hit/miss rates (Workers KV)                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         │ Workers Analytics Engine API       │
│                         ▼                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          Cloudflare Workers Analytics Engine                 │
│  - Time-series metrics storage                               │
│  - SQL-like query interface                                  │
│  - Retention: 90 days (Workers plan)                         │
│  - Query latency: <100ms                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Analytics API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Analytics Database                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tables: application_metrics, user_sessions,          │  │
│  │          feature_usage, conversion_events             │  │
│  │  Retention: 1 year                                    │  │
│  │  Purpose: Long-term trend analysis, business KPIs    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ PostgreSQL queries
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Visualization & Alerting Layer                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Cloudflare Dashboard (real-time Workers metrics)  │  │
│  │  2. Supabase Dashboard (database analytics)           │  │
│  │  3. Custom Ops Dashboard (HTML + Chart.js)           │  │
│  │  4. Grafana Cloud (optional, unified view)            │  │
│  │  5. Slack Alerts (threshold violations)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: Frontend Metrics Collection**
- **Purpose:** Track real user performance and interactions
- **Metrics:** Core Web Vitals (LCP, FID, CLS), custom timing events, user interactions
- **Implementation:** web-vitals library + custom React hooks
- **Storage:** Sent to Cloudflare Workers → Analytics Engine
- **Sampling:** 10% for detailed metrics, 100% for critical errors

**Component 2: Backend API Metrics**
- **Purpose:** Monitor API health and performance
- **Metrics:** Request duration, error rates, throughput, database query timing
- **Implementation:** Middleware in Cloudflare Workers
- **Storage:** Workers Analytics Engine + Supabase analytics database
- **Granularity:** Per-endpoint, per-user-tier, per-environment

**Component 3: Business KPI Tracking**
- **Purpose:** Measure product success and user engagement
- **Metrics:** User growth, feature adoption, conversion rates, retention
- **Implementation:** Event-driven tracking in React components and Workers
- **Storage:** Supabase analytics database (long-term retention)
- **Analysis:** Daily aggregation, weekly cohort analysis

**Component 4: User Journey Monitoring**
- **Purpose:** Track critical user flows and identify drop-off points
- **Metrics:** Funnel completion rates, step timing, abandonment points
- **Implementation:** Session tracking with event sequencing
- **Storage:** Supabase with session_id grouping
- **Visualization:** Funnel charts, user flow diagrams

---

## Frontend Metrics Collection

### Step 1: Install Web Vitals Library

**Purpose:** Track Core Web Vitals metrics automatically

**Commands:**
```bash
# Install web-vitals package
pnpm add web-vitals

# Verify installation
pnpm list web-vitals
```

**Expected output:**
```
web-vitals 3.5.0
```

**Time:** ~2 minutes

---

### Step 2: Implement Performance Tracking Hook

**Purpose:** Create reusable hook for tracking metrics

**Implementation:**

Create `lib/hooks/usePerformanceTracking.ts`:

```typescript
// lib/hooks/usePerformanceTracking.ts
import { useEffect } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

interface PerformanceMetric extends Metric {
  userId?: string;
  projectId?: string;
  environment?: string;
}

export function usePerformanceTracking() {
  useEffect(() => {
    // Track Core Web Vitals
    getCLS(sendMetric, { reportAllChanges: false });
    getFID(sendMetric);
    getFCP(sendMetric);
    getLCP(sendMetric, { reportAllChanges: false });
    getTTFB(sendMetric);

    // Track custom navigation timing
    trackNavigationTiming();

    // Track resource timing
    trackResourceTiming();
  }, []);
}

function sendMetric(metric: Metric) {
  const body = JSON.stringify({
    type: 'web_vital',
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    timestamp: Date.now(),
    url: window.location.href,
    user_agent: navigator.userAgent,
    connection: (navigator as any).connection?.effectiveType || 'unknown',
  });

  const url = '/api/metrics/web-vitals';

  // Use sendBeacon for reliability (fires even on page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
  } else {
    // Fallback to fetch with keepalive
    fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch((err) => {
      console.warn('Failed to send metric:', err);
    });
  }
}

function trackNavigationTiming() {
  if (!window.performance || !window.performance.timing) return;

  const timing = window.performance.timing;
  const navigationStart = timing.navigationStart;

  const metrics = {
    dns_lookup: timing.domainLookupEnd - timing.domainLookupStart,
    tcp_connection: timing.connectEnd - timing.connectStart,
    request_time: timing.responseStart - timing.requestStart,
    response_time: timing.responseEnd - timing.responseStart,
    dom_processing: timing.domComplete - timing.domLoading,
    dom_interactive: timing.domInteractive - navigationStart,
    page_load: timing.loadEventEnd - navigationStart,
  };

  fetch('/api/metrics/navigation', {
    method: 'POST',
    body: JSON.stringify({
      type: 'navigation_timing',
      metrics,
      timestamp: Date.now(),
      url: window.location.href,
    }),
    headers: { 'Content-Type': 'application/json' },
  }).catch(console.warn);
}

function trackResourceTiming() {
  if (!window.performance || !window.performance.getEntriesByType) return;

  const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  // Group resources by type
  const resourceMetrics = resources.reduce((acc, resource) => {
    const type = resource.initiatorType;
    if (!acc[type]) {
      acc[type] = { count: 0, totalDuration: 0, totalSize: 0 };
    }
    acc[type].count++;
    acc[type].totalDuration += resource.duration;
    acc[type].totalSize += resource.transferSize || 0;
    return acc;
  }, {} as Record<string, any>);

  fetch('/api/metrics/resources', {
    method: 'POST',
    body: JSON.stringify({
      type: 'resource_timing',
      metrics: resourceMetrics,
      timestamp: Date.now(),
      url: window.location.href,
    }),
    headers: { 'Content-Type': 'application/json' },
  }).catch(console.warn);
}
```

**Add to root layout:**

```typescript
// app/layout.tsx
import { usePerformanceTracking } from '@/lib/hooks/usePerformanceTracking';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  usePerformanceTracking();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Time:** ~30 minutes

---

### Step 3: Create Metrics API Endpoint

**Purpose:** Receive and store frontend metrics

**Implementation:**

Create `app/api/metrics/web-vitals/route.ts`:

```typescript
// app/api/metrics/web-vitals/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();

    // Add server-side metadata
    const enrichedMetric = {
      ...metric,
      server_timestamp: Date.now(),
      ip_address: request.headers.get('cf-connecting-ip') || 'unknown',
      country: request.headers.get('cf-ipcountry') || 'unknown',
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
    };

    // Send to Cloudflare Workers Analytics Engine
    await sendToAnalyticsEngine(enrichedMetric);

    // Optionally store in Supabase for long-term analysis
    if (shouldStoreInDatabase(metric)) {
      await storeInSupabase(enrichedMetric);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing web vital metric:', error);
    return NextResponse.json({ error: 'Failed to process metric' }, { status: 500 });
  }
}

async function sendToAnalyticsEngine(metric: any) {
  // Call Cloudflare Worker to write to Analytics Engine
  const workerUrl = process.env.NEXT_PUBLIC_API_URL + '/analytics/write';

  await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ANALYTICS_API_KEY}`,
    },
    body: JSON.stringify({
      dataset: 'web_vitals',
      data: metric,
    }),
  });
}

async function storeInSupabase(metric: any) {
  // Store significant metrics in Supabase for long-term analysis
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('application_metrics').insert({
    metric_type: 'web_vital',
    metric_name: metric.name,
    metric_value: metric.value,
    metric_rating: metric.rating,
    url: metric.url,
    user_agent: metric.user_agent,
    country: metric.country,
    environment: metric.environment,
    created_at: new Date(metric.timestamp).toISOString(),
  });
}

function shouldStoreInDatabase(metric: any): boolean {
  // Store 10% sample + all poor ratings
  if (metric.rating === 'poor') return true;
  return Math.random() < 0.1; // 10% sampling
}
```

**Time:** ~45 minutes

---

### Step 4: Track Custom User Interactions

**Purpose:** Monitor feature usage and user engagement

**Implementation:**

Create `lib/analytics/trackEvent.ts`:

```typescript
// lib/analytics/trackEvent.ts
export interface TrackEventParams {
  category: 'secret' | 'project' | 'ai_assistant' | 'team' | 'settings' | 'auth';
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
}

export async function trackEvent(params: TrackEventParams) {
  const event = {
    ...params,
    timestamp: Date.now(),
    url: window.location.href,
    session_id: getSessionId(),
  };

  await fetch('/api/metrics/events', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(console.warn);
}

function getSessionId(): string {
  // Generate or retrieve session ID from sessionStorage
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// Convenience functions for common events
export const analytics = {
  secretCreated: (secretId: string, projectId: string) =>
    trackEvent({
      category: 'secret',
      action: 'created',
      label: projectId,
      metadata: { secret_id: secretId },
    }),

  secretAccessed: (secretId: string, source: 'ui' | 'mcp' | 'api') =>
    trackEvent({
      category: 'secret',
      action: 'accessed',
      label: source,
      metadata: { secret_id: secretId },
    }),

  aiQuerySubmitted: (query: string, model: string, durationMs: number) =>
    trackEvent({
      category: 'ai_assistant',
      action: 'query_submitted',
      label: model,
      value: durationMs,
      metadata: { query_length: query.length },
    }),

  projectCreated: (projectId: string, environmentCount: number) =>
    trackEvent({
      category: 'project',
      action: 'created',
      value: environmentCount,
      metadata: { project_id: projectId },
    }),

  teamMemberInvited: (projectId: string, role: string) =>
    trackEvent({
      category: 'team',
      action: 'member_invited',
      label: role,
      metadata: { project_id: projectId },
    }),

  userSignup: (method: 'email' | 'google' | 'github') =>
    trackEvent({
      category: 'auth',
      action: 'signup',
      label: method,
    }),
};
```

**Usage in components:**

```typescript
// Example: Tracking secret creation
import { analytics } from '@/lib/analytics/trackEvent';

async function handleCreateSecret(data: CreateSecretData) {
  const secret = await createSecret(data);

  // Track event
  analytics.secretCreated(secret.id, data.projectId);

  return secret;
}
```

**Time:** ~1 hour

---

## Backend API Metrics

### Step 1: Implement Metrics Middleware in Workers

**Purpose:** Collect comprehensive API metrics for all requests

**Implementation:**

Create `workers/middleware/metrics.ts`:

```typescript
// workers/middleware/metrics.ts
import { AnalyticsEngineDataset } from '@cloudflare/workers-types';

export interface Env {
  ANALYTICS: AnalyticsEngineDataset;
  // ... other bindings
}

export interface RequestMetrics {
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  user_id?: string;
  organization_id?: string;
  endpoint: string;
  cache_status: 'hit' | 'miss' | 'bypass';
  external_api_calls?: {
    service: string;
    duration_ms: number;
    status: number;
  }[];
  database_queries?: {
    query_type: string;
    duration_ms: number;
    rows_affected: number;
  }[];
  error_type?: string;
  error_message?: string;
}

export async function metricsMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  next: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const endpoint = normalizeEndpoint(url.pathname);

  const metrics: RequestMetrics = {
    method: request.method,
    path: url.pathname,
    status_code: 0,
    duration_ms: 0,
    endpoint,
    cache_status: 'bypass',
  };

  let response: Response;

  try {
    // Execute request
    response = await next();

    // Capture response metrics
    metrics.status_code = response.status;
    metrics.cache_status = response.headers.get('X-Cache-Status') as any || 'bypass';

    // Extract user context from JWT (if authenticated)
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const userContext = await extractUserContext(authHeader);
      metrics.user_id = userContext?.userId;
      metrics.organization_id = userContext?.organizationId;
    }
  } catch (error: any) {
    // Capture error metrics
    metrics.status_code = 500;
    metrics.error_type = error.constructor.name;
    metrics.error_message = error.message;

    // Re-throw to be handled by error handler
    throw error;
  } finally {
    // Calculate duration
    metrics.duration_ms = Date.now() - startTime;

    // Send to Analytics Engine (non-blocking)
    ctx.waitUntil(writeMetrics(env.ANALYTICS, metrics));

    // Log structured JSON for Cloudflare Logs
    console.log(JSON.stringify({
      type: 'request_metric',
      ...metrics,
      timestamp: new Date().toISOString(),
    }));
  }

  return response;
}

function normalizeEndpoint(path: string): string {
  // Normalize dynamic routes to reduce cardinality
  // /api/secrets/abc-123 → /api/secrets/:id
  // /api/projects/xyz-456/secrets → /api/projects/:id/secrets

  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9]+/g, '/:id');
}

async function extractUserContext(authHeader: string) {
  // Extract userId and organizationId from JWT
  // This is a simplified version - use proper JWT verification
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      userId: payload.sub,
      organizationId: payload.org_id,
    };
  } catch {
    return null;
  }
}

async function writeMetrics(analytics: AnalyticsEngineDataset, metrics: RequestMetrics) {
  try {
    await analytics.writeDataPoint({
      blobs: [
        metrics.method,
        metrics.endpoint,
        metrics.cache_status,
        metrics.error_type || '',
      ],
      doubles: [
        metrics.status_code,
        metrics.duration_ms,
      ],
      indexes: [
        metrics.user_id || '',
        metrics.organization_id || '',
      ],
    });
  } catch (error) {
    console.error('Failed to write metrics to Analytics Engine:', error);
  }
}
```

**Apply middleware to Workers:**

```typescript
// workers/src/index.ts
import { metricsMiddleware } from './middleware/metrics';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Apply metrics middleware to all requests
    return metricsMiddleware(request, env, ctx, async () => {
      // Your main request handler
      return handleRequest(request, env);
    });
  },
};
```

**Time:** ~2 hours

---

### Step 2: Track External API Latency

**Purpose:** Monitor dependencies on Claude API and FireCrawl

**Implementation:**

```typescript
// workers/lib/externalApiClient.ts
export async function callClaudeAPI(
  prompt: string,
  model: string,
  env: Env
): Promise<ClaudeResponse> {
  const startTime = Date.now();
  let status = 0;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      }),
    });

    status = response.status;
    const data = await response.json();

    // Track API call metrics
    await trackExternalApiCall({
      service: 'claude_api',
      model,
      duration_ms: Date.now() - startTime,
      status,
      tokens_used: data.usage?.total_tokens || 0,
      success: response.ok,
    }, env);

    if (!response.ok) {
      throw new Error(`Claude API error: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error: any) {
    // Track failed API call
    await trackExternalApiCall({
      service: 'claude_api',
      model,
      duration_ms: Date.now() - startTime,
      status: status || 0,
      success: false,
      error_message: error.message,
    }, env);

    throw error;
  }
}

async function trackExternalApiCall(metrics: any, env: Env) {
  // Write to Analytics Engine
  await env.ANALYTICS.writeDataPoint({
    blobs: [
      'external_api_call',
      metrics.service,
      metrics.model || '',
      metrics.error_message || '',
    ],
    doubles: [
      metrics.duration_ms,
      metrics.status,
      metrics.tokens_used || 0,
    ],
    indexes: [
      metrics.success ? 'success' : 'failure',
    ],
  });
}
```

**Time:** ~45 minutes

---

### Step 3: Track Database Query Performance

**Purpose:** Monitor Supabase API call latency

**Implementation:**

```typescript
// workers/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient(env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  // Wrap query methods to track performance
  return {
    async query(table: string, operation: string, query: any) {
      const startTime = Date.now();
      let success = true;
      let rowsAffected = 0;

      try {
        const result = await query;

        rowsAffected = Array.isArray(result.data) ? result.data.length : 1;

        if (result.error) {
          success = false;
          throw result.error;
        }

        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        // Track database query metrics
        await trackDatabaseQuery({
          table,
          operation, // 'select' | 'insert' | 'update' | 'delete'
          duration_ms: Date.now() - startTime,
          rows_affected: rowsAffected,
          success,
        }, env);
      }
    },

    from: (table: string) => {
      const queryBuilder = supabase.from(table);

      return {
        select: (columns?: string) => this.query(table, 'select', queryBuilder.select(columns)),
        insert: (data: any) => this.query(table, 'insert', queryBuilder.insert(data)),
        update: (data: any) => this.query(table, 'update', queryBuilder.update(data)),
        delete: () => this.query(table, 'delete', queryBuilder.delete()),
      };
    },
  };
}

async function trackDatabaseQuery(metrics: any, env: Env) {
  await env.ANALYTICS.writeDataPoint({
    blobs: [
      'database_query',
      metrics.table,
      metrics.operation,
    ],
    doubles: [
      metrics.duration_ms,
      metrics.rows_affected,
    ],
    indexes: [
      metrics.success ? 'success' : 'failure',
    ],
  });
}
```

**Time:** ~30 minutes

---

## Business Metrics Tracking

### Step 1: Create Analytics Database Schema

**Purpose:** Store business metrics in Supabase for long-term analysis

**Implementation:**

Create migration `supabase/migrations/20251030000001_add_analytics_tables.sql`:

```sql
-- Analytics tables for business metrics and user journey tracking
-- These tables are separate from operational tables and optimized for analytics queries

-- Application metrics (Web Vitals, API performance, custom metrics)
CREATE TABLE IF NOT EXISTS application_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'web_vital' | 'api_performance' | 'feature_usage' | 'external_api'
  metric_name TEXT NOT NULL, -- 'LCP' | 'api_latency' | 'secret_created' | 'claude_api_call'
  metric_value NUMERIC NOT NULL,
  metric_rating TEXT, -- 'good' | 'needs-improvement' | 'poor' (for Web Vitals)
  url TEXT,
  endpoint TEXT, -- API endpoint (for backend metrics)
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  environment TEXT, -- 'production' | 'staging' | 'development'
  user_agent TEXT,
  country TEXT,
  metadata JSONB, -- Additional context (e.g., browser version, device type)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast analytics queries
CREATE INDEX idx_app_metrics_type_created ON application_metrics(metric_type, created_at DESC);
CREATE INDEX idx_app_metrics_name_created ON application_metrics(metric_name, created_at DESC);
CREATE INDEX idx_app_metrics_org ON application_metrics(organization_id, created_at DESC);
CREATE INDEX idx_app_metrics_user ON application_metrics(user_id, created_at DESC);

-- User sessions for journey tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  page_views INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  entry_url TEXT,
  exit_url TEXT,
  referrer TEXT,
  device_type TEXT, -- 'mobile' | 'tablet' | 'desktop'
  browser TEXT,
  os TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, started_at DESC);
CREATE INDEX idx_user_sessions_org ON user_sessions(organization_id, started_at DESC);
CREATE INDEX idx_user_sessions_started ON user_sessions(started_at DESC);

-- Feature usage tracking
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL, -- 'ai_assistant' | 'mcp_integration' | 'team_collaboration' | 'secret_management'
  action TEXT NOT NULL, -- 'created' | 'accessed' | 'updated' | 'deleted'
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  session_id TEXT,
  metadata JSONB, -- Feature-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_usage_feature ON feature_usage(feature_name, created_at DESC);
CREATE INDEX idx_feature_usage_user ON feature_usage(user_id, created_at DESC);
CREATE INDEX idx_feature_usage_org ON feature_usage(organization_id, created_at DESC);

-- Conversion events for funnel analysis
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_name TEXT NOT NULL, -- 'onboarding' | 'first_secret' | 'team_invite'
  step_name TEXT NOT NULL, -- 'signup' | 'verify_email' | 'create_project' | 'add_secret'
  step_order INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  session_id TEXT,
  completed BOOLEAN DEFAULT FALSE,
  time_to_complete_seconds INTEGER, -- Time from previous step
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversion_funnel ON conversion_events(funnel_name, step_order, created_at DESC);
CREATE INDEX idx_conversion_user ON conversion_events(user_id, created_at DESC);
CREATE INDEX idx_conversion_session ON conversion_events(session_id, step_order);

-- Row-Level Security policies
ALTER TABLE application_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- Service role can read all analytics data
CREATE POLICY "Service role full access to analytics"
  ON application_metrics
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to sessions"
  ON user_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to feature usage"
  ON feature_usage
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to conversion events"
  ON conversion_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view their organization's analytics
CREATE POLICY "Org admins can view their analytics"
  ON application_metrics
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Helper function for calculating Web Vitals performance score
CREATE OR REPLACE FUNCTION calculate_performance_score(
  p_lcp NUMERIC,
  p_fid NUMERIC,
  p_cls NUMERIC
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- LCP scoring (0-40 points)
  IF p_lcp <= 2500 THEN score := score + 40;
  ELSIF p_lcp <= 4000 THEN score := score + 20;
  END IF;

  -- FID scoring (0-30 points)
  IF p_fid <= 100 THEN score := score + 30;
  ELSIF p_fid <= 300 THEN score := score + 15;
  END IF;

  -- CLS scoring (0-30 points)
  IF p_cls <= 0.1 THEN score := score + 30;
  ELSIF p_cls <= 0.25 THEN score := score + 15;
  END IF;

  RETURN score; -- Score out of 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Automated cleanup for old analytics data (1 year retention)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
  DELETE FROM application_metrics WHERE created_at < NOW() - INTERVAL '1 year';
  DELETE FROM user_sessions WHERE started_at < NOW() - INTERVAL '1 year';
  DELETE FROM feature_usage WHERE created_at < NOW() - INTERVAL '1 year';
  DELETE FROM conversion_events WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * 0', 'SELECT cleanup_old_analytics_data()');
```

**Apply migration:**
```bash
supabase migration up
```

**Time:** ~1 hour

---

### Step 2: Track User Growth Metrics

**Purpose:** Monitor daily/monthly active users and signup conversions

**Implementation:**

```typescript
// workers/lib/analytics/userGrowth.ts
export async function trackUserSignup(userId: string, method: 'email' | 'google' | 'github', env: Env) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Track signup in feature_usage
  await supabase.from('feature_usage').insert({
    feature_name: 'authentication',
    action: 'signup',
    user_id: userId,
    metadata: {
      method,
      source: 'web_app', // or 'mcp', 'api'
    },
  });

  // Track onboarding funnel start
  await supabase.from('conversion_events').insert({
    funnel_name: 'onboarding',
    step_name: 'signup',
    step_order: 1,
    user_id: userId,
    completed: true,
  });
}

export async function trackFirstProject(userId: string, projectId: string, env: Env) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Check if this is the user's first project
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('created_by', userId);

  const isFirstProject = projects?.length === 1;

  if (isFirstProject) {
    // Track onboarding funnel progression
    await supabase.from('conversion_events').insert({
      funnel_name: 'onboarding',
      step_name: 'create_first_project',
      step_order: 2,
      user_id: userId,
      completed: true,
      metadata: { project_id: projectId },
    });
  }
}

export async function trackFirstSecret(userId: string, secretId: string, projectId: string, env: Env) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Check if this is the user's first secret in this project
  const { data: secrets } = await supabase
    .from('secrets')
    .select('id')
    .eq('project_id', projectId);

  const isFirstSecret = secrets?.length === 1;

  if (isFirstSecret) {
    // Track onboarding funnel completion
    await supabase.from('conversion_events').insert({
      funnel_name: 'onboarding',
      step_name: 'create_first_secret',
      step_order: 3,
      user_id: userId,
      completed: true,
      metadata: {
        project_id: projectId,
        secret_id: secretId,
      },
    });

    // Calculate time to first secret (from signup)
    const { data: signupEvent } = await supabase
      .from('conversion_events')
      .select('created_at')
      .eq('funnel_name', 'onboarding')
      .eq('step_name', 'signup')
      .eq('user_id', userId)
      .single();

    if (signupEvent) {
      const timeToFirstSecret = Math.floor(
        (Date.now() - new Date(signupEvent.created_at).getTime()) / 1000
      );

      await supabase
        .from('conversion_events')
        .update({ time_to_complete_seconds: timeToFirstSecret })
        .eq('funnel_name', 'onboarding')
        .eq('step_name', 'create_first_secret')
        .eq('user_id', userId);
    }
  }
}
```

**Time:** ~45 minutes

---

### Step 3: Query Business Metrics

**Purpose:** Create analytics queries for dashboards

**Implementation:**

```sql
-- Daily Active Users (DAU)
SELECT
  DATE_TRUNC('day', created_at) AS date,
  COUNT(DISTINCT user_id) AS dau
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Monthly Active Users (MAU)
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(DISTINCT user_id) AS mau
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- User signup conversion funnel
SELECT
  step_name,
  step_order,
  COUNT(DISTINCT user_id) AS users_reached,
  COUNT(DISTINCT CASE WHEN completed THEN user_id END) AS users_completed,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN completed THEN user_id END) / NULLIF(COUNT(DISTINCT user_id), 0),
    2
  ) AS completion_rate,
  ROUND(AVG(time_to_complete_seconds) / 60.0, 2) AS avg_time_minutes
FROM conversion_events
WHERE funnel_name = 'onboarding'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY step_name, step_order
ORDER BY step_order;

-- Feature adoption rates
SELECT
  feature_name,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(*) AS total_events,
  DATE_TRUNC('day', created_at) AS date
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY feature_name, DATE_TRUNC('day', created_at)
ORDER BY date DESC, total_events DESC;

-- Top users by activity
SELECT
  u.email,
  om.organization_id,
  COUNT(*) AS events_count,
  MAX(fu.created_at) AS last_activity
FROM feature_usage fu
JOIN auth.users u ON fu.user_id = u.id
JOIN organization_members om ON om.user_id = u.id
WHERE fu.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.email, om.organization_id
ORDER BY events_count DESC
LIMIT 20;

-- Average session duration
SELECT
  DATE_TRUNC('day', started_at) AS date,
  ROUND(AVG(duration_seconds) / 60.0, 2) AS avg_session_minutes,
  ROUND(AVG(page_views), 2) AS avg_page_views_per_session,
  COUNT(*) AS total_sessions
FROM user_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
  AND duration_seconds IS NOT NULL
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date DESC;

-- Web Vitals performance score (last 7 days)
WITH vitals AS (
  SELECT
    DATE_TRUNC('day', created_at) AS date,
    metric_name,
    AVG(metric_value) AS avg_value,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY metric_value) AS p75_value
  FROM application_metrics
  WHERE metric_type = 'web_vital'
    AND metric_name IN ('LCP', 'FID', 'CLS')
    AND created_at >= NOW() - INTERVAL '7 days'
  GROUP BY DATE_TRUNC('day', created_at), metric_name
)
SELECT
  date,
  MAX(CASE WHEN metric_name = 'LCP' THEN p75_value END) AS lcp_p75,
  MAX(CASE WHEN metric_name = 'FID' THEN p75_value END) AS fid_p75,
  MAX(CASE WHEN metric_name = 'CLS' THEN p75_value END) AS cls_p75,
  calculate_performance_score(
    MAX(CASE WHEN metric_name = 'LCP' THEN p75_value END),
    MAX(CASE WHEN metric_name = 'FID' THEN p75_value END),
    MAX(CASE WHEN metric_name = 'CLS' THEN p75_value END)
  ) AS performance_score
FROM vitals
GROUP BY date
ORDER BY date DESC;
```

**Time:** ~30 minutes

---

## User Journey Monitoring

### Step 1: Define Critical User Journeys

**Purpose:** Identify key user flows to monitor

**Critical Journeys:**

1. **Onboarding Funnel** (Learner/Solo Dev)
   - Step 1: Sign up (email/OAuth)
   - Step 2: Verify email (if email signup)
   - Step 3: Create first project
   - Step 4: Add first secret
   - Step 5: Successfully retrieve secret
   - **Target:** >70% complete funnel within 24 hours

2. **AI Assistant Usage** (All personas)
   - Step 1: Open AI chat
   - Step 2: Submit first query
   - Step 3: Receive response
   - Step 4: Save recommended secret (if applicable)
   - **Target:** >80% query success rate, <5s response time

3. **MCP Integration Setup** (Developer/Team)
   - Step 1: Install MCP server
   - Step 2: Authenticate with Abyrith
   - Step 3: Request first secret from Claude Code/Cursor
   - Step 4: Approve secret access
   - Step 5: Receive secret in IDE
   - **Target:** >60% complete setup within 15 minutes

4. **Team Collaboration** (Team/Enterprise)
   - Step 1: Invite team member
   - Step 2: Member accepts invitation
   - Step 3: Member accesses project
   - Step 4: Member views secrets (with approval if needed)
   - **Target:** >75% invitation acceptance within 7 days

**Time:** ~1 hour (planning)

---

### Step 2: Implement Journey Tracking

**Purpose:** Track user progress through critical journeys

**Implementation:**

```typescript
// lib/analytics/journeyTracking.ts
export async function trackJourneyStep(params: {
  journeyName: string;
  stepName: string;
  stepOrder: number;
  userId: string;
  organizationId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}) {
  await fetch('/api/analytics/journey-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      timestamp: Date.now(),
    }),
    keepalive: true,
  });
}

// Usage in components
export const journeyTracking = {
  onboarding: {
    signup: (userId: string) =>
      trackJourneyStep({
        journeyName: 'onboarding',
        stepName: 'signup',
        stepOrder: 1,
        userId,
        sessionId: getSessionId(),
      }),

    emailVerified: (userId: string) =>
      trackJourneyStep({
        journeyName: 'onboarding',
        stepName: 'email_verified',
        stepOrder: 2,
        userId,
        sessionId: getSessionId(),
      }),

    firstProject: (userId: string, projectId: string) =>
      trackJourneyStep({
        journeyName: 'onboarding',
        stepName: 'first_project',
        stepOrder: 3,
        userId,
        sessionId: getSessionId(),
        metadata: { project_id: projectId },
      }),

    firstSecret: (userId: string, secretId: string, projectId: string) =>
      trackJourneyStep({
        journeyName: 'onboarding',
        stepName: 'first_secret',
        stepOrder: 4,
        userId,
        sessionId: getSessionId(),
        metadata: { secret_id: secretId, project_id: projectId },
      }),

    secretRetrieved: (userId: string, secretId: string) =>
      trackJourneyStep({
        journeyName: 'onboarding',
        stepName: 'secret_retrieved',
        stepOrder: 5,
        userId,
        sessionId: getSessionId(),
        metadata: { secret_id: secretId },
      }),
  },

  aiAssistant: {
    opened: (userId: string) =>
      trackJourneyStep({
        journeyName: 'ai_assistant',
        stepName: 'chat_opened',
        stepOrder: 1,
        userId,
        sessionId: getSessionId(),
      }),

    querySubmitted: (userId: string, queryLength: number, model: string) =>
      trackJourneyStep({
        journeyName: 'ai_assistant',
        stepName: 'query_submitted',
        stepOrder: 2,
        userId,
        sessionId: getSessionId(),
        metadata: { query_length: queryLength, model },
      }),

    responseReceived: (userId: string, responseTime: number) =>
      trackJourneyStep({
        journeyName: 'ai_assistant',
        stepName: 'response_received',
        stepOrder: 3,
        userId,
        sessionId: getSessionId(),
        metadata: { response_time_ms: responseTime },
      }),

    secretSaved: (userId: string, secretId: string) =>
      trackJourneyStep({
        journeyName: 'ai_assistant',
        stepName: 'secret_saved',
        stepOrder: 4,
        userId,
        sessionId: getSessionId(),
        metadata: { secret_id: secretId },
      }),
  },

  mcpSetup: {
    installed: (userId: string, tool: 'claude_code' | 'cursor') =>
      trackJourneyStep({
        journeyName: 'mcp_setup',
        stepName: 'mcp_installed',
        stepOrder: 1,
        userId,
        sessionId: getSessionId(),
        metadata: { tool },
      }),

    authenticated: (userId: string) =>
      trackJourneyStep({
        journeyName: 'mcp_setup',
        stepName: 'authenticated',
        stepOrder: 2,
        userId,
        sessionId: getSessionId(),
      }),

    firstRequest: (userId: string, secretId: string) =>
      trackJourneyStep({
        journeyName: 'mcp_setup',
        stepName: 'first_request',
        stepOrder: 3,
        userId,
        sessionId: getSessionId(),
        metadata: { secret_id: secretId },
      }),

    approved: (userId: string, approvalDuration: string) =>
      trackJourneyStep({
        journeyName: 'mcp_setup',
        stepName: 'approved',
        stepOrder: 4,
        userId,
        sessionId: getSessionId(),
        metadata: { approval_duration: approvalDuration },
      }),

    secretReceived: (userId: string) =>
      trackJourneyStep({
        journeyName: 'mcp_setup',
        stepName: 'secret_received',
        stepOrder: 5,
        userId,
        sessionId: getSessionId(),
      }),
  },

  teamCollaboration: {
    inviteSent: (userId: string, inviteeEmail: string, projectId: string) =>
      trackJourneyStep({
        journeyName: 'team_collaboration',
        stepName: 'invite_sent',
        stepOrder: 1,
        userId,
        sessionId: getSessionId(),
        metadata: { invitee_email: inviteeEmail, project_id: projectId },
      }),

    inviteAccepted: (userId: string, inviterId: string) =>
      trackJourneyStep({
        journeyName: 'team_collaboration',
        stepName: 'invite_accepted',
        stepOrder: 2,
        userId,
        sessionId: getSessionId(),
        metadata: { inviter_id: inviterId },
      }),

    projectAccessed: (userId: string, projectId: string) =>
      trackJourneyStep({
        journeyName: 'team_collaboration',
        stepName: 'project_accessed',
        stepOrder: 3,
        userId,
        sessionId: getSessionId(),
        metadata: { project_id: projectId },
      }),

    secretViewed: (userId: string, secretId: string, approvalRequired: boolean) =>
      trackJourneyStep({
        journeyName: 'team_collaboration',
        stepName: 'secret_viewed',
        stepOrder: 4,
        userId,
        sessionId: getSessionId(),
        metadata: { secret_id: secretId, approval_required: approvalRequired },
      }),
  },
};
```

**Time:** ~2 hours

---

## Dashboard Configuration

### Step 1: Create Operations Dashboard HTML

**Purpose:** Simple, self-hosted dashboard for daily monitoring

**Implementation:**

Create `public/ops-dashboard/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abyrith Operations Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1e293b;
    }
    .header h1 {
      font-size: 28px;
      color: #f8fafc;
    }
    .last-updated {
      color: #94a3b8;
      font-size: 14px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric-card {
      background: #1e293b;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .metric-card.good { border-left: 4px solid #10b981; }
    .metric-card.warning { border-left: 4px solid #f59e0b; }
    .metric-card.critical { border-left: 4px solid #ef4444; }
    .metric-label {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 32px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 4px;
    }
    .metric-change {
      font-size: 12px;
      color: #64748b;
    }
    .metric-change.positive { color: #10b981; }
    .metric-change.negative { color: #ef4444; }
    .charts-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-container {
      background: #1e293b;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .chart-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #f8fafc;
    }
    canvas {
      max-height: 300px;
    }
    .alerts-section {
      background: #1e293b;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .alerts-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #f8fafc;
    }
    .alert-item {
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid;
      background: #0f172a;
    }
    .alert-item.critical { border-left-color: #ef4444; }
    .alert-item.warning { border-left-color: #f59e0b; }
    .alert-item.info { border-left-color: #3b82f6; }
    .alert-time {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .alert-message {
      font-size: 14px;
      color: #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 Abyrith Operations Dashboard</h1>
    <div class="last-updated">Last updated: <span id="last-updated-time">--</span></div>
  </div>

  <div class="metrics-grid" id="metrics-grid"></div>

  <div class="charts-section">
    <div class="chart-container">
      <div class="chart-title">API Response Time (p95)</div>
      <canvas id="api-latency-chart"></canvas>
    </div>
    <div class="chart-container">
      <div class="chart-title">Frontend Performance (Web Vitals)</div>
      <canvas id="web-vitals-chart"></canvas>
    </div>
    <div class="chart-container">
      <div class="chart-title">Daily Active Users</div>
      <canvas id="dau-chart"></canvas>
    </div>
    <div class="chart-container">
      <div class="chart-title">Feature Usage</div>
      <canvas id="feature-usage-chart"></canvas>
    </div>
  </div>

  <div class="alerts-section">
    <div class="alerts-title">Recent Alerts</div>
    <div id="alerts-container"></div>
  </div>

  <script>
    // Fetch metrics from API
    async function loadMetrics() {
      try {
        const response = await fetch('/api/analytics/dashboard');
        const data = await response.json();

        renderMetrics(data.metrics);
        renderCharts(data.charts);
        renderAlerts(data.alerts);

        document.getElementById('last-updated-time').textContent = new Date().toLocaleString();
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    }

    function renderMetrics(metrics) {
      const grid = document.getElementById('metrics-grid');
      grid.innerHTML = metrics.map(metric => `
        <div class="metric-card ${metric.status}">
          <div class="metric-label">${metric.label}</div>
          <div class="metric-value">${metric.value}</div>
          <div class="metric-change ${metric.change > 0 ? 'positive' : 'negative'}">
            ${metric.change > 0 ? '▲' : '▼'} ${Math.abs(metric.change)}% vs yesterday
          </div>
        </div>
      `).join('');
    }

    function renderCharts(charts) {
      // API Latency Chart
      new Chart(document.getElementById('api-latency-chart'), {
        type: 'line',
        data: {
          labels: charts.apiLatency.labels,
          datasets: [{
            label: 'p95 Latency (ms)',
            data: charts.apiLatency.values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
            x: { ticks: { color: '#94a3b8' } },
          },
        },
      });

      // Web Vitals Chart
      new Chart(document.getElementById('web-vitals-chart'), {
        type: 'bar',
        data: {
          labels: ['LCP', 'FID', 'CLS', 'TTFB'],
          datasets: [{
            label: 'p75 Value',
            data: charts.webVitals.values,
            backgroundColor: charts.webVitals.values.map((v, i) => {
              const thresholds = [2500, 100, 0.1, 600];
              return v <= thresholds[i] ? '#10b981' : v <= thresholds[i] * 2 ? '#f59e0b' : '#ef4444';
            }),
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: '#94a3b8' } },
            x: { ticks: { color: '#94a3b8' } },
          },
        },
      });

      // DAU Chart
      new Chart(document.getElementById('dau-chart'), {
        type: 'line',
        data: {
          labels: charts.dau.labels,
          datasets: [{
            label: 'Daily Active Users',
            data: charts.dau.values,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
            x: { ticks: { color: '#94a3b8' } },
          },
        },
      });

      // Feature Usage Chart
      new Chart(document.getElementById('feature-usage-chart'), {
        type: 'doughnut',
        data: {
          labels: charts.featureUsage.labels,
          datasets: [{
            data: charts.featureUsage.values,
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8' },
            },
          },
        },
      });
    }

    function renderAlerts(alerts) {
      const container = document.getElementById('alerts-container');
      if (alerts.length === 0) {
        container.innerHTML = '<div style="color: #64748b; text-align: center; padding: 20px;">No recent alerts</div>';
        return;
      }

      container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.severity}">
          <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
          <div class="alert-message">${alert.message}</div>
        </div>
      `).join('');
    }

    // Load metrics on page load
    loadMetrics();

    // Refresh every 60 seconds
    setInterval(loadMetrics, 60000);
  </script>
</body>
</html>
```

**Create API endpoint:**

```typescript
// app/api/analytics/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch metrics from last 24 hours
  const metrics = await fetchMetrics(supabase);
  const charts = await fetchChartData(supabase);
  const alerts = await fetchRecentAlerts(supabase);

  return NextResponse.json({ metrics, charts, alerts });
}

async function fetchMetrics(supabase: any) {
  // Implement metric queries...
  return [
    {
      label: 'API Uptime',
      value: '99.97%',
      status: 'good',
      change: 0.01,
    },
    {
      label: 'Error Rate',
      value: '0.12%',
      status: 'good',
      change: -0.05,
    },
    {
      label: 'Avg Response Time',
      value: '142ms',
      status: 'good',
      change: -8,
    },
    {
      label: 'Daily Active Users',
      value: '847',
      status: 'good',
      change: 12,
    },
    {
      label: 'Database Connections',
      value: '42/60',
      status: 'good',
      change: 5,
    },
    {
      label: 'Performance Score',
      value: '94/100',
      status: 'good',
      change: 2,
    },
  ];
}

async function fetchChartData(supabase: any) {
  // Implement chart data queries...
  return {
    apiLatency: {
      labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
      values: [120, 135, 158, 142, 138, 145],
    },
    webVitals: {
      values: [2100, 45, 0.08, 480], // LCP, FID, CLS, TTFB
    },
    dau: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      values: [720, 845, 790, 910, 847, 620, 580],
    },
    featureUsage: {
      labels: ['Secrets', 'AI Assistant', 'MCP', 'Team', 'Settings'],
      values: [3500, 1200, 450, 800, 350],
    },
  };
}

async function fetchRecentAlerts(supabase: any) {
  // Fetch from monitoring system...
  return [];
}
```

**Time:** ~3 hours

---

## Alerting Rules Setup

### Step 1: Define Alert Thresholds

**Purpose:** Establish clear criteria for application alerts

**Critical Alerts (Slack #incidents + PagerDuty):**
- **Frontend Performance Degradation** - LCP p75 > 4000ms for 10 minutes
- **API Error Rate Spike** - 5xx error rate > 5% for 5 minutes
- **Business KPI Drop** - DAU drops > 30% compared to 7-day average
- **User Journey Failure** - Onboarding funnel completion < 50% for 24 hours
- **AI Assistant Degradation** - Query success rate < 80% for 15 minutes

**Warning Alerts (Slack #alerts only):**
- **Performance Warning** - LCP p75 > 2500ms for 10 minutes
- **Elevated Error Rate** - 5xx error rate > 1% for 10 minutes
- **Feature Usage Drop** - Key feature usage drops > 20% compared to 7-day average
- **External API Latency** - Claude API p95 > 5s for 10 minutes
- **Conversion Funnel Drop** - Any funnel step drops > 15% completion rate

**Info Alerts (Slack #monitoring only):**
- **Performance Report** - Daily performance score report
- **User Growth Report** - Daily DAU/MAU metrics
- **Feature Adoption Report** - Weekly feature usage summary
- **Journey Completion Report** - Weekly funnel analysis

**Time:** ~30 minutes

---

### Step 2: Implement Alert Logic

**Purpose:** Create automated alert detection

**Implementation:**

Create Cloudflare Worker for periodic alert checking:

```typescript
// workers/scheduled/check-application-alerts.ts
interface Env {
  ANALYTICS: AnalyticsEngineDataset;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_WEBHOOK_URL: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run every 5 minutes
    ctx.waitUntil(checkAlerts(env));
  },
};

async function checkAlerts(env: Env) {
  const alerts = [];

  // Check frontend performance
  const lcpAlert = await checkLCPPerformance(env);
  if (lcpAlert) alerts.push(lcpAlert);

  // Check API error rate
  const errorRateAlert = await checkErrorRate(env);
  if (errorRateAlert) alerts.push(errorRateAlert);

  // Check DAU drop
  const dauAlert = await checkDAUDrop(env);
  if (dauAlert) alerts.push(dauAlert);

  // Check AI Assistant success rate
  const aiAlert = await checkAIAssistantHealth(env);
  if (aiAlert) alerts.push(aiAlert);

  // Send alerts to Slack
  for (const alert of alerts) {
    await sendSlackAlert(alert, env);
  }
}

async function checkLCPPerformance(env: Env): Promise<Alert | null> {
  // Query Analytics Engine for LCP p75 over last 10 minutes
  const query = `
    SELECT
      quantile(0.75)(metric_value) AS lcp_p75
    FROM web_vitals
    WHERE metric_name = 'LCP'
      AND timestamp > NOW() - INTERVAL 10 MINUTE
  `;

  const result = await queryAnalyticsEngine(env.ANALYTICS, query);
  const lcpP75 = result[0]?.lcp_p75;

  if (lcpP75 > 4000) {
    return {
      severity: 'critical',
      title: 'Frontend Performance Degradation',
      message: `LCP p75 is ${Math.round(lcpP75)}ms (threshold: 4000ms)`,
      metric: 'lcp_p75',
      value: lcpP75,
      threshold: 4000,
      runbook: 'https://docs.abyrith.com/operations/runbooks/frontend-performance',
    };
  } else if (lcpP75 > 2500) {
    return {
      severity: 'warning',
      title: 'Frontend Performance Warning',
      message: `LCP p75 is ${Math.round(lcpP75)}ms (threshold: 2500ms)`,
      metric: 'lcp_p75',
      value: lcpP75,
      threshold: 2500,
    };
  }

  return null;
}

async function checkErrorRate(env: Env): Promise<Alert | null> {
  // Query API error rate from last 5 minutes
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE status_code >= 500) / COUNT(*) AS error_rate
    FROM api_requests
    WHERE timestamp > NOW() - INTERVAL 5 MINUTE
  `;

  const result = await queryAnalyticsEngine(env.ANALYTICS, query);
  const errorRate = result[0]?.error_rate * 100; // Convert to percentage

  if (errorRate > 5) {
    return {
      severity: 'critical',
      title: 'High API Error Rate',
      message: `5xx error rate is ${errorRate.toFixed(2)}% (threshold: 5%)`,
      metric: 'error_rate',
      value: errorRate,
      threshold: 5,
      runbook: 'https://docs.abyrith.com/operations/runbooks/high-error-rate',
    };
  } else if (errorRate > 1) {
    return {
      severity: 'warning',
      title: 'Elevated API Error Rate',
      message: `5xx error rate is ${errorRate.toFixed(2)}% (threshold: 1%)`,
      metric: 'error_rate',
      value: errorRate,
      threshold: 1,
    };
  }

  return null;
}

async function sendSlackAlert(alert: Alert, env: Env) {
  const color = alert.severity === 'critical' ? '#ef4444' : '#f59e0b';
  const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';

  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        title: `${emoji} ${alert.title}`,
        text: alert.message,
        fields: [
          {
            title: 'Metric',
            value: alert.metric,
            short: true,
          },
          {
            title: 'Current Value',
            value: alert.value.toFixed(2),
            short: true,
          },
          {
            title: 'Threshold',
            value: alert.threshold.toFixed(2),
            short: true,
          },
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true,
          },
        ],
        actions: alert.runbook ? [{
          type: 'button',
          text: 'View Runbook',
          url: alert.runbook,
        }] : undefined,
        footer: 'Abyrith Monitoring',
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });
}
```

**Configure scheduled trigger in `wrangler.toml`:**

```toml
[triggers]
crons = ["*/5 * * * *"] # Run every 5 minutes
```

**Deploy Worker:**
```bash
wrangler deploy workers/scheduled/check-application-alerts.ts
```

**Time:** ~2 hours

---

## Performance Baselines

### Application Performance Targets

**Frontend Performance (Production):**
- **LCP (Largest Contentful Paint):**
  - Good: < 2.5s
  - Needs Improvement: 2.5s - 4.0s
  - Poor: > 4.0s
  - **Target:** p75 < 2.5s

- **FID (First Input Delay):**
  - Good: < 100ms
  - Needs Improvement: 100ms - 300ms
  - Poor: > 300ms
  - **Target:** p75 < 100ms

- **CLS (Cumulative Layout Shift):**
  - Good: < 0.1
  - Needs Improvement: 0.1 - 0.25
  - Poor: > 0.25
  - **Target:** p75 < 0.1

- **TTFB (Time to First Byte):**
  - Good: < 600ms
  - Needs Improvement: 600ms - 1500ms
  - Poor: > 1500ms
  - **Target:** p75 < 600ms

- **Overall Performance Score:**
  - Good: > 90/100
  - Acceptable: 70-90/100
  - Poor: < 70/100
  - **Target:** > 90/100

---

**Backend API Performance:**
- **Endpoint Latency:**
  - p50: < 100ms
  - p95: < 200ms
  - p99: < 500ms
  - **Target:** p95 < 200ms for all endpoints

- **Error Rates:**
  - 4xx errors: < 5% (user errors acceptable)
  - 5xx errors: < 0.5% (server errors)
  - **Target:** < 0.1% for 5xx errors

- **Throughput:**
  - Normal load: 100-500 req/s
  - Peak load: up to 1,000 req/s
  - **Target:** Handle 1,000 req/s without degradation

---

**Business KPIs:**
- **User Growth:**
  - DAU growth: +5-10% month-over-month
  - MAU growth: +10-15% month-over-month
  - **Target:** Consistent positive growth

- **Onboarding Funnel:**
  - Signup → First Project: > 80% completion
  - First Project → First Secret: > 70% completion
  - Overall funnel: > 60% completion within 24 hours
  - **Target:** > 70% overall completion

- **Feature Adoption:**
  - AI Assistant usage: > 30% of active users
  - MCP integration setup: > 15% of developer users
  - Team collaboration: > 40% of team-tier users
  - **Target:** Increasing adoption month-over-month

- **User Retention:**
  - Day 1 retention: > 70%
  - Day 7 retention: > 50%
  - Day 30 retention: > 35%
  - **Target:** Stable or improving retention cohorts

---

## Troubleshooting

### Issue 1: Web Vitals Metrics Not Being Collected

**Symptoms:**
```
Dashboard shows "No data available" for frontend metrics
```

**Cause:** sendBeacon() failing or API endpoint not receiving metrics

**Solution:**
```bash
# 1. Check browser console for errors
# Open browser DevTools → Console
# Look for errors from /api/metrics/web-vitals

# 2. Verify API endpoint is deployed
curl https://abyrith.com/api/metrics/web-vitals \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"LCP","value":2000,"rating":"good"}'

# Expected: {"success":true}

# 3. Check Analytics Engine is receiving data
wrangler analytics dataset list

# 4. Verify web-vitals library is installed
pnpm list web-vitals

# 5. Check usePerformanceTracking hook is called in layout
# app/layout.tsx should call usePerformanceTracking()
```

**If solution doesn't work:**
- Check Cloudflare Workers Analytics Engine binding is configured
- Verify ANALYTICS binding exists in wrangler.toml
- Test with manual sendBeacon() call in browser console

**Time to resolve:** ~15 minutes

---

### Issue 2: High API Latency for Specific Endpoints

**Symptoms:**
```
Dashboard shows p95 latency > 500ms for /api/secrets/:id endpoint
```

**Cause:** Database query inefficiency or missing indexes

**Solution:**
```sql
-- 1. Identify slow queries in Supabase
SELECT
  query,
  mean_time / 1000 AS mean_seconds,
  calls,
  total_time / 1000 AS total_seconds
FROM pg_stat_statements
WHERE query LIKE '%secrets%'
  AND mean_time > 100 -- > 100ms
ORDER BY mean_time DESC
LIMIT 10;

-- 2. Analyze query plan for slow query
EXPLAIN ANALYZE
SELECT *
FROM secrets
WHERE user_id = 'abc-123'
  AND project_id = 'xyz-456';

-- 3. Check for missing indexes
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename = 'secrets';

-- 4. Add missing index if needed
CREATE INDEX CONCURRENTLY idx_secrets_user_project
ON secrets(user_id, project_id);
```

**Monitor improvement:**
```bash
# Watch latency metrics for next 10 minutes
# Dashboard should show p95 dropping to < 200ms
```

**If solution doesn't work:**
- Check if RLS policies are causing sequential scans
- Review application code for N+1 query patterns
- Consider implementing caching for frequently accessed secrets

**Time to resolve:** ~30 minutes

---

### Issue 3: Business KPI Drop (DAU Decreased Significantly)

**Symptoms:**
```
Dashboard shows DAU dropped 25% compared to 7-day average
```

**Cause:** Could be legitimate (weekend effect) or concerning (user churn)

**Solution:**
```sql
-- 1. Check if drop is consistent or one-time anomaly
SELECT
  DATE_TRUNC('day', created_at) AS date,
  COUNT(DISTINCT user_id) AS dau,
  LAG(COUNT(DISTINCT user_id)) OVER (ORDER BY DATE_TRUNC('day', created_at)) AS previous_day_dau,
  ROUND(
    100.0 * (COUNT(DISTINCT user_id) - LAG(COUNT(DISTINCT user_id)) OVER (ORDER BY DATE_TRUNC('day', created_at)))
    / NULLIF(LAG(COUNT(DISTINCT user_id)) OVER (ORDER BY DATE_TRUNC('day', created_at)), 0),
    2
  ) AS change_percent
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- 2. Check if specific feature usage dropped
SELECT
  feature_name,
  COUNT(DISTINCT user_id) AS unique_users_today,
  LAG(COUNT(DISTINCT user_id)) OVER (PARTITION BY feature_name ORDER BY DATE_TRUNC('day', created_at)) AS unique_users_yesterday
FROM feature_usage
WHERE created_at >= NOW() - INTERVAL '2 days'
GROUP BY feature_name, DATE_TRUNC('day', created_at)
ORDER BY feature_name, DATE_TRUNC('day', created_at) DESC;

-- 3. Check for recent errors or performance issues
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE status_code >= 500) AS error_count,
  COUNT(*) AS total_requests,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status_code >= 500) / COUNT(*), 2) AS error_rate
FROM application_metrics
WHERE metric_type = 'api_performance'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- 4. Check user cohort retention
SELECT
  DATE_TRUNC('week', u.created_at) AS cohort_week,
  COUNT(DISTINCT u.id) AS total_users,
  COUNT(DISTINCT CASE WHEN fu.created_at >= NOW() - INTERVAL '7 days' THEN fu.user_id END) AS active_last_7_days,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN fu.created_at >= NOW() - INTERVAL '7 days' THEN fu.user_id END) / COUNT(DISTINCT u.id),
    2
  ) AS retention_rate
FROM auth.users u
LEFT JOIN feature_usage fu ON fu.user_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '8 weeks'
GROUP BY DATE_TRUNC('week', u.created_at)
ORDER BY cohort_week DESC;
```

**Actions:**
- If weekend effect: Normal, monitor for Monday recovery
- If correlated with errors: Fix errors immediately, communicate to users
- If cohort retention drop: Investigate product changes, gather user feedback
- If specific feature drop: Check for deployment issues, bugs, or UX problems

**Time to investigate:** ~1 hour

---

### Issue 4: Alert Fatigue from Too Many False Positives

**Symptoms:**
```
Team ignoring alerts because 80% are false positives
```

**Cause:** Alert thresholds set too aggressively

**Solution:**
```typescript
// 1. Review alert history
// Query Slack channel #alerts for last 7 days
// Calculate true positive rate

// 2. Adjust thresholds based on actual baseline
// Example: If LCP p75 is consistently 2200ms, don't alert at 2500ms

// Before (too sensitive):
if (lcpP75 > 2500) {
  return { severity: 'warning', ... };
}

// After (more realistic):
if (lcpP75 > 3000) {
  return { severity: 'warning', ... };
}

// 3. Add minimum duration requirement
// Alert only if threshold exceeded for sustained period

let exceedingThresholdCount = 0;

async function checkLCPPerformance(env: Env): Promise<Alert | null> {
  const lcpP75 = await queryMetric('lcp_p75');

  if (lcpP75 > 3000) {
    exceedingThresholdCount++;

    // Alert only after 3 consecutive checks (15 minutes)
    if (exceedingThresholdCount >= 3) {
      return {
        severity: 'warning',
        title: 'Sustained Frontend Performance Degradation',
        message: `LCP p75 has been > 3000ms for 15+ minutes`,
      };
    }
  } else {
    exceedingThresholdCount = 0; // Reset counter
  }

  return null;
}

// 4. Implement alert deduplication
// Don't send same alert multiple times within 1 hour

const recentAlerts = new Map<string, number>();

function shouldSendAlert(alert: Alert): boolean {
  const alertKey = `${alert.metric}_${alert.severity}`;
  const lastSent = recentAlerts.get(alertKey);

  if (lastSent && Date.now() - lastSent < 3600000) {
    return false; // Already sent within last hour
  }

  recentAlerts.set(alertKey, Date.now());
  return true;
}
```

**Best practices:**
- Review alert effectiveness monthly
- Tune thresholds based on actual production baselines
- Require sustained threshold violation (not single spike)
- Deduplicate identical alerts within time window
- Distinguish between noise and actionable alerts

**Time to fix:** ~1 hour

---

### Issue 5: Dashboard Showing Stale Data

**Symptoms:**
```
Dashboard last updated timestamp is > 10 minutes ago
```

**Cause:** API endpoint timeout or analytics database lag

**Solution:**
```bash
# 1. Check if API endpoint is responding
curl https://abyrith.com/api/analytics/dashboard

# Expected: JSON response within 2 seconds

# 2. Check Supabase database performance
# Navigate to Supabase Dashboard → Reports → Database
# Look for slow queries or connection pool exhaustion

# 3. Optimize dashboard queries
# Add indexes for analytics queries

CREATE INDEX CONCURRENTLY idx_app_metrics_type_created_filtered
ON application_metrics(metric_type, created_at DESC)
WHERE created_at >= NOW() - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY idx_feature_usage_created_filtered
ON feature_usage(created_at DESC)
WHERE created_at >= NOW() - INTERVAL '30 days';

# 4. Implement caching for dashboard data
```

**Add caching to API endpoint:**
```typescript
// app/api/analytics/dashboard/route.ts
import { unstable_cache } from 'next/cache';

export async function GET(request: NextRequest) {
  // Cache dashboard data for 5 minutes
  const getCachedDashboard = unstable_cache(
    async () => {
      const supabase = createClient(...);
      const metrics = await fetchMetrics(supabase);
      const charts = await fetchChartData(supabase);
      const alerts = await fetchRecentAlerts(supabase);
      return { metrics, charts, alerts };
    },
    ['dashboard-data'],
    { revalidate: 300 } // 5 minutes
  );

  const data = await getCachedDashboard();
  return NextResponse.json(data);
}
```

**Time to resolve:** ~30 minutes

---

## Post-Procedure

### Cleanup

**After successful monitoring setup:**
```bash
# No cleanup needed - monitoring runs continuously

# Optional: Remove test data from analytics tables (if any)
DELETE FROM application_metrics
WHERE metadata->>'test' = 'true';

DELETE FROM feature_usage
WHERE metadata->>'test' = 'true';
```

---

### Documentation

**Update these documents:**
- [ ] This runbook (if issues/improvements identified)
- [ ] `10-operations/monitoring/monitoring-alerting.md` (infrastructure monitoring)
- [ ] Team wiki with dashboard links
- [ ] Alert runbook with new alert types

**Document in team wiki:**
- Dashboard URL: https://abyrith.com/ops-dashboard
- Grafana URL (if configured): https://abyrith.grafana.net
- Key metrics definitions and thresholds
- Alert escalation procedures
- Performance optimization checklist

---

### Post-Setup Verification

**24 Hours After Setup:**
- [ ] Verify all dashboards showing data
- [ ] Confirm metrics collection from frontend and backend
- [ ] Test one alert by manually triggering condition
- [ ] Review business metrics for data quality
- [ ] Check user journey tracking is capturing events

**1 Week After Setup:**
- [ ] Review alert noise (false positive rate)
- [ ] Analyze performance trends
- [ ] Identify optimization opportunities
- [ ] Adjust thresholds if needed
- [ ] Document any issues encountered

**1 Month After Setup:**
- [ ] Comprehensive monitoring review with team
- [ ] Analyze month-over-month KPI trends
- [ ] Update performance baselines
- [ ] Optimize slow queries identified
- [ ] Training session for new team members on dashboards

---

### Communication

**Notify:**
- [ ] Team in #ops channel: "Application monitoring setup complete for [environment]"
- [ ] Document dashboard URLs in team wiki
- [ ] Share performance baselines with engineering team
- [ ] Send summary to stakeholders (if enterprise setup)

**Summary Message Template:**
```
✅ Application Monitoring Setup Complete - Abyrith [Environment]

Dashboards:
- Operations Dashboard: https://abyrith.com/ops-dashboard
- Cloudflare Analytics: [URL]
- Supabase Reports: [URL]
- Grafana (optional): [URL]

Metrics Tracked:
- Frontend: Core Web Vitals (LCP, FID, CLS, TTFB)
- Backend: API latency, error rates, throughput
- Business: DAU, MAU, feature adoption, conversion funnels
- User Journeys: Onboarding, AI usage, MCP setup, team collaboration

Alert Channels:
- Critical: Slack #incidents + PagerDuty
- Warning: Slack #alerts
- Info: Slack #monitoring

Performance Baselines:
- Frontend: LCP p75 < 2.5s, Performance Score > 90/100
- Backend: API p95 < 200ms, Error rate < 0.1%
- Business: DAU +5-10% MoM, Onboarding funnel > 70%

Monitoring Runbook:
10-operations/monitoring/application-monitoring.md

Questions? Reach out in #ops.
```

---

### Monitoring Health Checks

**Daily:**
- [ ] Review performance dashboard (5 min)
- [ ] Check for new alerts
- [ ] Monitor key business KPIs (DAU, error rate)

**Weekly:**
- [ ] Analyze performance trends (30 min)
- [ ] Review user journey funnels
- [ ] Identify optimization opportunities
- [ ] Check alert effectiveness (true positive rate)

**Monthly:**
- [ ] Full metrics review with team (1 hour)
- [ ] Update performance baselines
- [ ] Optimize slow queries and endpoints
- [ ] Review and tune alert thresholds
- [ ] Business KPI deep dive

**Quarterly:**
- [ ] Comprehensive monitoring audit (2 hours)
- [ ] Review and update this runbook
- [ ] Evaluate new monitoring tools/features
- [ ] Training refresher for team
- [ ] Capacity planning based on growth trends

---

## Communication

### Communication Templates

**Pre-Setup Announcement:**
```
📊 Application Monitoring Setup Scheduled

When: [Date/Time]
Duration: ~6-8 hours
Environment: [staging/production]
Impact: No user impact - monitoring only
Purpose: Setting up comprehensive application metrics collection and dashboards

Metrics covered:
- Frontend performance (Core Web Vitals)
- Backend API metrics (latency, errors, throughput)
- Business KPIs (DAU, feature adoption, conversion funnels)
- User journey tracking

Updates: This channel
```

---

**During Setup:**
```
🔧 Monitoring Setup In Progress

Status: [Current step]
Progress: 60% complete
ETA: ~2 hours remaining

Completed:
✅ Frontend metrics collection
✅ Backend API metrics
🔄 Business KPI tracking (in progress)
⏳ Dashboard configuration (pending)

All systems operational. No user impact.
```

---

**Completion:**
```
✅ Application Monitoring Setup Complete

Environment: [environment]
Duration: [actual time]
Status: Success

Dashboards live:
- Operations Dashboard: https://abyrith.com/ops-dashboard
- Cloudflare Workers Analytics: [URL]
- Supabase Analytics: [URL]

Metrics tracked:
- Frontend: Core Web Vitals, user interactions
- Backend: API performance, external dependencies
- Business: User growth, feature adoption, conversion funnels

Alert channels configured:
- Critical → Slack #incidents + PagerDuty
- Warning → Slack #alerts
- Info → Slack #monitoring

Monitoring is now active. Baselines will be established over next 7 days.

Runbook: 10-operations/monitoring/application-monitoring.md
```

---

**Rollback Announcement:**
```
⚠️ Monitoring Setup Issue

Issue encountered: [brief explanation]
Action taken: Reverted to previous configuration
Impact: Monitoring temporarily using infrastructure metrics only

Investigation underway. Application metrics collection will be retried after fix identified.

Incident ticket: [link]
```

---

## Dependencies

### Technical Dependencies

**Must exist before monitoring setup:**
- [ ] `10-operations/monitoring/monitoring-alerting.md` - Infrastructure monitoring
- [ ] `07-frontend/frontend-architecture.md` - Frontend performance targets
- [ ] `06-backend/cloudflare-workers/workers-architecture.md` - Backend architecture
- [ ] `02-architecture/system-overview.md` - System architecture
- [ ] Working production/staging environment with deployed application

**Systems involved:**
- Cloudflare Workers Analytics Engine (metrics storage)
- Supabase PostgreSQL (long-term analytics database)
- Cloudflare Pages (frontend hosting)
- Slack (alert notifications)
- PagerDuty (optional, critical alerts)

---

### Team Dependencies

**Requires coordination with:**
- Engineering team - For metrics collection implementation
- DevOps team - For dashboard access and alert configuration
- Product team - For business KPIs definition
- Analytics team - For funnel analysis and reporting

---

## References

### Internal Documentation
- `10-operations/monitoring/monitoring-alerting.md` - Infrastructure monitoring and alerting
- `10-operations/incidents/incident-response.md` - Incident response procedures
- `07-frontend/frontend-architecture.md` - Frontend architecture and performance targets
- `06-backend/cloudflare-workers/workers-architecture.md` - Backend API architecture
- `02-architecture/system-overview.md` - System architecture overview
- `TECH-STACK.md` - Technology specifications

### External Resources
- [Core Web Vitals Guide](https://web.dev/vitals/) - Google's Web Vitals documentation
- [web-vitals Library](https://github.com/GoogleChrome/web-vitals) - Official Web Vitals measurement library
- [Cloudflare Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) - Time-series metrics storage
- [Chart.js Documentation](https://www.chartjs.org/docs/) - Dashboard chart library
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance) - Browser performance measurement APIs

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | DevOps Team | Initial application monitoring runbook |

---

## Notes

### Future Enhancements
- Implement real-time anomaly detection using machine learning
- Add user segmentation for cohort analysis (e.g., by plan tier, country)
- Create mobile app for on-the-go dashboard monitoring
- Implement A/B testing framework with metrics tracking
- Add session replay integration for debugging user issues
- Create automated performance regression detection in CI/CD

### Known Limitations
- Analytics Engine retention: 90 days (Workers plan)
- Supabase analytics retention: 1 year (custom implementation)
- Web Vitals sampling: 10% detailed metrics, 100% critical errors
- Real-time dashboard: 1-minute update frequency
- Alert deduplication: 1-hour window

### Lessons Learned
- Start with critical metrics only, expand gradually
- Balance between comprehensive monitoring and alert fatigue
- Involve product team in defining business KPIs early
- Test alert thresholds in staging before production
- Document metric definitions clearly for whole team

### Next Review Date
2025-11-30 (Monthly review) | 2026-01-30 (Quarterly comprehensive review)
