# AI Chat Components

This directory contains the complete AI chat interface for Abyrith's AI Assistant feature.

## Components

### 1. ChatInterface (`ChatInterface.tsx`)
Main container component that orchestrates the entire chat experience.

**Features:**
- Message list with auto-scroll
- Context panel showing current project/environment
- Chat history sidebar
- Welcome screen with suggested prompts
- Responsive layout (mobile + desktop)

**Usage:**
```tsx
import { ChatInterface } from '@/components/ai';

export default function AIPage() {
  return <ChatInterface />;
}
```

### 2. ChatMessage (`ChatMessage.tsx`)
Individual message bubble component with role-based styling.

**Features:**
- User messages (right-aligned, blue)
- AI messages (left-aligned, gray)
- System messages (centered, muted)
- Markdown-like formatting (bold, code, links)
- Timestamps with relative display
- Metadata display (model, tokens)

**Props:**
```tsx
interface ChatMessageProps {
  message: Message;
}
```

### 3. ChatInput (`ChatInput.tsx`)
Message input component with auto-grow textarea and send button.

**Features:**
- Auto-resizing textarea (max 200px)
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Character count indicator (shows at 80% of limit)
- Send button (disabled when empty or submitting)
- Input validation

**Props:**
```tsx
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

### 4. ChatHistory (`ChatHistory.tsx`)
Sidebar component displaying conversation history.

**Features:**
- List of all conversations
- New conversation button
- Delete conversation (with confirmation)
- Current conversation highlighting
- Project context indicator
- Mobile-responsive (slide-out drawer)
- Empty state

**Usage:**
```tsx
import { ChatHistory } from '@/components/ai';

<ChatHistory />
```

### 5. ContextPanel (`ContextPanel.tsx`)
Header component showing current project/environment context.

**Features:**
- Display current project and environment
- Set/clear context actions
- Quick action buttons (add secret, view secrets, etc.)
- Context help tooltip
- Integration with project store

**Usage:**
```tsx
import { ContextPanel } from '@/components/ai';

<ContextPanel />
```

### 6. TypingIndicator (`TypingIndicator.tsx`)
Animated indicator showing AI is processing a response.

**Features:**
- Animated bouncing dots
- "AI is thinking..." text
- Smooth appearance/disappearance

**Usage:**
```tsx
import { TypingIndicator } from '@/components/ai';

{isTyping && <TypingIndicator />}
```

## State Management

### AI Store (`lib/stores/ai-store.ts`)

Zustand store managing all AI chat state.

**State:**
```tsx
interface AIState {
  // Current conversation
  currentConversation: Conversation | null;
  conversations: Conversation[];

  // UI state
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;

  // Context
  contextProjectId: string | null;
  contextEnvironmentId: string | null;
}
```

**Actions:**
- `createConversation(title?)` - Create new conversation
- `setCurrentConversation(id)` - Switch to conversation
- `loadConversations()` - Load conversation history
- `sendMessage(content)` - Send message (mock for now)
- `addMessage(message)` - Add message to current conversation
- `setTyping(isTyping)` - Toggle typing indicator
- `setContext(projectId, environmentId)` - Set current context
- `clearCurrentConversation()` - Clear current conversation
- `deleteConversation(id)` - Delete conversation

**Usage:**
```tsx
import { useAIStore } from '@/lib/stores/ai-store';

const {
  currentConversation,
  isTyping,
  sendMessage,
  createConversation,
} = useAIStore();
```

## Data Types

### Message
```tsx
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    context?: {
      projectId?: string;
      environmentId?: string;
      secretId?: string;
    };
  };
}
```

### Conversation
```tsx
interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  projectId?: string;
  environmentId?: string;
}
```

## Mock Data

Currently using mock responses for AI messages. The `sendMessage` action in the AI store includes a `generateMockResponse()` function that provides contextual responses based on keywords.

**Mock Response Logic:**
- Detects "api key" or "secret" → Guided acquisition response
- Detects "openai" → OpenAI-specific acquisition steps
- Detects "help" → Feature overview
- Default → General prompt for more info

**To Replace with Real API:**
1. Update `sendMessage` in `ai-store.ts`
2. Add API endpoint calls to Cloudflare Worker
3. Implement streaming for real-time responses
4. Handle errors and retries

## Testing the Components

### Local Testing

1. **Navigate to AI page:**
   ```
   http://localhost:3000/dashboard/ai
   ```

2. **Test scenarios:**
   - Create new conversation
   - Send various messages (see suggested prompts)
   - Switch between conversations
   - Delete conversations
   - Set project context
   - Test on mobile (responsive sidebar)

### Manual Testing Checklist

- [ ] Chat interface loads without errors
- [ ] Can send message and see response
- [ ] Typing indicator appears and disappears
- [ ] Messages scroll automatically
- [ ] Context panel shows current project
- [ ] Can switch contexts
- [ ] Chat history shows all conversations
- [ ] Can create new conversation
- [ ] Can delete conversation (with confirmation)
- [ ] Suggested prompts work on welcome screen
- [ ] Markdown formatting displays correctly (bold, code, links)
- [ ] Timestamps format correctly
- [ ] Character counter shows at 80% capacity
- [ ] Enter sends message, Shift+Enter adds newline
- [ ] Mobile sidebar slides out correctly
- [ ] All components responsive on mobile

## Styling

All components use:
- **Tailwind CSS** for styling
- **shadcn/ui** design tokens (primary, muted, etc.)
- Dark mode support (via Tailwind dark: prefix)
- Responsive breakpoints (md: for desktop)

**Design patterns:**
- User messages: `bg-primary text-primary-foreground`
- AI messages: `bg-muted text-foreground`
- System messages: `text-muted-foreground`
- Hover states: `hover:bg-accent`
- Borders: `border border-input`

## Future Enhancements

### Backend Integration
- [ ] Connect to Cloudflare Workers API
- [ ] Implement Claude API streaming
- [ ] Persist conversations to Supabase
- [ ] Add conversation search
- [ ] Implement token usage tracking

### Features
- [ ] Message editing/regeneration
- [ ] Conversation export (JSON, Markdown)
- [ ] Voice input
- [ ] Image upload for context
- [ ] Code syntax highlighting
- [ ] Copy code blocks
- [ ] Conversation sharing
- [ ] AI model selection

### UX Improvements
- [ ] Loading skeleton states
- [ ] Error retry mechanism
- [ ] Offline support
- [ ] Keyboard navigation
- [ ] Accessibility improvements (ARIA labels)
- [ ] Message reactions
- [ ] Conversation folders/tags

## Performance Considerations

- **Auto-scroll:** Uses `scrollIntoView({ behavior: 'smooth' })`
- **Message rendering:** Efficient re-renders with proper keys
- **State updates:** Zustand ensures minimal re-renders
- **Textarea auto-grow:** Limited to 200px max height
- **Conversation limit:** No limit yet (TODO: pagination)

## Accessibility

- Semantic HTML structure
- Keyboard navigation support (Enter, Shift+Enter)
- Focus management
- TODO: Add ARIA labels for screen readers
- TODO: Test with screen readers

## Browser Support

Tested on:
- Chrome 100+
- Firefox 100+
- Safari 15+
- Mobile Safari 15+
- Edge 100+

## Dependencies

- React 18
- Next.js 14
- Zustand (state management)
- Tailwind CSS
- shadcn/ui components (Button, Input)

## File Structure

```
components/ai/
├── ChatInterface.tsx     # Main container
├── ChatMessage.tsx       # Message bubbles
├── ChatInput.tsx         # Input area
├── ChatHistory.tsx       # Sidebar
├── ContextPanel.tsx      # Context header
├── TypingIndicator.tsx   # Loading animation
├── index.ts              # Exports
└── README.md             # This file

lib/stores/
└── ai-store.ts           # AI state management

app/dashboard/ai/
└── page.tsx              # AI assistant page
```

## Contributing

When adding new features:
1. Follow existing component patterns
2. Use TypeScript for type safety
3. Add props documentation
4. Update this README
5. Test on mobile and desktop
6. Ensure dark mode compatibility
