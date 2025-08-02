import { OpenAIClient, APISpec, ParsingContext } from './openai-client.js';

export interface CurlCommand {
  raw: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  options?: string[];
}

export interface CurlAnalysisResult {
  apiSpec: APISpec;
  confidence: number;
  warnings: string[];
  extractedElements: {
    method: boolean;
    url: boolean;
    headers: boolean;
    body: boolean;
    parameters: boolean;
  };
}

export class CurlAnalyzer {
  private openaiClient: OpenAIClient;

  constructor(openaiClient: OpenAIClient) {
    this.openaiClient = openaiClient;
  }

  /**
   * Extract curl commands from markdown content
   */
  extractCurlCommands(markdown: string): CurlCommand[] {
    const curlCommands: CurlCommand[] = [];
    
    // Match code blocks that contain curl commands
    const codeBlockRegex = /```(?:bash|shell|sh)?\s*\n([\s\S]*?)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const codeBlock = match[1];
      
      // Look for curl commands in the code block
      const curlMatches = this.findCurlInBlock(codeBlock);
      curlCommands.push(...curlMatches);
    }

    // Also look for inline curl commands (less common but possible)
    const inlineCurlRegex = /`curl[^`]+`/g;
    let inlineMatch;
    
    while ((inlineMatch = inlineCurlRegex.exec(markdown)) !== null) {
      const curlCommand = inlineMatch[0].slice(1, -1); // Remove backticks
      curlCommands.push({ raw: curlCommand });
    }

    return curlCommands;
  }

  /**
   * Analyze a single curl command using AI
   */
  async analyzeCurlCommand(
    curlCommand: CurlCommand, 
    context?: ParsingContext
  ): Promise<CurlAnalysisResult> {
    try {
      // First, try basic parsing to extract what we can
      const basicParsed = this.basicCurlParse(curlCommand.raw);
      
      // Use AI to get a complete API specification
      const apiSpec = await this.openaiClient.analyzeCurlCommand(curlCommand.raw, context);
      
      // Calculate confidence based on what we could extract
      const extractedElements = {
        method: !!basicParsed.method || !!apiSpec.method,
        url: !!basicParsed.url || !!apiSpec.url,
        headers: Object.keys(basicParsed.headers || {}).length > 0 || Object.keys(apiSpec.headers || {}).length > 0,
        body: !!basicParsed.body || !!apiSpec.body,
        parameters: (apiSpec.parameters?.length || 0) > 0
      };

      const confidence = this.calculateConfidence(extractedElements, curlCommand.raw);
      const warnings = this.generateWarnings(extractedElements, curlCommand.raw);

      return {
        apiSpec,
        confidence,
        warnings,
        extractedElements
      };
    } catch (error) {
      throw new Error(`Failed to analyze curl command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze multiple curl commands in batch
   */
  async analyzeCurlCommands(
    curlCommands: CurlCommand[],
    context?: ParsingContext
  ): Promise<CurlAnalysisResult[]> {
    const results: CurlAnalysisResult[] = [];
    
    for (const curlCommand of curlCommands) {
      try {
        const result = await this.analyzeCurlCommand(curlCommand, context);
        results.push(result);
      } catch (error) {
        // Create a failed result with low confidence
        results.push({
          apiSpec: {
            name: 'Failed to parse',
            method: 'GET',
            url: '',
            curlCommand: curlCommand.raw
          },
          confidence: 0,
          warnings: [`Failed to parse curl command: ${error instanceof Error ? error.message : 'Unknown error'}`],
          extractedElements: {
            method: false,
            url: false,
            headers: false,
            body: false,
            parameters: false
          }
        });
      }
    }

    return results;
  }

  /**
   * Find curl commands within a code block
   */
  private findCurlInBlock(codeBlock: string): CurlCommand[] {
    const commands: CurlCommand[] = [];
    const lines = codeBlock.split('\n');
    let currentCommand = '';
    let inCommand = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('curl')) {
        if (currentCommand && inCommand) {
          // Save previous command
          commands.push({ raw: currentCommand.trim() });
        }
        currentCommand = line;
        inCommand = true;
      } else if (inCommand) {
        if (line.endsWith('\\')) {
          // Line continuation
          currentCommand += ' ' + line.slice(0, -1).trim();
        } else if (line.length > 0) {
          // End of command
          currentCommand += ' ' + line;
          commands.push({ raw: currentCommand.trim() });
          currentCommand = '';
          inCommand = false;
        } else {
          // Empty line might end command
          if (currentCommand) {
            commands.push({ raw: currentCommand.trim() });
            currentCommand = '';
            inCommand = false;
          }
        }
      }
    }

    // Handle case where command is at end of block
    if (currentCommand && inCommand) {
      commands.push({ raw: currentCommand.trim() });
    }

    return commands;
  }

  /**
   * Basic curl parsing without AI (fallback/validation)
   */
  private basicCurlParse(curlCommand: string): Partial<CurlCommand> {
    const result: Partial<CurlCommand> = {
      raw: curlCommand,
      headers: {},
      options: []
    };

    // Extract HTTP method
    const methodMatch = curlCommand.match(/-X\s+(\w+)/i);
    if (methodMatch) {
      result.method = methodMatch[1].toUpperCase();
    } else {
      // Default to GET if no method specified
      result.method = 'GET';
    }

    // Extract URL (look for quoted or unquoted URLs)
    const urlMatches = [
      curlCommand.match(/"(https?:\/\/[^"]+)"/),
      curlCommand.match(/'(https?:\/\/[^']+)'/),
      curlCommand.match(/curl\s+(?:-\w+\s+)*([^\s-][^\s]*)/),
    ];

    for (const match of urlMatches) {
      if (match && match[1]) {
        result.url = match[1];
        break;
      }
    }

    // Extract headers
    const headerRegex = /-H\s+["']([^"']+)["']/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(curlCommand)) !== null) {
      const headerString = headerMatch[1];
      const colonIndex = headerString.indexOf(':');
      if (colonIndex > 0) {
        const key = headerString.substring(0, colonIndex).trim();
        const value = headerString.substring(colonIndex + 1).trim();
        result.headers![key] = value;
      }
    }

    // Extract body data
    const bodyMatches = [
      curlCommand.match(/-d\s+["']([^"']+)["']/),
      curlCommand.match(/--data\s+["']([^"']+)["']/),
      curlCommand.match(/--data-raw\s+["']([^"']+)["']/),
    ];

    for (const match of bodyMatches) {
      if (match && match[1]) {
        result.body = match[1];
        break;
      }
    }

    return result;
  }

  /**
   * Calculate confidence score based on extracted elements
   */
  private calculateConfidence(extractedElements: any, curlCommand: string): number {
    let score = 0;
    let maxScore = 0;

    // Method extraction (20 points)
    maxScore += 20;
    if (extractedElements.method) score += 20;

    // URL extraction (30 points - most important)
    maxScore += 30;
    if (extractedElements.url) score += 30;

    // Headers extraction (20 points)
    maxScore += 20;
    if (extractedElements.headers) score += 20;

    // Body extraction (15 points)
    maxScore += 15;
    if (extractedElements.body) score += 15;

    // Parameters extraction (15 points)
    maxScore += 15;
    if (extractedElements.parameters) score += 15;

    // Bonus for well-formed curl command
    if (curlCommand.includes('curl') && curlCommand.length > 10) {
      score += 5;
      maxScore += 5;
    }

    return Math.min(1, score / maxScore);
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(extractedElements: any, curlCommand: string): string[] {
    const warnings: string[] = [];

    if (!extractedElements.method) {
      warnings.push('HTTP method could not be determined');
    }

    if (!extractedElements.url) {
      warnings.push('URL could not be extracted');
    }

    if (!extractedElements.headers && curlCommand.includes('-H')) {
      warnings.push('Headers were present but could not be parsed');
    }

    if (!extractedElements.body && (curlCommand.includes('-d') || curlCommand.includes('--data'))) {
      warnings.push('Request body was present but could not be parsed');
    }

    if (!extractedElements.parameters) {
      warnings.push('No parameters could be inferred from the curl command');
    }

    if (curlCommand.length < 20) {
      warnings.push('Curl command appears to be incomplete or truncated');
    }

    if (!curlCommand.includes('http')) {
      warnings.push('No HTTP URL found in curl command');
    }

    return warnings;
  }
}