/**
 * FireCrawl API Client
 *
 * Wrapper for FireCrawl API with retry logic, error handling, and URL validation.
 * Provides methods for scraping URLs and extracting structured data.
 */

import { validateURL } from '../lib/url-validator';
import type {
  ScrapeOptions,
  ScrapeResult,
  ExtractedData,
  FireCrawlError
} from '../types/firecrawl';

export class FireCrawlClient {
  private apiKey: string;
  private endpoint: string;
  private timeout: number;
  private maxRetries: number;

  constructor(
    apiKey: string,
    endpoint: string = 'https://api.firecrawl.dev/v0',
    timeout: number = 30000,
    maxRetries: number = 3
  ) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Scrape a single URL and convert to markdown
   */
  async scrapeUrl(
    url: string,
    options?: ScrapeOptions
  ): Promise<ScrapeResult> {
    // SSRF Protection: Validate URL before scraping
    const validation = await validateURL(url);
    if (!validation.valid) {
      throw this.createError(
        `URL validation failed: ${validation.error}`,
        400
      );
    }

    return this.withRetry(async () => {
      try {
        const response = await fetch(`${this.endpoint}/scrape`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            url,
            pageOptions: {
              onlyMainContent: true,
              ...options?.pageOptions
            },
            ...options?.extractorOptions && {
              extractorOptions: options.extractorOptions
            }
          }),
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          throw this.createError(
            `FireCrawl API error: ${response.status} ${response.statusText}`,
            response.status
          );
        }

        const data = await response.json();
        return data as ScrapeResult;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw this.createError('Request timeout', 408);
        }
        throw error;
      }
    });
  }

  /**
   * Scrape URL and extract structured data using LLM
   */
  async extractWithLLM(
    url: string,
    extractionPrompt: string,
    schema?: object
  ): Promise<ExtractedData> {
    const result = await this.scrapeUrl(url, {
      pageOptions: { onlyMainContent: true },
      extractorOptions: {
        mode: 'llm-extraction',
        extractionPrompt,
        extractionSchema: schema
      }
    });

    return {
      success: result.success,
      data: result.data?.llm_extraction,
      markdown: result.data?.markdown || '',
      error: result.error
    };
  }

  /**
   * Scrape multiple URLs in parallel
   */
  async scrapeMultiple(
    urls: string[],
    options?: ScrapeOptions
  ): Promise<ScrapeResult[]> {
    // Validate all URLs first
    const validations = await Promise.all(urls.map(validateURL));

    const invalidUrls = validations
      .map((v, i) => ({ validation: v, url: urls[i] }))
      .filter(({ validation }) => !validation.valid);

    if (invalidUrls.length > 0) {
      const errors = invalidUrls.map(u => `${u.url}: ${u.validation.error}`).join(', ');
      throw this.createError(
        `URL validation failed for: ${errors}`,
        400
      );
    }

    // Execute scrapes in parallel
    const promises = urls.map(url => this.scrapeUrl(url, options));
    return Promise.all(promises);
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      // Don't retry non-retriable errors
      if (!this.isRetriable(error)) {
        throw error;
      }

      // Last attempt, throw error
      if (attempt >= this.maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry
      return this.withRetry(fn, attempt + 1);
    }
  }

  /**
   * Check if error is retriable
   */
  private isRetriable(error: any): boolean {
    if (!error.statusCode) return false;

    // Retriable status codes
    const retriableCodes = [429, 500, 503, 408];
    return retriableCodes.includes(error.statusCode);
  }

  /**
   * Create standardized error
   */
  private createError(message: string, statusCode: number, cause?: Error): Error {
    const error: any = new Error(message);
    error.name = 'FireCrawlError';
    error.statusCode = statusCode;
    if (cause) {
      error.cause = cause;
    }
    return error;
  }
}

/**
 * Create FireCrawl client from environment
 */
export function createFireCrawlClient(env: {
  FIRECRAWL_API_KEY: string;
  FIRECRAWL_ENDPOINT?: string;
  FIRECRAWL_TIMEOUT?: string;
  FIRECRAWL_MAX_RETRIES?: string;
}): FireCrawlClient {
  return new FireCrawlClient(
    env.FIRECRAWL_API_KEY,
    env.FIRECRAWL_ENDPOINT || 'https://api.firecrawl.dev/v0',
    parseInt(env.FIRECRAWL_TIMEOUT || '30000'),
    parseInt(env.FIRECRAWL_MAX_RETRIES || '3')
  );
}
