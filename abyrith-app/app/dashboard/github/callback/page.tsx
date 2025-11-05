'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { completeGitHubOAuth } from '@/lib/api/github';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Github, CheckCircle2, XCircle, Loader2, Lock } from 'lucide-react';

export default function GitHubCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { masterPassword, preferences, verifyMasterPassword } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'need_password' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

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

      // Check if master password is available
      if (!masterPassword || !preferences) {
        // Need to prompt for password
        setStatus('need_password');
        return;
      }

      // Complete OAuth flow
      await completeOAuth(code, state, masterPassword, preferences.masterPasswordVerification.salt);
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

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsVerifying(true);
    setErrorMessage('');

    try {
      // Load preferences if not in memory (happens when user skips unlock page)
      let prefs = preferences;
      if (!prefs) {
        console.log('[GitHub Callback] Loading user preferences...');
        const supabase = (await import('@/lib/api/supabase')).supabase;

        // Get current user ID from session (works better after OAuth redirects)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          throw new Error('Not authenticated');
        }
        const currentUser = session.user;

        // Load preferences from database
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (error || !data) {
          console.error('[GitHub Callback] Failed to load preferences:', error);
          throw new Error('Failed to load user preferences. Please try unlocking your vault first.');
        }

        prefs = {
          masterPasswordVerification: data.master_password_verification,
          theme: data.theme,
          notificationsEnabled: data.notifications_enabled,
        };
        console.log('[GitHub Callback] Preferences loaded successfully');
      }

      // Verify password using preferences
      const { verifyPassword } = await import('@/lib/crypto/envelope-encryption');
      const isValid = await verifyPassword(prefs.masterPasswordVerification, passwordInput);

      if (!isValid) {
        setErrorMessage('Incorrect master password');
        setIsVerifying(false);
        return;
      }

      // Get parameters again
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code || !state) {
        throw new Error('Missing required parameters');
      }

      // Complete OAuth flow with verified password
      await completeOAuth(code, state, passwordInput, prefs.masterPasswordVerification.salt);
    } catch (error) {
      console.error('Password verification error:', error);
      const message = error instanceof Error ? error.message : 'Failed to verify password';
      setErrorMessage(message);
      setIsVerifying(false);
    }
  }

  async function completeOAuth(code: string, state: string, password: string, kekSalt: string) {
    setStatus('loading');

    // Clean up stored state
    sessionStorage.removeItem('github_oauth_state');

    await completeGitHubOAuth(code, state, password, kekSalt);

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

          {/* Password Prompt State */}
          {status === 'need_password' && (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Confirm Your Identity</h2>
                <p className="text-muted-foreground">
                  Enter your master password to encrypt and store your GitHub token
                </p>
              </div>
              <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
                {errorMessage && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
                    {errorMessage}
                  </div>
                )}
                <div>
                  <Label htmlFor="password">Master Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your master password"
                    required
                    autoFocus
                    disabled={isVerifying}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>
              <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20 text-left">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  🔒 Zero-Knowledge Encryption
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your GitHub token will be encrypted with your master password before storage.
                  The server never sees your plaintext token.
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
