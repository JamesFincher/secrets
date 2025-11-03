/**
 * Visual Test for ChatMessage Component
 *
 * Use this in Storybook or as a standalone test page to verify:
 * 1. XSS prevention
 * 2. Markdown rendering
 * 3. Styling
 */

import { ChatMessage } from './ChatMessage';
import type { Message } from '@/lib/stores/ai-store';

export function ChatMessageVisualTest() {
  const testMessages: Message[] = [
    // Test 1: XSS - Script injection
    {
      id: '1',
      role: 'user',
      content: '<script>alert("XSS 1")</script>This should not execute JavaScript',
      timestamp: new Date(),
    },

    // Test 2: XSS - Event handler
    {
      id: '2',
      role: 'assistant',
      content: '<img src="x" onerror="alert(\'XSS 2\')">This should not execute JavaScript',
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 50,
      },
    },

    // Test 3: XSS - Dangerous link
    {
      id: '3',
      role: 'user',
      content: '[Click me](javascript:alert("XSS 3")) - This link should be safe',
      timestamp: new Date(),
    },

    // Test 4: Safe markdown - Bold, italic, code
    {
      id: '4',
      role: 'assistant',
      content: 'Here is **bold text**, *italic text*, and `inline code`',
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 25,
      },
    },

    // Test 5: Safe markdown - Links
    {
      id: '5',
      role: 'user',
      content: 'Check out [this safe link](https://example.com) and [another one](https://anthropic.com)',
      timestamp: new Date(),
    },

    // Test 6: Safe markdown - Code block
    {
      id: '6',
      role: 'assistant',
      content: `Here's a code example:

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  // This <script>alert('XSS')</script> should not execute
}
\`\`\`

The code block should be syntax highlighted.`,
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 120,
      },
    },

    // Test 7: Safe markdown - Lists
    {
      id: '7',
      role: 'assistant',
      content: `Here are some key points:

- First item with **bold**
- Second item with \`code\`
- Third item with [link](https://example.com)

And a numbered list:

1. Step one
2. Step two with *italic*
3. Step three`,
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 85,
      },
    },

    // Test 8: Safe markdown - Headers
    {
      id: '8',
      role: 'assistant',
      content: `# Heading 1
## Heading 2
### Heading 3

Regular paragraph text.`,
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 30,
      },
    },

    // Test 9: Safe markdown - Tables (GFM)
    {
      id: '9',
      role: 'assistant',
      content: `Here's a table:

| Feature | Status | Notes |
|---------|--------|-------|
| XSS Prevention | ✅ Fixed | Using rehype-sanitize |
| Markdown | ✅ Working | react-markdown |
| Syntax Highlighting | ✅ Working | rehype-highlight |`,
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 95,
      },
    },

    // Test 10: Safe markdown - Task lists (GFM)
    {
      id: '10',
      role: 'user',
      content: `My TODO list:

- [x] Fix XSS vulnerability
- [x] Add tests
- [ ] Deploy to production
- [ ] Celebrate! 🎉`,
      timestamp: new Date(),
    },

    // Test 11: System message
    {
      id: '11',
      role: 'system',
      content: 'This is a system notification',
      timestamp: new Date(),
    },

    // Test 12: Mixed content attack
    {
      id: '12',
      role: 'assistant',
      content: `Here's a response with **mixed** content:

\`\`\`html
<!-- This HTML should be displayed as code, not rendered -->
<script>alert('XSS')</script>
<img src=x onerror="alert('XSS')">
\`\`\`

And some [safe](https://example.com) and [dangerous](javascript:alert('XSS')) links.

<script>alert('Direct script injection')</script>
<img src=x onerror="alert('Event handler')">`,
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 150,
      },
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold mb-6">ChatMessage Security & Visual Test</h1>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">🔒 Security Test Instructions</h2>
        <p className="text-sm">
          If you see any JavaScript alerts or errors in the console, the XSS fix has failed.
          Otherwise, if all content renders safely as markdown/text, the fix is working correctly.
        </p>
      </div>

      <div className="space-y-4">
        {testMessages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
        <h2 className="text-lg font-semibold mb-2">✅ Expected Results</h2>
        <ul className="text-sm list-disc list-inside space-y-1">
          <li>No JavaScript alerts should appear</li>
          <li>Script tags should be visible as text (sanitized)</li>
          <li>Event handlers should be removed</li>
          <li>Safe markdown should render with formatting</li>
          <li>Code blocks should have syntax highlighting</li>
          <li>Links should be safe (no javascript: protocol)</li>
          <li>Tables and task lists should render correctly</li>
          <li>System messages should be centered</li>
          <li>Assistant messages should show metadata</li>
        </ul>
      </div>
    </div>
  );
}
