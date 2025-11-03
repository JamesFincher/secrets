/**
 * FireCrawl API Types
 *
 * Type definitions for FireCrawl API requests and responses
 */

export interface ScrapeOptions {
  pageOptions?: {
    onlyMainContent?: boolean;    // Remove headers, footers, ads (default: true)
    includeHtml?: boolean;         // Include raw HTML (default: false)
    screenshot?: boolean;          // Take screenshot (default: false)
    waitFor?: number;              // Wait time in ms before scraping
  };
  extractorOptions?: {
    mode: 'llm-extraction';
    extractionPrompt: string;      // Prompt for structured extraction
    extractionSchema?: object;     // JSON schema for extraction
  };
}

export interface ScrapeMetadata {
  title: string;
  description: string;
  language: string;
  sourceURL: string;
  statusCode: number;
}

export interface ScrapeResult {
  success: boolean;
  data?: {
    markdown: string;              // Converted markdown content
    html?: string;                 // Raw HTML (if requested)
    metadata: ScrapeMetadata;
    llm_extraction?: any;          // Structured data (if LLM extraction used)
    screenshot?: string;           // Screenshot URL (if requested)
  };
  error?: string;
}

export interface ExtractedData {
  success: boolean;
  data?: any;                      // Extracted structured data
  markdown: string;                // Original markdown
  error?: string;
}

export interface ServiceUrls {
  pricing: string;
  gettingStarted: string;
  apiReference: string;
}

export interface ScrapedServiceData {
  serviceName: string;
  pricing: string;              // Markdown content
  gettingStarted: string;       // Markdown content
  apiReference: string;         // Markdown content
  scrapedAt: string;            // ISO timestamp
  urls: ServiceUrls;
}

export interface CachedScrapeData {
  markdown: string;
  scrapedAt: string;
  urls: ServiceUrls;
}

export interface FireCrawlConfig {
  apiKey: string;
  endpoint: string;
  timeout: number;
  maxRetries: number;
  cacheTTL: number;
}

export class FireCrawlError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public cause?: Error
  ) {
    super(message);
    this.name = 'FireCrawlError';
  }
}
