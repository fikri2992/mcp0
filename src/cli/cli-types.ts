/**
 * CLI Options interface for command-line arguments and configuration
 */
export interface CLIOptions {
  input: string;           // Path to API markdown file
  output: string;          // Output directory for generated code
  name?: string;           // Generated MCP server name
  openaiApiKey?: string;   // OpenAI API key for parsing
  debug?: boolean;         // Debug logging
  template?: string;       // Custom template directory
  model?: string;          // OpenAI model to use (default: gpt-4)
  quiet?: boolean;         // Suppress non-error output
  noAi?: boolean;          // Disable AI-powered parsing
  config?: string;         // Path to configuration file
  overwrite?: boolean;     // Overwrite existing files
  backup?: boolean;        // Create backup of existing files
}

/**
 * CLI Command interface for command definitions
 */
export interface CLICommand {
  name: string;
  description: string;
  handler: (options: CLIOptions) => Promise<void>;
}

/**
 * Configuration file structure
 */
export interface CLIConfig {
  // Default options
  defaults?: {
    model?: string;
    template?: string;
    outputDir?: string;
    templateDir?: string;
    debug?: boolean;
    quiet?: boolean;
    noAi?: boolean;
  };
  
  // OpenAI configuration
  openai?: {
    apiKey?: string;
    model?: string;
    timeout?: number;
    maxTokens?: number;
    temperature?: number;
  };
  
  // Template configuration
  templates?: {
    directory?: string;
    custom?: Record<string, string>;
  };
  
  // Output configuration
  output?: {
    directory?: string;
    overwrite?: boolean;
    backup?: boolean;
  };
  
  // Validation configuration
  validation?: {
    strict?: boolean;
    skipWarnings?: boolean;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * CLI Error types
 */
export type CLIErrorType = 
  | 'input_not_found'
  | 'input_invalid'
  | 'output_error'
  | 'config_invalid'
  | 'config_not_found'
  | 'openai_error'
  | 'template_error'
  | 'generation_error'
  | 'validation_error'
  | 'unknown_error';

/**
 * CLI Error interface
 */
export interface CLIErrorInfo {
  type: CLIErrorType;
  message: string;
  details?: any;
  suggestions?: string[];
  code?: number;
}

/**
 * Progress reporting interface
 */
export interface ProgressInfo {
  step: string;
  current: number;
  total: number;
  message?: string;
}

/**
 * Generation options for code generation
 */
export interface GenerationOptions {
  includeTests: boolean;
  includeDocumentation: boolean;
  typescript: boolean;
  aiParsing: boolean;
  overwrite: boolean;
  backup: boolean;
}