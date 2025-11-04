'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useProjectStore } from '@/lib/stores/project-store';
import {
  previewRepositorySecrets,
  syncRepositorySecrets,
  type SecretPreview,
  type LinkedRepository,
  type SyncLog,
} from '@/lib/api/github';
import { AlertCircle, CheckCircle2, FileText, Loader2, Download, AlertTriangle } from 'lucide-react';
import { MasterPasswordPrompt } from '@/components/auth/MasterPasswordPrompt';

interface RepositorySyncPanelProps {
  linkedRepository: LinkedRepository;
  onSyncComplete?: (log: SyncLog) => void;
}

type SyncSource = 'env_files' | 'github_actions' | 'dependencies';
type CollisionStrategy = 'skip' | 'overwrite' | 'rename';

/**
 * RepositorySyncPanel Component
 *
 * UI for importing secrets from a linked GitHub repository.
 */
export function RepositorySyncPanel({
  linkedRepository,
  onSyncComplete,
}: RepositorySyncPanelProps) {
  const [preview, setPreview] = useState<SecretPreview[]>([]);
  const [selectedSources, setSelectedSources] = useState<SyncSource[]>(['env_files']);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    linkedRepository.default_environment_id || ''
  );
  const [collisionStrategy, setCollisionStrategy] = useState<CollisionStrategy>('skip');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncLog | null>(null);

  const { masterPassword, kekSalt } = useAuthStore();
  const { environments } = useProjectStore();
  const { toast } = useToast();

  const handleSourceToggle = (source: SyncSource) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const handlePreview = async () => {
    if (!masterPassword || !kekSalt) {
      setShowMasterPasswordPrompt(true);
      return;
    }

    if (selectedSources.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No sources selected',
        description: 'Please select at least one source',
      });
      return;
    }

    setIsLoadingPreview(true);

    try {
      const result = await previewRepositorySecrets(
        linkedRepository.id,
        selectedSources,
        masterPassword,
        kekSalt
      );
      setPreview(result.secrets);
      setShowPreview(true);

      toast({
        variant: 'success',
        title: 'Preview loaded',
        description: `Found ${result.total_secrets} secrets with ${result.collisions} collisions`,
      });
    } catch (error) {
      console.error('Failed to preview secrets:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to preview secrets',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSync = async () => {
    if (!masterPassword || !kekSalt) {
      setShowMasterPasswordPrompt(true);
      return;
    }

    if (!selectedEnvironmentId) {
      toast({
        variant: 'destructive',
        title: 'No environment selected',
        description: 'Please select a target environment',
      });
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await syncRepositorySecrets(
        linkedRepository.id,
        selectedSources,
        selectedEnvironmentId,
        collisionStrategy,
        masterPassword,
        kekSalt
      );

      setSyncResult(result);

      toast({
        variant: result.sync_status === 'failed' ? 'destructive' : 'success',
        title: result.sync_status === 'failed' ? 'Import failed' : 'Import complete',
        description: `Imported ${result.secrets_imported} secrets`,
      });

      onSyncComplete?.(result);
    } catch (error) {
      console.error('Failed to sync secrets:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to import secrets',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Import Secrets</CardTitle>
          <CardDescription>
            Import secrets from {linkedRepository.repo_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source Selection */}
          <div>
            <Label className="mb-2 block">Import Sources</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes('env_files')}
                  onChange={() => handleSourceToggle('env_files')}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">Environment files (.env, etc.)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes('github_actions')}
                  onChange={() => handleSourceToggle('github_actions')}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">GitHub Actions secrets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes('dependencies')}
                  onChange={() => handleSourceToggle('dependencies')}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">From dependencies</span>
              </label>
            </div>
          </div>

          {/* Environment Selection */}
          <div>
            <Label htmlFor="environment">Target Environment</Label>
            <select
              id="environment"
              value={selectedEnvironmentId}
              onChange={(e) => setSelectedEnvironmentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select environment...</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Collision Strategy */}
          <div>
            <Label htmlFor="collision">Collision Handling</Label>
            <select
              id="collision"
              value={collisionStrategy}
              onChange={(e) => setCollisionStrategy(e.target.value as CollisionStrategy)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="skip">Skip existing</option>
              <option value="overwrite">Overwrite existing</option>
              <option value="rename">Rename imported</option>
            </select>
          </div>

          {/* Preview Button */}
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isLoadingPreview || selectedSources.length === 0}
            className="w-full"
          >
            {isLoadingPreview ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Preview Secrets
              </>
            )}
          </Button>

          {/* Preview Results */}
          {showPreview && preview.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Preview</p>
                <Badge>{preview.length} secrets</Badge>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {preview.map((secret, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md bg-muted p-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono font-medium">{secret.key_name}</span>
                      <span className="text-xs text-muted-foreground">{secret.source_file}</span>
                    </div>
                    {secret.collision ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Collision
                      </Badge>
                    ) : (
                      <Badge>New</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync Result */}
          {syncResult && (
            <div className="rounded-lg p-4 bg-muted">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Import Complete</p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">{syncResult.secrets_imported}</span> imported,{' '}
                    <span className="font-medium">{syncResult.secrets_skipped}</span> skipped
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={handleSync}
            disabled={isSyncing || !selectedEnvironmentId}
            className="w-full"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Import Secrets
              </>
            )}
          </Button>

          {/* Security Note */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-semibold mb-1">🔒 Secure Import</p>
            <p className="text-muted-foreground text-xs">
              All secrets are encrypted with your master password
            </p>
          </div>
        </CardContent>
      </Card>

      <MasterPasswordPrompt
        open={showMasterPasswordPrompt}
        onOpenChange={setShowMasterPasswordPrompt}
        onSuccess={() => setShowMasterPasswordPrompt(false)}
      />
    </>
  );
}
