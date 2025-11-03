'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ServiceInfo } from '@/lib/services/service-detection';

interface DocumentationViewerProps {
  service: ServiceInfo;
  markdown: string;
  scrapedAt: string;
  onAskQuestion?: () => void;
}

/**
 * Documentation Viewer Component
 *
 * Displays scraped documentation with markdown rendering
 * Highlights pricing and getting started sections
 */
export function DocumentationViewer({
  service,
  markdown,
  scrapedAt,
  onAskQuestion,
}: DocumentationViewerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing' | 'getting-started'>(
    'overview'
  );

  // Parse markdown into sections
  const sections = parseMarkdownSections(markdown);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{service.name} Documentation</h3>
          <p className="text-xs text-muted-foreground">
            Scraped {new Date(scrapedAt).toLocaleString()}
          </p>
        </div>
        {onAskQuestion && (
          <Button variant="outline" size="sm" onClick={onAskQuestion}>
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            Ask AI
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </TabButton>
        {sections.pricing && (
          <TabButton
            active={activeTab === 'pricing'}
            onClick={() => setActiveTab('pricing')}
          >
            Pricing
          </TabButton>
        )}
        {sections.gettingStarted && (
          <TabButton
            active={activeTab === 'getting-started'}
            onClick={() => setActiveTab('getting-started')}
          >
            Getting Started
          </TabButton>
        )}
      </div>

      {/* Content */}
      <div className="rounded-lg border bg-muted/30 p-6 max-h-96 overflow-y-auto">
        {activeTab === 'overview' && (
          <MarkdownContent content={sections.overview || markdown} />
        )}
        {activeTab === 'pricing' && sections.pricing && (
          <div>
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                Pricing Information
              </p>
            </div>
            <MarkdownContent content={sections.pricing} />
          </div>
        )}
        {activeTab === 'getting-started' && sections.gettingStarted && (
          <MarkdownContent content={sections.gettingStarted} />
        )}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        {service.docsUrl && (
          <a
            href={service.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View full documentation
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
        {service.pricingUrl && (
          <a
            href={service.pricingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Pricing details
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
        {service.apiKeysUrl && (
          <a
            href={service.apiKeysUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Get API keys
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Tab Button Component
 */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Markdown Content Component
 *
 * Simple markdown rendering (without dependencies)
 * For production, consider using react-markdown
 */
function MarkdownContent({ content }: { content: string }) {
  // Basic markdown parsing (simplified)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  lines.forEach((line, index) => {
    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${index}`} className="bg-muted p-3 rounded my-2 overflow-x-auto">
            <code className="text-sm">{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Flush list if needed
    if (!line.trim().startsWith('-') && !line.trim().startsWith('*') && currentList.length > 0) {
      elements.push(
        <ul key={`list-${index}`} className="list-disc list-inside space-y-1 my-2">
          {currentList.map((item, i) => (
            <li key={i} className="text-sm">
              {item}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-base font-semibold mt-4 mb-2">
          {line.substring(4)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-lg font-bold mt-6 mb-3">
          {line.substring(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-xl font-bold mt-6 mb-4">
          {line.substring(2)}
        </h1>
      );
    }
    // Lists
    else if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
      currentList.push(line.trim().substring(1).trim());
    }
    // Links
    else if (line.includes('[') && line.includes('](')) {
      const parts = line.split(/\[([^\]]+)\]\(([^)]+)\)/);
      const linkElements: React.ReactNode[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 0) {
          linkElements.push(parts[i]);
        } else if (i % 3 === 1) {
          linkElements.push(
            <a
              key={i}
              href={parts[i + 1]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {parts[i]}
            </a>
          );
        }
      }
      elements.push(
        <p key={index} className="text-sm my-2">
          {linkElements}
        </p>
      );
    }
    // Paragraphs
    else if (line.trim()) {
      elements.push(
        <p key={index} className="text-sm my-2">
          {line}
        </p>
      );
    }
  });

  // Flush remaining list
  if (currentList.length > 0) {
    elements.push(
      <ul key="list-final" className="list-disc list-inside space-y-1 my-2">
        {currentList.map((item, i) => (
          <li key={i} className="text-sm">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return <div className="prose prose-sm max-w-none dark:prose-invert">{elements}</div>;
}

/**
 * Parse markdown into sections
 */
function parseMarkdownSections(markdown: string): {
  overview: string | null;
  pricing: string | null;
  gettingStarted: string | null;
} {
  const sections = {
    overview: null as string | null,
    pricing: null as string | null,
    gettingStarted: null as string | null,
  };

  const lines = markdown.split('\n');
  let currentSection: keyof typeof sections | null = null;
  let sectionContent: string[] = [];

  const saveSectionContent = () => {
    if (currentSection && sectionContent.length > 0) {
      sections[currentSection] = sectionContent.join('\n').trim();
      sectionContent = [];
    }
  };

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('## pricing') || lowerLine.includes('# pricing')) {
      saveSectionContent();
      currentSection = 'pricing';
    } else if (
      lowerLine.includes('## getting started') ||
      lowerLine.includes('# getting started') ||
      lowerLine.includes('## quickstart')
    ) {
      saveSectionContent();
      currentSection = 'gettingStarted';
    } else if (line.startsWith('# ') || line.startsWith('## ')) {
      if (!currentSection) {
        currentSection = 'overview';
      } else {
        saveSectionContent();
        currentSection = 'overview';
      }
    }

    if (currentSection) {
      sectionContent.push(line);
    }
  });

  saveSectionContent();

  // If no specific sections found, put everything in overview
  if (!sections.overview && !sections.pricing && !sections.gettingStarted) {
    sections.overview = markdown;
  }

  return sections;
}
