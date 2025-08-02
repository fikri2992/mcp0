/**
 * Parser module for markdown content and API specification extraction
 */

// Core parser classes
export { MarkdownParser } from './markdown-parser.js';
export { ContentPreprocessor } from './content-preprocessor.js';
export { APISpecValidator } from './api-spec-validator.js';

// Types and interfaces
export type {
  CurlCommand,
  APISpec,
  APIParameter,
  APIExample,
  ParsedAPICollection,
  MarkdownStructure,
  MarkdownHeading,
  MarkdownCodeBlock,
  ValidationError,
  ValidationResult,
  PreprocessedContent,
} from './types.js';

// Preprocessing options
export type {
  PreprocessingOptions,
  AIPreparationOptions,
} from './content-preprocessor.js';

// Type guards and utilities
export {
  isValidHTTPMethod,
  isCurlCommand,
  isCriticalError,
} from './types.js';

// Validation schemas
export {
  CurlCommandSchema,
  APIParameterSchema,
  APISpecSchema,
  ParsedAPICollectionSchema,
} from './types.js';

// Import the classes and types for internal use
import { MarkdownParser } from './markdown-parser.js';
import { ContentPreprocessor } from './content-preprocessor.js';
import { APISpecValidator } from './api-spec-validator.js';
import type {
  CurlCommand,
  APISpec,
  ParsedAPICollection,
  MarkdownStructure,
  ValidationResult,
  PreprocessedContent,
} from './types.js';

/**
 * Main parser facade for easy usage
 */
export class Parser {
  /**
   * Parse markdown content and extract API specifications
   */
  public static parseMarkdownToAPICollection(
    content: string,
    fileName?: string
  ): ParsedAPICollection {
    // Parse markdown structure
    const structure = MarkdownParser.parseMarkdown(content, fileName);
    
    // Extract curl commands
    const curlCommands = MarkdownParser.extractCurlCommands(content, structure);
    
    // Convert curl commands to API specs
    const apis: APISpec[] = curlCommands.map((curl: CurlCommand, index: number) => ({
      name: curl.context.heading || `API_${index + 1}`,
      description: curl.context.description,
      method: curl.method,
      url: curl.url,
      headers: curl.headers,
      body: curl.body,
      curlCommand: curl.raw,
      sourceLocation: {
        lineNumber: curl.lineNumber,
        heading: curl.context.heading,
      },
    }));

    // Determine collection name and base URL
    const collectionName = fileName ? 
      fileName.replace(/\.(md|markdown)$/i, '') : 
      structure.headings[0]?.text || 'API Collection';
    
    const baseUrl = this.extractBaseUrl(apis);

    return {
      name: collectionName,
      description: this.extractDescription(structure),
      baseUrl,
      apis,
      curlCommands,
      rawMarkdown: content,
      metadata: {
        fileName,
        parsedAt: new Date().toISOString(),
        headings: structure.headings.map((h: any) => h.text),
        codeBlocks: structure.codeBlocks.length,
        curlCommandsFound: curlCommands.length,
      },
    };
  }

  /**
   * Parse and preprocess markdown content for AI analysis
   */
  public static parseAndPreprocessForAI(
    content: string,
    fileName?: string
  ): {
    collection: ParsedAPICollection;
    preprocessed: PreprocessedContent;
    aiContent: string;
  } {
    // Preprocess content
    const preprocessed = ContentPreprocessor.preprocessContent(content);
    
    // Prepare for AI
    const aiContent = ContentPreprocessor.prepareForAI(content);
    
    // Parse preprocessed content
    const collection = this.parseMarkdownToAPICollection(
      preprocessed.processedContent,
      fileName
    );

    return {
      collection,
      preprocessed,
      aiContent,
    };
  }

  /**
   * Validate markdown content and extracted specifications
   */
  public static validateContent(
    content: string,
    fileName?: string
  ): {
    markdownValidation: ValidationResult;
    collectionValidation: ValidationResult;
    curlValidation: ValidationResult;
  } {
    // Validate markdown structure
    const markdownValidation = MarkdownParser.validateMarkdown(content, fileName);
    
    // Parse and validate collection
    const collection = this.parseMarkdownToAPICollection(content, fileName);
    const collectionValidation = APISpecValidator.validateAPICollection(collection);
    
    // Validate curl commands
    const curlValidation = APISpecValidator.validateCurlCommands(collection.curlCommands);

    return {
      markdownValidation,
      collectionValidation,
      curlValidation,
    };
  }

  /**
   * Extract base URL from API specifications
   */
  private static extractBaseUrl(apis: APISpec[]): string | undefined {
    if (apis.length === 0) {
      return undefined;
    }

    // Find common base URL
    const urls = apis.map(api => {
      try {
        const url = new URL(api.url);
        return `${url.protocol}//${url.host}`;
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (urls.length === 0) {
      return undefined;
    }

    // Find most common base URL
    const urlCounts = urls.reduce((acc, url) => {
      acc[url!] = (acc[url!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(urlCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return mostCommon ? mostCommon[0] : undefined;
  }

  /**
   * Extract description from markdown structure
   */
  private static extractDescription(structure: MarkdownStructure): string | undefined {
    // Look for content between first heading and first code block
    const firstHeading = structure.headings[0];
    const firstCodeBlock = structure.codeBlocks[0];

    if (!firstHeading || !firstCodeBlock) {
      return undefined;
    }

    const lines = structure.content.split('\n');
    const startLine = firstHeading.lineNumber;
    const endLine = firstCodeBlock.lineNumber - 1;

    if (endLine <= startLine) {
      return undefined;
    }

    const descriptionLines = lines
      .slice(startLine, endLine)
      .filter((line: string) => line.trim() && !line.startsWith('#'))
      .map((line: string) => line.trim());

    return descriptionLines.length > 0 ? descriptionLines.join(' ') : undefined;
  }
}