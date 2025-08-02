import { CLIErrorType, CLIErrorInfo } from './cli-types.js';

/**
 * Custom CLI Error class
 */
export class CLIError extends Error {
  public readonly type: CLIErrorType;
  public readonly details?: any;
  public readonly suggestions?: string[];
  public readonly code?: number;

  constructor(
    type: CLIErrorType,
    message: string,
    details?: any,
    suggestions?: string[],
    code?: number
  ) {
    super(message);
    this.name = 'CLIError';
    this.type = type;
    this.details = details;
    this.suggestions = suggestions;
    this.code = code;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CLIError);
    }
  }

  /**
   * Convert to CLIErrorInfo object
   */
  toErrorInfo(): CLIErrorInfo {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      suggestions: this.suggestions,
      code: this.code,
    };
  }
}

/**
 * Handle CLI errors with appropriate user feedback
 */
export async function handleError(error: unknown, debug: boolean = false): Promise<void> {
  let errorInfo: CLIErrorInfo;

  if (error instanceof CLIError) {
    errorInfo = error.toErrorInfo();
  } else if (error instanceof Error) {
    errorInfo = {
      type: 'unknown_error',
      message: error.message,
      details: debug ? { stack: error.stack } : undefined,
    };
  } else {
    errorInfo = {
      type: 'unknown_error',
      message: 'An unknown error occurred',
      details: debug ? error : undefined,
    };
  }

  // Display error to user
  displayError(errorInfo, debug);
}

/**
 * Display error information to the user
 */
function displayError(errorInfo: CLIErrorInfo, debug: boolean): void {
  console.error('❌ Error:', errorInfo.message);
  
  // Show error type in debug mode
  if (debug) {
    console.error('Error Type:', errorInfo.type);
  }
  
  // Show details if available
  if (errorInfo.details && debug) {
    console.error('Details:', JSON.stringify(errorInfo.details, null, 2));
  }
  
  // Show suggestions if available
  if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
    console.error('\n💡 Suggestions:');
    errorInfo.suggestions.forEach((suggestion, index) => {
      console.error(`  ${index + 1}. ${suggestion}`);
    });
  }
  
  // Show specific help based on error type
  showErrorHelp(errorInfo.type);
}

/**
 * Show context-specific help based on error type
 */
function showErrorHelp(errorType: CLIErrorType): void {
  const helpMessages: Record<CLIErrorType, string[]> = {
    input_not_found: [
      'Make sure the input file path is correct',
      'Check that the file exists and is readable',
      'Use absolute path if relative path is not working',
    ],
    input_invalid: [
      'Ensure the input file is a valid markdown file',
      'Check that curl commands are properly formatted',
      'Verify the file contains API specifications',
    ],
    output_error: [
      'Check that you have write permissions to the output directory',
      'Ensure the output directory path is valid',
      'Try using a different output directory',
    ],
    config_invalid: [
      'Check the configuration file syntax',
      'Verify all required configuration values are present',
      'Use --debug flag to see detailed configuration errors',
    ],
    config_not_found: [
      'Check that the configuration file path is correct',
      'Use mcp-builder config --init to create a default configuration',
      'Configuration file is optional - defaults will be used if not found',
    ],
    openai_error: [
      'Verify your OpenAI API key is correct',
      'Check your OpenAI account has sufficient credits',
      'Try using --no-ai flag to skip AI processing',
    ],
    template_error: [
      'Check that the template directory exists',
      'Verify template files are properly formatted',
      'Try without custom templates to use built-in templates',
    ],
    generation_error: [
      'Check that all required dependencies are available',
      'Verify the API specification is complete',
      'Try with --debug flag to see detailed generation logs',
    ],
    validation_error: [
      'Review the validation errors shown above',
      'Check the input file format and content',
      'Use --no-strict flag to allow warnings',
    ],
    unknown_error: [
      'Try running with --debug flag for more information',
      'Check that all dependencies are properly installed',
      'Report this issue if the problem persists',
    ],
  };

  const messages = helpMessages[errorType];
  if (messages && messages.length > 0) {
    console.error('\n🔧 Troubleshooting:');
    messages.forEach((message, index) => {
      console.error(`  • ${message}`);
    });
  }

  // Show general help
  console.error('\nFor more help, run: mcp-builder --help');
}

/**
 * Create specific error instances for common scenarios
 */
export const ErrorFactory = {
  inputNotFound: (filePath: string): CLIError => 
    new CLIError(
      'input_not_found',
      `Input file not found: ${filePath}`,
      { filePath },
      [
        'Check that the file path is correct',
        'Ensure the file exists and is readable',
        'Try using an absolute path',
      ]
    ),

  inputInvalid: (filePath: string, reason: string): CLIError =>
    new CLIError(
      'input_invalid',
      `Invalid input file: ${reason}`,
      { filePath, reason },
      [
        'Ensure the file is a valid markdown file',
        'Check that curl commands are properly formatted',
        'Verify the file contains API specifications',
      ]
    ),

  outputError: (outputPath: string, reason: string): CLIError =>
    new CLIError(
      'output_error',
      `Output error: ${reason}`,
      { outputPath, reason },
      [
        'Check write permissions to the output directory',
        'Ensure the output path is valid',
        'Try a different output directory',
      ]
    ),

  configInvalid: (configPath: string, errors: string[]): CLIError =>
    new CLIError(
      'config_invalid',
      'Configuration validation failed',
      { configPath, errors },
      [
        'Check the configuration file syntax',
        'Verify all required values are present',
        'Use --debug for detailed error information',
      ]
    ),

  openaiError: (message: string): CLIError =>
    new CLIError(
      'openai_error',
      `OpenAI API error: ${message}`,
      { message },
      [
        'Verify your OpenAI API key is correct',
        'Check your account has sufficient credits',
        'Try using --no-ai to skip AI processing',
      ]
    ),

  generationError: (message: string, details?: any): CLIError =>
    new CLIError(
      'generation_error',
      `Code generation failed: ${message}`,
      details,
      [
        'Check that all dependencies are available',
        'Verify the API specification is complete',
        'Use --debug for detailed generation logs',
      ]
    ),
};