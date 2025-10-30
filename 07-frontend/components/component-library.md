---
Document: Component Library Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 07-frontend/frontend-architecture.md, TECH-STACK.md, GLOSSARY.md
---

# Component Library Architecture

## Overview

This document defines the reusable component library for the Abyrith frontend, including naming conventions, component catalog, usage patterns, and integration with the design system. The component library is built on shadcn/ui (Radix UI primitives) with Tailwind CSS, emphasizing accessibility, consistency, and beginner-friendly documentation.

**Purpose:** Establish a comprehensive, well-documented component library that maintains design consistency, enforces accessibility standards, and accelerates development through reusable, composable UI components.

**Scope:** This document covers all reusable React components, from low-level primitives (buttons, inputs) to complex domain-specific components (SecretCard, AIChat, ProjectSelector). It includes component APIs, usage examples, accessibility requirements, and Storybook integration (when implemented).

**Status:** Draft - Components to be implemented during frontend development phase

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [API Contracts](#api-contracts)
7. [Security Architecture](#security-architecture)
8. [Performance Characteristics](#performance-characteristics)
9. [Scalability](#scalability)
10. [Failure Modes](#failure-modes)
11. [Alternatives Considered](#alternatives-considered)
12. [Decision Log](#decision-log)
13. [Dependencies](#dependencies)
14. [References](#references)
15. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith requires a consistent, accessible, and well-documented component library to enable rapid UI development while maintaining design consistency across the application. The frontend must support users ranging from complete beginners to enterprise teams, requiring components that are both simple to use and powerful when needed.

**Pain points:**
- **Consistency:** Without a component library, developers might implement the same UI pattern multiple ways
- **Accessibility:** Ensuring WCAG 2.1 AA compliance requires consistent accessible components
- **Development speed:** Recreating common UI patterns slows development
- **Design drift:** Ad-hoc components lead to visual inconsistency
- **Documentation:** Developers need clear examples and usage guidelines

**Why now?**
The component library is foundational infrastructure. Establishing it early ensures all features built on top maintain consistency and quality standards.

### Background

**Existing system:**
This is a greenfield implementation. No existing component library.

**Previous attempts:**
N/A - Initial implementation.

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Developer experience, reusability | Complexity, maintenance burden |
| Design Team | Visual consistency, brand adherence | Design system flexibility |
| Accessibility Lead | WCAG compliance, keyboard navigation | Accessibility coverage |
| Product Team | Feature velocity, user experience | Time to implement, user confusion |
| End Users | Intuitive, fast, accessible UI | Loading speed, usability |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Accessibility first** - All components WCAG 2.1 AA compliant (success metric: 100% keyboard navigable, screen reader tested)
2. **Developer experience** - Clear APIs, TypeScript types, inline documentation (success metric: New developer can use components without asking questions)
3. **Design consistency** - Single source of truth for UI patterns (success metric: Zero duplicate implementations of common patterns)
4. **Performance** - Fast rendering, minimal bundle impact (success metric: Core bundle < 300KB gzipped)

**Secondary goals:**
- Storybook integration for component catalog and visual testing
- Dark mode support for all components
- Responsive design patterns (mobile-first)
- Animation and transition standards

### Non-Goals

**Explicitly out of scope:**
- **Custom icon library** - Use Lucide React instead
- **Complex charting components** - Use external library if needed (future)
- **Native mobile components** - Focus on responsive web for MVP
- **Animation library** - Use CSS transitions and Tailwind utilities for MVP

### Success Metrics

**How we measure success:**
- **Accessibility**: 100% of components pass automated accessibility tests (axe-core)
- **Reusability**: > 80% of UI code uses library components (not one-offs)
- **Developer satisfaction**: < 5 minute time from "need component" to "using component"
- **Bundle size**: Component library adds < 100KB to bundle (tree-shakeable)
- **Documentation**: 100% of components have usage examples

---

## Architecture Overview

### High-Level Architecture

```
┌───────────────────────────────────────────────────────────┐
│                 Component Library                         │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │        Base Components (shadcn/ui)                  │ │
│  │  • Button, Input, Card, Dialog                      │ │
│  │  • Built on Radix UI primitives                     │ │
│  │  • Styled with Tailwind CSS                         │ │
│  └────────────────────┬────────────────────────────────┘ │
│                       │                                   │
│  ┌────────────────────▼────────────────────────────────┐ │
│  │      Composite Components                           │ │
│  │  • FormField (Input + Label + Error)                │ │
│  │  • DataTable (Table + Pagination + Filters)         │ │
│  │  • Modal (Dialog + Header + Footer + Actions)       │ │
│  └────────────────────┬────────────────────────────────┘ │
│                       │                                   │
│  ┌────────────────────▼────────────────────────────────┐ │
│  │      Domain-Specific Components                     │ │
│  │  • SecretCard (displays secret metadata)            │ │
│  │  • ProjectSelector (dropdown + project list)        │ │
│  │  • AIChat (message list + input)                    │ │
│  │  • EncryptedInput (input with encryption status)    │ │
│  └────────────────────┬────────────────────────────────┘ │
│                       │                                   │
│  ┌────────────────────▼────────────────────────────────┐ │
│  │      Layout Components                              │ │
│  │  • Header, Sidebar, Footer                          │ │
│  │  • Container, Stack, Grid                           │ │
│  │  • PageLayout, AuthLayout, AppLayout                │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### Key Components

**Component Layer 1: Base Components (shadcn/ui)**
- **Purpose:** Foundational UI primitives built on Radix UI
- **Technology:** React 18.3.x, Radix UI 1.x, Tailwind CSS 3.4.x
- **Responsibilities:**
  - Accessibility (ARIA labels, keyboard navigation)
  - Consistent styling
  - Basic interaction patterns
  - Dark mode support

**Component Layer 2: Composite Components**
- **Purpose:** Combine base components into common patterns
- **Technology:** React 18.3.x, React Hook Form 7.x, Zod 3.x
- **Responsibilities:**
  - Form field composition (label + input + error)
  - Complex UI patterns (data tables, modals)
  - Validation integration
  - State management for interactive patterns

**Component Layer 3: Domain-Specific Components**
- **Purpose:** Abyrith-specific business logic components
- **Technology:** React 18.3.x, React Query 5.x, Web Crypto API
- **Responsibilities:**
  - Secret management UI
  - Project and environment selection
  - AI assistant interface
  - Encryption-aware inputs

**Component Layer 4: Layout Components**
- **Purpose:** Page structure and responsive layouts
- **Technology:** React 18.3.x, Next.js 14.2.x (layouts), Tailwind CSS
- **Responsibilities:**
  - Responsive design
  - Navigation structure
  - Content spacing and hierarchy
  - Authentication-aware layouts

### Component Interactions

**Base Components ↔ Composite Components:**
- Protocol: React component composition (props)
- Data format: TypeScript interfaces
- Composite components render base components with enhanced functionality

**Composite Components ↔ Domain Components:**
- Protocol: React component composition
- Data format: Typed props, callbacks for events
- Domain components use composite patterns with business logic

**Domain Components ↔ React Query/Zustand:**
- Protocol: React hooks
- Data format: JavaScript objects (encrypted data remains encrypted)
- Components consume data from state management layers

---

## Component Details

### Component Naming Conventions

**File Naming:**
```
components/
├── ui/                    # Base components (shadcn/ui)
│   ├── button.tsx        # PascalCase for component
│   ├── input.tsx
│   └── card.tsx
├── forms/                # Composite form components
│   ├── FormField.tsx
│   └── FormError.tsx
├── secrets/              # Domain-specific (secrets)
│   ├── SecretCard.tsx
│   ├── SecretList.tsx
│   └── CreateSecretDialog.tsx
├── projects/             # Domain-specific (projects)
│   ├── ProjectSelector.tsx
│   └── ProjectSettings.tsx
├── ai/                   # Domain-specific (AI)
│   ├── AIChat.tsx
│   ├── MessageList.tsx
│   └── GuidedAcquisitionFlow.tsx
└── layout/               # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── Footer.tsx
```

**Component Naming Rules:**
- **PascalCase** for component files and exports: `SecretCard.tsx`, `export const SecretCard`
- **Descriptive names** that indicate purpose: `CreateSecretDialog` (not `Dialog1`)
- **Domain prefix** for domain-specific components: `SecretCard`, `ProjectSelector`, `AIChat`
- **No abbreviations** unless universally understood: `Button` (not `Btn`), `AI` is okay
- **Variant suffix** when needed: `ButtonPrimary`, `ButtonSecondary` (or use variant prop)

**Props Naming:**
```typescript
// DO: Descriptive, clear intent
<Button onClick={handleSave} disabled={isLoading} variant="primary">
  Save Secret
</Button>

// DON'T: Abbreviations, unclear names
<Btn cb={fn} dis={loading} v="p">
  Save
</Btn>
```

### Component Organization

**Base Components (shadcn/ui)**

All base components come from shadcn/ui, installed via CLI:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add form
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add toast
```

**Location:** `components/ui/`

**Key Base Components:**
- `Button` - All button variants
- `Input` - Text, email, password inputs
- `Card` - Content containers
- `Dialog` - Modals and dialogs
- `DropdownMenu` - Dropdown menus
- `Form` - Form container (React Hook Form integration)
- `Label` - Form labels
- `Select` - Select dropdowns
- `Tabs` - Tab navigation
- `Toast` - Notifications

---

### Component Catalog

#### 1. SecretCard

**Purpose:** Display a secret's metadata (name, service, environment, tags) with actions (view, edit, delete, copy).

**Location:** `components/secrets/SecretCard.tsx`

**Props:**
```typescript
interface SecretCardProps {
  secret: {
    id: string;
    name: string;
    service_name: string;
    environment: 'development' | 'staging' | 'production';
    tags: string[];
    created_at: string;
    updated_at: string;
    last_accessed_at?: string;
  };
  onView: (secretId: string) => void;
  onEdit: (secretId: string) => void;
  onDelete: (secretId: string) => void;
  onCopy: (secretId: string) => void;
  showActions?: boolean;
  className?: string;
}
```

**Usage Example:**
```tsx
import { SecretCard } from '@/components/secrets/SecretCard';

function SecretsPage() {
  const { data: secrets } = useSecrets(projectId);

  return (
    <div className="grid gap-4">
      {secrets.map((secret) => (
        <SecretCard
          key={secret.id}
          secret={secret}
          onView={handleViewSecret}
          onEdit={handleEditSecret}
          onDelete={handleDeleteSecret}
          onCopy={handleCopySecret}
        />
      ))}
    </div>
  );
}
```

**Accessibility:**
- Keyboard navigable (tab to card, enter to expand)
- Screen reader announces secret name, service, environment
- Action buttons have aria-labels
- Focus visible indicator

**Visual States:**
- Default: White background (dark: dark gray)
- Hover: Subtle shadow increase
- Focus: Blue outline
- Disabled: Opacity 50%, no hover effects

---

#### 2. ProjectSelector

**Purpose:** Dropdown menu for selecting the active project, showing project name, environment count, and quick create option.

**Location:** `components/projects/ProjectSelector.tsx`

**Props:**
```typescript
interface ProjectSelectorProps {
  projects: Array<{
    id: string;
    name: string;
    organization_id: string;
    environment_count: number;
  }>;
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  isLoading?: boolean;
  className?: string;
}
```

**Usage Example:**
```tsx
import { ProjectSelector } from '@/components/projects/ProjectSelector';
import { useProjects } from '@/lib/hooks/useProjects';

function Header() {
  const { data: projects, isLoading } = useProjects();
  const [activeProjectId, setActiveProjectId] = useActiveProject();

  return (
    <ProjectSelector
      projects={projects || []}
      activeProjectId={activeProjectId}
      onSelectProject={setActiveProjectId}
      onCreateProject={() => router.push('/projects/new')}
      isLoading={isLoading}
    />
  );
}
```

**Accessibility:**
- Keyboard navigable (arrow keys to navigate projects)
- Screen reader announces "Project selector, [active project name]"
- ARIA roles: `combobox`, `listbox`, `option`
- Focus trap within dropdown when open

---

#### 3. AIChat

**Purpose:** Conversational AI assistant interface with message history, input, and thinking indicators.

**Location:** `components/ai/AIChat.tsx`

**Props:**
```typescript
interface AIChatProps {
  conversationId?: string;
  initialMessages?: Message[];
  onSendMessage: (content: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  thinking?: boolean;
}
```

**Usage Example:**
```tsx
import { AIChat } from '@/components/ai/AIChat';
import { useAIConversation } from '@/lib/hooks/useAIConversation';

function AIAssistantPage() {
  const { messages, sendMessage, isThinking } = useAIConversation();

  return (
    <div className="h-full">
      <AIChat
        initialMessages={messages}
        onSendMessage={sendMessage}
        placeholder="Ask me anything about API keys..."
      />
    </div>
  );
}
```

**Accessibility:**
- Live region for new messages (screen reader announces)
- Keyboard navigable (tab through messages, focus on input)
- Message timestamps announced
- Thinking indicator announced ("Assistant is thinking...")

**Features:**
- Auto-scroll to latest message
- Markdown rendering for code blocks
- Copy code button in code blocks
- Thinking indicator (animated dots)
- Message editing (user messages)
- Message regeneration (assistant messages)

---

#### 4. EncryptedInput

**Purpose:** Password input with encryption readiness indicator and reveal/hide toggle.

**Location:** `components/secrets/EncryptedInput.tsx`

**Props:**
```typescript
interface EncryptedInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  encryptionReady: boolean; // Master key available
  showEncryptionBadge?: boolean;
  className?: string;
}
```

**Usage Example:**
```tsx
import { EncryptedInput } from '@/components/secrets/EncryptedInput';
import { useAuthStore } from '@/lib/stores/authStore';

function CreateSecretForm() {
  const [value, setValue] = useState('');
  const masterKeyReady = useAuthStore((s) => s.masterKeyReady);

  return (
    <form>
      <EncryptedInput
        value={value}
        onChange={setValue}
        label="Secret Value"
        placeholder="sk_test_..."
        encryptionReady={masterKeyReady}
        showEncryptionBadge
        required
      />
    </form>
  );
}
```

**Accessibility:**
- Label associated with input (htmlFor)
- Error announced by screen reader
- Reveal/hide button has aria-label "Show password" / "Hide password"
- Encryption badge has aria-label "End-to-end encrypted"

**Visual Indicators:**
- 🔒 Green badge: "Encrypted" (master key ready)
- ⚠️ Yellow badge: "Encryption not ready" (master key not available)
- 👁️ Eye icon: Reveal/hide password

---

#### 5. CreateSecretDialog

**Purpose:** Modal dialog for creating a new secret with form validation and encryption.

**Location:** `components/secrets/CreateSecretDialog.tsx`

**Props:**
```typescript
interface CreateSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: (secret: Secret) => void;
}
```

**Usage Example:**
```tsx
import { CreateSecretDialog } from '@/components/secrets/CreateSecretDialog';

function SecretsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        Add Secret
      </Button>

      <CreateSecretDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={currentProjectId}
        onSuccess={(secret) => {
          toast.success(`Secret "${secret.name}" created`);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
```

**Form Fields:**
- Secret Name (required)
- Service Name (required, autocomplete from known services)
- Environment (required, select: development/staging/production)
- Secret Value (required, encrypted input)
- Tags (optional, multi-select or comma-separated)

**Validation (Zod):**
```typescript
const createSecretSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  service_name: z.string().min(1, 'Service name is required'),
  environment: z.enum(['development', 'staging', 'production']),
  value: z.string().min(1, 'Secret value is required'),
  tags: z.array(z.string()).optional(),
});
```

---

#### 6. MessageList

**Purpose:** Scrollable list of AI conversation messages with message bubbles.

**Location:** `components/ai/MessageList.tsx`

**Props:**
```typescript
interface MessageListProps {
  messages: Message[];
  isThinking?: boolean;
  onRetry?: (messageId: string) => void;
  className?: string;
}
```

**Usage Example:**
```tsx
import { MessageList } from '@/components/ai/MessageList';

function AIChat({ messages, isThinking, onRetry }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto">
      <MessageList
        messages={messages}
        isThinking={isThinking}
        onRetry={onRetry}
      />
      <div ref={messagesEndRef} />
    </div>
  );
}
```

**Message Types:**
- **User message**: Right-aligned, blue background
- **Assistant message**: Left-aligned, gray background
- **System message**: Centered, italic, small text
- **Error message**: Red border, error icon

**Features:**
- Markdown rendering (react-markdown)
- Code syntax highlighting (highlight.js)
- Copy code button
- Message timestamp (relative time)
- Retry button for failed messages

---

#### 7. GuidedAcquisitionFlow

**Purpose:** Step-by-step wizard for acquiring API keys from external services.

**Location:** `components/ai/GuidedAcquisitionFlow.tsx`

**Props:**
```typescript
interface GuidedAcquisitionFlowProps {
  serviceName: string;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    type: 'instruction' | 'link' | 'input' | 'verify';
    content?: string;
    url?: string;
    inputLabel?: string;
  }>;
  onComplete: (apiKey: string) => void;
  onCancel: () => void;
}
```

**Usage Example:**
```tsx
import { GuidedAcquisitionFlow } from '@/components/ai/GuidedAcquisitionFlow';

function AcquisitionPage() {
  const { data: steps } = useAcquisitionSteps('stripe');

  return (
    <GuidedAcquisitionFlow
      serviceName="Stripe"
      steps={steps}
      onComplete={(apiKey) => {
        createSecret({ name: 'Stripe API Key', value: apiKey });
        router.push('/secrets');
      }}
      onCancel={() => router.back()}
    />
  );
}
```

**Step Types:**
- **instruction**: Text with optional image
- **link**: External link to open (opens in new tab)
- **input**: Input field for user to paste API key
- **verify**: Verify API key works (test request)

**Progress Indicator:**
- Step counter: "Step 2 of 5"
- Progress bar: 40% complete
- Step labels: Active (blue), Completed (green), Pending (gray)

---

#### 8. FormField

**Purpose:** Composite form field with label, input, error message, and description.

**Location:** `components/forms/FormField.tsx`

**Props:**
```typescript
interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ value: string; label: string }>; // For select
  className?: string;
}
```

**Usage Example:**
```tsx
import { FormField } from '@/components/forms/FormField';
import { useForm } from 'react-hook-form';

function ProjectForm() {
  const { register, formState: { errors } } = useForm();

  return (
    <form>
      <FormField
        label="Project Name"
        {...register('name')}
        placeholder="My Awesome Project"
        description="A unique name for your project"
        error={errors.name?.message}
        required
      />
    </form>
  );
}
```

---

#### 9. DataTable

**Purpose:** Table with sorting, filtering, pagination, and column configuration.

**Location:** `components/ui/DataTable.tsx`

**Props:**
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: Array<{
    id: string;
    header: string;
    accessor: keyof T | ((row: T) => React.ReactNode);
    sortable?: boolean;
    width?: string;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}
```

**Usage Example:**
```tsx
import { DataTable } from '@/components/ui/DataTable';

function AuditLogsPage() {
  const { data: logs, page, setPage } = useAuditLogs();

  return (
    <DataTable
      data={logs.data}
      columns={[
        { id: 'timestamp', header: 'Time', accessor: 'timestamp', sortable: true },
        { id: 'user', header: 'User', accessor: 'user_email' },
        { id: 'action', header: 'Action', accessor: 'action' },
        { id: 'resource', header: 'Resource', accessor: 'resource_name' },
      ]}
      pagination={{
        page,
        pageSize: 20,
        total: logs.total,
        onPageChange: setPage,
      }}
      onSort={handleSort}
      emptyMessage="No audit logs found"
    />
  );
}
```

---

#### 10. Header

**Purpose:** Top navigation with logo, project selector, user menu, and theme toggle.

**Location:** `components/layout/Header.tsx`

**Props:**
```typescript
interface HeaderProps {
  user: User;
  onLogout: () => void;
  showProjectSelector?: boolean;
  className?: string;
}
```

**Usage Example:**
```tsx
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/hooks/useAuth';

function AppLayout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-screen">
      <Header user={user} onLogout={logout} showProjectSelector />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

**Header Elements:**
- Logo (left)
- Project selector (left-center)
- Search bar (center) - future
- Theme toggle (right)
- Notifications icon (right) - future
- User menu (right): Profile, Settings, Logout

---

## Data Flow

### Flow 1: User Creates Secret via CreateSecretDialog

**Trigger:** User clicks "Add Secret" button, opens CreateSecretDialog.

**Steps:**

1. **User fills form:**
   ```tsx
   <CreateSecretDialog open={true} projectId="proj_123" />
   ```

2. **Form validation (Zod):**
   ```typescript
   const result = createSecretSchema.safeParse(formData);
   if (!result.success) {
     setErrors(result.error.formErrors.fieldErrors);
     return;
   }
   ```

3. **Encrypt secret value client-side:**
   ```typescript
   const masterKey = await getMasterKey();
   const encryptedValue = await encrypt(formData.value, masterKey);
   ```

4. **Call API via React Query mutation:**
   ```typescript
   const { mutate: createSecret } = useCreateSecret();
   createSecret({
     ...formData,
     encrypted_value: encryptedValue,
   });
   ```

5. **Optimistic update (React Query):**
   - Secret appears in UI immediately
   - If API call fails, rollback

6. **Success callback:**
   ```typescript
   onSuccess={(secret) => {
     toast.success(`Secret "${secret.name}" created`);
     onOpenChange(false);
   }}
   ```

---

### Flow 2: User Interacts with AIChat

**Trigger:** User types message and presses Enter.

**Steps:**

1. **User sends message:**
   ```tsx
   <AIChat onSendMessage={async (content) => {
     await sendMessage(content);
   }} />
   ```

2. **Message added to UI (optimistic):**
   ```typescript
   setMessages((prev) => [
     ...prev,
     { id: tempId, role: 'user', content, timestamp: now() }
   ]);
   ```

3. **Call Claude API:**
   ```typescript
   const response = await fetch('/api/ai/chat', {
     method: 'POST',
     body: JSON.stringify({ conversationId, message: content }),
   });
   ```

4. **Assistant response streamed (future: SSE):**
   ```typescript
   // For MVP: Single response
   const { message: assistantMessage } = await response.json();
   setMessages((prev) => [
     ...prev,
     { id: uuid(), role: 'assistant', content: assistantMessage, timestamp: now() }
   ]);
   ```

5. **MessageList auto-scrolls to bottom:**
   ```typescript
   useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   }, [messages]);
   ```

---

## API Contracts

### Component Props Types

All components use TypeScript interfaces for props. Shared types are exported from `types/index.ts`.

**Common Types:**
```typescript
// types/index.ts
export interface Secret {
  id: string;
  name: string;
  service_name: string;
  encrypted_value: string;
  decrypted_value?: string; // Only available after decryption
  environment: 'development' | 'staging' | 'production';
  tags: string[];
  project_id: string;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
}

export interface Project {
  id: string;
  name: string;
  organization_id: string;
  environment_count: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  thinking?: boolean;
  error?: string;
}
```

---

## Security Architecture

### Trust Boundaries

**Component Layer ↔ State Management:**
- **Threats:** XSS via unsanitized user input in component rendering
- **Controls:**
  - React escapes JSX by default
  - No `dangerouslySetInnerHTML` except for sanitized markdown
  - Zod validation on all form inputs
  - CSP headers prevent inline scripts

**EncryptedInput ↔ Encryption Layer:**
- **Threats:** Plaintext secret exposure in memory or logs
- **Controls:**
  - Plaintext only in component state (cleared on unmount)
  - Never log secret values
  - Master key stored in CryptoKey object (non-extractable)
  - Auto-clear input on page unload

### Data Security

**Sensitive Props:**
- `secret.decrypted_value` - Only passed to components when explicitly requested
- `masterPassword` - Never passed as prop, only used in derivation function
- `encryptedValue` - Safe to display, but clearly marked as encrypted

**Sanitization:**
- All user input sanitized via Zod schemas
- Markdown rendering uses `react-markdown` with `rehype-sanitize`
- No raw HTML rendering

---

## Performance Characteristics

### Performance Requirements

**Component Rendering:**
- Initial render: < 50ms for simple components (Button, Input)
- Initial render: < 200ms for complex components (DataTable, AIChat)
- Re-render: < 16ms (60fps) for interactive components

**Bundle Size Impact:**
- Base components (shadcn/ui): ~50KB gzipped
- Domain components: ~40KB gzipped
- Total component library: < 100KB gzipped

### Performance Optimization

**Optimizations implemented:**
- **React.memo** for expensive components (SecretCard, MessageList)
- **useMemo** for computed values (filtered lists, sorted data)
- **useCallback** for event handlers passed as props
- **Code splitting**: Domain components lazy loaded per route
- **Tree shaking**: Import only used components

**Example Optimization:**
```tsx
// Memoize SecretCard to prevent re-render when props unchanged
export const SecretCard = React.memo(({ secret, onView, onEdit, onDelete }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if secret ID or actions change
  return prevProps.secret.id === nextProps.secret.id &&
         prevProps.onView === nextProps.onView;
});
```

---

## Scalability

### Component Reusability

**Composition over inheritance:**
- Base components are building blocks
- Composite components combine base components
- Domain components use composite patterns

**Example: Building SecretCard from base components:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function SecretCard({ secret, onView, onEdit, onDelete }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{secret.name}</CardTitle>
        <CardDescription>{secret.service_name}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Badge>{secret.environment}</Badge>
          {secret.tags.map(tag => <Badge key={tag} variant="outline">{tag}</Badge>)}
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => onView(secret.id)}>View</Button>
          <Button onClick={() => onEdit(secret.id)} variant="outline">Edit</Button>
          <Button onClick={() => onDelete(secret.id)} variant="destructive">Delete</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Failure Modes

### Failure Mode 1: Component Props Type Mismatch

**Scenario:** Developer passes incorrect prop type to component.

**Impact:** TypeScript error at build time, component doesn't render correctly.

**Detection:** TypeScript compiler catches at development time.

**Recovery:**
1. Fix prop type in calling code
2. If prop interface changed, update all usages
3. Run TypeScript check: `pnpm tsc --noEmit`

**Prevention:**
- Strict TypeScript config (`strict: true`)
- Required props marked as non-optional
- JSDoc comments for complex prop types

---

### Failure Mode 2: Missing Encryption Key in EncryptedInput

**Scenario:** User tries to create secret but master key is not available.

**Impact:** Cannot encrypt secret, form submission fails.

**Detection:** `encryptionReady` prop is `false`.

**Recovery:**
1. EncryptedInput shows warning badge: "Encryption not ready"
2. Form submit button disabled
3. Prompt user to unlock master key
4. After unlock, form becomes available

**Prevention:**
- Check `masterKeyReady` state before rendering create form
- Prompt for master password on page load if needed

---

## Alternatives Considered

### Alternative 1: Material-UI instead of shadcn/ui

**Description:** Use Material-UI component library.

**Pros:**
- Comprehensive component library
- Well-documented
- Active community

**Cons:**
- Larger bundle size (~200KB+)
- Opinionated styling (harder to customize)
- Package dependency (less control)
- Heavier runtime overhead

**Why not chosen:** shadcn/ui provides full control, smaller bundle, and better performance with copy-paste approach.

---

### Alternative 2: Custom component library from scratch

**Description:** Build all components from scratch without base library.

**Pros:**
- Full control
- Exact customization
- Learning experience

**Cons:**
- Significant development time
- Accessibility challenges (Radix UI provides this)
- Reinventing the wheel
- Maintenance burden

**Why not chosen:** Radix UI provides accessible primitives out of the box, shadcn/ui provides styled versions. Building from scratch would delay MVP significantly.

---

## Decision Log

### Decision 1: shadcn/ui over component library package

**Date:** 2025-10-30

**Context:** Need accessible, customizable components without large bundle size.

**Options:**
1. shadcn/ui (copy-paste approach)
2. Material-UI (package dependency)
3. Chakra UI (package dependency)
4. Custom from scratch

**Decision:** shadcn/ui.

**Rationale:**
- Full control (components are in codebase)
- Smaller bundle size (only what we use)
- Built on Radix UI (accessibility)
- Tailwind CSS integration (consistent with design)
- Easy to customize and extend

**Consequences:**
- Must manually update components when shadcn/ui updates
- More files in codebase
- But: Full control and smaller bundle size worth the tradeoff

---

### Decision 2: React Hook Form + Zod over Formik

**Date:** 2025-10-30

**Context:** Need form library with validation for CreateSecretDialog and other forms.

**Options:**
1. React Hook Form + Zod
2. Formik + Yup
3. Manual form state

**Decision:** React Hook Form + Zod.

**Rationale:**
- Better performance (fewer re-renders)
- TypeScript-first validation (Zod)
- Smaller bundle size
- Better DevTools support
- Type inference from Zod schemas

**Consequences:**
- Learning curve if team knows Formik
- But: Performance and TypeScript benefits outweigh

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `07-frontend/frontend-architecture.md` - Frontend architecture patterns
- [x] `TECH-STACK.md` - Technology decisions (React, Tailwind, shadcn/ui)
- [x] `GLOSSARY.md` - Standard terminology

**External Packages:**
- `react` 18.3.x
- `react-dom` 18.3.x
- `next` 14.2.x
- `tailwindcss` 3.4.x
- `@radix-ui/*` 1.x (via shadcn/ui)
- `lucide-react` (icons)
- `react-hook-form` 7.x
- `zod` 3.x
- `react-markdown` (for AIChat)
- `clsx` + `tailwind-merge` (className utilities)

### Architecture Dependencies

**Depends on these patterns:**
- State management (Zustand, React Query) from `07-frontend/frontend-architecture.md`
- Encryption layer from `03-security/encryption-specification.md`
- Design tokens (colors, spacing) from Tailwind config

**Required by:**
- All frontend features (secrets, projects, AI, team)
- Storybook (future)
- Testing (component tests)

---

## References

### Internal Documentation
- `07-frontend/frontend-architecture.md` - Frontend architecture overview
- `TECH-STACK.md` - Technology stack decisions
- `GLOSSARY.md` - Technical term definitions
- `03-security/encryption-specification.md` - Client-side encryption details

### External Resources
- [shadcn/ui Documentation](https://ui.shadcn.com) - Component library source
- [Radix UI Documentation](https://www.radix-ui.com) - Accessibility primitives
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Styling framework
- [React Hook Form](https://react-hook-form.com) - Form handling
- [Zod Documentation](https://zod.dev) - Schema validation
- [Lucide Icons](https://lucide.dev) - Icon library
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility standards

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial component library architecture document |

---

## Notes

### Storybook Integration (Future)

**When to implement:** After MVP, for component catalog and visual regression testing.

**Setup:**
```bash
pnpm add -D @storybook/react @storybook/addon-essentials
npx storybook@latest init
```

**Story example:**
```tsx
// components/secrets/SecretCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { SecretCard } from './SecretCard';

const meta: Meta<typeof SecretCard> = {
  title: 'Secrets/SecretCard',
  component: SecretCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SecretCard>;

export const Default: Story = {
  args: {
    secret: {
      id: 'secret_123',
      name: 'Stripe API Key',
      service_name: 'Stripe',
      environment: 'development',
      tags: ['payment', 'api-key'],
      created_at: '2025-10-29T12:00:00Z',
      updated_at: '2025-10-29T12:00:00Z',
    },
    onView: (id) => console.log('View', id),
    onEdit: (id) => console.log('Edit', id),
    onDelete: (id) => console.log('Delete', id),
    onCopy: (id) => console.log('Copy', id),
  },
};
```

### Component Testing Strategy

**Unit tests (Vitest + Testing Library):**
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SecretCard } from './SecretCard';

describe('SecretCard', () => {
  it('renders secret name and service', () => {
    render(<SecretCard secret={mockSecret} {...mockHandlers} />);
    expect(screen.getByText('Stripe API Key')).toBeInTheDocument();
    expect(screen.getByText('Stripe')).toBeInTheDocument();
  });

  it('calls onView when View button clicked', () => {
    const onView = vi.fn();
    render(<SecretCard secret={mockSecret} onView={onView} {...mockHandlers} />);
    fireEvent.click(screen.getByText('View'));
    expect(onView).toHaveBeenCalledWith('secret_123');
  });
});
```

### Accessibility Testing

**Automated tests (axe-core):**
```tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SecretCard } from './SecretCard';

expect.extend(toHaveNoViolations);

test('SecretCard has no accessibility violations', async () => {
  const { container } = render(<SecretCard secret={mockSecret} {...mockHandlers} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Dark Mode Implementation

All components support dark mode via Tailwind's `dark:` variant:

```tsx
<Card className="bg-white dark:bg-gray-800">
  <CardTitle className="text-gray-900 dark:text-gray-100">
    {secret.name}
  </CardTitle>
</Card>
```

**Theme toggle:**
```tsx
import { useTheme } from 'next-themes';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      variant="ghost"
      size="icon"
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
```

### Next Review Date
2025-11-30 (review after initial component implementation)
