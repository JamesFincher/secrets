---
Document: Frontend Error Handling - Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 07-frontend/frontend-architecture.md, 05-api/api-rest-design.md, 03-security/security-model.md, TECH-STACK.md
---

# Frontend Error Handling Architecture

## Overview

This document defines the comprehensive error handling architecture for the Abyrith frontend, including error boundaries, user-facing error messages, error recovery patterns, logging, and monitoring strategies. The architecture ensures a resilient user experience where errors are caught gracefully, users receive clear actionable guidance, and developers have visibility into production issues without exposing sensitive data.

**Purpose:** Create a robust error handling system that prevents application crashes, provides clear user feedback, enables debugging without compromising security, and maintains zero-knowledge encryption guarantees even during error scenarios.

**Scope:** This document covers React error boundaries, async error handling, API error patterns, encryption error handling, form validation errors, network failure recovery, error logging strategies, user-facing error messages, and error recovery workflows.

**Status:** Draft - Implementation pending

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [API Contracts](#api-contracts)
7. [Security Architecture](#security-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Scalability](#scalability)
10. [Failure Modes](#failure-modes)
11. [Alternatives Considered](#alternatives-considered)
12. [Decision Log](#decision-log)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Frontend applications must handle numerous error scenarios: component rendering failures, API errors, network failures, encryption/decryption failures, authentication errors, validation failures, and unexpected runtime errors. Without proper error handling, users encounter cryptic browser errors, data loss, and application crashes that require page refreshes.

**Pain points:**
- Unhandled errors crash the entire application, requiring page reload
- Generic error messages confuse users and provide no actionable guidance
- Errors expose sensitive information (stack traces, secret values) in production
- No visibility into production errors for debugging
- Errors during encryption operations can expose plaintext secrets
- Network failures lose user data without recovery mechanisms
- Error recovery requires manual intervention (refresh page)

**Why now?**
Error handling is foundational to user experience and security. The zero-knowledge architecture introduces complex encryption error scenarios that must be handled gracefully. AI-native features require resilient error handling to prevent workflow disruptions. Enterprise customers require comprehensive error logging for security audits and compliance.

### Background

**Existing system:**
This is a greenfield implementation. No existing error handling system.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| End Users | Application doesn't crash, clear error messages | Frustration with cryptic errors, data loss |
| Frontend Team | Debuggable errors, error visibility | Lack of production error insights, security constraints on logging |
| Security Lead | No sensitive data in error logs | Stack traces or logs might expose secrets, keys, or user data |
| Product Team | Graceful degradation, error recovery | Errors disrupting critical flows, poor UX during failures |
| Support Team | Actionable error messages, error codes | Can't help users without understanding errors |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Prevent application crashes** - All errors caught gracefully, no white screen of death (Success metric: 0 unhandled errors causing full app crash, 100% error boundary coverage)
2. **Clear user-facing messages** - Errors translated to plain English with actionable next steps (Success metric: User testing shows 90%+ understand error messages)
3. **Secure error logging** - Full error details logged for debugging without exposing secrets or sensitive data (Success metric: Security audit confirms no PII/secrets in logs)
4. **Automatic recovery** - Common errors (network, auth) recover automatically without user intervention (Success metric: 80% of transient errors auto-recover)
5. **Developer visibility** - Production errors aggregated in Sentry with sufficient context for debugging (Success metric: Mean time to resolution < 2 hours for critical errors)

**Secondary goals:**
- Offline error queueing (retry when network returns)
- Progressive enhancement (degrade gracefully when features unavailable)
- Error replay for debugging (capture steps leading to error)
- User-initiated error reports with context

### Non-Goals

**Explicitly out of scope:**
- **Server-side error logging** - This document focuses on frontend; backend logging is separate (see `10-operations/monitoring/monitoring-alerting.md`)
- **Network infrastructure errors** - Cloudflare-level errors handled at infrastructure layer
- **Security vulnerability exploitation** - Error handling won't prevent determined attackers; focus is on UX and visibility
- **Custom error tracking solution** - Use Sentry (existing tool) rather than building custom analytics

### Success Metrics

**How we measure success:**
- **Crash Prevention**: 0 unhandled errors causing app crash, 99.9% error boundary coverage of React tree
- **User Clarity**: 90%+ of user testing participants understand error messages and know next steps
- **Security Compliance**: 0 secrets, PII, or encryption keys in error logs (verified by security audit)
- **Recovery Rate**: 80%+ of transient errors (network, auth) auto-recover without user action
- **Developer Efficiency**: Mean time to resolution < 2 hours for P1 errors, < 4 hours for P2 errors

---

## Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Frontend Error Handling                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Error Capture Layer                            │  │
│  │                                                          │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │  │
│  │  │ React Error   │  │  Global Error  │  │  Promise   │ │  │
│  │  │  Boundaries   │  │    Handler     │  │ Rejection  │ │  │
│  │  │ (Component    │  │  (window.      │  │  Handler   │ │  │
│  │  │   crashes)    │  │  onerror)      │  │            │ │  │
│  │  └────────┬───────┘  └────────┬───────┘  └──────┬─────┘ │  │
│  │           │                   │                  │       │  │
│  └───────────┼───────────────────┼──────────────────┼───────┘  │
│              │                   │                  │          │
│  ┌───────────▼───────────────────▼──────────────────▼───────┐  │
│  │              Error Classification Engine                 │  │
│  │  • Network errors → NetworkErrorHandler                  │  │
│  │  • API errors → APIErrorHandler                          │  │
│  │  • Encryption errors → CryptoErrorHandler                │  │
│  │  • Validation errors → ValidationErrorHandler            │  │
│  │  • Auth errors → AuthErrorHandler                        │  │
│  │  • Unknown errors → GenericErrorHandler                  │  │
│  └───────────┬──────────────────────────────────────────────┘  │
│              │                                                 │
│  ┌───────────▼──────────────────────────────────────────────┐  │
│  │           Error Processing Pipeline                      │  │
│  │                                                          │  │
│  │  1. Sanitize (remove sensitive data)                    │  │
│  │  2. Enrich (add context: user, route, state)            │  │
│  │  3. Map to user message (plain English)                 │  │
│  │  4. Log to monitoring (Sentry)                          │  │
│  │  5. Determine recovery strategy                         │  │
│  │  6. Execute recovery or show error UI                   │  │
│  └───────────┬──────────────────────────────────────────────┘  │
│              │                                                 │
│  ┌───────────▼──────────────────────────────────────────────┐  │
│  │              Error Output Layer                          │  │
│  │                                                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │  │
│  │  │   Toast     │  │   Error     │  │   Sentry       │  │  │
│  │  │   Alerts    │  │   Fallback  │  │   Logging      │  │  │
│  │  │ (transient) │  │     UI      │  │ (monitoring)   │  │  │
│  │  └─────────────┘  └─────────────┘  └────────────────┘  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: React Error Boundaries**
- **Purpose:** Catch React component rendering errors, prevent entire app crash
- **Technology:** React 18.3.x error boundaries, custom error boundary component
- **Responsibilities:**
  - Catch errors during render, lifecycle methods, and constructors
  - Display fallback UI with error message and recovery options
  - Log error to monitoring service (Sentry)
  - Prevent error propagation to parent components

**Component 2: Global Error Handler**
- **Purpose:** Catch errors outside React tree (window.onerror)
- **Technology:** Native browser error events
- **Responsibilities:**
  - Catch unhandled JavaScript errors
  - Catch errors in async code not wrapped in try/catch
  - Prevent browser default error UI
  - Log to monitoring service

**Component 3: Promise Rejection Handler**
- **Purpose:** Catch unhandled promise rejections
- **Technology:** window.onunhandledrejection event
- **Responsibilities:**
  - Catch async errors (API calls, encryption operations)
  - Prevent "Unhandled Promise Rejection" browser warnings
  - Log to monitoring service
  - Trigger error recovery for known error types

**Component 4: API Error Handler**
- **Purpose:** Handle API errors with consistent patterns
- **Technology:** Custom API client interceptors (see `07-frontend/frontend-architecture.md`)
- **Responsibilities:**
  - Parse API error responses
  - Map status codes to user messages
  - Trigger automatic retries for transient errors (500, 502, 503, 504)
  - Handle authentication errors (401 token refresh)

**Component 5: Encryption Error Handler**
- **Purpose:** Handle encryption/decryption failures securely
- **Technology:** Custom error handling in crypto layer
- **Responsibilities:**
  - Catch Web Crypto API errors
  - Detect incorrect master password
  - Handle key not available scenarios
  - Clear sensitive data from memory on error

**Component 6: Error Toast System**
- **Purpose:** Display non-blocking error notifications
- **Technology:** shadcn/ui Toast component, Sonner library
- **Responsibilities:**
  - Show transient errors (network, validation)
  - Auto-dismiss after timeout (default 5s)
  - Support action buttons (retry, dismiss)
  - Queue multiple toasts

### Component Interactions

**React Component ↔ Error Boundary:**
- Protocol: React error boundary API (`componentDidCatch`, `getDerivedStateFromError`)
- Data format: Error object with stack trace
- Error boundary wraps component, catches render errors

**API Client ↔ API Error Handler:**
- Protocol: Function interceptors (response, error)
- Data format: APIError interface with status, message, details
- All API errors flow through error handler

**Crypto Layer ↔ Encryption Error Handler:**
- Protocol: Try/catch blocks with custom CryptoError types
- Data format: CryptoError with errorCode, userMessage
- Never log plaintext secrets or keys

**Error Handlers ↔ Sentry:**
- Protocol: Sentry JavaScript SDK
- Data format: Sanitized error with context (no secrets)
- Automatic breadcrumbs and session replay

**Error Handlers ↔ User (Toast/UI):**
- Protocol: React state updates
- Data format: UserMessage with title, description, actions
- Plain English messages with actionable guidance

---

## Component Details

### Component: React Error Boundaries

**Purpose:** Wrap React component trees to catch rendering errors and display fallback UI.

**Implementation:**

```typescript
// lib/errors/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';
import { logError } from './errorLogger';
import { ErrorFallback } from '@/components/error/ErrorFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to show fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    logError(error, {
      context: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Show fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error!}
          reset={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
```

**Usage in App Layout:**

```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          <Providers>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}

// app/(app)/projects/[id]/page.tsx
export default function ProjectPage() {
  return (
    <ErrorBoundary
      fallback={<ProjectErrorFallback />}
      onError={(error) => {
        // Track project-specific errors
        logError(error, { context: 'ProjectPage' });
      }}
    >
      <ProjectDetails />
      <SecretsList />
    </ErrorBoundary>
  );
}
```

**Fallback UI Component:**

```typescript
// components/error/ErrorFallback.tsx
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const userMessage = getUserFacingMessage(error);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        {userMessage}
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
```

---

### Component: Global Error Handler

**Purpose:** Catch JavaScript errors outside React tree and unhandled promise rejections.

**Implementation:**

```typescript
// lib/errors/globalErrorHandler.ts
import { logError } from './errorLogger';
import { isProduction } from '@/lib/utils/env';

/**
 * Set up global error handlers
 * Call once in app initialization
 */
export function setupGlobalErrorHandlers(): void {
  // Catch unhandled errors
  window.onerror = (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ) => {
    logError(error || new Error(String(message)), {
      context: 'window.onerror',
      source,
      lineno,
      colno,
    });

    // Prevent browser default error UI in production
    if (isProduction()) {
      return true;
    }

    return false;
  };

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    logError(error, {
      context: 'unhandledRejection',
      promise: event.promise,
    });

    // Prevent browser default error UI in production
    if (isProduction()) {
      event.preventDefault();
    }
  };

  // Log when page unloads with errors
  window.addEventListener('beforeunload', () => {
    // Flush pending error logs to Sentry
    // (Sentry SDK handles this automatically)
  });
}
```

**Usage:**

```typescript
// app/layout.tsx (Root layout)
'use client';

import { useEffect } from 'react';
import { setupGlobalErrorHandlers } from '@/lib/errors/globalErrorHandler';

export default function RootLayout({ children }) {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

### Component: API Error Handler

**Purpose:** Handle API errors consistently with automatic retries and user-friendly messages.

**Error Types:**

```typescript
// lib/errors/types.ts
export interface APIError extends Error {
  name: 'APIError';
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  endpoint?: string;
  method?: string;
  isRetryable: boolean;
}

export interface NetworkError extends Error {
  name: 'NetworkError';
  message: string;
  isRetryable: boolean;
}

export interface ValidationError extends Error {
  name: 'ValidationError';
  field: string;
  message: string;
  details: Record<string, string[]>;
}

export interface CryptoError extends Error {
  name: 'CryptoError';
  code: 'MASTER_KEY_NOT_AVAILABLE' | 'DECRYPTION_FAILED' | 'ENCRYPTION_FAILED' | 'KEY_DERIVATION_FAILED';
  message: string;
  userMessage: string;
}

export interface AuthError extends Error {
  name: 'AuthError';
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SESSION_EXPIRED' | 'INVALID_CREDENTIALS';
  message: string;
  requiresReauth: boolean;
}
```

**API Error Handler Implementation:**

```typescript
// lib/api/errorHandler.ts
import { APIError, NetworkError } from '@/lib/errors/types';
import { showToast } from '@/components/ui/toast';
import { logError } from '@/lib/errors/errorLogger';

/**
 * Handle API errors consistently
 */
export async function handleAPIError(
  error: unknown,
  endpoint: string,
  options: {
    silent?: boolean;
    customMessage?: string;
    onRetry?: () => void;
  } = {}
): Promise<APIError | NetworkError> {
  let apiError: APIError | NetworkError;

  // Network errors (no response from server)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    apiError = {
      name: 'NetworkError',
      message: 'Unable to connect to the server. Please check your internet connection.',
      isRetryable: true,
    } as NetworkError;
  }
  // API errors (response from server)
  else if (isAPIErrorResponse(error)) {
    apiError = {
      name: 'APIError',
      status: error.status,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.details,
      endpoint,
      method: error.method,
      isRetryable: isRetryableStatus(error.status),
    } as APIError;
  }
  // Unknown errors
  else {
    apiError = {
      name: 'APIError',
      status: 500,
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      endpoint,
      isRetryable: false,
    } as APIError;
  }

  // Log to monitoring
  logError(apiError, {
    context: 'API',
    endpoint,
    ...options,
  });

  // Show toast notification (unless silent)
  if (!options.silent) {
    const message = options.customMessage || getUserFacingMessage(apiError);
    showToast({
      title: 'Error',
      description: message,
      variant: 'destructive',
      action: apiError.isRetryable && options.onRetry ? {
        label: 'Retry',
        onClick: options.onRetry,
      } : undefined,
    });
  }

  return apiError;
}

/**
 * Determine if HTTP status is retryable
 */
function isRetryableStatus(status: number): boolean {
  // 5xx server errors are retryable
  if (status >= 500 && status < 600) {
    return true;
  }

  // 429 Too Many Requests is retryable (after delay)
  if (status === 429) {
    return true;
  }

  // 408 Request Timeout is retryable
  if (status === 408) {
    return true;
  }

  // Client errors (4xx except above) are not retryable
  return false;
}

/**
 * Check if error is an API error response
 */
function isAPIErrorResponse(error: unknown): error is { status: number; code?: string; message?: string; details?: unknown; method?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  );
}
```

**Usage in React Query:**

```typescript
// lib/api/secrets.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { handleAPIError } from './errorHandler';

export function useCreateSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newSecret: CreateSecretInput) => {
      try {
        const response = await apiClient.post<Secret>('/secrets', newSecret);
        return response.data;
      } catch (error) {
        throw await handleAPIError(error, '/secrets', {
          customMessage: 'Failed to create secret. Please try again.',
        });
      }
    },

    // React Query automatic retry for retryable errors
    retry: (failureCount, error) => {
      if ('isRetryable' in error && error.isRetryable) {
        return failureCount < 3;
      }
      return false;
    },

    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    onError: (error) => {
      // Error already handled by handleAPIError
      // This is for additional error handling if needed
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['secrets', variables.project_id] });
    },
  });
}
```

---

### Component: Encryption Error Handler

**Purpose:** Handle encryption/decryption errors securely without exposing sensitive data.

**Implementation:**

```typescript
// lib/crypto/errorHandler.ts
import { CryptoError } from '@/lib/errors/types';
import { logError } from '@/lib/errors/errorLogger';
import { showToast } from '@/components/ui/toast';

/**
 * Handle encryption/decryption errors
 */
export function handleCryptoError(
  error: unknown,
  operation: 'encryption' | 'decryption' | 'key_derivation',
  context?: Record<string, unknown>
): CryptoError {
  let cryptoError: CryptoError;

  // Web Crypto API errors
  if (error instanceof DOMException) {
    if (error.name === 'OperationError') {
      cryptoError = {
        name: 'CryptoError',
        code: operation === 'decryption' ? 'DECRYPTION_FAILED' : 'ENCRYPTION_FAILED',
        message: `${operation} operation failed: ${error.message}`,
        userMessage: operation === 'decryption'
          ? 'Unable to decrypt this secret. Your master password may be incorrect.'
          : 'Unable to encrypt this secret. Please try again.',
      } as CryptoError;
    } else if (error.name === 'InvalidAccessError') {
      cryptoError = {
        name: 'CryptoError',
        code: 'MASTER_KEY_NOT_AVAILABLE',
        message: 'Master key not available for encryption operation',
        userMessage: 'Please unlock your vault with your master password.',
      } as CryptoError;
    } else {
      cryptoError = {
        name: 'CryptoError',
        code: operation === 'decryption' ? 'DECRYPTION_FAILED' : 'ENCRYPTION_FAILED',
        message: `Crypto operation failed: ${error.message}`,
        userMessage: 'A cryptographic error occurred. Please try again.',
      } as CryptoError;
    }
  }
  // Master key not available
  else if (error instanceof Error && error.message.includes('Master key not available')) {
    cryptoError = {
      name: 'CryptoError',
      code: 'MASTER_KEY_NOT_AVAILABLE',
      message: 'Master key not available',
      userMessage: 'Please unlock your vault with your master password.',
    } as CryptoError;
  }
  // Key derivation errors
  else if (error instanceof Error && operation === 'key_derivation') {
    cryptoError = {
      name: 'CryptoError',
      code: 'KEY_DERIVATION_FAILED',
      message: `Key derivation failed: ${error.message}`,
      userMessage: 'Unable to process your master password. Please try again.',
    } as CryptoError;
  }
  // Unknown crypto errors
  else {
    cryptoError = {
      name: 'CryptoError',
      code: operation === 'decryption' ? 'DECRYPTION_FAILED' : 'ENCRYPTION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown crypto error',
      userMessage: 'A cryptographic error occurred. Please try again.',
    } as CryptoError;
  }

  // Log to monitoring (sanitized - no secrets or keys)
  logError(cryptoError, {
    context: 'Crypto',
    operation,
    errorCode: cryptoError.code,
    // Never log: plaintext, keys, passwords, secret values
    ...sanitizeContext(context),
  });

  // Show user message
  showToast({
    title: 'Encryption Error',
    description: cryptoError.userMessage,
    variant: 'destructive',
  });

  return cryptoError;
}

/**
 * Remove sensitive data from context before logging
 */
function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> {
  if (!context) return {};

  const sanitized = { ...context };

  // Remove sensitive keys
  const sensitiveKeys = [
    'masterPassword',
    'masterKey',
    'key',
    'password',
    'secret',
    'value',
    'plaintext',
    'decrypted',
    'token',
    'jwt',
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}
```

**Usage in Encryption Layer:**

```typescript
// lib/crypto/encryption.ts
import { handleCryptoError } from './errorHandler';

export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv, 0);
    combined.set(encryptedArray, iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    throw handleCryptoError(error, 'encryption', {
      dataLength: plaintext.length,
      hasKey: !!key,
    });
  }
}

export async function decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw handleCryptoError(error, 'decryption', {
      ciphertextLength: ciphertext.length,
      hasKey: !!key,
    });
  }
}
```

---

### Component: Error Logger (Sentry Integration)

**Purpose:** Log errors to Sentry with sanitized context for debugging.

**Implementation:**

```typescript
// lib/errors/errorLogger.ts
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/lib/stores/authStore';
import { isProduction } from '@/lib/utils/env';

interface ErrorContext {
  context?: string;
  [key: string]: unknown;
}

/**
 * Log error to Sentry with sanitized context
 */
export function logError(error: Error, context?: ErrorContext): void {
  // Don't log in development (console only)
  if (!isProduction()) {
    console.error('[Error]', error, context);
    return;
  }

  // Sanitize context (remove sensitive data)
  const sanitizedContext = sanitizeForLogging(context);

  // Add user context (non-PII only)
  const user = useAuthStore.getState().user;
  if (user) {
    Sentry.setUser({
      id: user.id,
      // Don't log email or other PII
    });
  }

  // Add breadcrumb
  if (context?.context) {
    Sentry.addBreadcrumb({
      category: context.context as string,
      message: error.message,
      level: 'error',
    });
  }

  // Set context
  if (sanitizedContext) {
    Sentry.setContext('error_context', sanitizedContext);
  }

  // Log to Sentry
  Sentry.captureException(error, {
    level: 'error',
    tags: {
      errorType: error.name,
      errorContext: context?.context as string,
    },
  });
}

/**
 * Sanitize context for logging (remove secrets, PII)
 */
function sanitizeForLogging(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const sanitized = { ...context };

  // Sensitive keys to redact
  const sensitiveKeys = [
    'password',
    'masterPassword',
    'masterKey',
    'key',
    'secret',
    'token',
    'jwt',
    'accessToken',
    'refreshToken',
    'apiKey',
    'value',
    'plaintext',
    'decrypted',
    'email',
    'name',
    'phone',
    'ssn',
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();

    // Redact sensitive keys
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Redact objects with sensitive keys
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key] as Record<string, unknown>);
    }

    // Redact long strings (likely sensitive)
    if (typeof sanitized[key] === 'string' && (sanitized[key] as string).length > 500) {
      sanitized[key] = `[REDACTED - ${(sanitized[key] as string).length} chars]`;
    }
  }

  return sanitized;
}

/**
 * Set user context for error logging
 */
export function setUserContext(userId: string, orgId?: string): void {
  if (!isProduction()) return;

  Sentry.setUser({
    id: userId,
    // Don't log PII (email, name)
  });

  if (orgId) {
    Sentry.setTag('organization_id', orgId);
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  if (!isProduction()) return;

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isProduction()) {
    console.log('[Breadcrumb]', category, message, data);
    return;
  }

  Sentry.addBreadcrumb({
    category,
    message,
    data: sanitizeForLogging(data),
    level: 'info',
  });
}
```

---

### Component: User-Facing Error Messages

**Purpose:** Map technical errors to plain English messages with actionable guidance.

**Implementation:**

```typescript
// lib/errors/userMessages.ts
import { APIError, CryptoError, AuthError, NetworkError } from './types';

/**
 * Get user-friendly error message
 */
export function getUserFacingMessage(error: Error): string {
  // API errors
  if (error.name === 'APIError') {
    return getAPIErrorMessage(error as APIError);
  }

  // Network errors
  if (error.name === 'NetworkError') {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Crypto errors
  if (error.name === 'CryptoError') {
    return (error as CryptoError).userMessage;
  }

  // Auth errors
  if (error.name === 'AuthError') {
    return getAuthErrorMessage(error as AuthError);
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return 'Please check your input and try again.';
  }

  // Unknown errors
  return 'An unexpected error occurred. Please try again. If the problem persists, contact support.';
}

/**
 * Get user message for API errors
 */
function getAPIErrorMessage(error: APIError): string {
  // Status code-specific messages
  switch (error.status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This action conflicts with existing data. Please refresh and try again.';
    case 422:
      return 'Unable to process your request. Please check your input.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'A server error occurred. Our team has been notified. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'The service is temporarily unavailable. Please try again in a moment.';
    default:
      return error.message || 'An error occurred. Please try again.';
  }
}

/**
 * Get user message for auth errors
 */
function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'UNAUTHORIZED':
      return 'Please log in to continue.';
    case 'FORBIDDEN':
      return "You don't have permission to access this resource.";
    case 'SESSION_EXPIRED':
      return 'Your session has expired. Please log in again.';
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password. Please try again.';
    default:
      return 'Authentication error. Please log in again.';
  }
}

/**
 * Get recovery actions for error
 */
export function getRecoveryActions(error: Error): RecoveryAction[] {
  const actions: RecoveryAction[] = [];

  // Retry action for retryable errors
  if ('isRetryable' in error && error.isRetryable) {
    actions.push({
      label: 'Try Again',
      type: 'retry',
      primary: true,
    });
  }

  // Refresh action for data errors
  if (error.name === 'APIError') {
    const apiError = error as APIError;
    if (apiError.status === 409 || apiError.status === 412) {
      actions.push({
        label: 'Refresh Page',
        type: 'refresh',
      });
    }
  }

  // Re-auth action for auth errors
  if (error.name === 'AuthError') {
    const authError = error as AuthError;
    if (authError.requiresReauth) {
      actions.push({
        label: 'Log In',
        type: 'navigate',
        href: '/login',
        primary: true,
      });
    }
  }

  // Unlock action for crypto errors
  if (error.name === 'CryptoError') {
    const cryptoError = error as CryptoError;
    if (cryptoError.code === 'MASTER_KEY_NOT_AVAILABLE') {
      actions.push({
        label: 'Unlock Vault',
        type: 'custom',
        action: 'unlock_vault',
        primary: true,
      });
    }
  }

  // Default: dismiss
  if (actions.length === 0) {
    actions.push({
      label: 'Dismiss',
      type: 'dismiss',
    });
  }

  return actions;
}

export interface RecoveryAction {
  label: string;
  type: 'retry' | 'refresh' | 'navigate' | 'custom' | 'dismiss';
  href?: string;
  action?: string;
  primary?: boolean;
}
```

---

## Data Flow

### Flow 1: API Error with Automatic Retry

**Trigger:** API request fails with 503 Service Unavailable

**Steps:**

1. **API Client: Make Request**
   ```typescript
   const response = await apiClient.post('/secrets', secretData);
   ```

2. **Network: 503 Response**
   - Server returns 503 status
   - API client catches error

3. **API Error Handler: Parse Error**
   ```typescript
   const apiError = {
     name: 'APIError',
     status: 503,
     code: 'SERVICE_UNAVAILABLE',
     message: 'Service temporarily unavailable',
     isRetryable: true,
   };
   ```

4. **Error Handler: Log to Sentry**
   ```typescript
   logError(apiError, { context: 'API', endpoint: '/secrets' });
   ```

5. **React Query: Automatic Retry**
   - Retry count: 1/3
   - Exponential backoff: 2 seconds
   - Wait 2 seconds...

6. **API Client: Retry Request**
   - Same request sent again
   - If succeeds: flow complete
   - If fails: retry again (up to 3 times)

7. **React Query: Max Retries Exceeded**
   - After 3 failures, show error toast

8. **Toast: Display Error**
   ```typescript
   showToast({
     title: 'Error',
     description: 'The service is temporarily unavailable. Please try again in a moment.',
     variant: 'destructive',
     action: {
       label: 'Retry',
       onClick: () => mutate(secretData),
     },
   });
   ```

**Sequence Diagram:**
```
User  Component  ReactQuery  APIClient  ErrorHandler  Network  Server
 |       |          |           |            |           |        |
 |--action->|        |           |            |           |        |
 |       |--mutate->|           |            |           |        |
 |       |          |--request->|            |           |        |
 |       |          |           |--POST------------------>|        |
 |       |          |           |            |           |<--503--|
 |       |          |           |<--error----|           |        |
 |       |          |           |--parse---->|           |        |
 |       |          |           |            |--log-->(Sentry)    |
 |       |          |<--retry---|            |           |        |
 |       |          |--wait 2s->|            |           |        |
 |       |          |--retry--->|            |           |        |
 |       |          |           |--POST------------------>|        |
 |       |          |           |            |           |<--200--|
 |       |          |           |<--success--|           |        |
 |       |<--success|           |            |           |        |
 |<--UI update       |           |            |           |        |
```

---

### Flow 2: Component Render Error with Fallback UI

**Trigger:** React component throws error during render

**Steps:**

1. **Component: Render Error**
   ```typescript
   function SecretCard({ secret }) {
     // Bug: secret is null, crashes on secret.name
     return <div>{secret.name}</div>;
   }
   ```

2. **Error Boundary: Catch Error**
   ```typescript
   static getDerivedStateFromError(error) {
     return { hasError: true, error };
   }
   ```

3. **Error Boundary: Log Error**
   ```typescript
   componentDidCatch(error, errorInfo) {
     logError(error, {
       context: 'ErrorBoundary',
       componentStack: errorInfo.componentStack,
     });
   }
   ```

4. **Error Boundary: Render Fallback**
   ```typescript
   render() {
     if (this.state.hasError) {
       return <ErrorFallback error={this.error} reset={this.resetError} />;
     }
     return this.props.children;
   }
   ```

5. **Fallback UI: Display Error**
   - Show error icon
   - Display user-friendly message
   - Show "Try Again" button
   - Show "Go to Dashboard" button

6. **User: Click "Try Again"**
   - Calls `reset()` method
   - Clears error state
   - Re-renders component tree
   - If error persists, fallback shown again

**Sequence Diagram:**
```
Component  ErrorBoundary  ErrorLogger  Sentry  User
    |            |             |         |      |
    |--render--->|             |         |      |
    |--ERROR     |             |         |      |
    |            |<--catch-----|         |      |
    |            |--log------->|         |      |
    |            |             |--send-->|      |
    |            |--fallback UI -------->|      |
    |            |                       |<--click "Try Again"
    |            |<--reset---------------|      |
    |<--re-render|                       |      |
    |--render--->|                       |      |
    |<--success--|(no error)             |      |
```

---

### Flow 3: Decryption Error with Master Password Prompt

**Trigger:** User attempts to view secret, but master key is not available

**Steps:**

1. **User: Click "View Secret"**

2. **Component: Request Decryption**
   ```typescript
   const decrypted = await decrypt(secret.encrypted_value, masterKey);
   ```

3. **Crypto Layer: Check Master Key**
   ```typescript
   const masterKey = await getMasterKey();
   if (!masterKey) {
     throw new Error('Master key not available');
   }
   ```

4. **Crypto Error Handler: Handle Error**
   ```typescript
   const cryptoError = {
     name: 'CryptoError',
     code: 'MASTER_KEY_NOT_AVAILABLE',
     userMessage: 'Please unlock your vault with your master password.',
   };
   ```

5. **UI: Show Master Password Dialog**
   ```typescript
   openModal('unlock-vault');
   ```

6. **User: Enter Master Password**

7. **Crypto Layer: Derive Key**
   ```typescript
   const masterKey = await deriveMasterKey(masterPassword, userSalt);
   await storeMasterKey(masterKey, sessionToken);
   ```

8. **Component: Retry Decryption**
   ```typescript
   const decrypted = await decrypt(secret.encrypted_value, masterKey);
   ```

9. **UI: Display Decrypted Secret**
   - Show plaintext secret value
   - Master key now available for future operations

**Data Transformations:**
- **Point A**: Encrypted secret (Base64 string)
- **Point B**: Master key unavailable (error)
- **Point C**: User enters master password (plaintext)
- **Point D**: Master key derived (CryptoKey object)
- **Point E**: Secret decrypted (plaintext)
- **Point F**: Plaintext displayed in UI

---

## API Contracts

### Internal APIs

**API: Error Logging**

**Endpoint:** `logError(error, context)`

**Purpose:** Log errors to monitoring service with sanitized context

**Request:**
```typescript
interface LogErrorParams {
  error: Error;
  context?: {
    context: string;
    [key: string]: unknown;
  };
}
```

**Example:**
```typescript
logError(new APIError('Request failed'), {
  context: 'API',
  endpoint: '/secrets',
  status: 500,
});
```

**Behavior:**
- Sanitizes context (removes secrets, PII)
- Adds user context (userId only, no PII)
- Sends to Sentry
- Adds breadcrumb for debugging

---

**API: Toast Notifications**

**Endpoint:** `showToast(options)`

**Purpose:** Display error toast notification to user

**Request:**
```typescript
interface ToastOptions {
  title: string;
  description: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Example:**
```typescript
showToast({
  title: 'Error',
  description: 'Failed to create secret',
  variant: 'destructive',
  duration: 5000,
  action: {
    label: 'Retry',
    onClick: () => mutate(secretData),
  },
});
```

---

**API: Error Recovery**

**Endpoint:** `recoverFromError(error)`

**Purpose:** Attempt automatic recovery from error

**Request:**
```typescript
interface RecoverFromErrorParams {
  error: Error;
  retryFn?: () => Promise<void>;
}
```

**Returns:**
```typescript
interface RecoveryResult {
  recovered: boolean;
  action?: 'retry' | 'refresh' | 'reauth' | 'none';
  message?: string;
}
```

**Example:**
```typescript
const result = await recoverFromError(error, {
  retryFn: () => createSecret(secretData),
});

if (result.recovered) {
  showToast({ title: 'Success', description: 'Operation completed successfully' });
} else {
  showToast({ title: 'Error', description: result.message, variant: 'destructive' });
}
```

---

## Security Architecture

### Trust Boundaries

**Boundary 1: Error Logs ↔ Monitoring Service**
- **Threats:** Secrets or PII leaked in error logs
- **Controls:**
  - Sanitize all error context before logging
  - Redact sensitive keys (password, secret, token, etc.)
  - Never log plaintext secrets or encryption keys
  - Limit string length (truncate long values)
  - Security audit of logged data

**Boundary 2: User Error Messages ↔ Technical Details**
- **Threats:** Exposing internal system details to users/attackers
- **Controls:**
  - Map all errors to generic user-facing messages
  - Never show stack traces in production
  - Avoid exposing database structure or API internals
  - Use error codes (not implementation details)

**Boundary 3: Error Handling ↔ Encryption Layer**
- **Threats:** Decryption failures exposing plaintext, keys leaked in memory
- **Controls:**
  - Clear sensitive data from memory on error
  - Never log decryption keys or plaintext
  - Use secure error types (CryptoError with userMessage only)
  - Fail securely (default to encrypted, not plaintext)

### Data Security

**Data in Error Logs (Sentry):**
- **Encryption:** TLS for transmission, encrypted at rest in Sentry
- **Sensitive Data:** All sensitive data redacted before logging
- **Access Controls:** Sentry access limited to engineering team
- **Retention:** Error logs retained for 90 days, then deleted

**Data in User Error Messages:**
- **Information Disclosure:** Generic messages, no internal details
- **User Context:** Only non-sensitive context shown (operation, resource type)

### Threat Model

**Threat 1: Secrets Leaked in Error Logs**
- **Description:** Error contains secret value, logged to Sentry
- **Likelihood:** Medium (common programming error)
- **Impact:** Critical (secret exposure, security breach)
- **Mitigation:**
  - Sanitize all error context before logging
  - Code review for error handling
  - Security audit of logged data
  - Alert on sensitive patterns in logs

**Threat 2: Stack Trace Information Disclosure**
- **Description:** Stack trace reveals internal system structure to attackers
- **Likelihood:** Low (only in production errors)
- **Impact:** Medium (aids reconnaissance for attacks)
- **Mitigation:**
  - Never show stack traces to users in production
  - Generic user-facing messages only
  - Detailed errors only in development

**Threat 3: Decryption Key Exposure in Error**
- **Description:** Decryption error logs master key or plaintext
- **Likelihood:** Low (secure error handling in crypto layer)
- **Impact:** Critical (key exposure compromises all secrets)
- **Mitigation:**
  - Crypto error handler never logs keys or plaintext
  - Clear keys from memory on error
  - CryptoError only exposes userMessage (generic)
  - Security audit of crypto error handling

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Error boundary render: < 50ms (instant fallback UI)
- Error logging: < 100ms (async, non-blocking)
- Toast display: < 50ms (instant notification)
- Error recovery attempt: < 2s (retry with backoff)

**Throughput:**
- Handle 100+ errors per session without performance degradation
- Queue errors if logging service is slow (don't block UI)

**Resource Usage:**
- Error logging: < 5MB memory for error queue
- Toast notifications: < 1MB DOM overhead

### Performance Optimization

**Optimizations implemented:**
- Async error logging (don't block UI thread)
- Error deduplication (don't log same error 100 times)
- Lazy-load Sentry SDK (reduce initial bundle size)
- Toast queueing (display multiple toasts without overlap)

---

## Scalability

### Bottlenecks

**Current bottlenecks:**
- Sentry rate limits (10k events/month on free tier)
- Browser memory for large error queues

**Mitigation strategies:**
- Error deduplication (reduce Sentry event count)
- Sample errors in high-traffic scenarios (log 10% of common errors)
- Upgrade Sentry plan for production

---

## Failure Modes

### Failure Mode 1: Sentry Unavailable

**Scenario:** Sentry service is down or rate-limited

**Impact:** Errors not logged to monitoring service

**Detection:** Sentry SDK fails to send events

**Recovery:**
1. Queue errors in browser memory (max 100)
2. Retry sending when Sentry available
3. Fall back to console.error in development
4. User experience unaffected (errors still handled)

**Prevention:**
- Sentry SDK has built-in retry logic
- Use Sentry's offline queueing

---

### Failure Mode 2: Error Boundary Not Rendering

**Scenario:** Error boundary component itself has a bug

**Impact:** White screen of death (entire app crashes)

**Detection:** window.onerror catches unhandled error

**Recovery:**
1. Global error handler displays minimal fallback UI
2. User sees "Something went wrong" message
3. "Reload Page" button shown

**Prevention:**
- Thoroughly test error boundary component
- Keep error boundary simple (minimal logic)
- Nest multiple error boundaries (inner can catch outer errors)

---

### Failure Mode 3: Infinite Error Loop

**Scenario:** Error recovery causes same error repeatedly

**Impact:** Application becomes unusable, browser hangs

**Detection:** Same error logged 10+ times in 10 seconds

**Recovery:**
1. Error deduplication detects loop
2. Stop automatic retries
3. Show permanent error message with "Reload Page" only

**Prevention:**
- Track error frequency in error handler
- Disable auto-retry after 3 consecutive failures
- Clear error state on page navigation

---

## Alternatives Considered

### Alternative 1: No Error Boundaries (Try/Catch Only)

**Description:** Use try/catch blocks everywhere instead of error boundaries

**Pros:**
- Simpler (no need for error boundary component)
- More control over error handling per component

**Cons:**
- Doesn't catch render errors (only works in async code)
- Must wrap every component in try/catch (error-prone)
- Can't catch errors in event handlers or useEffect

**Why not chosen:** Error boundaries are the React-recommended way to catch render errors. Try/catch alone is insufficient.

---

### Alternative 2: Show Stack Traces in Production

**Description:** Show full error details to users in production

**Pros:**
- Users can report detailed errors
- Easier debugging

**Cons:**
- Exposes internal system structure
- Confuses non-technical users
- Security risk (information disclosure)

**Why not chosen:** Security and UX concerns outweigh debugging convenience. Sentry provides detailed errors for developers.

---

### Alternative 3: Optimistic UI Without Rollback

**Description:** Don't rollback optimistic updates on error

**Pros:**
- Simpler implementation
- Less jarring UX (no flashing UI)

**Cons:**
- Shows incorrect data to users (mutation succeeded in UI but failed on server)
- Data inconsistency between client and server
- Confusing when user refreshes page and data is gone

**Why not chosen:** Data consistency is more important than avoiding UI rollback. React Query makes rollback easy.

---

## Decision Log

### Decision 1: Use Sentry for Error Monitoring

**Date:** 2025-10-30

**Context:** Need error monitoring service for production debugging

**Options:**
1. Sentry (SaaS)
2. Self-hosted error tracking (Sentry OSS, GlitchTip)
3. CloudWatch Logs (AWS)
4. No error monitoring (logs only)

**Decision:** Use Sentry (SaaS)

**Rationale:**
- Industry-standard error tracking
- Excellent React integration
- Source map support for minified code
- Session replay for debugging
- Free tier sufficient for MVP

**Consequences:**
- Dependency on third-party service
- Must sanitize data before sending
- Need to upgrade plan for high traffic

---

### Decision 2: Generic User Messages (No Technical Details)

**Date:** 2025-10-30

**Context:** What information to show users when errors occur?

**Options:**
1. Show full error messages and stack traces
2. Show generic messages only
3. Show error codes only

**Decision:** Show generic messages with actionable guidance

**Rationale:**
- Non-technical users don't understand stack traces
- Exposing internal errors is a security risk
- Actionable guidance (retry, refresh, contact support) is more helpful

**Consequences:**
- Users can't self-debug errors
- Support team needs Sentry access to see details
- Must map all errors to user-friendly messages

---

### Decision 3: Automatic Retry for Transient Errors

**Date:** 2025-10-30

**Context:** Should errors automatically retry or require user action?

**Options:**
1. Automatic retry with exponential backoff
2. Always require user to click "Retry"
3. No retry (show error, user must refresh page)

**Decision:** Automatic retry for transient errors (5xx, network)

**Rationale:**
- Better UX (errors resolve automatically)
- Transient errors (503, network) often resolve quickly
- React Query has built-in retry logic
- Still show error toast so user knows what happened

**Consequences:**
- May delay showing error to user (3 retries = 7 seconds)
- Could cause excessive API calls if server is down
- Must be careful with non-idempotent operations

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `07-frontend/frontend-architecture.md` - Frontend architecture (API client, state management)
- [x] `05-api/api-rest-design.md` - API error response format
- [x] `03-security/security-model.md` - Security requirements for error handling
- [x] `TECH-STACK.md` - Technology decisions (React, Next.js, Sentry)

**External Services:**
- Sentry (error monitoring)
- Cloudflare Workers (API gateway)

### Architecture Dependencies

**Depends on these components:**
- React 18.3.x (error boundaries)
- Next.js 14.2.x (app structure)
- React Query 5.x (mutation error handling, retry logic)
- API Client (error response parsing)
- Encryption Layer (crypto error handling)

**Required by these components:**
- All frontend components (must use error boundaries)
- All API calls (must use error handler)
- All encryption operations (must use crypto error handler)

---

## References

### Internal Documentation
- `07-frontend/frontend-architecture.md` - Frontend architecture overview
- `05-api/api-rest-design.md` - REST API design patterns and error responses
- `03-security/security-model.md` - Zero-knowledge security model
- `TECH-STACK.md` - Technology stack decisions
- `GLOSSARY.md` - Term definitions (Error Boundary, Circuit Breaker, etc.)
- `10-operations/monitoring/monitoring-alerting.md` - Production monitoring setup

### External Resources
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) - Official React docs
- [Sentry React Integration](https://docs.sentry.io/platforms/javascript/guides/react/) - Sentry setup guide
- [React Query Error Handling](https://tanstack.com/query/latest/docs/react/guides/query-retries) - Retry logic documentation
- [Error Handling Best Practices](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react) - Kent C. Dodds article
- [Security Logging Best Practices](https://owasp.org/www-community/Logging_Cheat_Sheet) - OWASP logging guidelines

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial error handling architecture document |

---

## Notes

### Future Enhancements
- **Error replay** - Capture user actions leading to error for debugging
- **User-initiated error reports** - Allow users to send error reports with context
- **Offline error queueing** - Queue errors when offline, send when online
- **Error trends dashboard** - Visualize error patterns over time
- **Circuit breaker pattern** - Disable features that are consistently failing
- **Error recovery hooks** - Custom recovery logic per component type

### Known Issues
- **Error deduplication needs improvement** - Same error from different components logs multiple times
- **Sentry session replay not configured** - Need to configure for better debugging
- **No error boundary for React Server Components** - Next.js 14 limitation
- **Toast notifications can overflow screen** - Need max queue limit and stacking

### Next Review Date
2025-11-30 (review after initial implementation and error monitoring data)
