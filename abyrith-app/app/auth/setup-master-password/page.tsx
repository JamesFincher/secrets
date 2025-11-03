'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { validatePasswordStrength } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SetupMasterPasswordPage() {
  const router = useRouter();
  const { setupMasterPassword, isLoading } = useAuth();
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validate master password
    const validation = validatePasswordStrength(masterPassword);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    if (masterPassword !== confirmPassword) {
      setErrors(['Passwords do not match']);
      return;
    }

    try {
      await setupMasterPassword(masterPassword);
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to setup master password:', err);
      setErrors(['Failed to setup master password. Please try again.']);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Set Up Master Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your master password encrypts all your secrets. Choose a strong password you'll remember.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <h3 className="font-semibold mb-2">Password Requirements:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• At least 12 characters long</li>
            <li>• Contains uppercase and lowercase letters</li>
            <li>• Contains at least one number</li>
            <li>• Contains at least one special character</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-destructive">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="masterPassword">Master Password</Label>
              <Input
                id="masterPassword"
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="new-password"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Master Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="new-password"
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20">
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              ⚠️ Important: Never forget this password!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Due to zero-knowledge encryption, we cannot recover your master password.
              If you forget it, you'll lose access to all your secrets.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Setting up...' : 'Set Up Master Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
