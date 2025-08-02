import { OpenAIClient, AIParsingRequest, AIParsingResult, APISpec, ParsingContext } from './openai-client.js';
import { CurlAnalyzer, CurlAnalysisResult } from './curl-analyzer.js';

export interface ExtractionOptions {
  useAIOptimization?: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
  fallbackToBasicParsing?: boolean;
}

export interface ExtractionResult {
  success: boolean;
  apis: APISpec[];
  metadata: {
    name: string;
    description?: string;
    baseUrl?: string;
    authentication?: any;
    commonHeaders?: Record<string, string>;
  };
  confidence: number;
  warnings: string[];
  errors: string[];
  processingStats: {
    totalCurlCommands: number;
    successfullyParsed: number;
    failedToParse: number;
    averageConfidence: number;
  };
}

export class APIExtractor {
  private openaiClient: OpenAIClient;
  private curlAnalyzer: CurlAnalyzer;
  private defaultOptions: ExtractionOptions = {
    useAIOptimization: true,
    confidenceThreshold: 0.6,
    maxRetries: 2,
    fallbackToBasicParsing: true
  };

  constructor(openaiClient: OpenAIClient) {
    this.openaiClient = openaiClient;
    this.curlAnalyzer = new CurlAnalyzer(openaiClient);
  }

  /**
   * Extract API specifications from markdown content
   */
  async extractFromMarkdown(
    markdown: string,
    context?: ParsingContext,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // First, try the comprehensive AI approach
      const aiResult = await this.tryAIExtraction(markdown, context, opts);
      
      if (aiResult.success && aiResult.confidence >= opts.confidenceThreshold!) {
        return aiResult;
      }

      // If AI extraction failed or confidence is low, try curl-by-curl analysis
      warnings.push('AI extraction had low confidence, falling back to individual curl analysis');
      const curlResult = await this.tryCurlByUrlAnalysis(markdown, context, opts);
      
      if (curlResult.success) {
        return curlResult;
      }

      // If both approaches failed, return the best result we have
      if (aiResult.confidence > curlResult.confidence) {
        return { ...aiResult, warnings: [...aiResult.warnings, ...warnings] };
      } else {
        return { ...curlResult, warnings: [...curlResult.warnings, ...warnings] };
      }

    } catch (error) {
      errors.push(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        apis: [],
        metadata: { name: 'Failed extraction' },
        confidence: 0,
        warnings,
        errors,
        processingStats: {
          totalCurlCommands: 0,
          successfullyParsed: 0,
          failedToParse: 0,
          averageConfidence: 0
        }
      };
    }
  }

  /**
   * Try comprehensive AI extraction of the entire markdown
   */
  private async tryAIExtraction(
    markdown: string,
    context?: ParsingContext,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    const opts = { ...this.defaultOptions, ...options };
    let retries = 0;
    
    while (retries <= opts.maxRetries!) {
      try {
        const request: AIParsingRequest = { markdown, context };
        const aiResult: AIParsingResult = await this.openaiClient.parseMarkdownToAPISpecs(request);
        
        // Optionally optimize each API spec
        let optimizedApis = aiResult.apis;
        if (opts.useAIOptimization && aiResult.apis.length > 0) {
          optimizedApis = await this.optimizeAPISpecs(aiResult.apis);
        }

        const processingStats = {
          totalCurlCommands: aiResult.apis.length,
          successfullyParsed: aiResult.apis.length,
          failedToParse: 0,
          averageConfidence: aiResult.confidence
        };

        return {
          success: true,
          apis: optimizedApis,
          metadata: aiResult.metadata,
          confidence: aiResult.confidence,
          warnings: aiResult.warnings,
          errors: [],
          processingStats
        };

      } catch (error) {
        retries++;
        if (retries > opts.maxRetries!) {
          return {
            success: false,
            apis: [],
            metadata: { name: 'AI extraction failed' },
            confidence: 0,
            warnings: [],
            errors: [`AI extraction failed after ${opts.maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`],
            processingStats: {
              totalCurlCommands: 0,
              successfullyParsed: 0,
              failedToParse: 0,
              averageConfidence: 0
            }
          };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      apis: [],
      metadata: { name: 'Unexpected error' },
      confidence: 0,
      warnings: [],
      errors: ['Unexpected error in AI extraction'],
      processingStats: {
        totalCurlCommands: 0,
        successfullyParsed: 0,
        failedToParse: 0,
        averageConfidence: 0
      }
    };
  }

  /**
   * Try curl-by-curl analysis as fallback
   */
  private async tryCurlByUrlAnalysis(
    markdown: string,
    context?: ParsingContext,
    options?: ExtractionOptions
  ): Promise<ExtractionResult> {
    const curlCommands = this.curlAnalyzer.extractCurlCommands(markdown);
    
    if (curlCommands.length === 0) {
      return {
        success: false,
        apis: [],
        metadata: { name: 'No curl commands found' },
        confidence: 0,
        warnings: ['No curl commands found in markdown'],
        errors: [],
        processingStats: {
          totalCurlCommands: 0,
          successfullyParsed: 0,
          failedToParse: 0,
          averageConfidence: 0
        }
      };
    }

    const analysisResults: CurlAnalysisResult[] = await this.curlAnalyzer.analyzeCurlCommands(curlCommands, context);
    
    const successfulResults = analysisResults.filter(r => r.confidence >= (options?.confidenceThreshold || 0.6));
    const apis = successfulResults.map(r => r.apiSpec);
    
    // Generate metadata from successful results
    const metadata = this.generateMetadataFromAPIs(apis, context);
    
    // Calculate overall confidence
    const totalConfidence = analysisResults.reduce((sum, r) => sum + r.confidence, 0);
    const averageConfidence = analysisResults.length > 0 ? totalConfidence / analysisResults.length : 0;
    
    // Collect all warnings
    const allWarnings = analysisResults.flatMap(r => r.warnings);
    
    const processingStats = {
      totalCurlCommands: curlCommands.length,
      successfullyParsed: successfulResults.length,
      failedToParse: curlCommands.length - successfulResults.length,
      averageConfidence
    };

    return {
      success: successfulResults.length > 0,
      apis,
      metadata,
      confidence: averageConfidence,
      warnings: allWarnings,
      errors: [],
      processingStats
    };
  }

  /**
   * Optimize API specifications using AI
   */
  private async optimizeAPISpecs(apis: APISpec[]): Promise<APISpec[]> {
    const optimizedApis: APISpec[] = [];
    
    for (const api of apis) {
      try {
        const optimized = await this.openaiClient.optimizeAPISpec(api);
        optimizedApis.push(optimized);
      } catch (error) {
        // If optimization fails, use the original
        optimizedApis.push(api);
      }
    }
    
    return optimizedApis;
  }

  /**
   * Generate metadata from successfully parsed APIs
   */
  private generateMetadataFromAPIs(apis: APISpec[], context?: ParsingContext): any {
    if (apis.length === 0) {
      return {
        name: context?.apiName || 'Empty API Collection',
        description: 'No APIs were successfully extracted'
      };
    }

    // Try to infer base URL from APIs
    let baseUrl = context?.baseUrl;
    if (!baseUrl && apis.length > 0) {
      const firstUrl = apis[0].url;
      const urlMatch = firstUrl.match(/^(https?:\/\/[^\/]+)/);
      if (urlMatch) {
        baseUrl = urlMatch[1];
      }
    }

    // Collect common headers
    const commonHeaders: Record<string, string> = {};
    if (apis.length > 1) {
      const headerCounts: Record<string, { value: string; count: number }> = {};
      
      apis.forEach(api => {
        if (api.headers) {
          Object.entries(api.headers).forEach(([key, value]) => {
            const headerKey = key.toLowerCase();
            if (!headerCounts[headerKey]) {
              headerCounts[headerKey] = { value, count: 0 };
            }
            if (headerCounts[headerKey].value === value) {
              headerCounts[headerKey].count++;
            }
          });
        }
      });

      // Headers that appear in more than half the APIs are considered common
      const threshold = Math.ceil(apis.length / 2);
      Object.entries(headerCounts).forEach(([key, data]) => {
        if (data.count >= threshold) {
          commonHeaders[key] = data.value;
        }
      });
    }

    // Try to detect authentication
    let authentication;
    const authHeaders = apis.flatMap(api => 
      Object.entries(api.headers || {}).filter(([key]) => 
        key.toLowerCase().includes('authorization') || key.toLowerCase().includes('auth')
      )
    );

    if (authHeaders.length > 0) {
      const [key, value] = authHeaders[0];
      if (value.toLowerCase().startsWith('bearer')) {
        authentication = { type: 'bearer', location: 'header', name: key };
      } else if (value.toLowerCase().startsWith('basic')) {
        authentication = { type: 'basic', location: 'header', name: key };
      } else {
        authentication = { type: 'apikey', location: 'header', name: key };
      }
    }

    return {
      name: context?.apiName || 'Generated API Collection',
      description: `API collection with ${apis.length} endpoint${apis.length === 1 ? '' : 's'}`,
      baseUrl,
      authentication,
      commonHeaders: Object.keys(commonHeaders).length > 0 ? commonHeaders : undefined
    };
  }

  /**
   * Validate extraction result
   */
  validateExtractionResult(result: ExtractionResult): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!result.success) {
      issues.push('Extraction was not successful');
    }

    if (result.apis.length === 0) {
      issues.push('No APIs were extracted');
    }

    if (result.confidence < 0.5) {
      issues.push('Overall confidence is below 50%');
    }

    // Validate individual APIs
    result.apis.forEach((api, index) => {
      if (!api.name || api.name.trim().length === 0) {
        issues.push(`API ${index + 1}: Missing or empty name`);
      }

      if (!api.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(api.method.toUpperCase())) {
        issues.push(`API ${index + 1}: Invalid or missing HTTP method`);
      }

      if (!api.url || !api.url.includes('http')) {
        issues.push(`API ${index + 1}: Invalid or missing URL`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}