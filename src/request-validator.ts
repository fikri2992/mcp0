import { z } from 'zod';
import { URL } from 'url';
import {
  APIRequest,
  HTTPMethod,
  ToolCallParams,
  ErrorResponse,
  HTTPMethodSchema,
  URLSchema,
  HeadersSchema,
  BodySchema,
  APIRequestSchema,
  validateToolParams,
  createValidationError,
} from './types.js';

/**
 * Configuration options for request validation
 */
export interface RequestValidatorConfig {
  /** Maximum request body size in bytes (default: 10MB) */
  maxBodySize?: number;
  /** Allowed URL schemes (default: ['http', 'https']) */
  allowedSchemes?: string[];
  /** Blocked IP ranges for SSRF protection */
  blockedIpRanges?: string[];
  /** Blocked hostnames for SSRF protection */
  blockedHostnames?: string[];
  /** Allow private IP addresses (default: false) */
  allowPrivateIps?: boolean;
  /** Allow localhost addresses (default: false) */
  allowLocalhost?: boolean;
}

/**
 * Request validator class for parameter validation and security checks
 * Validates URLs, HTTP methods, headers, request bodies, and prevents SSRF attacks
 */
export class RequestValidator {
  private config: Required<RequestValidatorConfig>;

  constructor(config: RequestValidatorConfig = {}) {
    this.config = {
      maxBodySize: config.maxBodySize ?? 10 * 1024 * 1024, // 10MB
      allowedSchemes: config.allowedSchemes ?? ['http', 'https'],
      blockedIpRanges: config.blockedIpRanges ?? [
        // Private IP ranges (RFC 1918)
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        // Loopback
        '127.0.0.0/8',
        '::1/128',
        // Link-local
        '169.254.0.0/16',
        'fe80::/10',
        // Multicast
        '224.0.0.0/4',
        'ff00::/8',
      ],
      blockedHostnames: config.blockedHostnames ?? [
        'localhost',
        'metadata.google.internal',
        '169.254.169.254', // AWS/GCP metadata
      ],
      allowPrivateIps: config.allowPrivateIps ?? false,
      allowLocalhost: config.allowLocalhost ?? false,
    };
  }

  /**
   * Validates tool call parameters based on the tool name
   */
  validateToolCall(toolName: string, params: unknown): ToolCallParams | ErrorResponse {
    try {
      // First validate that we have a known tool
      if (!['api_get', 'api_post', 'api_put', 'api_delete'].includes(toolName)) {
        return createValidationError(`Unknown tool: ${toolName}`);
      }

      // Validate parameters using Zod schemas
      const validatedParams = validateToolParams(toolName, params);

      // Perform additional security validation
      const urlValidation = this.validateUrl(validatedParams.url);
      if ('error' in urlValidation) {
        return urlValidation;
      }

      // Validate headers if present
      if (validatedParams.headers) {
        const headersValidation = this.validateHeaders(validatedParams.headers);
        if ('error' in headersValidation) {
          return headersValidation;
        }
      }

      // Validate body if present (for POST/PUT requests)
      if ('body' in validatedParams && validatedParams.body !== undefined) {
        const bodyValidation = this.validateBody(validatedParams.body);
        if ('error' in bodyValidation) {
          return bodyValidation;
        }
      }

      return validatedParams;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createValidationError(
          'Parameter validation failed',
          {
            issues: error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          }
        );
      }

      return createValidationError(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates an API request object
   */
  validateAPIRequest(request: APIRequest): APIRequest | ErrorResponse {
    try {
      // Validate using Zod schema
      const validatedRequest = APIRequestSchema.parse(request);

      // Perform additional security validation
      const urlValidation = this.validateUrl(validatedRequest.url);
      if ('error' in urlValidation) {
        return urlValidation;
      }

      // Validate headers if present
      if (validatedRequest.headers) {
        const headersValidation = this.validateHeaders(validatedRequest.headers);
        if ('error' in headersValidation) {
          return headersValidation;
        }
      }

      // Validate body if present
      if (validatedRequest.body !== undefined) {
        const bodyValidation = this.validateBody(validatedRequest.body);
        if ('error' in bodyValidation) {
          return bodyValidation;
        }
      }

      return validatedRequest;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createValidationError(
          'Request validation failed',
          {
            issues: error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          }
        );
      }

      return createValidationError(
        `Request validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates a URL and performs SSRF protection checks
   */
  private validateUrl(url: string): { valid: true } | ErrorResponse {
    try {
      // Basic URL format validation
      const urlValidation = URLSchema.safeParse(url);
      if (!urlValidation.success) {
        return createValidationError('Invalid URL format', {
          issues: urlValidation.error.issues,
        });
      }

      // Parse URL for detailed validation
      const parsedUrl = new URL(url);

      // Check allowed schemes
      if (!this.config.allowedSchemes.includes(parsedUrl.protocol.slice(0, -1))) {
        return createValidationError(
          `URL scheme '${parsedUrl.protocol.slice(0, -1)}' is not allowed`,
          {
            allowedSchemes: this.config.allowedSchemes,
          }
        );
      }

      // Check blocked hostnames (but allow localhost if configured)
      const hostname = parsedUrl.hostname.toLowerCase();
      const isLocalhostHostname = hostname === 'localhost' || hostname.startsWith('127.');
      if (this.config.blockedHostnames.includes(hostname) && 
          !(isLocalhostHostname && this.config.allowLocalhost)) {
        return createValidationError(`Hostname '${hostname}' is blocked for security reasons`);
      }

      // SSRF protection - check for private/local IPs
      if (!this.config.allowPrivateIps || !this.config.allowLocalhost) {
        const ipCheck = this.checkForPrivateIp(hostname);
        if (ipCheck.isPrivate && !this.config.allowPrivateIps) {
          return createValidationError(
            `Private IP addresses are not allowed: ${hostname}`,
            { ipType: 'private' }
          );
        }
        if (ipCheck.isLocalhost && !this.config.allowLocalhost) {
          return createValidationError(
            `Localhost addresses are not allowed: ${hostname}`,
            { ipType: 'localhost' }
          );
        }
      }

      // Additional checks for suspicious patterns (but be more permissive for allowed configurations)
      if (this.isSuspiciousUrl(parsedUrl, this.config.allowLocalhost, this.config.allowPrivateIps)) {
        return createValidationError('URL contains suspicious patterns that may indicate SSRF attempt');
      }

      return { valid: true };
    } catch (error) {
      return createValidationError(
        `URL validation error: ${error instanceof Error ? error.message : 'Invalid URL'}`
      );
    }
  }

  /**
   * Validates HTTP headers
   */
  private validateHeaders(headers: Record<string, string>): { valid: true } | ErrorResponse {
    try {
      // Validate using Zod schema
      const validatedHeaders = HeadersSchema.parse(headers);
      if (!validatedHeaders) {
        return { valid: true };
      }

      // Check for suspicious headers
      for (const [key, value] of Object.entries(validatedHeaders)) {
        // Check header name
        if (!this.isValidHeaderName(key)) {
          return createValidationError(`Invalid header name: ${key}`);
        }

        // Check header value
        if (!this.isValidHeaderValue(value)) {
          return createValidationError(`Invalid header value for '${key}': ${value}`);
        }

        // Check for potentially dangerous headers
        if (this.isDangerousHeader(key, value)) {
          return createValidationError(
            `Header '${key}' contains potentially dangerous value`,
            { header: key, value }
          );
        }
      }

      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createValidationError(
          'Headers validation failed',
          {
            issues: error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          }
        );
      }

      return createValidationError(
        `Headers validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates request body and handles JSON parsing
   */
  private validateBody(body: string | object): { valid: true } | ErrorResponse {
    try {
      // Validate using Zod schema
      const validatedBody = BodySchema.parse(body);
      if (validatedBody === undefined) {
        return { valid: true };
      }

      // Check body size if it's a string
      if (typeof validatedBody === 'string') {
        const bodySize = Buffer.byteLength(validatedBody, 'utf8');
        if (bodySize > this.config.maxBodySize) {
          return createValidationError(
            `Request body too large: ${bodySize} bytes (max: ${this.config.maxBodySize} bytes)`
          );
        }

        // Try to parse as JSON if it looks like JSON
        if (this.looksLikeJson(validatedBody)) {
          try {
            JSON.parse(validatedBody);
          } catch (jsonError) {
            return createValidationError(
              'Request body appears to be JSON but is invalid',
              { parseError: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error' }
            );
          }
        }
      }

      // Check object body size by serializing
      if (typeof validatedBody === 'object') {
        try {
          const serialized = JSON.stringify(validatedBody);
          const bodySize = Buffer.byteLength(serialized, 'utf8');
          if (bodySize > this.config.maxBodySize) {
            return createValidationError(
              `Request body too large: ${bodySize} bytes (max: ${this.config.maxBodySize} bytes)`
            );
          }
        } catch (serializeError) {
          return createValidationError(
            'Request body object cannot be serialized to JSON',
            { error: serializeError instanceof Error ? serializeError.message : 'Serialization error' }
          );
        }
      }

      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createValidationError(
          'Body validation failed',
          {
            issues: error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          }
        );
      }

      return createValidationError(
        `Body validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Checks if a hostname is a private IP or localhost
   */
  private checkForPrivateIp(hostname: string): { isPrivate: boolean; isLocalhost: boolean } {
    // Check for localhost patterns
    const isLocalhost = /^(localhost|127\.|::1$|0\.0\.0\.0$)/i.test(hostname);

    // Check for private IP patterns
    const isPrivate = 
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^fc00:/i.test(hostname) ||
      /^fe80:/i.test(hostname);

    return { isPrivate, isLocalhost };
  }

  /**
   * Checks for suspicious URL patterns that might indicate SSRF attempts
   */
  private isSuspiciousUrl(url: URL, allowLocalhost: boolean = false, allowPrivateIps: boolean = false): boolean {
    const suspicious = [
      // URL encoding attempts
      /%[0-9a-f]{2}/i.test(url.href),
      // Unicode/punycode attempts
      /xn--/.test(url.hostname),
      // Unusual ports for HTTP/HTTPS (but be more permissive for localhost/private IPs if allowed)
      url.port && !['80', '443', '8080', '8443', '3000', '5000', '9000'].includes(url.port) && 
      parseInt(url.port) < 1024 && 
      !(allowLocalhost && (url.hostname === 'localhost' || url.hostname.startsWith('127.'))) &&
      !(allowPrivateIps && this.checkForPrivateIp(url.hostname).isPrivate),
      // Suspicious paths (but be more permissive for allowed configurations)
      /\/(admin|internal|private|secret|config|env)/i.test(url.pathname) &&
      !(allowLocalhost && (url.hostname === 'localhost' || url.hostname.startsWith('127.'))) &&
      !(allowPrivateIps && this.checkForPrivateIp(url.hostname).isPrivate),
    ];

    return suspicious.some(Boolean);
  }

  /**
   * Validates HTTP header name format
   */
  private isValidHeaderName(name: string): boolean {
    // HTTP header names should only contain token characters
    // RFC 7230: token = 1*tchar
    // tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." / 
    //         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
    return /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name);
  }

  /**
   * Validates HTTP header value format
   */
  private isValidHeaderValue(value: string): boolean {
    // HTTP header values should not contain control characters except HTAB
    // RFC 7230: field-value = *( field-content / obs-fold )
    // field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
    // field-vchar = VCHAR / obs-text
    return !/[\x00-\x08\x0A-\x1F\x7F]/.test(value);
  }

  /**
   * Checks for potentially dangerous header values
   */
  private isDangerousHeader(name: string, value: string): boolean {
    const lowerName = name.toLowerCase();
    const lowerValue = value.toLowerCase();

    // Check for headers that might be used for SSRF or injection
    const dangerousPatterns = [
      // Host header manipulation
      lowerName === 'host' && (lowerValue.includes('localhost') || lowerValue.includes('127.0.0.1')),
      // X-Forwarded headers that might bypass security
      lowerName.startsWith('x-forwarded') && (lowerValue.includes('localhost') || /\b(?:10|172|192)\b/.test(lowerValue)),
      // Authorization headers with suspicious patterns
      lowerName === 'authorization' && lowerValue.includes('..'),
      // Content-Type with suspicious values
      lowerName === 'content-type' && /script|javascript|vbscript/.test(lowerValue),
    ];

    return dangerousPatterns.some(Boolean);
  }

  /**
   * Checks if a string looks like JSON
   */
  private looksLikeJson(str: string): boolean {
    const trimmed = str.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }
}