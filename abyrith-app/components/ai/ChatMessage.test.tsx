/**
 * ChatMessage Security Tests
 *
 * Tests to verify XSS vulnerability is fixed
 */

import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import type { Message } from '@/lib/stores/ai-store';

describe('ChatMessage XSS Security', () => {
  it('should sanitize script tags and prevent XSS', () => {
    const maliciousMessage: Message = {
      id: '1',
      role: 'user',
      content: '<script>alert("XSS")</script>Hello',
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={maliciousMessage} />);

    // Script tag should be sanitized and not present in the DOM
    expect(container.querySelector('script')).toBeNull();

    // Should not find the alert code
    expect(container.innerHTML).not.toContain('alert("XSS")');
  });

  it('should sanitize inline event handlers', () => {
    const maliciousMessage: Message = {
      id: '2',
      role: 'assistant',
      content: '<img src="x" onerror="alert(\'XSS\')" />',
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={maliciousMessage} />);

    // Event handlers should be stripped
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('onerror')).toBeNull();
    });
  });

  it('should allow safe markdown formatting', () => {
    const safeMessage: Message = {
      id: '3',
      role: 'assistant',
      content: '**bold text** and `code` and [link](https://example.com)',
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={safeMessage} />);

    // Should render markdown elements
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();
    expect(container.querySelector('a')).toBeTruthy();

    // Link should have safe attributes
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
  });

  it('should handle code blocks safely', () => {
    const codeMessage: Message = {
      id: '4',
      role: 'assistant',
      content: '```javascript\nconst x = "<script>alert(1)</script>";\n```',
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={codeMessage} />);

    // Code block should exist
    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();

    // Script inside code should be rendered as text, not executed
    expect(container.querySelector('script')).toBeNull();
  });

  it('should sanitize dangerous links', () => {
    const dangerousMessage: Message = {
      id: '5',
      role: 'user',
      content: '[Click me](javascript:alert("XSS"))',
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={dangerousMessage} />);

    const link = container.querySelector('a');
    if (link) {
      // javascript: protocol should be sanitized
      expect(link.getAttribute('href')).not.toContain('javascript:');
    }
  });

  it('should handle mixed content safely', () => {
    const mixedMessage: Message = {
      id: '6',
      role: 'assistant',
      content: `
# Heading with <script>alert(1)</script>

Normal text **bold** and \`code\`

<img src=x onerror="alert(1)">

[Safe link](https://example.com)
[Dangerous link](javascript:alert(1))
      `,
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={mixedMessage} />);

    // No scripts should be present
    expect(container.querySelector('script')).toBeNull();

    // No event handlers
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('onerror')).toBeNull();
    });

    // Safe markdown should work
    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();
  });
});

describe('ChatMessage Markdown Rendering', () => {
  it('should render user messages correctly', () => {
    const userMessage: Message = {
      id: '7',
      role: 'user',
      content: 'Hello, **world**!',
      timestamp: new Date(),
    };

    render(<ChatMessage message={userMessage} />);

    // Should find the bold text
    expect(screen.getByText(/world/i)).toBeTruthy();
  });

  it('should render assistant messages with metadata', () => {
    const assistantMessage: Message = {
      id: '8',
      role: 'assistant',
      content: 'Response from AI',
      timestamp: new Date(),
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokens: 150,
      },
    };

    render(<ChatMessage message={assistantMessage} />);

    // Should show metadata
    expect(screen.getByText(/Model: claude-3-5-sonnet-20241022/i)).toBeTruthy();
    expect(screen.getByText(/Tokens: 150/i)).toBeTruthy();
  });

  it('should render system messages differently', () => {
    const systemMessage: Message = {
      id: '9',
      role: 'system',
      content: 'System notification',
      timestamp: new Date(),
    };

    const { container } = render(<ChatMessage message={systemMessage} />);

    // System messages should be centered
    expect(container.querySelector('.justify-center')).toBeTruthy();
  });
});
