'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UnlockPage() {
  const router = useRouter();
  const { user, verifyMasterPassword, signOut } = useAuth();
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const isValid = await verifyMasterPassword(masterPassword);

      if (isValid) {
        router.push('/dashboard');
      } else {
        setError('Incorrect master password. Please try again.');
        setMasterPassword('');
      }
    } catch (err) {
      console.error('Failed to verify master password:', err);
      setError('Failed to verify master password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/signin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <div className="inline-block p-3 rounded-full bg-primary/10 mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold">Unlock Your Vault</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome back, {user?.email}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your master password to unlock your secrets
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="masterPassword">Master Password</Label>
            <Input
              id="masterPassword"
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              autoFocus
              autoComplete="off"
              className="mt-1"
            />
          </div>

          <div className="rounded-lg bg-blue-500/10 p-4 border border-blue-500/20">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              🔒 Zero-Knowledge Security
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Your master password never leaves your device. It's used only to decrypt
              your secrets locally.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Unlocking...' : 'Unlock Vault'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in as a different user
            </button>
          </div>
        </form>

        <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20">
          <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
            ⚠️ Forgot your master password?
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Due to zero-knowledge encryption, we cannot recover your master password.
            You'll need to reset your account and lose access to all secrets.
          </p>
        </div>
      </div>
    </div>
  );
}
