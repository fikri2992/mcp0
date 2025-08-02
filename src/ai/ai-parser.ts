import { OpenAIClient, OpenAIClientConfig, ParsingContext } from './openai-client.js';
import { APIExtractor, ExtractionOptions, ExtractionResult } from './api-extractor.js';

export interface AIParserConfig extends OpenAIClientConfig {
  extractionOptions?: ExtractionOptions;
}

export interface AIParserResult extends ExtractionResult {
  processingTime: number;
  tokensUsed?: number;
  cost?: number;
}

export class AIParser {
  private openaiClient: OpenAIClient;
  private apiExtractor: APIExtractor;
  private config: AIParserConfig;

  constructor(config: AIParserConfig) {
    this.config = config;
    this.openaiClient = new OpenAIClient(config);
    this.apiExtractor = new APIExtractor(this.openaiClient);
  }

  /**
   * Parse markdown content and extract API specifications
   */
  async parseMarkdown(
    markdown: string,
    context?: ParsingContext,
    options?: ExtractionOptions
  ): Promise<AIParserResult> {
    const startTime = Date.now();
    
    try {
      // Validate input first (before any AI calls)
      this.validateInput(markdown);
      
      // Extract APIs using the API extractor
      const extractionResult = await this.apiExtractor.extractFromMarkdown(
        markdown,
        context,
        { ...this.config.extractionOptions, ...options }
      );

      const processingTime = Date.now() - startTime;

      return {
        ...extractionResult,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // If it's a validation error, throw it immediately
      if (error instanceof Error && (
        error.message.includes('required') ||
        error.message.includes('empty') ||
        error.message.includes('large') ||
        error.message.includes('curl')
      )) {
        throw error;
      }
      
      return {
        success: false,
        apis: [],
        metadata: { name: 'Parser Error' },
        confidence: 0,
        warnings: [],
        errors: [`AI Parser failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        processingStats: {
          totalCurlCommands: 0,
          successfullyParsed: 0,
          failedToParse: 0,
          averageConfidence: 0
        },
        processingTime
      };
    }
  }

  /**
   * Parse markdown with automatic context inference
   */
  async parseMarkdownWithAutoContext(
    markdown: string,
    options?: ExtractionOptions
  ): Promise<AIParserResult> {
    const inferredContext = this.inferContextFromMarkdown(markdown);
    return this.parseMarkdown(markdown, inferredContext, options);
  }

  /**
   * Validate API extraction result
   */
  validateResult(result: AIParserResult): { isValid: boolean; issues: string[] } {
    return this.apiExtractor.validateExtractionResult(result);
  }

  /**
   * Get parser statistics and health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      openaiConnection: boolean;
      modelAvailable: boolean;
      lastError?: string;
    };
  }> {
    try {
      // Test OpenAI connection with a simple request
      const testResult = await this.openaiClient.parseMarkdownToAPISpecs({
        markdown: '# Test API\n\n```bash\ncurl -X GET "https://api.example.com/test"\n```'
      });

      return {
        status: 'healthy',
        details: {
          openaiConnection: true,
          modelAvailable: true
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        return {
          status: 'degraded',
          details: {
            openaiConnection: true,
            modelAvailable: false,
            lastError: errorMessage
          }
        };
      }

      return {
        status: 'unhealthy',
        details: {
          openaiConnection: false,
          modelAvailable: false,
          lastError: errorMessage
        }
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIParserConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate clients if API key or model changed
    if (newConfig.apiKey || newConfig.model) {
      this.openaiClient = new OpenAIClient(this.config);
      this.apiExtractor = new APIExtractor(this.openaiClient);
    }
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<AIParserConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Validate input markdown
   */
  private validateInput(markdown: string): void {
    if (!markdown || typeof markdown !== 'string') {
      throw new Error('Markdown content is required and must be a string');
    }

    if (markdown.trim().length === 0) {
      throw new Error('Markdown content cannot be empty');
    }

    if (markdown.length > 100000) {
      throw new Error('Markdown content is too large (max 100KB)');
    }

    // Check if markdown contains any curl commands
    if (!markdown.includes('curl')) {
      throw new Error('No curl commands found in markdown content');
    }
  }

  /**
   * Infer context from markdown content
   */
  private inferContextFromMarkdown(markdown: string): ParsingContext {
    const context: ParsingContext = {};

    // Try to infer API name from title
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      context.apiName = titleMatch[1].trim();
    }

    // Try to infer base URL from first curl command
    const curlMatch = markdown.match(/curl[^"']*["']([^"']+)["']/);
    if (curlMatch) {
      const url = curlMatch[1];
      const baseUrlMatch = url.match(/^(https?:\/\/[^\/]+)/);
      if (baseUrlMatch) {
        context.baseUrl = baseUrlMatch[1];
      }
    }

    // Count expected endpoints by counting curl commands
    const curlCount = (markdown.match(/curl/g) || []).length;
    if (curlCount > 0) {
      context.expectedEndpoints = curlCount;
    }

    // Try to infer common headers from multiple curl commands
    const headerMatches = markdown.match(/-H\s+["']([^"']+)["']/g);
    if (headerMatches && headerMatches.length > 1) {
      const headerCounts: Record<string, number> = {};
      
      headerMatches.forEach(match => {
        const headerMatch = match.match(/-H\s+["']([^"':]+):\s*([^"']+)["']/);
        if (headerMatch) {
          const key = headerMatch[1].trim();
          headerCounts[key] = (headerCounts[key] || 0) + 1;
        }
      });

      // Headers that appear more than once might be common
      const commonHeaders: Record<string, string> = {};
      Object.entries(headerCounts).forEach(([key, count]) => {
        if (count > 1) {
          // Find the actual value for this header
          const valueMatch = markdown.match(new RegExp(`-H\\s+["']${key}:\\s*([^"']+)["']`));
          if (valueMatch) {
            commonHeaders[key] = valueMatch[1].trim();
          }
        }
      });

      if (Object.keys(commonHeaders).length > 0) {
        context.commonHeaders = commonHeaders;
      }
    }

    return context;
  }
}

// Export factory function for easy instantiation
export function createAIParser(config: AIParserConfig): AIParser {
  return new AIParser(config);
}

// Export default configuration
export const DEFAULT_AI_PARSER_CONFIG: Partial<AIParserConfig> = {
  model: 'gpt-4',
  maxTokens: 4000,
  temperature: 0.1,
  extractionOptions: {
    useAIOptimization: true,
    confidenceThreshold: 0.6,
    maxRetries: 2,
    fallbackToBasicParsing: true
  }
};