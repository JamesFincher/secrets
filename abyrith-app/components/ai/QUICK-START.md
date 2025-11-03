# AI Chat Components - Quick Start Guide

## For Developers: How to Use These Components

### Installation

No additional dependencies needed! These components use only the existing project dependencies:
- React 18
- Next.js 14
- Zustand
- Tailwind CSS
- TypeScript

### Using the Complete Chat Interface

**Simplest Usage (Full-Screen):**

```tsx
// app/your-page/page.tsx
'use client';

import { ChatInterface } from '@/components/ai';

export default function AIPage() {
  return <ChatInterface />;
}
```

That's it! The ChatInterface includes everything:
- Message list
- Input area
- Chat history sidebar
- Context panel
- Typing indicator

### Using Individual Components

**Custom Chat Layout:**

```tsx
'use client';

import {
  ChatMessage,
  ChatInput,
  TypingIndicator,
} from '@/components/ai';
import { useAIStore } from '@/lib/stores/ai-store';

export default function CustomChatPage() {
  const { currentConversation, isTyping, sendMessage } = useAIStore();

  return (
    <div className="flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentConversation?.messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isTyping} />
    </div>
  );
}
```

### Using the AI Store

**In any component:**

```tsx
import { useAIStore } from '@/lib/stores/ai-store';

function MyComponent() {
  const {
    currentConversation,
    conversations,
    isTyping,
    sendMessage,
    createConversation,
  } = useAIStore();

  return (
    <div>
      <button onClick={() => createConversation()}>
        New Chat
      </button>

      <button onClick={() => sendMessage('Hello!')}>
        Send Hello
      </button>

      {isTyping && <p>AI is typing...</p>}
    </div>
  );
}
```

### Setting Context

**Connect AI to current project:**

```tsx
import { useAIStore } from '@/lib/stores/ai-store';
import { useProjectStore } from '@/lib/stores/project-store';

function MyComponent() {
  const { setContext } = useAIStore();
  const { currentProject, environments } = useProjectStore();

  // Set context when project changes
  useEffect(() => {
    if (currentProject) {
      const firstEnv = environments[0];
      setContext(currentProject.id, firstEnv?.id || null);
    }
  }, [currentProject]);

  return <div>Context set to {currentProject?.name}</div>;
}
```

## Common Tasks

### 1. Adding a New Message Programmatically

```tsx
const { addMessage } = useAIStore();

addMessage({
  role: 'system',
  content: 'Welcome to Abyrith!',
});
```

### 2. Creating a Conversation with Initial Message

```tsx
const { createConversation, addMessage } = useAIStore();

const conversation = createConversation('API Key Help');
addMessage({
  role: 'assistant',
  content: 'How can I help you with API keys today?',
});
```

### 3. Switching Between Conversations

```tsx
const { setCurrentConversation, conversations } = useAIStore();

// Switch to first conversation
setCurrentConversation(conversations[0].id);
```

### 4. Deleting a Conversation

```tsx
const { deleteConversation } = useAIStore();

deleteConversation(conversationId);
```

### 5. Getting All Messages from Current Conversation

```tsx
const { currentConversation } = useAIStore();

const messages = currentConversation?.messages || [];
```

## Customization Examples

### Custom Welcome Screen

Replace the default welcome screen:

```tsx
// Create your own version of ChatInterface
import { useAIStore } from '@/lib/stores/ai-store';

export function CustomChatInterface() {
  const { currentConversation } = useAIStore();

  return (
    <div>
      {currentConversation?.messages.length === 0 ? (
        <div className="text-center py-12">
          <h2>Your Custom Welcome Message</h2>
          {/* Your custom UI */}
        </div>
      ) : (
        {/* Messages */}
      )}
    </div>
  );
}
```

### Custom Message Styling

```tsx
// Extend ChatMessage with your styles
import { ChatMessage } from '@/components/ai';

function MyCustomMessage({ message }) {
  return (
    <div className="my-custom-wrapper">
      <ChatMessage message={message} />
    </div>
  );
}
```

### Custom Suggested Prompts

```tsx
const suggestedPrompts = [
  { text: 'Help me set up AWS keys', action: () => sendMessage('...') },
  { text: 'Show security best practices', action: () => sendMessage('...') },
  // ... your prompts
];

return (
  <div className="grid gap-2">
    {suggestedPrompts.map((prompt) => (
      <button onClick={prompt.action}>
        {prompt.text}
      </button>
    ))}
  </div>
);
```

## Integration with Backend

### Replace Mock with Real API

**Step 1: Update sendMessage in ai-store.ts**

```typescript
// lib/stores/ai-store.ts

sendMessage: async (content: string) => {
  const { currentConversation, addMessage, setTyping } = get();

  if (!currentConversation) return;

  // Add user message
  addMessage({ role: 'user', content });

  setTyping(true);

  try {
    // Call your API endpoint
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        conversationId: currentConversation.id,
        context: {
          projectId: get().contextProjectId,
          environmentId: get().contextEnvironmentId,
        },
      }),
    });

    const data = await response.json();

    // Add AI response
    addMessage({
      role: 'assistant',
      content: data.content,
      metadata: {
        model: data.model,
        tokens: data.tokens,
      },
    });

    setTyping(false);
  } catch (error) {
    console.error('Failed to send message:', error);
    set({ error: error.message });
    setTyping(false);
  }
}
```

**Step 2: Add Streaming (Optional)**

```typescript
sendMessage: async (content: string) => {
  // ... add user message ...

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: content }),
  });

  // Handle streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let accumulatedContent = '';
  const tempMessageId = crypto.randomUUID();

  // Add temporary message that we'll update
  addMessage({
    role: 'assistant',
    content: '',
    id: tempMessageId,
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    accumulatedContent += decoder.decode(value);

    // Update message content in real-time
    set((state) => ({
      currentConversation: {
        ...state.currentConversation!,
        messages: state.currentConversation!.messages.map((msg) =>
          msg.id === tempMessageId
            ? { ...msg, content: accumulatedContent }
            : msg
        ),
      },
    }));
  }

  setTyping(false);
}
```

### Persist Conversations to Database

```typescript
// Add to ai-store.ts

loadConversations: async () => {
  set({ isLoading: true });

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    set({
      conversations: data.map((conv) => ({
        id: conv.id,
        title: conv.title,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
        messages: conv.messages,
        projectId: conv.project_id,
        environmentId: conv.environment_id,
      })),
      isLoading: false,
    });
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
},

createConversation: async (title = 'New Conversation') => {
  const conversation = {
    id: crypto.randomUUID(),
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [],
    project_id: get().contextProjectId,
    environment_id: get().contextEnvironmentId,
  };

  // Save to database
  await supabase
    .from('conversations')
    .insert(conversation);

  // Update local state
  set((state) => ({
    conversations: [conversation, ...state.conversations],
    currentConversation: conversation,
  }));

  return conversation;
},
```

## Troubleshooting

### Messages not appearing

**Problem:** Messages don't show up after sending.

**Solution:** Check that:
1. `currentConversation` exists
2. `addMessage` is being called
3. Messages array is updating in state

```tsx
// Debug in browser console
const store = useAIStore.getState();
console.log('Current conversation:', store.currentConversation);
console.log('Messages:', store.currentConversation?.messages);
```

### Auto-scroll not working

**Problem:** Chat doesn't scroll to bottom on new messages.

**Solution:** Ensure the ref is attached:

```tsx
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [currentConversation?.messages]);

return (
  <div>
    {/* messages */}
    <div ref={messagesEndRef} />
  </div>
);
```

### Typing indicator stuck

**Problem:** "AI is thinking..." never goes away.

**Solution:** Ensure `setTyping(false)` is called in both success and error cases:

```tsx
try {
  await sendMessage(content);
  setTyping(false);
} catch (error) {
  setTyping(false); // Important!
}
```

### Context not updating

**Problem:** Context panel doesn't show current project.

**Solution:** Make sure to call `setContext`:

```tsx
const { currentProject, environments } = useProjectStore();
const { setContext } = useAIStore();

useEffect(() => {
  if (currentProject && environments[0]) {
    setContext(currentProject.id, environments[0].id);
  }
}, [currentProject, environments]);
```

## Performance Tips

### 1. Lazy Load Conversations

```tsx
// Only load conversations when chat is opened
useEffect(() => {
  if (isChatOpen) {
    loadConversations();
  }
}, [isChatOpen]);
```

### 2. Limit Message History

```tsx
// Only show last 100 messages
const recentMessages = currentConversation?.messages.slice(-100) || [];
```

### 3. Virtualize Long Conversations

```tsx
// Use react-window for very long conversations
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={100}
>
  {({ index, style }) => (
    <div style={style}>
      <ChatMessage message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

## Testing Your Integration

### Manual Testing Checklist

```
[ ] Navigate to AI page
[ ] See welcome screen
[ ] Click suggested prompt
[ ] Message appears in chat
[ ] AI response appears after delay
[ ] Can send another message
[ ] Can create new conversation
[ ] Can switch between conversations
[ ] Can delete conversation
[ ] Context panel shows project
[ ] Mobile sidebar works
[ ] Typing indicator animates
[ ] Auto-scroll works
[ ] Keyboard shortcuts work (Enter, Shift+Enter)
```

### Example Test Script

```typescript
// Example Playwright test
import { test, expect } from '@playwright/test';

test('can send message and receive response', async ({ page }) => {
  await page.goto('/dashboard/ai');

  // Type message
  await page.fill('textarea', 'Hello AI');

  // Send message
  await page.click('button:has-text("Send")');

  // Verify user message appears
  await expect(page.locator('text=Hello AI')).toBeVisible();

  // Wait for AI response
  await expect(page.locator('text=AI is thinking')).toBeVisible();
  await expect(page.locator('text=AI is thinking')).not.toBeVisible({ timeout: 5000 });

  // Verify AI response appears
  await expect(page.locator('[data-role="assistant"]')).toBeVisible();
});
```

## Getting Help

### Resources

- **Component README:** `components/ai/README.md` - Full documentation
- **Architecture Doc:** `components/ai/ARCHITECTURE.md` - Technical deep dive
- **Implementation Summary:** `WORKSTREAM-2-SUMMARY.md` - Complete overview

### Common Questions

**Q: Can I use these components in a non-Next.js app?**
A: Yes, but you'll need to adapt the imports and remove Next.js-specific features (like `'use client'`).

**Q: How do I change the AI's personality?**
A: Modify the `generateMockResponse()` function in `ai-store.ts` or update the system prompt when calling the real API.

**Q: Can I add images to messages?**
A: Yes! Extend the `Message` type to include an `images` array and update `ChatMessage` to display them.

**Q: How do I export conversations?**
A: Add a function that serializes the conversation to JSON or Markdown:

```typescript
function exportConversation(conversation: Conversation) {
  const markdown = conversation.messages
    .map((msg) => `**${msg.role}:** ${msg.content}`)
    .join('\n\n');

  // Download as file
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${conversation.title}.md`;
  a.click();
}
```

---

**Ready to build?** Start with the full `ChatInterface` component and customize as needed!

**Questions?** Check the README and Architecture docs for more details.

**Happy coding!** 🚀
