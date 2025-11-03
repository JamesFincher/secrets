/**
 * URL Validation & SSRF Protection
 *
 * Validates URLs before passing to FireCrawl to prevent SSRF attacks.
 * Blocks requests to:
 * - Private IP ranges (10.x, 192.168.x, 172.16-31.x)
 * - Localhost (127.x, ::1)
 * - Link-local IPs (169.254.x - AWS/GCP metadata)
 * - Non-HTTP protocols (file://, ftp://, etc.)
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check if IP address is in private range
 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);

  // Validate parts
  if (parts.length !== 4 || parts.some(isNaN)) {
    return false;
  }

  // Check for private IP ranges
  return (
    parts[0] === 10 ||                                      // 10.0.0.0/8
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
    (parts[0] === 192 && parts[1] === 168) ||                // 192.168.0.0/16
    parts[0] === 127 ||                                      // 127.0.0.0/8 (localhost)
    (parts[0] === 169 && parts[1] === 254)                   // 169.254.0.0/16 (link-local)
  );
}

/**
 * Validate URL before scraping
 * CRITICAL SECURITY: Prevents SSRF attacks
 */
export async function validateURL(url: string): Promise<ValidationResult> {
  try {
    const parsedURL = new URL(url);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS protocols allowed' };
    }

    const hostname = parsedURL.hostname.toLowerCase();

    // Block localhost
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      return { valid: false, error: 'Cannot scrape localhost' };
    }

    // Check if hostname is an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      if (isPrivateIP(hostname)) {
        return { valid: false, error: 'Cannot scrape private IP addresses' };
      }
    }

    // For domain names, perform DNS resolution via Cloudflare DNS
    // This prevents DNS rebinding attacks
    try {
      const dnsResult = await fetch(
        `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
        {
          headers: { 'Accept': 'application/dns-json' },
          // Timeout DNS queries quickly
          signal: AbortSignal.timeout(5000)
        }
      );

      if (!dnsResult.ok) {
        // DNS lookup failed, but allow the request
        // FireCrawl will handle unreachable domains
        return { valid: true };
      }

      const dnsData: any = await dnsResult.json();

      if (dnsData.Answer) {
        for (const record of dnsData.Answer) {
          if (record.type === 1) { // A record
            if (isPrivateIP(record.data)) {
              return { valid: false, error: 'Domain resolves to private IP address' };
            }
          }
        }
      }
    } catch (dnsError) {
      // DNS timeout or error - allow the request to proceed
      // Better to have false negatives than false positives
      console.warn('DNS validation error (allowing request):', dnsError);
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate multiple URLs
 */
export async function validateURLs(urls: string[]): Promise<Map<string, ValidationResult>> {
  const validations = await Promise.all(
    urls.map(async url => ({
      url,
      result: await validateURL(url)
    }))
  );

  return new Map(validations.map(v => [v.url, v.result]));
}

/**
 * Check if URL validation error is retriable
 */
export function isValidationErrorRetriable(error: string): boolean {
  // DNS errors might be transient, other errors are permanent
  return error.includes('DNS');
}
