'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { validateKeyFormat, type ServiceInfo } from '@/lib/services/service-detection';

interface KeyValidatorProps {
  service: ServiceInfo;
  onValidKey: (key: string) => void;
  initialKey?: string;
}

/**
 * Key Validator Component
 *
 * Validates API key format and optionally tests it
 * Shows success/error states with clear feedback
 */
export function KeyValidator({ service, onValidKey, initialKey = '' }: KeyValidatorProps) {
  const [key, setKey] = useState(initialKey);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    tested?: boolean;
  } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const handleValidate = async () => {
    if (!key.trim()) {
      setValidationResult({
        valid: false,
        error: 'Please enter an API key',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    // Format validation
    const formatResult = validateKeyFormat(service.id, key);
    if (!formatResult.valid) {
      setValidationResult({
        valid: false,
        error: formatResult.error,
      });
      setIsValidating(false);
      return;
    }

    // TODO: Optional test call to verify key works
    // For now, just format validation
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call

    setValidationResult({
      valid: true,
      tested: false, // Set to true when implementing test calls
    });
    setIsValidating(false);
  };

  const handleSave = () => {
    if (validationResult?.valid) {
      onValidKey(key);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Validate Your API Key</h3>
        <p className="text-sm text-muted-foreground">
          Paste your {service.name} API key to validate the format
        </p>
      </div>

      {/* Key input */}
      <div className="space-y-2">
        <Label htmlFor="api-key">API Key</Label>
        <div className="relative">
          <Input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setValidationResult(null); // Clear validation on change
            }}
            placeholder={
              service.keyPrefix
                ? `e.g., ${service.keyPrefix}...`
                : 'Paste your API key here'
            }
            className={`pr-20 ${
              validationResult?.valid === false
                ? 'border-red-500 focus-visible:ring-red-500'
                : validationResult?.valid === true
                ? 'border-green-500 focus-visible:ring-green-500'
                : ''
            }`}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded transition-colors"
            type="button"
          >
            {showKey ? (
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Format hint */}
        {service.keyPrefix && !validationResult && (
          <p className="text-xs text-muted-foreground">
            {service.name} API keys typically start with "{service.keyPrefix}"
          </p>
        )}

        {/* Validation result */}
        {validationResult && (
          <div
            className={`p-3 rounded-lg border ${
              validationResult.valid
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {validationResult.valid ? (
                <svg
                  className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    validationResult.valid
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {validationResult.valid
                    ? validationResult.tested
                      ? 'Key is valid and working!'
                      : 'Key format looks correct!'
                    : 'Invalid key format'}
                </p>
                {validationResult.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {validationResult.error}
                  </p>
                )}
                {validationResult.valid && !validationResult.tested && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Format validation passed. We haven't tested the key with {service.name}'s
                    API yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleValidate}
          disabled={!key.trim() || isValidating}
          variant="outline"
        >
          {isValidating ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Validating...
            </>
          ) : (
            'Validate Format'
          )}
        </Button>

        {validationResult?.valid && (
          <Button onClick={handleSave} className="flex-1">
            Save API Key
          </Button>
        )}
      </div>

      {/* Security notice */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
        <div className="flex items-start gap-2">
          <svg
            className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Your key is encrypted
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Your API key will be encrypted with AES-256-GCM before being saved. We use
              zero-knowledge encryption, so only you can decrypt it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
