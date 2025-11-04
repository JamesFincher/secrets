'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useProjectStore } from '@/lib/stores/project-store';
import { linkGitHubRepository, type GitHubRepository } from '@/lib/api/github';
import { MasterPasswordPrompt } from '@/components/auth/MasterPasswordPrompt';

interface LinkRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: GitHubRepository | null;
  onLinked?: () => void;
}

/**
 * LinkRepositoryDialog Component
 *
 * Modal dialog for linking a GitHub repository to an Abyrith project.
 */
export function LinkRepositoryDialog({
  open,
  onOpenChange,
  repository,
  onLinked,
}: LinkRepositoryDialogProps) {
  const [action, setAction] = useState<'create_project' | 'link_existing'>('create_project');
  const [projectName, setProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [writeMarkerFile, setWriteMarkerFile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] = useState(false);

  const { masterPassword, kekSalt } = useAuthStore();
  const { projects, environments, currentOrganization } = useProjectStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open && repository) {
      setAction('create_project');
      setProjectName(repository.name);
      setSelectedProjectId('');
      setSelectedEnvironmentId('');
      setWriteMarkerFile(true);
    }
  }, [open, repository]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!masterPassword || !kekSalt) {
      setShowMasterPasswordPrompt(true);
      return;
    }

    if (!repository) return;

    setIsSubmitting(true);

    try {
      await linkGitHubRepository(
        repository.id,
        repository.owner,
        repository.name,
        repository.url,
        action,
        action === 'create_project' ? projectName : null,
        action === 'link_existing' ? selectedProjectId : null,
        selectedEnvironmentId || null,
        writeMarkerFile,
        masterPassword,
        kekSalt
      );

      toast({
        variant: 'success',
        title: 'Repository linked',
        description: `${repository.full_name} has been linked successfully.`,
      });

      onOpenChange(false);
      onLinked?.();
    } catch (error) {
      console.error('Failed to link repository:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to link repository',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMasterPasswordSuccess = async () => {
    setShowMasterPasswordPrompt(false);
    const form = document.getElementById('link-repo-form') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  };

  if (!repository) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Link Repository to Project</DialogTitle>
            <DialogDescription>
              Connect <span className="font-semibold">{repository.full_name}</span> to an Abyrith
              project to import secrets.
            </DialogDescription>
          </DialogHeader>

          <form id="link-repo-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Action Selection */}
            <div className="space-y-3">
              <Label>Action</Label>
              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="create_project"
                    checked={action === 'create_project'}
                    onChange={(e) => setAction(e.target.value as any)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="space-y-1">
                    <div className="font-normal">Create new project</div>
                    <p className="text-sm text-muted-foreground">
                      Create a new Abyrith project for this repository
                    </p>
                  </div>
                </label>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="link_existing"
                    checked={action === 'link_existing'}
                    onChange={(e) => setAction(e.target.value as any)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="space-y-1">
                    <div className="font-normal">Link to existing project</div>
                    <p className="text-sm text-muted-foreground">
                      Add this repository to an existing project
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Project Name (Create New) */}
            {action === 'create_project' && (
              <div>
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Project"
                  required
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A new project will be created with default environments
                </p>
              </div>
            )}

            {/* Project Selection (Link Existing) */}
            {action === 'link_existing' && (
              <div>
                <Label htmlFor="project">Select Project</Label>
                <select
                  id="project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Choose a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Default Environment */}
            <div>
              <Label htmlFor="environment">Default Environment (optional)</Label>
              <select
                id="environment"
                value={selectedEnvironmentId}
                onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No default environment</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name} ({env.slug})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Where to import secrets by default
              </p>
            </div>

            {/* Write Marker File */}
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                id="markerFile"
                checked={writeMarkerFile}
                onChange={(e) => setWriteMarkerFile(e.target.checked)}
                className="mt-1 h-4 w-4 rounded"
              />
              <div className="space-y-1">
                <div className="font-normal text-sm">Write .abyrith marker file to repository</div>
                <p className="text-sm text-muted-foreground">
                  Creates a .abyrith file with project ID for MCP/CLI integration
                </p>
              </div>
            </label>

            {/* Security Note */}
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold mb-1">🔒 Secure Linking</p>
              <p className="text-muted-foreground text-xs">
                Only a non-sensitive project UUID is stored in the repository
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Linking...' : 'Link Repository'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MasterPasswordPrompt
        open={showMasterPasswordPrompt}
        onOpenChange={setShowMasterPasswordPrompt}
        onSuccess={handleMasterPasswordSuccess}
      />
    </>
  );
}
