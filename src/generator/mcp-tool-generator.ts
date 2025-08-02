import { APISpec, APIParameter } from '../parser/types.js';
import { MCPTool } from '../types.js';

/**
 * Configuration for MCP tool generation
 */
export interface MCPToolGeneratorConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Include parameter descriptions in schema */
  includeDescriptions?: boolean;
  /** Generate strict validation schemas */
  strictValidation?: boolean;
  /** Custom tool name prefix */
  toolNamePrefix?: string;
}

/**
 * Generated MCP tool with additional metadata
 */
export interface GeneratedMCPTool extends MCPTool {
  /** Original API specification */
  apiSpec: APISpec;
  /** Generated function name for the tool handler */
  functionName: string;
  /** HTTP method for the API call */
  httpMethod: string;
  /** Whether the tool requires a request body */
  hasBody: boolean;
  /** Extracted parameters with enhanced metadata */
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    location: 'query' | 'header' | 'body' | 'path';
    example?: any;
    validation?: {
      pattern?: string;
      minimum?: number;
      maximum?: number;
      minLength?: number;
      maxLength?: number;
    };
  }>;
  /** Generated validation rules */
  validation: {
    requiredParams: string[];
    optionalParams: string[];
    bodySchema?: any;
    headerSchema?: any;
    querySchema?: any;
  };
}

/**
 * Result of tool generation process
 */
export interface ToolGenerationResult {
  /** Generated tools */
  tools: GeneratedMCPTool[];
  /** Generation statistics */
  stats: {
    totalAPIs: number;
    toolsGenerated: number;
    errors: number;
    warnings: number;
  };
  /** Any errors that occurred during generation */
  errors: string[];
  /** Warnings about potential issues */
  warnings: string[];
}

/**
 * Generator for MCP tools from API specifications
 */
export class MCPToolGenerator {
  private config: Required<MCPToolGeneratorConfig>;

  constructor(config: MCPToolGeneratorConfig = {}) {
    this.config = {
      debug: config.debug ?? false,
      includeDescriptions: config.includeDescriptions ?? true,
      strictValidation: config.strictValidation ?? true,
      toolNamePrefix: config.toolNamePrefix ?? '',
    };

    this.log('MCPToolGenerator initialized', this.config);
  }

  /**
   * Generate MCP tools from API specifications
   */
  generateTools(apiSpecs: APISpec[]): ToolGenerationResult {
    const result: ToolGenerationResult = {
      tools: [],
      stats: {
        totalAPIs: apiSpecs.length,
        toolsGenerated: 0,
        errors: 0,
        warnings: 0,
      },
      errors: [],
      warnings: [],
    };

    this.log(`Generating tools for ${apiSpecs.length} API specifications`);

    for (const apiSpec of apiSpecs) {
      try {
        const tool = this.generateTool(apiSpec);
        result.tools.push(tool);
        result.stats.toolsGenerated++;
        
        this.log(`Generated tool: ${tool.name}`, {
          method: tool.httpMethod,
          paramCount: tool.parameters.length,
          hasBody: tool.hasBody,
        });
      } catch (error) {
        const errorMessage = `Failed to generate tool for API ${apiSpec.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        result.errors.push(errorMessage);
        result.stats.errors++;
        this.log('Tool generation error', { apiSpec: apiSpec.name, error });
      }
    }

    // Add warnings for potential issues
    this.addGenerationWarnings(result);

    this.log('Tool generation completed', {
      totalAPIs: result.stats.totalAPIs,
      toolsGenerated: result.stats.toolsGenerated,
      errors: result.stats.errors,
      warnings: result.stats.warnings,
    });

    return result;
  }

  /**
   * Generate a single MCP tool from an API specification
   */
  private generateTool(apiSpec: APISpec): GeneratedMCPTool {
    // Generate tool name
    const toolName = this.generateToolName(apiSpec);
    
    // Generate function name
    const functionName = this.generateFunctionName(apiSpec);
    
    // Extract and enhance parameters
    const parameters = this.extractParameters(apiSpec);
    
    // Generate input schema
    const inputSchema = this.generateInputSchema(apiSpec, parameters);
    
    // Generate validation rules
    const validation = this.generateValidationRules(apiSpec, parameters);
    
    // Determine if tool has body
    const hasBody = ['POST', 'PUT'].includes(apiSpec.method) && 
                   (apiSpec.body !== undefined || parameters.some(p => p.location === 'body'));

    return {
      name: toolName,
      description: this.generateToolDescription(apiSpec),
      inputSchema,
      apiSpec,
      functionName,
      httpMethod: apiSpec.method,
      hasBody,
      parameters,
      validation,
    };
  }

  /**
   * Generate tool name from API specification
   */
  private generateToolName(apiSpec: APISpec): string {
    const prefix = this.config.toolNamePrefix;
    const method = apiSpec.method.toLowerCase();
    const name = apiSpec.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    return `${prefix}${method}_${name}`;
  }

  /**
   * Generate function name for tool handler
   */
  private generateFunctionName(apiSpec: APISpec): string {
    const method = apiSpec.method.toLowerCase();
    const name = apiSpec.name
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((word, index) => index === 0 ? word.toLowerCase() : 
           word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    
    return `${method}${name.charAt(0).toUpperCase() + name.slice(1)}`;
  }

  /**
   * Generate tool description
   */
  private generateToolDescription(apiSpec: APISpec): string {
    const method = apiSpec.method;
    const baseName = apiSpec.name;
    const description = apiSpec.description;
    
    let toolDescription = `Make a ${method} request to ${baseName}`;
    
    if (description) {
      toolDescription += ` - ${description}`;
    }
    
    return toolDescription;
  }

  /**
   * Extract and enhance parameters from API specification
   */
  private extractParameters(apiSpec: APISpec): GeneratedMCPTool['parameters'] {
    const parameters: GeneratedMCPTool['parameters'] = [];
    
    // Add URL as a parameter (always required)
    parameters.push({
      name: 'url',
      type: 'string',
      required: true,
      description: 'The URL to make the request to',
      location: 'path',
      validation: {
        pattern: '^https?://.+',
      },
    });

    // Add parameters from API spec
    if (apiSpec.parameters) {
      for (const param of apiSpec.parameters) {
        parameters.push({
          name: param.name,
          type: param.type,
          required: param.required,
          description: param.description,
          location: param.location,
          example: param.example,
          validation: this.generateParameterValidation(param),
        });
      }
    }

    // Add headers parameter if API spec has headers
    if (apiSpec.headers && Object.keys(apiSpec.headers).length > 0) {
      parameters.push({
        name: 'headers',
        type: 'object',
        required: false,
        description: 'Additional headers to include in the request',
        location: 'header',
      });
    }

    // Add body parameter for POST/PUT requests
    if (['POST', 'PUT'].includes(apiSpec.method)) {
      parameters.push({
        name: 'body',
        type: apiSpec.body && typeof apiSpec.body === 'object' ? 'object' : 'string',
        required: false,
        description: 'Request body data',
        location: 'body',
        example: apiSpec.body,
      });
    }

    return parameters;
  }

  /**
   * Generate parameter validation rules
   */
  private generateParameterValidation(param: APIParameter): GeneratedMCPTool['parameters'][0]['validation'] {
    const validation: GeneratedMCPTool['parameters'][0]['validation'] = {};

    switch (param.type) {
      case 'string':
        if (param.name.toLowerCase().includes('email')) {
          validation.pattern = '^[^@]+@[^@]+\\.[^@]+$';
        } else if (param.name.toLowerCase().includes('url')) {
          validation.pattern = '^https?://.+';
        }
        break;
      
      case 'number':
        if (param.name.toLowerCase().includes('id')) {
          validation.minimum = 1;
        }
        break;
    }

    return Object.keys(validation).length > 0 ? validation : undefined;
  }

  /**
   * Generate JSON Schema for tool input
   */
  private generateInputSchema(apiSpec: APISpec, parameters: GeneratedMCPTool['parameters']): MCPTool['inputSchema'] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of parameters) {
      // Generate property schema
      const property: any = {
        type: this.mapTypeToJSONSchema(param.type),
      };

      if (this.config.includeDescriptions && param.description) {
        property.description = param.description;
      }

      if (param.example !== undefined) {
        property.example = param.example;
      }

      // Add validation rules
      if (param.validation) {
        if (param.validation.pattern) {
          property.pattern = param.validation.pattern;
        }
        if (param.validation.minimum !== undefined) {
          property.minimum = param.validation.minimum;
        }
        if (param.validation.maximum !== undefined) {
          property.maximum = param.validation.maximum;
        }
        if (param.validation.minLength !== undefined) {
          property.minLength = param.validation.minLength;
        }
        if (param.validation.maxLength !== undefined) {
          property.maxLength = param.validation.maxLength;
        }
      }

      // Handle special cases
      if (param.name === 'headers' || param.type === 'object') {
        property.type = 'object';
        property.additionalProperties = { type: 'string' };
      }

      if (param.name === 'body' && param.type === 'object') {
        property.oneOf = [
          { type: 'string' },
          { type: 'object' },
        ];
        delete property.type;
      }

      properties[param.name] = property;

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Map parameter type to JSON Schema type
   */
  private mapTypeToJSONSchema(type: string): string {
    switch (type) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'object';
      case 'array':
        return 'array';
      default:
        return 'string';
    }
  }

  /**
   * Generate validation rules for the tool
   */
  private generateValidationRules(
    apiSpec: APISpec, 
    parameters: GeneratedMCPTool['parameters']
  ): GeneratedMCPTool['validation'] {
    const requiredParams = parameters.filter(p => p.required).map(p => p.name);
    const optionalParams = parameters.filter(p => !p.required).map(p => p.name);

    const validation: GeneratedMCPTool['validation'] = {
      requiredParams,
      optionalParams,
    };

    // Generate body schema for POST/PUT requests
    if (['POST', 'PUT'].includes(apiSpec.method) && apiSpec.body) {
      validation.bodySchema = this.generateBodySchema(apiSpec.body);
    }

    // Generate header schema if headers are present
    if (apiSpec.headers) {
      validation.headerSchema = this.generateHeaderSchema(apiSpec.headers);
    }

    // Generate query schema for query parameters
    const queryParams = parameters.filter(p => p.location === 'query');
    if (queryParams.length > 0) {
      validation.querySchema = this.generateQuerySchema(queryParams);
    }

    return validation;
  }

  /**
   * Generate schema for request body
   */
  private generateBodySchema(body: string | object): any {
    if (typeof body === 'string') {
      return { type: 'string' };
    }

    if (typeof body === 'object' && body !== null) {
      return {
        type: 'object',
        properties: this.inferObjectSchema(body),
      };
    }

    return { oneOf: [{ type: 'string' }, { type: 'object' }] };
  }

  /**
   * Generate schema for headers
   */
  private generateHeaderSchema(headers: Record<string, string>): any {
    return {
      type: 'object',
      properties: Object.keys(headers).reduce((props, key) => {
        props[key] = { type: 'string' };
        return props;
      }, {} as Record<string, any>),
      additionalProperties: { type: 'string' },
    };
  }

  /**
   * Generate schema for query parameters
   */
  private generateQuerySchema(queryParams: GeneratedMCPTool['parameters']): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of queryParams) {
      properties[param.name] = {
        type: this.mapTypeToJSONSchema(param.type),
        description: param.description,
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Infer JSON schema from object structure
   */
  private inferObjectSchema(obj: any): Record<string, any> {
    const properties: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        properties[key] = { type: 'string' };
      } else if (typeof value === 'number') {
        properties[key] = { type: 'number' };
      } else if (typeof value === 'boolean') {
        properties[key] = { type: 'boolean' };
      } else if (Array.isArray(value)) {
        properties[key] = { type: 'array' };
      } else if (typeof value === 'object' && value !== null) {
        properties[key] = {
          type: 'object',
          properties: this.inferObjectSchema(value),
        };
      } else {
        properties[key] = { type: 'string' };
      }
    }

    return properties;
  }

  /**
   * Add warnings for potential issues
   */
  private addGenerationWarnings(result: ToolGenerationResult): void {
    // Check for duplicate tool names
    const toolNames = result.tools.map(t => t.name);
    const duplicates = toolNames.filter((name, index) => toolNames.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      result.warnings.push(`Duplicate tool names detected: ${[...new Set(duplicates)].join(', ')}`);
      result.stats.warnings++;
    }

    // Check for tools without descriptions
    const toolsWithoutDescriptions = result.tools.filter(t => !t.apiSpec.description);
    if (toolsWithoutDescriptions.length > 0) {
      result.warnings.push(`${toolsWithoutDescriptions.length} tools generated without descriptions`);
      result.stats.warnings++;
    }

    // Check for tools with many parameters
    const toolsWithManyParams = result.tools.filter(t => t.parameters.length > 10);
    if (toolsWithManyParams.length > 0) {
      result.warnings.push(`${toolsWithManyParams.length} tools have more than 10 parameters, consider simplifying`);
      result.stats.warnings++;
    }
  }

  /**
   * Update generator configuration
   */
  updateConfig(config: Partial<MCPToolGeneratorConfig>): void {
    Object.assign(this.config, config);
    this.log('MCPToolGenerator configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<MCPToolGeneratorConfig> {
    return { ...this.config };
  }

  /**
   * Log messages with optional debug filtering
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] MCPToolGenerator: ${message}`, data);
      } else {
        console.error(`[${timestamp}] MCPToolGenerator: ${message}`);
      }
    }
  }
}