'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSecretStore } from '@/lib/stores/secret-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MasterPasswordPrompt } from '@/components/auth/MasterPasswordPrompt';

interface CreateSecretDialogProps {
  projectId: string;
  environmentId: string;
  onClose: () => void;
}

export function CreateSecretDialog({
  projectId,
  environmentId,
  onClose,
}: CreateSecretDialogProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] = useState(false);

  const { createSecret } = useSecretStore();
  const { masterPassword } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!masterPassword) {
      setShowMasterPasswordPrompt(true);
      return;
    }

    setIsSubmitting(true);

    try {
      await createSecret(projectId, environmentId, key, value, masterPassword, {
        description,
        serviceName,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create secret:', error);
      alert('Failed to create secret. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMasterPasswordSuccess = async () => {
    // After successful master password verification, try to create again
    const { masterPassword: newMasterPassword } = useAuthStore.getState();
    if (!newMasterPassword) return;

    setIsSubmitting(true);

    try {
      await createSecret(projectId, environmentId, key, value, newMasterPassword, {
        description,
        serviceName,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create secret:', error);
      alert('Failed to create secret. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Create Secret</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="key">Key Name</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="OPENAI_API_KEY"
              required
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use UPPER_SNAKE_CASE for consistency
            </p>
          </div>

          <div>
            <Label htmlFor="value">Secret Value</Label>
            <div className="relative">
              <Input
                id="value"
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-proj-..."
                required
                className="mt-1 font-mono pr-20"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
              >
                {showValue ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="serviceName">Service Name (optional)</Label>
            <Input
              id="serviceName"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="OpenAI"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="API key for ChatGPT integration"
              className="mt-1"
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-semibold mb-1">🔒 Zero-Knowledge Encryption</p>
            <p className="text-muted-foreground">
              Your secret will be encrypted on your device before being sent to the server.
              Only you can decrypt it with your master password.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Encrypting...' : 'Create Secret'}
            </Button>
          </div>
        </form>

        <MasterPasswordPrompt
          open={showMasterPasswordPrompt}
          onOpenChange={setShowMasterPasswordPrompt}
          onSuccess={handleMasterPasswordSuccess}
        />
      </div>
    </div>
  );
}
