'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { completeGitHubOAuth } from '@/lib/api/github';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Github, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function GitHubCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { masterPassword, preferences } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      // Get code and state from URL parameters
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        throw new Error(errorDescription || error);
      }

      // Validate required parameters
      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Verify state matches (CSRF protection)
      const storedState = sessionStorage.getItem('github_oauth_state');
      if (state !== storedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Clean up stored state
      sessionStorage.removeItem('github_oauth_state');

      // Check if master password is available
      if (!masterPassword || !preferences) {
        throw new Error('Master password required - please unlock your vault first');
      }

      // Complete OAuth flow
      const kekSalt = preferences.masterPasswordVerification.salt;
      await completeGitHubOAuth(code, state, masterPassword, kekSalt);

      // Success!
      setStatus('success');
      toast({
        title: 'GitHub Connected',
        description: 'Your GitHub account has been successfully connected',
      });

      // Redirect to GitHub page after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/github');
      }, 2000);
    } catch (error) {
      console.error('OAuth callback error:', error);
      const message = error instanceof Error ? error.message : 'Failed to complete GitHub connection';
      setErrorMessage(message);
      setStatus('error');
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
    }
  }

  function handleRetry() {
    router.push('/dashboard/github');
  }

  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      <Card className="max-w-md w-full p-8">
        <div className="text-center space-y-6">
          {/* Loading State */}
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Connecting GitHub...</h2>
                <p className="text-muted-foreground">
                  Please wait while we complete the connection
                </p>
              </div>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Connected Successfully!</h2>
                <p className="text-muted-foreground">
                  Your GitHub account has been connected. Redirecting...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to GitHub page...</span>
              </div>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Connection Failed</h2>
                <p className="text-muted-foreground">{errorMessage}</p>
              </div>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full gap-2">
                  <Github className="w-4 h-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="w-full"
                >
                  Back to Dashboard
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
