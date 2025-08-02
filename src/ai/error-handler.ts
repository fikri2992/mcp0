export interface AIError {
  type: 'rate_limit' | 'api_key' | 'model_unavailable' | 'network' | 'parsing' | 'unknown';
  code?: string;
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  suggestions: string[];
}

export class AIErrorHandler {
  /**
   * Parse and categorize OpenAI API errors
   */
  static parseOpenAIError(error: any): AIError {
    const message = error?.message || error?.toString() || 'Unknown error';
    const code = error?.code || error?.status?.toString();

    // Rate limiting errors
    if (message.includes('rate limit') || message.includes('quota') || code === '429') {
      return {
        type: 'rate_limit',
        code,
        message: 'OpenAI API rate limit exceeded',
        retryable: true,
        retryAfter: this.extractRetryAfter(error) || 60,
        suggestions: [
          'Wait before retrying the request',
          'Consider upgrading your OpenAI plan for higher rate limits',
          'Implement exponential backoff in your retry logic'
        ]
      };
    }

    // Authentication errors
    if (message.includes('api key') || message.includes('authentication') || code === '401') {
      return {
        type: 'api_key',
        code,
        message: 'Invalid or missing OpenAI API key',
        retryable: false,
        suggestions: [
          'Check that your OpenAI API key is correct',
          'Ensure the API key has sufficient permissions',
          'Verify the API key is not expired'
        ]
      };
    }

    // Model availability errors
    if (message.includes('model') || message.includes('engine') || code === '404') {
      return {
        type: 'model_unavailable',
        code,
        message: 'Requested OpenAI model is not available',
        retryable: false,
        suggestions: [
          'Check that the model name is correct (e.g., "gpt-4", "gpt-3.5-turbo")',
          'Verify your account has access to the requested model',
          'Try using a different model as fallback'
        ]
      };
    }

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return {
        type: 'network',
        code,
        message: 'Network error connecting to OpenAI API',
        retryable: true,
        retryAfter: 30,
        suggestions: [
          'Check your internet connection',
          'Verify firewall settings allow OpenAI API access',
          'Try again in a few moments'
        ]
      };
    }

    // Parsing/validation errors
    if (message.includes('parse') || message.includes('validation') || message.includes('schema')) {
      return {
        type: 'parsing',
        code,
        message: 'Error parsing AI response or validating input',
        retryable: true,
        retryAfter: 10,
        suggestions: [
          'The AI response may have been malformed',
          'Try simplifying the input markdown',
          'Check for special characters that might cause parsing issues'
        ]
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      code,
      message: `Unknown error: ${message}`,
      retryable: true,
      retryAfter: 30,
      suggestions: [
        'Check the OpenAI API status page',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    };
  }

  /**
   * Determine if an error should be retried
   */
  static shouldRetry(error: AIError, attemptCount: number, maxRetries: number): boolean {
    if (attemptCount >= maxRetries) {
      return false;
    }

    return error.retryable;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(error: AIError, attemptCount: number): number {
    const baseDelay = error.retryAfter || 30;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptCount - 1), 300); // Max 5 minutes
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    
    return Math.floor(exponentialDelay + jitter) * 1000; // Convert to milliseconds
  }

  /**
   * Create user-friendly error message
   */
  static formatUserMessage(error: AIError): string {
    let message = `❌ ${error.message}`;
    
    if (error.suggestions.length > 0) {
      message += '\n\n💡 Suggestions:';
      error.suggestions.forEach((suggestion, index) => {
        message += `\n  ${index + 1}. ${suggestion}`;
      });
    }

    if (error.retryable) {
      const retryMinutes = Math.ceil((error.retryAfter || 30) / 60);
      message += `\n\n🔄 This error is retryable. Consider waiting ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'} before trying again.`;
    }

    return message;
  }

  /**
   * Extract retry-after header from error response
   */
  private static extractRetryAfter(error: any): number | undefined {
    // Check various places where retry-after might be stored
    const retryAfter = 
      error?.response?.headers?.['retry-after'] ||
      error?.headers?.['retry-after'] ||
      error?.retryAfter;

    if (retryAfter) {
      const seconds = parseInt(retryAfter.toString(), 10);
      return isNaN(seconds) ? undefined : seconds;
    }

    return undefined;
  }
}

/**
 * Retry wrapper for AI operations with exponential backoff
 */
export class AIRetryHandler {
  private maxRetries: number;
  private baseDelay: number;

  constructor(maxRetries: number = 3, baseDelay: number = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'AI operation'
  ): Promise<T> {
    let lastError: AIError | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const aiError = AIErrorHandler.parseOpenAIError(error);
        lastError = aiError;

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt > this.maxRetries || !AIErrorHandler.shouldRetry(aiError, attempt, this.maxRetries)) {
          throw new Error(`${operationName} failed after ${attempt} attempt${attempt === 1 ? '' : 's'}: ${aiError.message}`);
        }

        // Calculate delay and wait
        const delay = AIErrorHandler.calculateRetryDelay(aiError, attempt);
        console.warn(`⚠️  ${operationName} failed (attempt ${attempt}/${this.maxRetries + 1}): ${aiError.message}`);
        console.warn(`🕐 Retrying in ${Math.round(delay / 1000)} seconds...`);
        
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error(`${operationName} failed: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker for AI operations to prevent cascading failures
 */
export class AICircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>, operationName: string = 'AI operation'): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Too many recent failures.`);
      } else {
        this.state = 'half-open';
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): {
    state: string;
    failureCount: number;
    lastFailureTime: number;
    timeUntilRecovery: number;
  } {
    const timeUntilRecovery = this.state === 'open' 
      ? Math.max(0, this.recoveryTimeout - (Date.now() - this.lastFailureTime))
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilRecovery
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}