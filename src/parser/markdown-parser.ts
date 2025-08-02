import {
  MarkdownStructure,
  MarkdownHeading,
  MarkdownCodeBlock,
  CurlCommand,
  ValidationResult,
  ValidationError,
  isCurlCommand,
  isValidHTTPMethod
} from './types.js';
import { HTTPMethod } from '../types.js';

/**
 * Main markdown parser class for extracting structure and curl commands
 */
export class MarkdownParser {
  private static readonly HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;
  private static readonly CODE_BLOCK_REGEX = /^```(\w+)?\s*\n([\s\S]*?)\n```$/gm;
  private static readonly CURL_COMMAND_REGEX = /curl\s+[\s\S]*?(?=\n\s*$|\n\s*[^-\s]|\n\s*curl|$)/gm;

  /**
   * Parse markdown content and extract structure
   */
  public static parseMarkdown(content: string, fileName?: string): MarkdownStructure {
    const headings = this.extractHeadings(content);
    const codeBlocks = this.extractCodeBlocks(content);
    
    return {
      headings,
      codeBlocks,
      content,
      metadata: {
        lineCount: content.split('\n').length,
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
        characterCount: content.length,
      },
    };
  }

  /**
   * Extract all headings from markdown content
   */
  private static extractHeadings(content: string): MarkdownHeading[] {
    const headings: MarkdownHeading[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = this.generateHeadingId(text);
        
        headings.push({
          level,
          text,
          lineNumber: index + 1,
          id,
        });
      }
    });

    return headings;
  }

  /**
   * Extract all code blocks from markdown content
   */
  private static extractCodeBlocks(content: string): MarkdownCodeBlock[] {
    const codeBlocks: MarkdownCodeBlock[] = [];
    const lines = content.split('\n');
    let inCodeBlock = false;
    let currentBlock: Partial<MarkdownCodeBlock> = {};
    let blockContent: string[] = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          const language = line.slice(3).trim() || undefined;
          currentBlock = {
            language,
            lineNumber,
            lineCount: 0,
          };
          blockContent = [];
        } else {
          // Ending a code block
          inCodeBlock = false;
          const content = blockContent.join('\n');
          const isCurl = isCurlCommand(content);
          
          codeBlocks.push({
            language: currentBlock.language,
            content,
            lineNumber: currentBlock.lineNumber!,
            lineCount: blockContent.length,
            isCurlCommand: isCurl,
          });
          
          currentBlock = {};
          blockContent = [];
        }
      } else if (inCodeBlock) {
        blockContent.push(line);
      }
    });

    return codeBlocks;
  }

  /**
   * Extract curl commands from markdown content
   */
  public static extractCurlCommands(content: string, structure?: MarkdownStructure): CurlCommand[] {
    const curlCommands: CurlCommand[] = [];
    const markdownStructure = structure || this.parseMarkdown(content);
    
    // Find curl commands in code blocks
    markdownStructure.codeBlocks.forEach(codeBlock => {
      if (codeBlock.isCurlCommand) {
        const commands = this.parseCurlFromCodeBlock(codeBlock, markdownStructure.headings);
        curlCommands.push(...commands);
      }
    });

    return curlCommands;
  }

  /**
   * Parse curl commands from a code block
   */
  private static parseCurlFromCodeBlock(
    codeBlock: MarkdownCodeBlock,
    headings: MarkdownHeading[]
  ): CurlCommand[] {
    const commands: CurlCommand[] = [];
    
    // For curl commands, treat the entire code block as one command if it contains curl
    if (codeBlock.content.includes('curl')) {
      const contextHeading = this.findContextHeading(codeBlock.lineNumber, headings);
      
      try {
        const parsed = this.parseSingleCurlCommand(codeBlock.content);
        if (parsed) {
          commands.push({
            ...parsed,
            raw: codeBlock.content.trim(),
            lineNumber: codeBlock.lineNumber,
            context: {
              heading: contextHeading?.text,
              description: this.extractDescription(codeBlock, headings),
              codeBlockLanguage: codeBlock.language,
            },
          });
        }
      } catch (error) {
        // Skip invalid curl commands but log for debugging
        console.warn(`Failed to parse curl command in code block at line ${codeBlock.lineNumber}:`, error);
      }
    }

    return commands;
  }

  /**
   * Parse a single curl command string
   */
  private static parseSingleCurlCommand(curlCommand: string): Omit<CurlCommand, 'raw' | 'lineNumber' | 'context'> | null {
    const parts = this.tokenizeCurlCommand(curlCommand);
    
    let method: HTTPMethod = 'GET';
    let url = '';
    const headers: Record<string, string> = {};
    let body: string | object | undefined;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part === 'curl') {
        continue;
      }
      
      if (part === '-X' || part === '--request') {
        const nextPart = parts[i + 1];
        if (nextPart && isValidHTTPMethod(nextPart)) {
          method = nextPart;
          i++; // Skip the next part as we've consumed it
        }
      } else if (part === '-H' || part === '--header') {
        const headerValue = parts[i + 1];
        if (headerValue) {
          // Remove quotes if present
          const cleanHeader = headerValue.replace(/^["']|["']$/g, '');
          const colonIndex = cleanHeader.indexOf(':');
          if (colonIndex > 0) {
            const key = cleanHeader.substring(0, colonIndex).trim();
            const value = cleanHeader.substring(colonIndex + 1).trim();
            headers[key] = value;
          }
          i++; // Skip the next part as we've consumed it
        }
      } else if (part === '-d' || part === '--data') {
        const dataValue = parts[i + 1];
        if (dataValue) {
          // Remove quotes if present
          const cleanData = dataValue.replace(/^["']|["']$/g, '');
          try {
            // Try to parse as JSON
            body = JSON.parse(cleanData);
          } catch {
            // If not JSON, keep as string
            body = cleanData;
          }
          i++; // Skip the next part as we've consumed it
        }
      } else if (part.startsWith('http://') || part.startsWith('https://')) {
        url = part;
      } else if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
        // Handle quoted URLs
        const unquoted = part.slice(1, -1);
        if (unquoted.startsWith('http://') || unquoted.startsWith('https://')) {
          url = unquoted;
        }
      }
    }

    if (!url) {
      return null;
    }

    return {
      method,
      url,
      headers,
      body,
    };
  }

  /**
   * Tokenize curl command into parts, handling quotes and multiline properly
   */
  private static tokenizeCurlCommand(command: string): string[] {
    // First, normalize the command by removing line continuations and extra whitespace
    const normalized = command
      .replace(/\\\s*\n\s*/g, ' ') // Remove line continuations
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        current += char;
        quoteChar = '';
      } else if (!inQuotes && /\s/.test(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      tokens.push(current.trim());
    }
    
    return tokens;
  }

  /**
   * Find the most relevant heading for a given line number
   */
  private static findContextHeading(lineNumber: number, headings: MarkdownHeading[]): MarkdownHeading | undefined {
    let contextHeading: MarkdownHeading | undefined;
    
    for (const heading of headings) {
      if (heading.lineNumber < lineNumber) {
        if (!contextHeading || heading.lineNumber > contextHeading.lineNumber) {
          contextHeading = heading;
        }
      }
    }
    
    return contextHeading;
  }

  /**
   * Extract description from context around a code block
   */
  private static extractDescription(codeBlock: MarkdownCodeBlock, headings: MarkdownHeading[]): string | undefined {
    const contextHeading = this.findContextHeading(codeBlock.lineNumber, headings);
    return contextHeading?.text;
  }

  /**
   * Generate a URL-friendly ID from heading text
   */
  private static generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  /**
   * Validate markdown structure and content
   */
  public static validateMarkdown(content: string, fileName?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: string[] = [];

    try {
      const structure = this.parseMarkdown(content, fileName);
      
      // Check for basic structure
      if (structure.headings.length === 0) {
        warnings.push({
          type: 'structure',
          message: 'No headings found in markdown file',
          suggestions: ['Add headings to organize your API documentation'],
        });
      }

      if (structure.codeBlocks.length === 0) {
        errors.push({
          type: 'content',
          message: 'No code blocks found in markdown file',
          suggestions: ['Add code blocks with curl commands to define your APIs'],
        });
      }

      // Check for curl commands
      const curlBlocks = structure.codeBlocks.filter(block => block.isCurlCommand);
      if (curlBlocks.length === 0) {
        errors.push({
          type: 'content',
          message: 'No curl commands found in code blocks',
          suggestions: ['Add curl commands in code blocks to define API endpoints'],
        });
      }

      // Validate curl commands
      curlBlocks.forEach(block => {
        try {
          const commands = this.parseCurlFromCodeBlock(block, structure.headings);
          if (commands.length === 0) {
            warnings.push({
              type: 'curl',
              message: `Invalid curl command in code block at line ${block.lineNumber}`,
              lineNumber: block.lineNumber,
              suggestions: ['Check curl command syntax and ensure it includes a valid URL'],
            });
          }
        } catch (error) {
          errors.push({
            type: 'curl',
            message: `Failed to parse curl command at line ${block.lineNumber}: ${error}`,
            lineNumber: block.lineNumber,
          });
        }
      });

      // Generate suggestions
      if (structure.headings.length > 0 && curlBlocks.length > 0) {
        suggestions.push('Consider organizing curl commands under descriptive headings');
      }
      
      if (structure.codeBlocks.some(block => !block.language)) {
        suggestions.push('Specify language for code blocks (e.g., ```bash) for better syntax highlighting');
      }

    } catch (error) {
      errors.push({
        type: 'format',
        message: `Failed to parse markdown: ${error}`,
        suggestions: ['Check markdown syntax and formatting'],
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}