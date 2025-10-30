---
Document: AI Chat Interface - UI/UX Architecture
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Frontend Team
Status: Draft
Dependencies: 08-features/ai-assistant/ai-assistant-overview.md, 07-frontend/frontend-architecture.md, TECH-STACK.md, 00-admin/document-templates.md
---

# AI Chat Interface - UI/UX Architecture

## Overview

The AI Chat Interface is the primary user interaction point for Abyrith's AI Secret Assistant. It provides a conversational, beginner-friendly interface where users can ask questions about API keys, receive guided acquisition flows, compare services, and get cost estimates. The interface emphasizes clarity, responsiveness, and progressive disclosure—hiding complexity until users need it.

**Purpose:** Define the UI/UX architecture for the AI chat interface, including component structure, message rendering patterns, loading states, code block handling, action buttons, and context awareness displays. Ensure the interface works seamlessly for all target personas from complete beginners to experienced developers.

**Scope:** This document covers the chat UI components, message rendering logic, streaming response handling, markdown/code block display, action buttons within messages, acquisition flow visualization, and context awareness indicators.

**Status:** Draft - Phase 6 documentation (per DOCUMENTATION-ROADMAP.md)

---

## Table of Contents

1. [Context](#context)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Message Rendering](#message-rendering)
7. [Loading States & Thinking Indicators](#loading-states--thinking-indicators)
8. [Code Block & Markdown Rendering](#code-block--markdown-rendering)
9. [Action Buttons & Approvals](#action-buttons--approvals)
10. [Context Awareness Display](#context-awareness-display)
11. [Accessibility](#accessibility)
12. [Performance Characteristics](#performance-characteristics)
13. [Responsive Design](#responsive-design)
14. [Dark Mode Support](#dark-mode-support)
15. [Dependencies](#dependencies)
16. [References](#references)
17. [Change Log](#change-log)

---

## Context

### Problem Statement

**Current situation:**
Abyrith's AI-native design requires a chat interface that serves as the primary interaction model for secret management. Unlike traditional chatbots added as an afterthought, this interface must handle complex interactions including:
- Multi-step guided flows with progress tracking
- Code snippets with syntax highlighting and copy functionality
- Action buttons that trigger real operations (e.g., "Save this secret")
- Context awareness (showing what project/environment user is in)
- Streaming responses that render incrementally

**Pain points:**
- Chat interfaces often feel disconnected from the main application
- Long AI responses without streaming feel unresponsive
- Code blocks without syntax highlighting are hard to read
- Users lose track of context (which project am I working in?)
- Acquisition flows need clear progress indicators
- Action buttons in AI responses can be confusing (what will this do?)

**Why now?**
The AI chat interface is foundational to Abyrith's unique value proposition. All primary user flows—from asking "What is an API key?" to acquiring and storing secrets—must work through this conversational interface.

### Background

**Existing system:**
This is a greenfield implementation designed from the ground up for AI-first interactions.

**Design Principles from Product Vision:**
- **5-year-old simple:** Every interaction should be comprehensible to complete beginners
- **Progressive disclosure:** Show advanced features only when needed
- **Conversational first:** Natural language over forms and buttons
- **Educational:** Teach users about concepts while helping them accomplish tasks

### Stakeholders

| Stakeholder | Interest | Concerns |
|-------------|----------|----------|
| Frontend Team | Clean component architecture, reusability | Performance with long conversations, streaming complexity |
| Product Team | Delightful UX for all personas | Simplicity for beginners, power for advanced users |
| AI Team | Proper rendering of AI responses | Markdown parsing, action button handling, context injection |
| Design Team | Consistent visual language, accessibility | Dark mode, responsive behavior, animation performance |

---

## Goals & Non-Goals

### Goals

**Primary goals:**
1. **Streaming response rendering** - Show AI responses as they arrive, not after completion (success metric: < 100ms time to first token displayed)
2. **Beginner-friendly design** - Clear, uncluttered interface with helpful hints (success metric: 80% of Learner persona users complete first interaction without confusion)
3. **Action buttons that work** - In-message buttons trigger real operations with clear feedback (success metric: 90% success rate for actions)
4. **Context always visible** - Users always know which project/environment they're working in (success metric: 0 support tickets about "wrong project")

**Secondary goals:**
- Smooth animations and transitions (60fps)
- Keyboard navigation and shortcuts
- Mobile-optimized chat experience
- Conversation history accessible
- Search within conversation

### Non-Goals

**Explicitly out of scope:**
- **Voice input/output** - Post-MVP feature
- **Multi-modal (image uploads)** - Post-MVP (except for troubleshooting screenshots)
- **Chat with team members** - This is AI-only, not team chat
- **Custom AI agent creation** - AI behavior controlled by backend prompts

### Success Metrics

**How we measure success:**
- **Performance:** Time to first token < 100ms, smooth 60fps scrolling
- **Usability:** 80% of new users successfully complete guided flow in first session
- **Clarity:** < 5% of users click wrong action button
- **Accessibility:** WCAG 2.1 AA compliance, keyboard navigation works

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Chat Interface                        │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Chat Container                        │ │
│  │  • Full height layout                                  │ │
│  │  • Sticky header (context banner)                      │ │
│  │  • Scrollable message area                             │ │
│  │  • Fixed input at bottom                               │ │
│  └────────────────┬───────────────────────────────────────┘ │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────────┐ │
│  │            Context Banner (Sticky)                     │ │
│  │  • Current project name                                │ │
│  │  • Environment selector                                │ │
│  │  • "AI is thinking..." indicator                       │ │
│  └────────────────┬───────────────────────────────────────┘ │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────────┐ │
│  │          Message List (Scrollable)                     │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         User Message Component                   │ │ │
│  │  │  • Right-aligned bubble                          │ │ │
│  │  │  • User avatar                                   │ │ │
│  │  │  • Timestamp                                     │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │       Assistant Message Component                │ │ │
│  │  │  • Left-aligned bubble                           │ │ │
│  │  │  • AI avatar                                     │ │ │
│  │  │  • Markdown renderer                             │ │ │
│  │  │  • Code blocks with syntax highlighting          │ │ │
│  │  │  • Action buttons (if present)                   │ │ │
│  │  │  • Streaming cursor (while typing)               │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │     Acquisition Flow Component (Special)         │ │ │
│  │  │  • Step-by-step visualization                    │ │ │
│  │  │  • Progress indicator                            │ │ │
│  │  │  • Screenshot display                            │ │ │
│  │  │  • "Mark complete" checkboxes                    │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────┬───────────────────────────────────────┘ │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────────┐ │
│  │            Message Input (Fixed Bottom)                │ │
│  │  • Text input with auto-resize                         │ │
│  │  • Send button                                         │ │
│  │  • Attachment button (future: screenshots)             │ │
│  │  • Suggested prompts (when input empty)                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

**Component 1: ChatContainer**
- **Purpose:** Layout wrapper managing header, messages, and input positioning
- **Technology:** React functional component with CSS Grid/Flexbox
- **Responsibilities:**
  - Full-height layout (100vh - header)
  - Scroll management (auto-scroll to bottom on new messages)
  - Context banner sticky positioning
  - Input field fixed at bottom

**Component 2: ContextBanner**
- **Purpose:** Display current project, environment, and AI status
- **Technology:** React component with Zustand state
- **Responsibilities:**
  - Show active project name
  - Environment selector dropdown
  - "AI is thinking..." loading indicator
  - Cost tracking display (optional)

**Component 3: MessageList**
- **Purpose:** Render all conversation messages with auto-scroll
- **Technology:** React component with virtual scrolling (react-virtual) for long conversations
- **Responsibilities:**
  - Render user and assistant messages
  - Auto-scroll to bottom on new messages
  - Smooth scrolling animations
  - "New messages" indicator when not at bottom

**Component 4: UserMessage**
- **Purpose:** Display user's messages
- **Technology:** React component, simple text rendering
- **Responsibilities:**
  - Right-aligned bubble
  - User avatar (initials or profile pic)
  - Timestamp
  - Edit capability (future)

**Component 5: AssistantMessage**
- **Purpose:** Display AI responses with rich formatting
- **Technology:** React component with react-markdown, react-syntax-highlighter
- **Responsibilities:**
  - Left-aligned bubble
  - AI avatar
  - Markdown rendering
  - Code block syntax highlighting
  - Action buttons rendering
  - Streaming cursor during response
  - Copy buttons for code blocks

**Component 6: AcquisitionFlowVisualization**
- **Purpose:** Display step-by-step API key acquisition flows
- **Technology:** React component with progress tracking
- **Responsibilities:**
  - Step list with numbers and titles
  - Progress bar (X of Y steps complete)
  - Screenshot display
  - Checkpoint verification
  - "Mark complete" interactions
  - "Get help" button for each step

**Component 7: MessageInput**
- **Purpose:** Text input for user messages
- **Technology:** React component with auto-resize textarea
- **Responsibilities:**
  - Auto-resizing textarea (1-5 lines)
  - Send button (enabled when text present)
  - Shift+Enter for new line, Enter to send
  - Suggested prompts when empty
  - Character count (optional)

### Component Interactions

**ChatContainer ↔ MessageList:**
- Protocol: Props passing (messages array, loading state)
- Scroll management via refs
- Auto-scroll triggered on new messages

**MessageInput ↔ ChatContainer:**
- Protocol: Event callbacks (onSendMessage)
- Input value controlled by parent
- Enter key triggers send

**AssistantMessage ↔ Backend:**
- Protocol: Server-Sent Events (SSE) for streaming
- Incremental token rendering
- Completion event triggers final formatting

---

## Component Details

### Component: ChatContainer

**Purpose:** Top-level layout component orchestrating the entire chat interface.

**Implementation:**

```typescript
// components/ai/ChatContainer.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ContextBanner } from './ContextBanner';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useMessages } from '@/lib/hooks/useMessages';
import { useAutoScroll } from '@/lib/hooks/useAutoScroll';

interface ChatContainerProps {
  conversationId?: string;
  projectId?: string;
}

export function ChatContainer({ conversationId, projectId }: ChatContainerProps) {
  const messageListRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage } = useMessages(conversationId);
  const { shouldAutoScroll, enableAutoScroll, disableAutoScroll } = useAutoScroll();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScroll && messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, shouldAutoScroll]);

  const handleSend = async (content: string) => {
    await sendMessage(content);
    enableAutoScroll();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Context banner - sticky at top */}
      <ContextBanner projectId={projectId} isThinking={isLoading} />

      {/* Message list - scrollable */}
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
          if (!isAtBottom) {
            disableAutoScroll();
          }
        }}
      >
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* Message input - fixed at bottom */}
      <MessageInput
        onSendMessage={handleSend}
        disabled={isLoading}
        placeholder={
          projectId
            ? "Ask me anything about API keys..."
            : "Select a project to get started"
        }
      />
    </div>
  );
}
```

**State Management:**
- Messages fetched via `useMessages` hook (React Query)
- Auto-scroll state managed locally
- Project context from URL or Zustand store

---

### Component: ContextBanner

**Purpose:** Display current context and AI status at the top of the chat.

**Implementation:**

```typescript
// components/ai/ContextBanner.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useProject } from '@/lib/hooks/useProject';

interface ContextBannerProps {
  projectId?: string;
  isThinking: boolean;
}

export function ContextBanner({ projectId, isThinking }: ContextBannerProps) {
  const { data: project } = useProject(projectId);
  const [environment, setEnvironment] = useState('development');

  if (!project) {
    return (
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Select a project to start chatting with the AI assistant
        </p>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Project name and environment */}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium">{project.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs">
                {project.secrets_count || 0} secrets
              </Badge>
            </div>
          </div>
        </div>

        {/* Right: AI status */}
        {isThinking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Design Rationale:**
- Sticky positioning keeps context always visible
- Environment selector affects where AI suggests storing secrets
- Thinking indicator provides feedback during response generation
- Backdrop blur creates depth separation

---

### Component: MessageList

**Purpose:** Render all messages in the conversation with proper spacing and alignment.

**Implementation:**

```typescript
// components/ai/MessageList.tsx
'use client';

import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { AcquisitionFlowVisualization } from './AcquisitionFlowVisualization';
import { Message, MessageType } from '@/types/messages';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {messages.map((message, index) => (
        <div key={message.id} className="message-item">
          {message.role === 'user' ? (
            <UserMessage message={message} />
          ) : message.type === 'acquisition_flow' ? (
            <AcquisitionFlowVisualization flow={message.flow_data} />
          ) : (
            <AssistantMessage
              message={message}
              isStreaming={index === messages.length - 1 && isLoading}
            />
          )}
        </div>
      ))}

      {/* Loading indicator for new message */}
      {isLoading && messages[messages.length - 1]?.role === 'user' && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <span className="text-3xl">💬</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Ask me anything about API keys, secrets management, or how to get started with a service.
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <button className="text-primary hover:underline">
          "I need an OpenAI API key"
        </button>
        <button className="text-primary hover:underline">
          "What's the difference between Stripe and Paddle?"
        </button>
        <button className="text-primary hover:underline">
          "How do I secure my API keys?"
        </button>
      </div>
    </div>
  );
}
```

**Features:**
- Empty state with suggested prompts
- Handles different message types (user, assistant, flow)
- Loading skeleton while AI generates response
- Max width for readability (4xl container)

---

## Data Flow

### Flow 1: User Sends Message and Receives Streaming Response

**Trigger:** User types message and presses Enter or clicks Send button.

**Steps:**

1. **User Input:**
   ```typescript
   handleSend("I need an OpenAI API key");
   ```

2. **Frontend: Optimistic Update**
   - Add user message to local state immediately
   - Disable input (prevent double-send)
   - Show "AI is thinking..." indicator

3. **API Call: POST /api/ai/chat**
   ```typescript
   const response = await fetch('/api/ai/chat', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`,
     },
     body: JSON.stringify({
       message: "I need an OpenAI API key",
       conversation_id: conversationId,
       project_id: projectId,
     }),
   });
   ```

4. **Backend: Stream Response**
   - Worker calls Claude API
   - Streams response tokens via Server-Sent Events

5. **Frontend: Parse SSE Stream**
   ```typescript
   const reader = response.body.getReader();
   const decoder = new TextDecoder();
   let buffer = '';

   while (true) {
     const { done, value } = await reader.read();
     if (done) break;

     buffer += decoder.decode(value, { stream: true });

     // Parse SSE events
     const lines = buffer.split('\n\n');
     buffer = lines.pop() || '';

     for (const line of lines) {
       if (line.startsWith('data: ')) {
         const data = JSON.parse(line.slice(6));

         if (data.type === 'chunk') {
           // Append to message content
           appendToAssistantMessage(data.content);
         } else if (data.type === 'complete') {
           // Mark message complete, save to DB
           finalizeMessage(data.usage);
         }
       }
     }
   }
   ```

6. **Frontend: Render Streaming Tokens**
   - Each token appended to AssistantMessage content
   - Markdown re-parsed on each update (optimized with debounce)
   - Cursor shown at end of streaming content

7. **Frontend: Finalize Message**
   - Remove streaming cursor
   - Save complete message to React Query cache
   - Re-enable input
   - Auto-scroll to bottom

**Sequence Diagram:**
```
User    Input    ChatAPI   Claude   MessageList
 |        |         |         |          |
 |--type->|         |         |          |
 |--send->|         |         |          |
 |        |--POST-->|         |          |
 |        |         |--call-->|          |
 |        |         |<--chunk-|          |
 |        |<--SSE---|         |          |
 |        |---------|---------|--append->|
 |        |         |<--chunk-|          |
 |        |<--SSE---|         |          |
 |        |---------|---------|--append->|
 |        |         |<-complete          |
 |        |<--done--|         |          |
 |        |---------|---------|--final-->|
```

---

## Message Rendering

### User Message Rendering

**Component Structure:**

```typescript
// components/ai/UserMessage.tsx
interface UserMessageProps {
  message: Message;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex items-start gap-3 justify-end">
      {/* Message content */}
      <div className="flex flex-col items-end max-w-[80%]">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          {formatTimestamp(message.created_at)}
        </span>
      </div>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium">
          {getUserInitials()}
        </span>
      </div>
    </div>
  );
}
```

**Styling:**
- Right-aligned with flex-end
- Primary color background (blue)
- Rounded corners (right-top corner sharp for speech bubble effect)
- Max width 80% of container
- Timestamp below message

---

### Assistant Message Rendering

**Component Structure:**

```typescript
// components/ai/AssistantMessage.tsx
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface AssistantMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function AssistantMessage({ message, isStreaming }: AssistantMessageProps) {
  return (
    <div className="flex items-start gap-3">
      {/* AI avatar */}
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <span className="text-xs">🤖</span>
      </div>

      {/* Message content */}
      <div className="flex flex-col flex-1 max-w-[80%]">
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              code: ({ node, inline, className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                return !inline && language ? (
                  <CodeBlock
                    language={language}
                    code={String(children).replace(/\n$/, '')}
                  />
                ) : (
                  <code className="bg-background px-1.5 py-0.5 rounded text-xs" {...props}>
                    {children}
                  </code>
                );
              },
              a: ({ node, children, ...props }) => (
                <a
                  {...props}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>

          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-1" />
          )}
        </div>

        {/* Timestamp and actions */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.created_at)}
          </span>
          {message.model && (
            <span className="text-xs text-muted-foreground">
              • {getModelDisplayName(message.model)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Styling:**
- Left-aligned with flex-start
- Muted background (light gray)
- Markdown formatting with `react-markdown`
- Code blocks with syntax highlighting
- Streaming cursor during generation
- Model name in timestamp area

---

### Code Block Component

**Purpose:** Render code blocks with syntax highlighting and copy functionality.

**Implementation:**

```typescript
// components/ai/CodeBlock.tsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      {/* Language label and copy button */}
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 rounded-t-lg">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-zinc-400 hover:text-white transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Code with syntax highlighting */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 0.5rem 0.5rem',
          fontSize: '0.875rem',
        }}
        showLineNumbers={code.split('\n').length > 3}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
```

**Features:**
- Language badge (top-left)
- Copy button (top-right)
- Syntax highlighting via Prism
- Line numbers for code > 3 lines
- Dark theme (oneDark)
- Copy success feedback (check icon)

---

## Loading States & Thinking Indicators

### Thinking Indicators

**1. Context Banner Indicator**
```typescript
{isThinking && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>AI is thinking...</span>
  </div>
)}
```

**2. Message Loading Skeleton**
```typescript
<div className="flex items-start gap-3">
  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
  </div>
  <div className="flex flex-col gap-2">
    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
    <div className="h-4 w-64 bg-muted rounded animate-pulse" />
    <div className="h-4 w-48 bg-muted rounded animate-pulse" />
  </div>
</div>
```

**3. Streaming Cursor**
```typescript
{isStreaming && (
  <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-1" />
)}
```

### Loading State Transitions

```
User sends message
         ↓
[Disable input, show thinking indicator]
         ↓
Backend starts processing (1-2s)
         ↓
[Show loading skeleton]
         ↓
First token arrives (< 100ms target)
         ↓
[Remove skeleton, show message with streaming cursor]
         ↓
Tokens stream in (20-50 tokens/second)
         ↓
[Update message content, keep cursor]
         ↓
Stream completes
         ↓
[Remove cursor, re-enable input, finalize message]
```

---

## Code Block & Markdown Rendering

### Markdown Support

**Supported Markdown Features:**
- **Headings:** `# H1`, `## H2`, `### H3`
- **Bold:** `**bold**`
- **Italic:** `*italic*`
- **Links:** `[text](url)`
- **Lists:** Ordered and unordered
- **Code:** Inline \`code\` and blocks \`\`\`language
- **Blockquotes:** `> quote`
- **Tables:** Standard markdown tables

**Custom Styling:**

```typescript
// Tailwind Typography customization
<div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:before:content-none prose-code:after:content-none">
  <ReactMarkdown>{content}</ReactMarkdown>
</div>
```

### Syntax Highlighting Languages

**Supported Languages:**
- JavaScript, TypeScript
- Python, Ruby, PHP
- Go, Rust
- Shell/Bash
- JSON, YAML, TOML
- SQL
- Markdown

**Fallback:** If language not recognized, render as plain text with monospace font.

### Performance Optimization

**Challenge:** Re-parsing markdown on every streaming token is expensive.

**Solution: Debounced Parsing**

```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash-es';

// Only re-parse markdown at most every 100ms during streaming
const debouncedContent = useMemo(() => {
  if (!isStreaming) return message.content;

  return debounce(() => message.content, 100);
}, [message.content, isStreaming]);
```

---

## Action Buttons & Approvals

### Action Button Types

**1. Save Secret Button**
```typescript
// AI response: "Here's your OpenAI API key. Would you like to save it?"
<ActionButton
  action="save_secret"
  payload={{
    name: "OpenAI API Key",
    service: "openai",
    environment: "development",
  }}
  onAction={handleSaveSecret}
>
  Save this secret securely
</ActionButton>
```

**2. Start Acquisition Flow Button**
```typescript
// AI response: "Want me to show you how to get a Stripe API key?"
<ActionButton
  action="start_flow"
  payload={{
    service: "stripe"
  }}
  onAction={handleStartFlow}
>
  Yes, show me how
</ActionButton>
```

**3. Research Service Button**
```typescript
// AI response: "I don't have info on that service yet. Want me to research it?"
<ActionButton
  action="research_service"
  payload={{
    service_name: "twilio"
  }}
  onAction={handleResearch}
>
  Research Twilio
</ActionButton>
```

### Action Button Component

```typescript
// components/ai/ActionButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';

interface ActionButtonProps {
  action: string;
  payload: Record<string, any>;
  onAction: (action: string, payload: any) => Promise<void>;
  children: React.ReactNode;
}

export function ActionButton({ action, payload, onAction, children }: ActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onAction(action, payload);
      setIsComplete(true);
      setTimeout(() => setIsComplete(false), 2000);
    } catch (error) {
      console.error('Action failed:', error);
      // Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading || isComplete}
      className="mt-2"
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isComplete && <Check className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}
```

### Approval Workflow UI

**For sensitive actions (production secrets, team invites):**

```typescript
// components/ai/ApprovalDialog.tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <ActionButton action="access_prod_secret" payload={...}>
      Access production secret
    </ActionButton>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Approve Secret Access</AlertDialogTitle>
      <AlertDialogDescription>
        You're about to access a production secret: <strong>{secretName}</strong>.
        This action will be logged in the audit trail.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleApprove}>
        I approve
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Context Awareness Display

### Context Indicators

**1. Project Badge (Always Visible)**
```typescript
<div className="flex items-center gap-2">
  <span className="text-sm font-medium">{project.name}</span>
  <Badge variant="outline">Development</Badge>
</div>
```

**2. Existing Secrets Count**
```typescript
<Badge variant="secondary">
  {project.secrets_count || 0} secrets
</Badge>
```

**3. Cost Tracking (Optional)**
```typescript
{showCosts && (
  <div className="text-xs text-muted-foreground">
    AI usage: ${conversationCost.toFixed(2)} this conversation
  </div>
)}
```

### Context Injection in Responses

**AI responses should reference context:**

```markdown
AI: "I see you're working on **RecipeApp** in **development** mode.
You already have 3 secrets stored. Would you like me to help you add an OpenAI key?"
```

**Implementation:**
- Backend includes project context in system prompt
- Frontend displays context banner continuously
- AI references project/environment in responses naturally

---

## Accessibility

### Keyboard Navigation

**Shortcuts:**
- `Enter`: Send message (when input focused)
- `Shift+Enter`: New line in input
- `Ctrl+/`: Focus input field
- `Esc`: Clear input
- `Tab`: Navigate through action buttons
- `Space/Enter`: Activate action button (when focused)

**Implementation:**

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+/ or Cmd+/ to focus input
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Screen Reader Support

**ARIA Labels:**
```typescript
<div role="region" aria-label="AI Assistant Chat">
  <div role="log" aria-live="polite" aria-relevant="additions">
    {/* Message list */}
  </div>

  <form role="search" aria-label="Message input">
    <textarea
      aria-label="Type your message"
      aria-describedby="input-hint"
    />
  </form>
</div>
```

**Live Regions:**
- Message list: `aria-live="polite"` (announces new messages)
- Thinking indicator: `aria-live="polite"` (announces when AI is responding)
- Error messages: `aria-live="assertive"` (immediate announcement)

### Focus Management

**Auto-focus behavior:**
- Focus input on page load
- Focus input after message sent
- Focus first action button when AI suggests action
- Return focus to input after action complete

---

## Performance Characteristics

### Performance Requirements

**Latency:**
- Time to first token: < 100ms
- Markdown render time: < 50ms per message
- Smooth scrolling: 60fps
- Input lag: < 16ms

**Throughput:**
- Handle 100+ messages in conversation without lag
- Stream 20-50 tokens/second
- Real-time markdown parsing during stream

**Resource Usage:**
- Memory: < 50MB for typical conversation (20 messages)
- CPU: < 10% average (spikes during markdown parsing)

### Optimization Strategies

**1. Virtual Scrolling (for long conversations)**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => messageListRef.current,
  estimateSize: () => 100,
  overscan: 5,
});
```

**2. Debounced Markdown Parsing**
```typescript
const debouncedContent = useMemo(
  () => debounce(() => message.content, 100),
  [message.content]
);
```

**3. Lazy Load Syntax Highlighter**
```typescript
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then(mod => ({
    default: mod.Prism
  }))
);
```

**4. Memoized Components**
```typescript
export const UserMessage = React.memo(UserMessageComponent);
export const AssistantMessage = React.memo(AssistantMessageComponent);
```

---

## Responsive Design

### Mobile Layout

**Adjustments for mobile (< 768px):**
- Message max-width: 90% (instead of 80%)
- Input: Single line, no auto-resize (expands in modal on focus)
- Context banner: Compact (stack project and environment)
- Code blocks: Horizontal scroll
- Action buttons: Full width

**Implementation:**

```typescript
// Responsive message width
<div className="max-w-[90%] sm:max-w-[80%]">
  {/* Message content */}
</div>

// Compact context banner on mobile
<div className="flex flex-col sm:flex-row sm:items-center gap-2">
  <span className="text-sm font-medium">{project.name}</span>
  <Badge variant="outline" className="w-fit">Development</Badge>
</div>
```

### Tablet Layout (768px - 1024px)

**Adjustments:**
- Similar to desktop but slightly narrower max-width
- Side-by-side action buttons (if 2-3)
- Full-width for 4+ buttons

---

## Dark Mode Support

### Color Tokens

**Light Mode:**
- Background: `bg-background` (white)
- User message: `bg-primary` (blue)
- Assistant message: `bg-muted` (light gray)
- Code blocks: Dark theme (consistent in light/dark)

**Dark Mode:**
- Background: `bg-background` (dark gray)
- User message: `bg-primary` (blue, same hue)
- Assistant message: `bg-muted` (darker gray)
- Code blocks: Dark theme (oneDark)

**Implementation:**
```typescript
// Tailwind dark mode (class strategy)
<div className="bg-muted dark:bg-muted">
  {/* Content */}
</div>
```

### Syntax Highlighting in Dark Mode

**Always use dark theme for code blocks** (even in light mode) for better readability:

```typescript
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

<SyntaxHighlighter
  language={language}
  style={oneDark} // Always dark
>
  {code}
</SyntaxHighlighter>
```

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant architecture (VERIFIED)
- [x] `07-frontend/frontend-architecture.md` - Frontend architecture (VERIFIED)
- [x] `TECH-STACK.md` - React, Next.js, Tailwind, shadcn/ui specs (VERIFIED)

**External Services:**
- Claude API - Streaming responses
- React Query - Message caching
- Zustand - UI state (thinking indicator, context)

### Feature Dependencies

**Required by features:**
- AI-powered secret acquisition (primary use case)
- Cost tracking dashboard (displays conversation costs)
- Team collaboration (context awareness)

**Depends on features:**
- Authentication - User must be logged in
- Project management - Context requires active project

---

## References

### Internal Documentation
- `08-features/ai-assistant/ai-assistant-overview.md` - AI assistant feature spec
- `07-frontend/frontend-architecture.md` - Frontend architecture
- `TECH-STACK.md` - Technology stack specifications
- `GLOSSARY.md` - Term definitions

### External Resources
- [React Markdown Documentation](https://remarkjs.github.io/react-markdown/) - Markdown rendering
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) - Code highlighting
- [Tailwind Typography](https://tailwindcss.com/docs/typography-plugin) - Prose styling
- [shadcn/ui Chat Component](https://ui.shadcn.com/docs/components/chat) - Component inspiration
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) - SSE streaming

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Frontend Team | Initial AI chat interface UI/UX documentation |

---

## Notes

### Future Enhancements
- **Voice input** - Speak messages instead of typing
- **Image uploads** - Upload screenshots for troubleshooting
- **Multi-modal responses** - AI returns images/videos in responses
- **Conversation search** - Search within conversation history
- **Message reactions** - Thumbs up/down for AI responses
- **Export conversation** - Download conversation as markdown

### Known Limitations
- Markdown parsing can be expensive during streaming (mitigated with debouncing)
- Very long conversations (200+ messages) may impact performance (use virtual scrolling)
- Code blocks don't wrap (intentional - horizontal scroll for long lines)

### Next Review Date
2025-11-30 (review after initial implementation and user testing)
