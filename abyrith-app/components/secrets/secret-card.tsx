'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSecretStore } from '@/lib/stores/secret-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MasterPasswordPrompt } from '@/components/auth/MasterPasswordPrompt';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/lib/api/supabase';

type Secret = Tables<'secrets'>;

interface SecretCardProps {
  secret: Secret;
}

export function SecretCard({ secret }: SecretCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] = useState(false);

  const { decryptSecret, getDecryptedSecret, deleteSecret } = useSecretStore();
  const { masterPassword } = useAuthStore();
  const { toast } = useToast();

  const decryptedValue = getDecryptedSecret(secret.id);

  const handleReveal = async () => {
    if (decryptedValue) {
      setIsRevealed(!isRevealed);
      return;
    }

    if (!masterPassword) {
      setShowMasterPasswordPrompt(true);
      return;
    }

    setIsDecrypting(true);
    try {
      await decryptSecret(secret, masterPassword);
      setIsRevealed(true);
      toast({
        variant: 'success',
        title: 'Secret decrypted',
        description: 'Your secret is now visible.',
      });
    } catch (error) {
      console.error('Decryption failed:', error);
      toast({
        variant: 'destructive',
        title: 'Decryption failed',
        description: 'Invalid master password or corrupted secret.',
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleMasterPasswordSuccess = async () => {
    // After successful master password verification, try to decrypt again
    const { masterPassword: newMasterPassword } = useAuthStore.getState();
    if (!newMasterPassword) return;

    setIsDecrypting(true);
    try {
      await decryptSecret(secret, newMasterPassword);
      setIsRevealed(true);
      toast({
        variant: 'success',
        title: 'Secret decrypted',
        description: 'Your secret is now visible.',
      });
    } catch (error) {
      console.error('Decryption failed:', error);
      toast({
        variant: 'destructive',
        title: 'Decryption failed',
        description: 'Invalid master password or corrupted secret.',
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleCopy = async () => {
    if (!decryptedValue) return;

    try {
      await navigator.clipboard.writeText(decryptedValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        variant: 'success',
        title: 'Copied to clipboard',
        description: `${secret.key} copied successfully.`,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
      });
    }
  };

  const handleDelete = async () => {
    // Show confirmation dialog via toast with action
    toast({
      variant: 'warning',
      title: `Delete "${secret.key}"?`,
      description: 'This action cannot be undone.',
    });

    // Use native confirm for now - we can improve this later with a custom modal
    if (!confirm(`Are you sure you want to delete "${secret.key}"?`)) {
      return;
    }

    try {
      await deleteSecret(secret.id);
      toast({
        variant: 'success',
        title: 'Secret deleted',
        description: `${secret.key} has been removed.`,
      });
    } catch (error) {
      console.error('Failed to delete secret:', error);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Could not delete secret. Please try again.',
      });
    }
  };

  return (
    <div className="rounded-lg border p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-mono font-semibold text-sm">{secret.key}</h3>
          {secret.service_name && (
            <p className="text-xs text-muted-foreground mt-1">
              Service: {secret.service_name}
            </p>
          )}
          {secret.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {secret.description}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReveal}
            disabled={isDecrypting}
          >
            {isDecrypting ? 'Decrypting...' : isRevealed ? 'Hide' : 'Reveal'}
          </Button>

          {isRevealed && decryptedValue && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          )}

          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      {isRevealed && decryptedValue && (
        <div className="mt-3 pt-3 border-t">
          <div className="bg-muted rounded p-2 font-mono text-sm break-all">
            {decryptedValue}
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-2 flex-wrap">
        {secret.tags?.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Created: {new Date(secret.created_at).toLocaleDateString()}
        {secret.last_accessed_at && (
          <> • Last accessed: {new Date(secret.last_accessed_at).toLocaleDateString()}</>
        )}
      </div>

      <MasterPasswordPrompt
        open={showMasterPasswordPrompt}
        onOpenChange={setShowMasterPasswordPrompt}
        onSuccess={handleMasterPasswordSuccess}
      />
    </div>
  );
}
