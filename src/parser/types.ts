import { z } from 'zod';
import { HTTPMethod } from '../types.js';

// =============================================================================
// Parser Types
// =============================================================================

/**
 * Represents a curl command extracted from markdown
 */
export interface CurlCommand {
  raw: string;
  method: HTTPMethod;
  url: string;
  headers: Record<string, string>;
  body?: string | object;
  lineNumber: number;
  context: {
    heading?: string;
    description?: string;
    codeBlockLanguage?: string;
  };
}

/**
 * Represents an API specification extracted from markdown
 */
export interface APISpec {
  name: string;
  description?: string;
  method: HTTPMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string | object;
  parameters?: APIParameter[];
  examples?: APIExample[];
  curlCommand?: string;
  sourceLocation: {
    lineNumber: number;
    heading?: string;
  };
}

/**
 * Represents an API parameter
 */
export interface APIParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  location: 'query' | 'header' | 'body' | 'path';
  example?: any;
}

/**
 * Represents an API example
 */
export interface APIExample {
  name?: string;
  description?: string;
  request: {
    url: string;
    method: HTTPMethod;
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
  };
}

/**
 * Represents a parsed API collection from markdown
 */
export interface ParsedAPICollection {
  name: string;
  description?: string;
  baseUrl?: string;
  apis: APISpec[];
  curlCommands: CurlCommand[];
  rawMarkdown: string;
  metadata: {
    fileName?: string;
    parsedAt: string;
    headings: string[];
    codeBlocks: number;
    curlCommandsFound: number;
  };
}

/**
 * Represents markdown structure
 */
export interface MarkdownStructure {
  headings: MarkdownHeading[];
  codeBlocks: MarkdownCodeBlock[];
  content: string;
  metadata: {
    lineCount: number;
    wordCount: number;
    characterCount: number;
  };
}

/**
 * Represents a markdown heading
 */
export interface MarkdownHeading {
  level: number;
  text: string;
  lineNumber: number;
  id?: string;
}

/**
 * Represents a markdown code block
 */
export interface MarkdownCodeBlock {
  language?: string;
  content: string;
  lineNumber: number;
  lineCount: number;
  isCurlCommand: boolean;
}

/**
 * Validation errors that can occur during parsing
 */
export interface ValidationError {
  type: 'structure' | 'curl' | 'format' | 'content';
  message: string;
  lineNumber?: number;
  details?: any;
  suggestions?: string[];
}

/**
 * Result of markdown validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: string[];
}

/**
 * Content preprocessing result
 */
export interface PreprocessedContent {
  originalContent: string;
  processedContent: string;
  extractedCurls: CurlCommand[];
  structure: MarkdownStructure;
  metadata: {
    preprocessedAt: string;
    transformations: string[];
    statistics: {
      originalLines: number;
      processedLines: number;
      curlCommandsFound: number;
      headingsFound: number;
      codeBlocksFound: number;
    };
  };
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

/**
 * Schema for validating curl commands
 */
export const CurlCommandSchema = z.object({
  raw: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  url: z.string().url(),
  headers: z.record(z.string()),
  body: z.union([z.string(), z.record(z.any())]).optional(),
  lineNumber: z.number(),
  context: z.object({
    heading: z.string().optional(),
    description: z.string().optional(),
    codeBlockLanguage: z.string().optional(),
  }),
});

/**
 * Schema for validating API parameters
 */
export const APIParameterSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean(),
  description: z.string().optional(),
  location: z.enum(['query', 'header', 'body', 'path']),
  example: z.any().optional(),
});

/**
 * Schema for validating API specifications
 */
export const APISpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.union([z.string(), z.record(z.any())]).optional(),
  parameters: z.array(APIParameterSchema).optional(),
  examples: z.array(z.any()).optional(),
  curlCommand: z.string().optional(),
  sourceLocation: z.object({
    lineNumber: z.number(),
    heading: z.string().optional(),
  }),
});

/**
 * Schema for validating parsed API collections
 */
export const ParsedAPICollectionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apis: z.array(APISpecSchema),
  curlCommands: z.array(CurlCommandSchema),
  rawMarkdown: z.string(),
  metadata: z.object({
    fileName: z.string().optional(),
    parsedAt: z.string(),
    headings: z.array(z.string()),
    codeBlocks: z.number(),
    curlCommandsFound: z.number(),
  }),
});

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a string is a valid HTTP method
 */
export function isValidHTTPMethod(method: string): method is HTTPMethod {
  return ['GET', 'POST', 'PUT', 'DELETE'].includes(method as HTTPMethod);
}

/**
 * Type guard to check if a code block contains a curl command
 */
export function isCurlCommand(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('curl ') || trimmed.includes('\ncurl ');
}

/**
 * Type guard to check if a validation error is critical
 */
export function isCriticalError(error: ValidationError): boolean {
  return error.type === 'structure' || error.type === 'format';
}