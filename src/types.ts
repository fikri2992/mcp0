import { z } from 'zod';

// =============================================================================
// Core API Types
// =============================================================================

/**
 * Supported HTTP methods for API calls
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * API request interface
 */
export interface APIRequest {
  url: string;
  method: HTTPMethod;
  headers?: Record<string, string>;
  body?: string | object;
}

/**
 * API response interface
 */
export interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
}

/**
 * Error types that can occur during API calls
 */
export type ErrorType = 'validation' | 'network' | 'http' | 'parsing';

/**
 * Error response interface
 */
export interface APIError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  details?: any;
}

/**
 * Complete error response structure
 */
export interface ErrorResponse {
  error: APIError;
}

// =============================================================================
// Tool Parameter Types
// =============================================================================

/**
 * Base parameters for all API tool calls
 */
export interface BaseToolParams {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Parameters for GET requests
 */
export interface GetToolParams extends BaseToolParams {}

/**
 * Parameters for POST requests
 */
export interface PostToolParams extends BaseToolParams {
  body?: string | object;
}

/**
 * Parameters for PUT requests
 */
export interface PutToolParams extends BaseToolParams {
  body?: string | object;
}

/**
 * Parameters for DELETE requests
 */
export interface DeleteToolParams extends BaseToolParams {}

/**
 * Union type for all tool parameters
 */
export type ToolCallParams = GetToolParams | PostToolParams | PutToolParams | DeleteToolParams;

// =============================================================================
// MCP Protocol Types
// =============================================================================

/**
 * MCP tool definition structure
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP tool call request structure
 */
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP tool call response structure
 */
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

/**
 * Schema for validating HTTP methods
 */
export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE']);

/**
 * Schema for validating URLs
 */
export const URLSchema = z.string().url('Invalid URL format');

/**
 * Schema for validating headers
 */
export const HeadersSchema = z.record(z.string()).optional();

/**
 * Schema for validating request body (can be string or object)
 */
export const BodySchema = z.union([z.string(), z.record(z.any())]).optional();

/**
 * Base schema for all tool parameters
 */
export const BaseToolParamsSchema = z.object({
  url: URLSchema,
  headers: HeadersSchema,
});

/**
 * Schema for GET tool parameters
 */
export const GetToolParamsSchema = BaseToolParamsSchema;

/**
 * Schema for POST tool parameters
 */
export const PostToolParamsSchema = BaseToolParamsSchema.extend({
  body: BodySchema,
});

/**
 * Schema for PUT tool parameters
 */
export const PutToolParamsSchema = BaseToolParamsSchema.extend({
  body: BodySchema,
});

/**
 * Schema for DELETE tool parameters
 */
export const DeleteToolParamsSchema = BaseToolParamsSchema;

/**
 * Schema for validating API requests
 */
export const APIRequestSchema = z.object({
  url: URLSchema,
  method: HTTPMethodSchema,
  headers: HeadersSchema,
  body: BodySchema,
});

/**
 * Schema for validating error types
 */
export const ErrorTypeSchema = z.enum(['validation', 'network', 'http', 'parsing']);

/**
 * Schema for validating API errors
 */
export const APIErrorSchema = z.object({
  type: ErrorTypeSchema,
  message: z.string(),
  statusCode: z.number().optional(),
  details: z.any().optional(),
});

/**
 * Schema for validating error responses
 */
export const ErrorResponseSchema = z.object({
  error: APIErrorSchema,
});

/**
 * Schema for validating MCP tool calls
 */
export const MCPToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.any()),
});

// =============================================================================
// Type Guards and Validation Helpers
// =============================================================================

/**
 * Type guard to check if a value is a valid HTTP method
 */
export function isValidHTTPMethod(method: string): method is HTTPMethod {
  return HTTPMethodSchema.safeParse(method).success;
}

/**
 * Type guard to check if a value is a valid URL
 */
export function isValidURL(url: string): boolean {
  return URLSchema.safeParse(url).success;
}

/**
 * Validates tool parameters based on the tool name
 */
export function validateToolParams(toolName: string, params: unknown): ToolCallParams {
  switch (toolName) {
    case 'api_get':
      return GetToolParamsSchema.parse(params);
    case 'api_post':
      return PostToolParamsSchema.parse(params);
    case 'api_put':
      return PutToolParamsSchema.parse(params);
    case 'api_delete':
      return DeleteToolParamsSchema.parse(params);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Creates a validation error response
 */
export function createValidationError(message: string, details?: any): ErrorResponse {
  return {
    error: {
      type: 'validation',
      message,
      details,
    },
  };
}

/**
 * Creates a network error response
 */
export function createNetworkError(message: string, details?: any): ErrorResponse {
  return {
    error: {
      type: 'network',
      message,
      details,
    },
  };
}

/**
 * Creates an HTTP error response
 */
export function createHTTPError(message: string, statusCode: number, details?: any): ErrorResponse {
  return {
    error: {
      type: 'http',
      message,
      statusCode,
      details,
    },
  };
}

/**
 * Creates a parsing error response
 */
export function createParsingError(message: string, details?: any): ErrorResponse {
  return {
    error: {
      type: 'parsing',
      message,
      details,
    },
  };
}