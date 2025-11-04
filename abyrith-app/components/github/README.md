# GitHub Integration Components

React components for GitHub repository connection and secrets syncing in Abyrith.

## Components

### 1. GitHubConnectButton

OAuth connection button that initiates GitHub authentication flow.

**Features:**
- Shows "Connect GitHub" if not connected
- Shows "GitHub Connected" if already connected
- Handles OAuth flow initiation
- Loading states

**Usage:**
```tsx
import { GitHubConnectButton } from '@/components/github';

<GitHubConnectButton
  onConnected={() => console.log('Connected!')}
  variant="default"
  size="default"
/>
```

**Props:**
- `onConnected?: () => void` - Callback when connection succeeds
- `variant?: 'default' | 'outline' | 'secondary' | 'ghost'` - Button variant
- `size?: 'default' | 'sm' | 'lg' | 'icon'` - Button size

---

### 2. GitHubConnectionStatus

Display card showing GitHub connection details.

**Features:**
- GitHub username and email
- Connection date
- Token scopes
- Last used timestamp
- Disconnect button
- Token expiry warning

**Usage:**
```tsx
import { GitHubConnectionStatus } from '@/components/github';

<GitHubConnectionStatus
  onDisconnected={() => console.log('Disconnected')}
/>
```

**Props:**
- `onDisconnected?: () => void` - Callback when disconnection succeeds

---

### 3. GitHubRepositoryBrowser

Browse and search user's GitHub repositories.

**Features:**
- Repository list with details (name, description, language, visibility)
- Search/filter functionality
- Pagination (30 per page)
- Linked status badges
- "Link to Project" action buttons
- Master password prompt for decryption

**Usage:**
```tsx
import { GitHubRepositoryBrowser } from '@/components/github';

<GitHubRepositoryBrowser
  onLinkRepository={(repo) => handleLink(repo)}
/>
```

**Props:**
- `onLinkRepository: (repo: GitHubRepository) => void` - Callback when user clicks "Link to Project"

---

### 4. LinkRepositoryDialog

Modal dialog for linking a GitHub repository to an Abyrith project.

**Features:**
- Choose "Create new project" or "Link to existing"
- Project name input (if creating new)
- Project dropdown (if linking existing)
- Default environment selector
- "Write .abyrith marker file" checkbox
- Master password validation
- Form validation

**Usage:**
```tsx
import { LinkRepositoryDialog } from '@/components/github';

const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
const [isOpen, setIsOpen] = useState(false);

<LinkRepositoryDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  repository={selectedRepo}
  onLinked={() => console.log('Repository linked!')}
/>
```

**Props:**
- `open: boolean` - Dialog open state
- `onOpenChange: (open: boolean) => void` - Dialog state change handler
- `repository: GitHubRepository | null` - Repository to link
- `onLinked?: () => void` - Callback when link succeeds

---

### 5. RepositorySyncPanel

UI for importing secrets from a linked GitHub repository.

**Features:**
- Preview secrets before import
- Source selection (env files, GitHub Actions, dependencies)
- Environment selector
- Collision handling dropdown (skip/overwrite/rename)
- Import progress indicator
- Import summary with counts
- Error handling

**Usage:**
```tsx
import { RepositorySyncPanel } from '@/components/github';

<RepositorySyncPanel
  linkedRepository={repo}
  onSyncComplete={(log) => console.log('Sync complete:', log)}
/>
```

**Props:**
- `linkedRepository: LinkedRepository` - The linked repository to sync from
- `onSyncComplete?: (log: SyncLog) => void` - Callback when sync completes

---

### 6. SyncHistoryLog

Display sync history for a linked GitHub repository.

**Features:**
- Table of past syncs
- Status badges (success/partial/failed)
- Import/skip/fail counts
- Timestamps with relative time
- Expandable details (files imported, errors)
- Pagination (10 per page)

**Usage:**
```tsx
import { SyncHistoryLog } from '@/components/github';

<SyncHistoryLog linkedRepository={repo} />
```

**Props:**
- `linkedRepository: LinkedRepository` - Repository to show history for

---

## Types

All TypeScript types and Zod schemas are available in `types.ts`:

```tsx
import type {
  GitHubConnection,
  GitHubRepository,
  LinkedRepository,
  SyncLog,
  SecretPreview,
  SyncConfiguration,
  LinkRepositoryFormData,
} from '@/components/github/types';

// Zod schemas for validation
import {
  linkRepositoryFormSchema,
  syncConfigurationSchema,
  gitHubOAuthCallbackSchema,
} from '@/components/github/types';
```

---

## Integration

### Required Dependencies

These components depend on:
- `lib/api/github.ts` - GitHub API client
- `lib/crypto/github-encryption.ts` - Token encryption
- `lib/stores/auth-store.ts` - Master password management
- `lib/stores/project-store.ts` - Project/environment state
- `components/ui/*` - shadcn/ui components
- `date-fns` - Date formatting
- `lucide-react` - Icons

### Required Setup

1. **Master Password:** User must have master password set and verified
2. **GitHub OAuth:** GitHub OAuth app must be configured
3. **Projects:** At least one project must exist (for linking existing)
4. **Environments:** Environments must exist in selected project

### Master Password Handling

All components that require decryption will:
1. Check if `masterPassword` and `kekSalt` exist in auth store
2. Show `MasterPasswordPrompt` if not available
3. Retry operation after successful password verification

Example:
```tsx
const { masterPassword, kekSalt } = useAuthStore();

if (!masterPassword || !kekSalt) {
  setShowMasterPasswordPrompt(true);
  return;
}

// Proceed with decryption...
```

---

## User Flows

### Connect GitHub Flow

1. User clicks `GitHubConnectButton`
2. OAuth URL is generated
3. User redirects to GitHub authorization page
4. User authorizes Abyrith
5. GitHub redirects back with code
6. Token is exchanged and encrypted client-side
7. Connection stored in database
8. User returns to app
9. `GitHubConnectionStatus` shows connection details

### Link Repository Flow

1. User views `GitHubRepositoryBrowser`
2. Master password prompted if needed
3. Repositories load from GitHub API
4. User searches/filters to find repository
5. User clicks "Link to Project"
6. `LinkRepositoryDialog` opens
7. User chooses create new or link existing
8. User selects environment and options
9. Repository links to project
10. Optional: `.abyrith` marker file written to repo

### Import Secrets Flow

1. User opens `RepositorySyncPanel` for linked repo
2. User selects sources (env files, GitHub Actions, dependencies)
3. User selects target environment
4. User selects collision strategy
5. User clicks "Preview Secrets"
6. Preview shows secrets with collision warnings
7. User clicks "Import Secrets"
8. Secrets are fetched, encrypted, and stored
9. Import summary displayed
10. `SyncHistoryLog` shows new entry

---

## Error Handling

All components handle errors gracefully:

- **Network errors:** Show toast with error message
- **Decryption errors:** Prompt for master password
- **Validation errors:** Show inline error messages
- **API errors:** Display descriptive error messages

Example:
```tsx
try {
  await linkGitHubRepository(...);
  toast({
    variant: 'success',
    title: 'Repository linked',
  });
} catch (error) {
  toast({
    variant: 'destructive',
    title: 'Failed to link repository',
    description: error instanceof Error ? error.message : 'Please try again',
  });
}
```

---

## Accessibility

All components implement:
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support

---

## Testing

To test these components:

1. **Unit tests:** Test component rendering and interactions
2. **Integration tests:** Test with real API calls (dev environment)
3. **E2E tests:** Test complete user flows with Playwright

Example test:
```tsx
describe('GitHubConnectButton', () => {
  it('shows connect button when not connected', () => {
    render(<GitHubConnectButton />);
    expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
  });

  it('initiates OAuth flow on click', async () => {
    const user = userEvent.setup();
    render(<GitHubConnectButton />);
    await user.click(screen.getByText('Connect GitHub'));
    // Assert OAuth URL is generated
  });
});
```

---

## Security Notes

- All GitHub tokens are encrypted client-side with user's master password
- Zero-knowledge architecture: server cannot decrypt tokens
- OAuth state parameter prevents CSRF attacks
- Token scopes are minimal (only what's needed)
- Master password never transmitted to server
- `.abyrith` marker file contains only non-sensitive project UUID

---

## Future Enhancements

Potential improvements:
- Auto-sync on schedule or webhook
- Dependency detection for more languages
- Two-way sync (Abyrith → GitHub Actions)
- Bulk repository linking
- Repository templates
- Secret validation before import
- Import history comparison

---

## Related Documentation

- Feature spec: `/08-features/github-integration/github-repo-syncing.md`
- API endpoints: `/05-api/endpoints/github-endpoints.md`
- Security model: `/03-security/integrations-security.md`
- Database schema: `/04-database/schemas/github-connections.md`
