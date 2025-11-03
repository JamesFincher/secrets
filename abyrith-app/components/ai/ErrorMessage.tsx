/**
 * Error Message Component
 *
 * Displays error messages with contextual styling and retry actions
 */

import { AlertCircle, RefreshCw, XCircle, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AIAPIError } from '@/lib/api/ai';

/**
 * Error message props
 */
export interface ErrorMessageProps {
  /**
   * Error to display
   */
  error: AIAPIError | Error | string;

  /**
   * Optional title (defaults to error type)
   */
  title?: string;

  /**
   * Show retry button
   */
  showRetry?: boolean;

  /**
   * Retry callback
   */
  onRetry?: () => void;

  /**
   * Dismiss callback
   */
  onDismiss?: () => void;
}

/**
 * Get error details from error object
 */
function getErrorDetails(error: AIAPIError | Error | string): {
  title: string;
  message: string;
  icon: React.ComponentType<any>;
  variant: 'default' | 'destructive';
  code?: string;
} {
  // String error
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
      icon: AlertCircle,
      variant: 'destructive',
    };
  }

  // AIAPIError with specific error codes
  if (error instanceof Error && 'code' in error) {
    const apiError = error as AIAPIError;

    switch (apiError.code) {
      case 'RATE_LIMIT_EXCEEDED':
        return {
          title: 'Rate Limit Reached',
          message:
            apiError.message ||
            'You have reached the rate limit. Please wait a moment and try again.',
          icon: AlertCircle,
          variant: 'default',
          code: apiError.code,
        };

      case 'UNAUTHORIZED':
      case 'INVALID_TOKEN':
      case 'TOKEN_EXPIRED':
        return {
          title: 'Authentication Error',
          message:
            apiError.message ||
            'Your session has expired. Please sign in again.',
          icon: XCircle,
          variant: 'destructive',
          code: apiError.code,
        };

      case 'NETWORK_ERROR':
        return {
          title: 'Connection Error',
          message:
            apiError.message ||
            'Unable to connect to the server. Please check your internet connection and try again.',
          icon: WifiOff,
          variant: 'destructive',
          code: apiError.code,
        };

      case 'VALIDATION_ERROR':
      case 'INVALID_INPUT':
        return {
          title: 'Invalid Input',
          message:
            apiError.message || 'Please check your input and try again.',
          icon: AlertCircle,
          variant: 'default',
          code: apiError.code,
        };

      case 'STREAM_ERROR':
        return {
          title: 'Streaming Error',
          message:
            apiError.message ||
            'An error occurred while receiving the response. Please try again.',
          icon: AlertCircle,
          variant: 'destructive',
          code: apiError.code,
        };

      default:
        return {
          title: 'Error',
          message: apiError.message || 'An unexpected error occurred.',
          icon: AlertCircle,
          variant: 'destructive',
          code: apiError.code,
        };
    }
  }

  // Generic Error
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred.',
    icon: AlertCircle,
    variant: 'destructive',
  };
}

/**
 * Error Message Component
 */
export function ErrorMessage({
  error,
  title: customTitle,
  showRetry = true,
  onRetry,
  onDismiss,
}: ErrorMessageProps) {
  const { title, message, icon: Icon, variant, code } = getErrorDetails(error);

  return (
    <Alert variant={variant} className="my-4">
      <Icon className="h-4 w-4" />
      <AlertTitle>{customTitle || title}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm">{message}</p>

        {code && (
          <p className="text-xs text-muted-foreground mt-2">Error Code: {code}</p>
        )}

        <div className="flex gap-2 mt-4">
          {showRetry && onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Try Again
            </Button>
          )}

          {onDismiss && (
            <Button onClick={onDismiss} variant="ghost" size="sm">
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline error display (smaller, for in-chat errors)
 */
export function InlineError({
  error,
  onRetry,
}: {
  error: AIAPIError | Error | string;
  onRetry?: () => void;
}) {
  const { message, icon: Icon, code } = getErrorDetails(error);

  return (
    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
      <Icon className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-destructive">{message}</p>
        {code && (
          <p className="text-xs text-destructive/70 mt-1">Code: {code}</p>
        )}
      </div>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="flex-shrink-0 h-7 px-2 text-destructive hover:text-destructive"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
