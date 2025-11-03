# AI Chat Components - Architecture

## Component Hierarchy

```
ChatInterface (Main Container)
│
├── ChatHistory (Sidebar - Desktop: Fixed, Mobile: Slide-out)
│   ├── Header
│   │   └── Button: "New Conversation"
│   │
│   ├── Conversation List
│   │   └── ConversationItem (for each conversation)
│   │       ├── Title
│   │       ├── Message Count
│   │       ├── Last Updated
│   │       ├── Delete Button
│   │       └── Project Context Badge (if applicable)
│   │
│   └── Footer
│       └── Conversation Count
│
├── Main Chat Column
│   │
│   ├── ContextPanel (Header)
│   │   ├── Current Context Display
│   │   │   ├── Project Name
│   │   │   ├── Environment Badge
│   │   │   └── Clear Button
│   │   │
│   │   ├── Set Context Button (if no context)
│   │   │
│   │   ├── Quick Actions (when context set)
│   │   │   ├── Add Secret
│   │   │   ├── View Secrets
│   │   │   └── Security Audit
│   │   │
│   │   └── Help Tooltip
│   │
│   ├── Messages Area (Scrollable)
│   │   │
│   │   ├── Welcome Screen (if no messages)
│   │   │   ├── Icon
│   │   │   ├── Title
│   │   │   ├── Description
│   │   │   └── Suggested Prompts Grid
│   │   │       ├── Get API Key
│   │   │       ├── Explore Features
│   │   │       ├── Organization Tips
│   │   │       └── Security Overview
│   │   │
│   │   ├── Message List
│   │   │   └── ChatMessage (for each message)
│   │   │       ├── Role-based Layout
│   │   │       │   ├── User: Right-aligned, Blue
│   │   │       │   ├── Assistant: Left-aligned, Gray
│   │   │       │   └── System: Centered, Muted
│   │   │       │
│   │   │       ├── Content
│   │   │       │   ├── Formatted Text (Markdown-like)
│   │   │       │   ├── Bold (**text**)
│   │   │       │   ├── Code (`code`)
│   │   │       │   └── Links ([text](url))
│   │   │       │
│   │   │       ├── Metadata (AI only)
│   │   │       │   ├── Model Name
│   │   │       │   └── Token Count
│   │   │       │
│   │   │       └── Timestamp
│   │   │           ├── Relative ("5m ago")
│   │   │           └── Absolute (older messages)
│   │   │
│   │   ├── TypingIndicator (when AI is responding)
│   │   │   ├── Animated Dots (3)
│   │   │   └── "AI is thinking..." text
│   │   │
│   │   └── Scroll Anchor (auto-scroll target)
│   │
│   └── ChatInput (Footer)
│       ├── Textarea Container
│       │   ├── Auto-grow Textarea
│       │   │   ├── Min Height: 52px
│       │   │   ├── Max Height: 200px
│       │   │   └── Max Length: 2000 chars
│       │   │
│       │   └── Character Counter (>80% capacity)
│       │
│       ├── Send Button
│       │   ├── Disabled when empty
│       │   └── Disabled when typing
│       │
│       └── Keyboard Hints
│           ├── "Enter to send"
│           └── "Shift+Enter for newline"
```

## Data Flow

### Message Send Flow

```
User types in ChatInput
        ↓
    Press Enter
        ↓
ChatInput.onSend(content)
        ↓
ChatInterface.handleSendMessage(content)
        ↓
useAIStore.sendMessage(content)
        ↓
┌───────────────────────────────────────┐
│ AI Store Actions                      │
├───────────────────────────────────────┤
│ 1. Add user message to conversation   │
│    - Generate ID (crypto.randomUUID)  │
│    - Set timestamp                    │
│    - Update conversation              │
│                                       │
│ 2. Set typing indicator = true        │
│                                       │
│ 3. Call API / Mock Response           │
│    - Wait for response                │
│    - Generate mock (or real API)      │
│                                       │
│ 4. Add AI message to conversation     │
│    - Include metadata                 │
│    - Update conversation title        │
│                                       │
│ 5. Set typing indicator = false       │
└───────────────────────────────────────┘
        ↓
React re-renders
        ↓
ChatInterface updates
        ↓
Auto-scroll to bottom
```

### Context Setting Flow

```
User clicks "Set Context"
        ↓
ContextPanel.handleSetContext()
        ↓
useAIStore.setContext(projectId, environmentId)
        ↓
Update store state
        ↓
ContextPanel re-renders
        ↓
Display project + environment
Show quick actions
```

### Conversation Management Flow

```
User clicks "New Conversation"
        ↓
ChatHistory.handleNewConversation()
        ↓
useAIStore.createConversation()
        ↓
┌─────────────────────────────────────┐
│ Create Conversation                 │
├─────────────────────────────────────┤
│ 1. Generate ID                      │
│ 2. Set title: "New Conversation"    │
│ 3. Initialize empty messages array  │
│ 4. Set timestamps                   │
│ 5. Add to conversations list        │
│ 6. Set as current conversation      │
└─────────────────────────────────────┘
        ↓
ChatInterface updates
        ↓
Show welcome screen
(no messages yet)
```

## State Management Architecture

### Zustand Store (ai-store.ts)

```
useAIStore
│
├── State
│   ├── currentConversation: Conversation | null
│   ├── conversations: Conversation[]
│   ├── isTyping: boolean
│   ├── isLoading: boolean
│   ├── error: string | null
│   ├── contextProjectId: string | null
│   └── contextEnvironmentId: string | null
│
└── Actions
    ├── Conversation Management
    │   ├── createConversation(title?)
    │   ├── setCurrentConversation(id)
    │   ├── deleteConversation(id)
    │   ├── loadConversations()
    │   └── clearCurrentConversation()
    │
    ├── Message Management
    │   ├── sendMessage(content)
    │   └── addMessage(message)
    │
    ├── UI State
    │   └── setTyping(isTyping)
    │
    └── Context Management
        └── setContext(projectId, environmentId)
```

### Integration with Other Stores

```
ChatInterface
    │
    ├── useAIStore()
    │   ├── AI state
    │   └── AI actions
    │
    ├── useProjectStore()  (via ContextPanel)
    │   ├── currentProject
    │   └── environments
    │
    └── useAuth()  (via page)
        ├── user
        └── preferences
```

## Responsive Design Strategy

### Desktop (≥768px)

```
┌─────────────────────────────────────────────┐
│ [Sidebar: 256px]  │  [Main Chat: flex-1]   │
│                   │                          │
│ Conversation 1    │  ┌────────────────────┐ │
│ Conversation 2    │  │ Context Panel      │ │
│ ...               │  └────────────────────┘ │
│                   │                          │
│ [New Conv Btn]    │  Messages...            │
│                   │                          │
│                   │  ┌────────────────────┐ │
│                   │  │ Chat Input         │ │
│                   │  └────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Mobile (<768px)

```
┌──────────────────────────────┐
│  [≡] (Toggle Sidebar)        │
│  ┌──────────────────────────┐│
│  │ Context Panel            ││
│  └──────────────────────────┘│
│                              │
│  Messages...                 │
│                              │
│  ┌──────────────────────────┐│
│  │ Chat Input               ││
│  └──────────────────────────┘│
└──────────────────────────────┘

When sidebar opened:
┌──────────────────────────────┐
│ [Overlay: 50% opacity]       │
│   ┌────────────────────┐     │
│   │ Sidebar (256px)    │     │
│   │                    │     │
│   │ Conversations...   │     │
│   │                    │     │
│   └────────────────────┘     │
│                              │
└──────────────────────────────┘
```

## CSS Class Strategy

### Tailwind Utilities Used

**Layout:**
- `flex`, `flex-col`, `flex-1`
- `grid`, `grid-cols-1`, `md:grid-cols-2`
- `max-w-4xl`, `mx-auto`
- `sticky`, `fixed`, `absolute`

**Spacing:**
- `p-4`, `px-4`, `py-3`, `gap-2`
- `mt-2`, `mb-4`, `ml-auto`

**Colors:**
- `bg-background`, `bg-primary`, `bg-muted`
- `text-foreground`, `text-primary-foreground`
- `border-input`, `border-primary`

**States:**
- `hover:bg-accent`
- `disabled:opacity-50`
- `focus-visible:ring-2`

**Responsive:**
- `md:translate-x-0` (desktop: always visible)
- `-translate-x-full` (mobile: hidden by default)
- `md:max-w-[70%]` (message width)

**Animations:**
- `animate-bounce` (typing dots)
- `transition-colors`, `transition-transform`
- `[animation-delay:-0.3s]` (staggered dots)

## Performance Optimizations

### 1. Efficient Re-renders

```typescript
// Zustand ensures components only re-render when their data changes
const { currentConversation } = useAIStore();
// Only re-renders when currentConversation changes
```

### 2. Proper React Keys

```typescript
// All mapped items have stable keys
{messages.map((message) => (
  <ChatMessage key={message.id} message={message} />
))}
```

### 3. Auto-scroll Optimization

```typescript
// Only scroll when messages change
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [currentConversation?.messages, isTyping]);
```

### 4. Textarea Auto-resize

```typescript
// Efficient height calculation
useEffect(() => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}, [message]);
```

### 5. Debounced Updates

- Character counter only shows when >80% full
- Typing indicator batched with state updates

## Accessibility Features

### Keyboard Navigation

- ✅ Enter to send message
- ✅ Shift+Enter for newline
- ✅ Tab navigation through UI
- ✅ Focus visible on all interactive elements

### Semantic HTML

- ✅ `<button>` for all clickable elements
- ✅ `<textarea>` for input
- ✅ Proper heading hierarchy
- ✅ `<nav>` for conversation list

### Future Improvements

- [ ] ARIA labels on buttons
- [ ] ARIA live regions for new messages
- [ ] Screen reader announcements
- [ ] Keyboard shortcuts (Ctrl+N for new conversation)

## Error Handling Strategy

### Current Implementation

```typescript
try {
  await sendMessage(content);
} catch (error) {
  set({ error: error.message });
  setTyping(false);
}
```

### Future Enhancements

- [ ] Retry mechanism (3 attempts)
- [ ] Exponential backoff
- [ ] User-facing error messages
- [ ] Error recovery suggestions
- [ ] Offline detection

## Testing Strategy

### Unit Tests (Future)

```typescript
// Example test structure
describe('ChatMessage', () => {
  it('renders user message correctly', () => {
    const message = { role: 'user', content: 'Hello' };
    // ... assertions
  });

  it('formats markdown correctly', () => {
    const message = { content: '**bold** and `code`' };
    // ... assertions
  });
});
```

### Integration Tests (Future)

```typescript
describe('ChatInterface', () => {
  it('sends message and displays response', async () => {
    // Type message
    // Click send
    // Verify user message appears
    // Verify typing indicator
    // Verify AI response
  });
});
```

### E2E Tests (Future)

- Complete conversation flow
- Context switching
- Conversation management
- Mobile responsive behavior

## Mock Data System

### generateMockResponse() Logic

```
Input: User message (string)
    ↓
Convert to lowercase
    ↓
Check keywords:
    ├── Contains "api key" or "secret"
    │   └── Return: Guided acquisition response
    │
    ├── Contains "openai"
    │   └── Return: OpenAI-specific steps
    │
    ├── Contains "help"
    │   └── Return: Feature overview
    │
    └── Default
        └── Return: General prompt for more info
```

### Mock Response Examples

**1. API Key Request:**
```
User: "I need an API key"
AI: "I can help you acquire and manage API keys securely.
     To get started, I'll need to know:
     1. Which service do you need an API key for?
     2. What will you use this API key for?"
```

**2. Service-Specific:**
```
User: "OpenAI API key"
AI: "Great! Let me guide you through getting an OpenAI API key:
     Step 1: Visit platform.openai.com
     Step 2: Sign in or create an account
     ..." (full walkthrough)
```

**3. Help Request:**
```
User: "What can you do?"
AI: "I'm your AI assistant for secrets management!
     - API Key Acquisition
     - Secrets Management
     - Best Practices
     ..." (feature list)
```

## Future Architectural Enhancements

### 1. Streaming Response Handler

```typescript
async function handleStreamingResponse(stream: ReadableStream) {
  const reader = stream.getReader();
  let accumulatedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulatedText += value;
    // Update message content in real-time
    updateMessageContent(currentMessageId, accumulatedText);
  }
}
```

### 2. Conversation Persistence

```typescript
// Save to Supabase after each message
async function saveConversation(conversation: Conversation) {
  await supabase
    .from('conversations')
    .upsert({
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
      // ... other fields
    });
}
```

### 3. Context-Aware Suggestions

```typescript
// Generate suggestions based on current context
function getSuggestions(context: Context) {
  if (context.projectId && !hasSecrets(context.projectId)) {
    return ['Add your first secret', 'Import from .env file'];
  }
  // ... more logic
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-02
**Maintained by:** Frontend Components Team
