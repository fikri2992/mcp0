import { APIResponse, ErrorResponse, MCPToolResponse } from './types.js';

/**
 * Configuration options for the ResponseFormatter
 */
export interface ResponseFormatterConfig {
  /** Whether to include response headers in the formatted output */
  includeHeaders?: boolean;
  /** Whether to pretty-print JSON responses */
  prettyPrintJson?: boolean;
  /** Maximum length for truncating large responses */
  maxResponseLength?: number;
}

/**
 * ResponseFormatter class for structuring API responses into MCP-compatible format
 * Handles different content types and formats both successful and error responses
 */
export class ResponseFormatter {
  private config: Required<ResponseFormatterConfig>;

  constructor(config: ResponseFormatterConfig = {}) {
    this.config = {
      includeHeaders: config.includeHeaders ?? true,
      prettyPrintJson: config.prettyPrintJson ?? true,
      maxResponseLength: config.maxResponseLength ?? 50000, // 50KB limit
    };
  }

  /**
   * Formats a successful API response into MCP tool response format
   */
  formatSuccessResponse(response: APIResponse): MCPToolResponse {
    const contentType = this.getContentType(response.headers);
    const formattedData = this.formatResponseData(response.data, contentType);
    
    // Build the response text
    let responseText = `Status: ${response.status} ${response.statusText}\n\n`;
    
    // Add headers if configured to include them
    if (this.config.includeHeaders && Object.keys(response.headers).length > 0) {
      responseText += 'Headers:\n';
      Object.entries(response.headers).forEach(([key, value]) => {
        responseText += `  ${key}: ${value}\n`;
      });
      responseText += '\n';
    }
    
    // Add response body
    responseText += 'Response:\n';
    responseText += formattedData;
    
    // Truncate if too long
    if (responseText.length > this.config.maxResponseLength) {
      responseText = responseText.substring(0, this.config.maxResponseLength) + 
        '\n\n[Response truncated due to length]';
    }

    return {
      content: [{
        type: 'text',
        text: responseText
      }],
      isError: false
    };
  }

  /**
   * Formats an error response into MCP tool response format
   */
  formatErrorResponse(errorResponse: ErrorResponse): MCPToolResponse {
    const { error } = errorResponse;
    
    let errorText = `Error: ${error.message}\n`;
    errorText += `Type: ${error.type}\n`;
    
    if (error.statusCode !== undefined) {
      errorText += `Status Code: ${error.statusCode}\n`;
    }
    
    if (error.details) {
      errorText += '\nDetails:\n';
      if (typeof error.details === 'object') {
        try {
          errorText += JSON.stringify(error.details, null, 2);
        } catch {
          errorText += String(error.details);
        }
      } else {
        errorText += String(error.details);
      }
    }

    return {
      content: [{
        type: 'text',
        text: errorText
      }],
      isError: true
    };
  }

  /**
   * Formats either a success or error response based on the input type
   */
  formatResponse(response: APIResponse | ErrorResponse): MCPToolResponse {
    if (this.isErrorResponse(response)) {
      return this.formatErrorResponse(response);
    } else {
      return this.formatSuccessResponse(response);
    }
  }

  /**
   * Extracts content type from response headers
   */
  private getContentType(headers: Record<string, string>): string {
    // Look for content-type header (case-insensitive)
    const contentTypeKey = Object.keys(headers).find(
      key => key.toLowerCase() === 'content-type'
    );
    
    if (contentTypeKey) {
      return headers[contentTypeKey].toLowerCase();
    }
    
    return 'text/plain';
  }

  /**
   * Formats response data based on content type
   */
  private formatResponseData(data: any, contentType: string): string {
    // Handle null or undefined data
    if (data === null || data === undefined) {
      return '[No response body]';
    }

    // Handle JSON content types
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      return this.formatJsonData(data);
    }

    // Handle XML content types
    if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      return this.formatXmlData(data);
    }

    // Handle HTML content types
    if (contentType.includes('text/html')) {
      return this.formatHtmlData(data);
    }

    // Handle binary content types
    if (this.isBinaryContentType(contentType)) {
      return this.formatBinaryData(data, contentType);
    }

    // Default to text formatting
    return this.formatTextData(data);
  }

  /**
   * Formats JSON data with optional pretty printing
   */
  private formatJsonData(data: any): string {
    try {
      if (typeof data === 'string') {
        // Try to parse string as JSON first
        const parsed = JSON.parse(data);
        return this.config.prettyPrintJson 
          ? JSON.stringify(parsed, null, 2)
          : JSON.stringify(parsed);
      } else if (typeof data === 'object') {
        // Already an object, stringify it
        return this.config.prettyPrintJson 
          ? JSON.stringify(data, null, 2)
          : JSON.stringify(data);
      } else {
        // Primitive value, stringify as-is
        return JSON.stringify(data);
      }
    } catch (error) {
      // If JSON parsing fails, return as text
      return String(data);
    }
  }

  /**
   * Formats XML data
   */
  private formatXmlData(data: any): string {
    if (typeof data === 'string') {
      return data;
    }
    return String(data);
  }

  /**
   * Formats HTML data
   */
  private formatHtmlData(data: any): string {
    if (typeof data === 'string') {
      return data;
    }
    return String(data);
  }

  /**
   * Formats binary data
   */
  private formatBinaryData(data: any, contentType: string): string {
    if (Buffer.isBuffer(data)) {
      return `[Binary data: ${data.length} bytes, Content-Type: ${contentType}]`;
    }
    if (data instanceof ArrayBuffer) {
      return `[Binary data: ${data.byteLength} bytes, Content-Type: ${contentType}]`;
    }
    if (typeof data === 'string') {
      return `[Binary data: ${data.length} characters, Content-Type: ${contentType}]`;
    }
    return `[Binary data, Content-Type: ${contentType}]`;
  }

  /**
   * Formats text data
   */
  private formatTextData(data: any): string {
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'object') {
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    return String(data);
  }

  /**
   * Checks if content type is binary
   */
  private isBinaryContentType(contentType: string): boolean {
    const binaryTypes = [
      'application/octet-stream',
      'application/pdf',
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-tar',
      'application/x-rar-compressed',
      'application/x-7z-compressed'
    ];

    return binaryTypes.some(type => contentType.includes(type));
  }

  /**
   * Type guard to check if response is an error response
   */
  private isErrorResponse(response: APIResponse | ErrorResponse): response is ErrorResponse {
    return 'error' in response;
  }
}