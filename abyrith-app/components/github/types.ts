/**
 * GitHub Integration Component Types
 *
 * TypeScript type definitions for GitHub integration components.
 * These extend the types from lib/api/github.ts with component-specific types.
 */

import { z } from 'zod';

/**
 * Link Repository Form Data
 */
export interface LinkRepositoryFormData {
  action: 'create_project' | 'link_existing';
  projectName: string | null;
  projectId: string | null;
  environmentId: string | null;
  writeMarkerFile: boolean;
}

/**
 * Sync Configuration
 */
export interface SyncConfiguration {
  sources: ('env_files' | 'github_actions' | 'dependencies')[];
  environmentId: string;
  collisionStrategy: 'skip' | 'overwrite' | 'rename';
}

/**
 * Component Props Types
 */

export interface GitHubConnectButtonProps {
  onConnected?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export interface GitHubConnectionStatusProps {
  onDisconnected?: () => void;
}

export interface GitHubRepositoryBrowserProps {
  onLinkRepository: (repo: GitHubRepository) => void;
}

export interface LinkRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: GitHubRepository | null;
  onLinked?: () => void;
}

export interface RepositorySyncPanelProps {
  linkedRepository: LinkedRepository;
  onSyncComplete?: (log: SyncLog) => void;
}

export interface SyncHistoryLogProps {
  linkedRepository: LinkedRepository;
}

/**
 * Re-export types from lib/api/github.ts for convenience
 */
export type {
  GitHubConnection,
  GitHubRepository,
  LinkedRepository,
  SyncLog,
  SecretPreview,
} from '@/lib/api/github';

/**
 * Zod Validation Schemas
 */

/**
 * Link Repository Form Schema
 */
export const linkRepositoryFormSchema = z.object({
  action: z.enum(['create_project', 'link_existing']),
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .nullable(),
  projectId: z.string().uuid('Invalid project ID').nullable(),
  environmentId: z.string().uuid('Invalid environment ID').nullable(),
  writeMarkerFile: z.boolean(),
});

/**
 * Sync Configuration Schema
 */
export const syncConfigurationSchema = z.object({
  sources: z
    .array(z.enum(['env_files', 'github_actions', 'dependencies']))
    .min(1, 'At least one source must be selected'),
  environmentId: z.string().uuid('Invalid environment ID'),
  collisionStrategy: z.enum(['skip', 'overwrite', 'rename']),
});

/**
 * GitHub OAuth Callback Query Parameters Schema
 */
export const gitHubOAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

/**
 * Repository Search Query Schema
 */
export const repositorySearchQuerySchema = z.object({
  query: z.string().max(255, 'Search query too long').optional(),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(1).max(100).default(30),
});

/**
 * Type guards
 */

export function isGitHubConnection(obj: any): obj is GitHubConnection {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.github_username === 'string' &&
    Array.isArray(obj.token_scope)
  );
}

export function isLinkedRepository(obj: any): obj is LinkedRepository {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.repo_name === 'string' &&
    typeof obj.github_repo_id === 'number'
  );
}

export function isSyncLog(obj: any): obj is SyncLog {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.sync_status === 'string' &&
    ['success', 'partial', 'failed'].includes(obj.sync_status)
  );
}

/**
 * Utility Types
 */

export type SyncStatus = 'success' | 'partial' | 'failed';
export type SyncType = 'manual' | 'scheduled' | 'webhook';
export type SyncSource = 'env_files' | 'github_actions' | 'dependencies';
export type CollisionStrategy = 'skip' | 'overwrite' | 'rename';
export type LinkAction = 'create_project' | 'link_existing';

/**
 * Helper functions for validation
 */

/**
 * Validate link repository form data
 */
export function validateLinkRepositoryForm(data: LinkRepositoryFormData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Action-specific validation
  if (data.action === 'create_project') {
    if (!data.projectName || data.projectName.trim().length === 0) {
      errors.push('Project name is required when creating a new project');
    }
  } else if (data.action === 'link_existing') {
    if (!data.projectId) {
      errors.push('Project selection is required when linking to existing project');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate sync configuration
 */
export function validateSyncConfiguration(config: SyncConfiguration): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.sources.length === 0) {
    errors.push('At least one source must be selected');
  }

  if (!config.environmentId) {
    errors.push('Target environment is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format repository full name
 */
export function formatRepositoryFullName(owner: string, name: string): string {
  return `${owner}/${name}`;
}

/**
 * Format sync duration
 */
export function formatSyncDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'N/A';

  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.round(duration / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get sync status color
 */
export function getSyncStatusColor(status: SyncStatus): string {
  switch (status) {
    case 'success':
      return 'text-green-600 dark:text-green-500';
    case 'partial':
      return 'text-yellow-600 dark:text-yellow-500';
    case 'failed':
      return 'text-red-600 dark:text-red-500';
  }
}

/**
 * Get sync type label
 */
export function getSyncTypeLabel(type: SyncType): string {
  switch (type) {
    case 'manual':
      return 'Manual Import';
    case 'scheduled':
      return 'Scheduled Sync';
    case 'webhook':
      return 'Webhook Trigger';
  }
}

/**
 * Get collision strategy description
 */
export function getCollisionStrategyDescription(strategy: CollisionStrategy): string {
  switch (strategy) {
    case 'skip':
      return 'Existing secrets will be kept unchanged';
    case 'overwrite':
      return 'Existing secrets will be replaced with imported values';
    case 'rename':
      return 'Imported secrets will be renamed with _github suffix';
  }
}

/**
 * Import from lib/api/github.ts for type safety
 */
import type {
  GitHubConnection,
  GitHubRepository,
  LinkedRepository,
  SyncLog,
  SecretPreview,
} from '@/lib/api/github';
