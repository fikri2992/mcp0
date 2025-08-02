import { CLIConfig, ConfigValidationResult } from './cli-types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CLIError } from './cli-error-handler.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CLIConfig = {
  defaults: {
    model: process.env.OPENAI_MODEL || 'gpt-4',
    outputDir: process.env.DEFAULT_OUTPUT_DIR,
    templateDir: process.env.DEFAULT_TEMPLATE_DIR,
    debug: process.env.DEBUG === 'true',
    quiet: process.env.QUIET === 'true',
    noAi: process.env.NO_AI === 'true',
  },
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4',
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
  },
  output: {
    overwrite: false,
    backup: true,
  },
  validation: {
    strict: false,
    skipWarnings: false,
  },
};

/**
 * Configuration file names to search for
 */
const CONFIG_FILENAMES = [
  'mcp-builder.config.json',
  'mcp-builder.config.js',
  '.mcp-builder.json',
  '.mcp-builderrc',
];

/**
 * Load configuration from file or environment variables
 */
export async function loadConfig(configPath?: string): Promise<CLIConfig> {
  let config: CLIConfig = { ...DEFAULT_CONFIG };

  // Load from specified config file
  if (configPath) {
    try {
      const fileConfig = await loadConfigFile(configPath);
      config = mergeConfigs(config, fileConfig);
    } catch (error) {
      throw new CLIError(
        'config_not_found',
        `Configuration file not found: ${configPath}`,
        { path: configPath, error }
      );
    }
  } else {
    // Search for config files in current directory
    const foundConfig = await findConfigFile();
    if (foundConfig) {
      try {
        const fileConfig = await loadConfigFile(foundConfig);
        config = mergeConfigs(config, fileConfig);
      } catch (error) {
        // Log warning but continue with defaults
        console.warn(`Warning: Could not load config file ${foundConfig}:`, error);
      }
    }
  }

  // Override with environment variables
  config = mergeEnvironmentVariables(config);

  return config;
}

/**
 * Load configuration from a specific file
 */
async function loadConfigFile(filePath: string): Promise<CLIConfig> {
  const resolvedPath = path.resolve(filePath);
  
  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  
  if (ext === '.json' || !ext) {
    // JSON configuration
    const content = await fs.readFile(resolvedPath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new CLIError(
        'config_invalid',
        `Invalid JSON in config file: ${resolvedPath}`,
        { error }
      );
    }
  } else if (ext === '.js') {
    // JavaScript configuration (for future implementation)
    throw new CLIError(
      'config_invalid',
      'JavaScript config files not yet supported',
      { path: resolvedPath }
    );
  } else {
    throw new CLIError(
      'config_invalid',
      `Unsupported config file format: ${ext}`,
      { path: resolvedPath }
    );
  }
}

/**
 * Find configuration file in current directory
 */
async function findConfigFile(): Promise<string | null> {
  for (const filename of CONFIG_FILENAMES) {
    try {
      await fs.access(filename);
      return filename;
    } catch {
      // Continue searching
    }
  }
  return null;
}

/**
 * Merge two configuration objects
 */
function mergeConfigs(base: CLIConfig, override: CLIConfig): CLIConfig {
  return {
    defaults: { ...base.defaults, ...override.defaults },
    openai: { ...base.openai, ...override.openai },
    templates: { ...base.templates, ...override.templates },
    output: { ...base.output, ...override.output },
    validation: { ...base.validation, ...override.validation },
  };
}

/**
 * Merge environment variables into configuration
 */
function mergeEnvironmentVariables(config: CLIConfig): CLIConfig {
  const env = process.env;
  
  // OpenAI configuration from environment
  if (env.OPENAI_API_KEY) {
    config.openai = config.openai || {};
    config.openai.apiKey = env.OPENAI_API_KEY;
  }
  
  if (env.OPENAI_MODEL) {
    config.openai = config.openai || {};
    config.openai.model = env.OPENAI_MODEL;
  }
  
  if (env.OPENAI_TIMEOUT) {
    config.openai = config.openai || {};
    config.openai.timeout = parseInt(env.OPENAI_TIMEOUT, 10);
  }
  
  if (env.OPENAI_MAX_TOKENS) {
    config.openai = config.openai || {};
    config.openai.maxTokens = parseInt(env.OPENAI_MAX_TOKENS, 10);
  }
  
  if (env.OPENAI_TEMPERATURE) {
    config.openai = config.openai || {};
    config.openai.temperature = parseFloat(env.OPENAI_TEMPERATURE);
  }
  
  // Default configuration from environment
  if (env.DEBUG === 'true' || env.MCP_BUILDER_DEBUG === 'true') {
    config.defaults = config.defaults || {};
    config.defaults.debug = true;
  }
  
  if (env.QUIET === 'true' || env.MCP_BUILDER_QUIET === 'true') {
    config.defaults = config.defaults || {};
    config.defaults.quiet = true;
  }
  
  if (env.NO_AI === 'true') {
    config.defaults = config.defaults || {};
    config.defaults.noAi = true;
  }
  
  if (env.DEFAULT_OUTPUT_DIR) {
    config.defaults = config.defaults || {};
    config.defaults.outputDir = env.DEFAULT_OUTPUT_DIR;
  }
  
  if (env.DEFAULT_TEMPLATE_DIR) {
    config.defaults = config.defaults || {};
    config.defaults.templateDir = env.DEFAULT_TEMPLATE_DIR;
  }
  
  if (env.MCP_BUILDER_NO_AI === 'true') {
    config.defaults = config.defaults || {};
    config.defaults.noAi = true;
  }
  
  // Template directory from environment
  if (env.MCP_BUILDER_TEMPLATE_DIR) {
    config.templates = config.templates || {};
    config.templates.directory = env.MCP_BUILDER_TEMPLATE_DIR;
  }
  
  return config;
}

/**
 * Validate configuration object
 */
export function validateConfig(config: CLIConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate OpenAI configuration
  if (config.openai) {
    if (config.openai.timeout && (config.openai.timeout < 1000 || config.openai.timeout > 300000)) {
      errors.push('OpenAI timeout must be between 1000ms and 300000ms');
    }
    
    if (config.openai.maxTokens && (config.openai.maxTokens < 100 || config.openai.maxTokens > 8000)) {
      warnings.push('OpenAI maxTokens should be between 100 and 8000 for optimal performance');
    }
    
    if (config.openai.temperature && (config.openai.temperature < 0 || config.openai.temperature > 2)) {
      errors.push('OpenAI temperature must be between 0.0 and 2.0');
    }
    
    if (config.openai.model && !['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'].includes(config.openai.model)) {
      warnings.push(`OpenAI model '${config.openai.model}' may not be supported`);
    }
  }
  
  // Validate template configuration
  if (config.templates?.directory) {
    // Note: We can't validate directory existence here as it's async
    // This will be validated during actual usage
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a default configuration file
 */
export async function createDefaultConfig(filePath: string = 'mcp-builder.config.json'): Promise<void> {
  const defaultConfig: CLIConfig = {
    defaults: {
      model: 'gpt-4',
      debug: false,
      quiet: false,
      noAi: false,
    },
    openai: {
      // apiKey: 'your-openai-api-key-here',
      model: 'gpt-4',
      timeout: 30000,
      maxTokens: 4000,
      temperature: 0.1,
    },
    templates: {
      // directory: './custom-templates',
    },
    output: {
      overwrite: false,
      backup: true,
    },
    validation: {
      strict: false,
      skipWarnings: false,
    },
  };
  
  await fs.writeFile(filePath, JSON.stringify(defaultConfig, null, 2));
}

/**
 * Get configuration value with fallback
 */
export function getConfigValue<T>(
  config: CLIConfig,
  path: string,
  defaultValue: T
): T {
  const keys = path.split('.');
  let current: any = config;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  
  return current !== undefined ? current : defaultValue;
}