import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { APIRequest, APIResponse, HTTPMethod, ErrorResponse, createNetworkError, createHTTPError, createParsingError } from './types.js';

/**
 * Configuration options for the APIClient
 */
export interface APIClientConfig {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** User agent string for requests */
  userAgent?: string;
  /** Maximum response size in bytes */
  maxContentLength?: number;
  /** Maximum request size in bytes */
  maxBodyLength?: number;
}

/**
 * HTTP client wrapper for making API requests
 * Handles different HTTP methods, timeouts, and error management
 */
export class APIClient {
  private axiosInstance: AxiosInstance;
  private config: Required<APIClientConfig>;

  constructor(config: APIClientConfig = {}) {
    // Set default configuration
    this.config = {
      timeout: config.timeout ?? 30000,
      userAgent: config.userAgent ?? 'MCP-API-Server/1.0.0',
      maxContentLength: config.maxContentLength ?? 10 * 1024 * 1024, // 10MB
      maxBodyLength: config.maxBodyLength ?? 10 * 1024 * 1024, // 10MB
    };

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      timeout: this.config.timeout,
      maxContentLength: this.config.maxContentLength,
      maxBodyLength: this.config.maxBodyLength,
      headers: {
        'User-Agent': this.config.userAgent,
      },
      // Don't throw on HTTP error status codes - we'll handle them manually
      validateStatus: () => true,
    });
  }

  /**
   * Makes an HTTP request using the provided parameters
   */
  async makeRequest(request: APIRequest): Promise<APIResponse | ErrorResponse> {
    try {
      const axiosConfig = this.buildAxiosConfig(request);
      const response = await this.axiosInstance.request(axiosConfig);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Makes a GET request
   */
  async get(url: string, headers?: Record<string, string>): Promise<APIResponse | ErrorResponse> {
    return this.makeRequest({
      url,
      method: 'GET',
      headers,
    });
  }

  /**
   * Makes a POST request
   */
  async post(
    url: string,
    body?: string | object,
    headers?: Record<string, string>
  ): Promise<APIResponse | ErrorResponse> {
    return this.makeRequest({
      url,
      method: 'POST',
      body,
      headers,
    });
  }

  /**
   * Makes a PUT request
   */
  async put(
    url: string,
    body?: string | object,
    headers?: Record<string, string>
  ): Promise<APIResponse | ErrorResponse> {
    return this.makeRequest({
      url,
      method: 'PUT',
      body,
      headers,
    });
  }

  /**
   * Makes a DELETE request
   */
  async delete(url: string, headers?: Record<string, string>): Promise<APIResponse | ErrorResponse> {
    return this.makeRequest({
      url,
      method: 'DELETE',
      headers,
    });
  }

  /**
   * Builds axios configuration from APIRequest
   */
  private buildAxiosConfig(request: APIRequest): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      url: request.url,
      method: request.method.toLowerCase() as any,
      headers: { ...request.headers },
    };

    // Handle request body and Content-Type
    if (request.body !== undefined && (request.method === 'POST' || request.method === 'PUT')) {
      if (typeof request.body === 'string') {
        // String body - set as-is, let user control Content-Type
        config.data = request.body;
        if (!config.headers!['Content-Type'] && !config.headers!['content-type']) {
          // Default to text/plain if no Content-Type specified
          config.headers!['Content-Type'] = 'text/plain';
        }
      } else if (typeof request.body === 'object') {
        // Object body - serialize to JSON
        config.data = request.body;
        if (!config.headers!['Content-Type'] && !config.headers!['content-type']) {
          // Default to application/json for objects
          config.headers!['Content-Type'] = 'application/json';
        }
      }
    }

    return config;
  }

  /**
   * Formats axios response into APIResponse
   */
  private formatResponse(response: AxiosResponse): APIResponse {
    // Convert headers to plain object
    const headers: Record<string, string> = {};
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        } else if (value !== undefined) {
          headers[key] = String(value);
        }
      });
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      data: response.data,
    };
  }

  /**
   * Handles errors that occur during requests
   */
  private handleError(error: unknown): ErrorResponse {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Network/connection errors
      if (!axiosError.response) {
        if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
          return createNetworkError('Request timeout - the server did not respond within the specified time limit');
        }
        if (axiosError.code === 'ENOTFOUND') {
          return createNetworkError('DNS resolution failed - could not resolve hostname');
        }
        if (axiosError.code === 'ECONNREFUSED') {
          return createNetworkError('Connection refused - the server is not accepting connections');
        }
        if (axiosError.code === 'ECONNRESET') {
          return createNetworkError('Connection reset - the server closed the connection unexpectedly');
        }
        
        return createNetworkError(
          `Network error: ${axiosError.message}`,
          { code: axiosError.code }
        );
      }

      // HTTP errors with response
      const status = axiosError.response.status;
      const statusText = axiosError.response.statusText;
      
      return createHTTPError(
        `HTTP ${status} ${statusText}`,
        status,
        {
          response: axiosError.response.data,
          headers: axiosError.response.headers,
        }
      );
    }

    // JSON parsing or other errors
    if (error instanceof SyntaxError) {
      return createParsingError('Failed to parse response as JSON', { originalError: error.message });
    }

    // Generic error fallback
    return createNetworkError(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { originalError: error }
    );
  }
}