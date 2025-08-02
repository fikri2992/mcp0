import { APISpec, APIParameter } from '../parser/types.js';
import { GeneratedMCPTool } from './mcp-tool-generator.js';

/**
 * Configuration for validation generation
 */
export interface ValidationGeneratorConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Generate strict validation rules */
  strictValidation?: boolean;
  /** Include custom error messages */
  includeCustomErrors?: boolean;
  /** Generate runtime type checking */
  runtimeTypeChecking?: boolean;
}

/**
 * Generated validation rule
 */
export interface ValidationRule {
  /** Parameter name */
  parameter: string;
  /** Validation type */
  type: 'required' | 'type' | 'format' | 'range' | 'custom';
  /** Validation expression */
  expression: string;
  /** Error message */
  errorMessage: string;
  /** Validation priority (lower = higher priority) */
  priority: number;
}

/**
 * Generated validation schema
 */
export interface ValidationSchema {
  /** Schema name */
  name: string;
  /** Zod schema definition */
  zodSchema: string;
  /** Validation rules */
  rules: ValidationRule[];
  /** TypeScript interface */
  typeInterface: string;
  /** Validation function */
  validationFunction: string;
}

/**
 * Request/response validation structure
 */
export interface RequestResponseValidation {
  /** Request validation schema */
  requestSchema: ValidationSchema;
  /** Response validation schema (optional) */
  responseSchema?: ValidationSchema;
  /** Parameter validation schemas */
  parameterSchemas: Map<string, ValidationSchema>;
  /** Body validation schema */
  bodySchema?: ValidationSchema;
  /** Header validation schema */
  headerSchema?: ValidationSchema;
  /** Query validation schema */
  querySchema?: ValidationSchema;
}

/**
 * Validation generation result
 */
export interface ValidationGenerationResult {
  /** Generated validation schemas */
  schemas: Map<string, RequestResponseValidation>;
  /** Generated validation code */
  validationCode: string;
  /** Generated type definitions */
  typeDefinitions: string;
  /** Generated utility functions */
  utilityFunctions: string;
  /** Generation statistics */
  stats: {
    schemasGenerated: number;
    rulesGenerated: number;
    functionsGenerated: number;
  };
  /** Any warnings during generation */
  warnings: string[];
}

/**
 * Generator for validation logic and schemas
 */
export class ValidationGenerator {
  private config: Required<ValidationGeneratorConfig>;

  constructor(config: ValidationGeneratorConfig = {}) {
    this.config = {
      debug: config.debug ?? false,
      strictValidation: config.strictValidation ?? true,
      includeCustomErrors: config.includeCustomErrors ?? true,
      runtimeTypeChecking: config.runtimeTypeChecking ?? true,
    };

    this.log('ValidationGenerator initialized', this.config);
  }

  /**
   * Generate validation logic for MCP tools
   */
  generateValidation(tools: GeneratedMCPTool[]): ValidationGenerationResult {
    const result: ValidationGenerationResult = {
      schemas: new Map(),
      validationCode: '',
      typeDefinitions: '',
      utilityFunctions: '',
      stats: {
        schemasGenerated: 0,
        rulesGenerated: 0,
        functionsGenerated: 0,
      },
      warnings: [],
    };

    this.log(`Generating validation for ${tools.length} tools`);

    // Generate validation schemas for each tool
    for (const tool of tools) {
      try {
        const validation = this.generateToolValidation(tool);
        result.schemas.set(tool.name, validation);
        result.stats.schemasGenerated++;
        
        // Count rules
        result.stats.rulesGenerated += validation.requestSchema.rules.length;
        if (validation.responseSchema) {
          result.stats.rulesGenerated += validation.responseSchema.rules.length;
        }
        
        this.log(`Generated validation for tool: ${tool.name}`, {
          requestRules: validation.requestSchema.rules.length,
          hasResponseValidation: !!validation.responseSchema,
          parameterSchemas: validation.parameterSchemas.size,
        });
      } catch (error) {
        const warning = `Failed to generate validation for tool ${tool.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        result.warnings.push(warning);
        this.log('Validation generation error', { tool: tool.name, error });
      }
    }

    // Generate validation code
    result.validationCode = this.generateValidationCode(result.schemas);
    result.typeDefinitions = this.generateTypeDefinitions(result.schemas);
    result.utilityFunctions = this.generateUtilityFunctions();
    result.stats.functionsGenerated = result.schemas.size * 2; // Request + response validation functions

    this.log('Validation generation completed', result.stats);

    return result;
  }

  /**
   * Generate validation for a single tool
   */
  private generateToolValidation(tool: GeneratedMCPTool): RequestResponseValidation {
    const validation: RequestResponseValidation = {
      requestSchema: this.generateRequestSchema(tool),
      parameterSchemas: new Map(),
    };

    // Generate parameter schemas
    for (const param of tool.parameters) {
      const paramSchema = this.generateParameterSchema(param, tool.name);
      validation.parameterSchemas.set(param.name, paramSchema);
    }

    // Generate body schema for POST/PUT requests
    if (tool.hasBody && tool.validation.bodySchema) {
      validation.bodySchema = this.generateBodySchema(tool);
    }

    // Generate header schema if needed
    if (tool.validation.headerSchema) {
      validation.headerSchema = this.generateHeaderSchema(tool);
    }

    // Generate query schema if needed
    if (tool.validation.querySchema) {
      validation.querySchema = this.generateQuerySchema(tool);
    }

    return validation;
  }

  /**
   * Generate request validation schema
   */
  private generateRequestSchema(tool: GeneratedMCPTool): ValidationSchema {
    const rules: ValidationRule[] = [];
    let priority = 1;

    // Generate rules for required parameters
    for (const param of tool.parameters.filter(p => p.required)) {
      rules.push({
        parameter: param.name,
        type: 'required',
        expression: `${param.name} !== undefined && ${param.name} !== null`,
        errorMessage: `Parameter '${param.name}' is required`,
        priority: priority++,
      });
    }

    // Generate type validation rules
    for (const param of tool.parameters) {
      const typeRule = this.generateTypeValidationRule(param, priority++);
      if (typeRule) {
        rules.push(typeRule);
      }

      // Generate format validation rules
      const formatRule = this.generateFormatValidationRule(param, priority++);
      if (formatRule) {
        rules.push(formatRule);
      }

      // Generate range validation rules
      const rangeRule = this.generateRangeValidationRule(param, priority++);
      if (rangeRule) {
        rules.push(rangeRule);
      }
    }

    // Generate Zod schema
    const zodSchema = this.generateZodSchema(tool);
    
    // Generate TypeScript interface
    const typeInterface = this.generateTypeInterface(tool);
    
    // Generate validation function
    const validationFunction = this.generateValidationFunction(tool, rules);

    return {
      name: `${tool.name}RequestSchema`,
      zodSchema,
      rules,
      typeInterface,
      validationFunction,
    };
  }

  /**
   * Generate parameter validation schema
   */
  private generateParameterSchema(
    param: GeneratedMCPTool['parameters'][0], 
    toolName: string
  ): ValidationSchema {
    const rules: ValidationRule[] = [];
    let priority = 1;

    // Required validation
    if (param.required) {
      rules.push({
        parameter: param.name,
        type: 'required',
        expression: `value !== undefined && value !== null`,
        errorMessage: `Parameter '${param.name}' is required`,
        priority: priority++,
      });
    }

    // Type validation
    const typeRule = this.generateTypeValidationRule(param, priority++);
    if (typeRule) {
      rules.push(typeRule);
    }

    // Validation rules from parameter validation
    if (param.validation) {
      if (param.validation.pattern) {
        rules.push({
          parameter: param.name,
          type: 'format',
          expression: `new RegExp('${param.validation.pattern}').test(String(value))`,
          errorMessage: `Parameter '${param.name}' does not match required format`,
          priority: priority++,
        });
      }

      if (param.validation.minimum !== undefined) {
        rules.push({
          parameter: param.name,
          type: 'range',
          expression: `Number(value) >= ${param.validation.minimum}`,
          errorMessage: `Parameter '${param.name}' must be at least ${param.validation.minimum}`,
          priority: priority++,
        });
      }

      if (param.validation.maximum !== undefined) {
        rules.push({
          parameter: param.name,
          type: 'range',
          expression: `Number(value) <= ${param.validation.maximum}`,
          errorMessage: `Parameter '${param.name}' must be at most ${param.validation.maximum}`,
          priority: priority++,
        });
      }

      if (param.validation.minLength !== undefined) {
        rules.push({
          parameter: param.name,
          type: 'range',
          expression: `String(value).length >= ${param.validation.minLength}`,
          errorMessage: `Parameter '${param.name}' must be at least ${param.validation.minLength} characters`,
          priority: priority++,
        });
      }

      if (param.validation.maxLength !== undefined) {
        rules.push({
          parameter: param.name,
          type: 'range',
          expression: `String(value).length <= ${param.validation.maxLength}`,
          errorMessage: `Parameter '${param.name}' must be at most ${param.validation.maxLength} characters`,
          priority: priority++,
        });
      }
    }

    const zodSchema = this.generateParameterZodSchema(param);
    const typeInterface = this.generateParameterTypeInterface(param);
    const validationFunction = this.generateParameterValidationFunction(param, rules);

    return {
      name: `${toolName}_${param.name}Schema`,
      zodSchema,
      rules,
      typeInterface,
      validationFunction,
    };
  }

  /**
   * Generate body validation schema
   */
  private generateBodySchema(tool: GeneratedMCPTool): ValidationSchema {
    const rules: ValidationRule[] = [];
    
    if (tool.validation.bodySchema) {
      rules.push({
        parameter: 'body',
        type: 'type',
        expression: 'typeof body === "object" || typeof body === "string"',
        errorMessage: 'Request body must be an object or string',
        priority: 1,
      });
    }

    const zodSchema = `z.union([z.string(), z.record(z.any())])`;
    const typeInterface = `string | Record<string, any>`;
    const validationFunction = this.generateBodyValidationFunction(tool, rules);

    return {
      name: `${tool.name}BodySchema`,
      zodSchema,
      rules,
      typeInterface,
      validationFunction,
    };
  }

  /**
   * Generate header validation schema
   */
  private generateHeaderSchema(tool: GeneratedMCPTool): ValidationSchema {
    const rules: ValidationRule[] = [
      {
        parameter: 'headers',
        type: 'type',
        expression: 'typeof headers === "object" && headers !== null',
        errorMessage: 'Headers must be an object',
        priority: 1,
      },
    ];

    const zodSchema = `z.record(z.string())`;
    const typeInterface = `Record<string, string>`;
    const validationFunction = this.generateHeaderValidationFunction(tool, rules);

    return {
      name: `${tool.name}HeaderSchema`,
      zodSchema,
      rules,
      typeInterface,
      validationFunction,
    };
  }

  /**
   * Generate query validation schema
   */
  private generateQuerySchema(tool: GeneratedMCPTool): ValidationSchema {
    const queryParams = tool.parameters.filter(p => p.location === 'query');
    const rules: ValidationRule[] = [];

    for (const param of queryParams) {
      if (param.required) {
        rules.push({
          parameter: param.name,
          type: 'required',
          expression: `query.${param.name} !== undefined`,
          errorMessage: `Query parameter '${param.name}' is required`,
          priority: 1,
        });
      }
    }

    const zodSchema = this.generateQueryZodSchema(queryParams);
    const typeInterface = this.generateQueryTypeInterface(queryParams);
    const validationFunction = this.generateQueryValidationFunction(tool, rules);

    return {
      name: `${tool.name}QuerySchema`,
      zodSchema,
      rules,
      typeInterface,
      validationFunction,
    };
  }

  /**
   * Generate type validation rule
   */
  private generateTypeValidationRule(
    param: GeneratedMCPTool['parameters'][0], 
    priority: number
  ): ValidationRule | null {
    let expression: string;
    let errorMessage: string;

    switch (param.type) {
      case 'string':
        expression = `typeof ${param.name} === 'string'`;
        errorMessage = `Parameter '${param.name}' must be a string`;
        break;
      case 'number':
        expression = `typeof ${param.name} === 'number' && !isNaN(${param.name})`;
        errorMessage = `Parameter '${param.name}' must be a valid number`;
        break;
      case 'boolean':
        expression = `typeof ${param.name} === 'boolean'`;
        errorMessage = `Parameter '${param.name}' must be a boolean`;
        break;
      case 'object':
        expression = `typeof ${param.name} === 'object' && ${param.name} !== null && !Array.isArray(${param.name})`;
        errorMessage = `Parameter '${param.name}' must be an object`;
        break;
      case 'array':
        expression = `Array.isArray(${param.name})`;
        errorMessage = `Parameter '${param.name}' must be an array`;
        break;
      default:
        return null;
    }

    return {
      parameter: param.name,
      type: 'type',
      expression,
      errorMessage,
      priority,
    };
  }

  /**
   * Generate format validation rule
   */
  private generateFormatValidationRule(
    param: GeneratedMCPTool['parameters'][0], 
    priority: number
  ): ValidationRule | null {
    if (!param.validation?.pattern) {
      return null;
    }

    return {
      parameter: param.name,
      type: 'format',
      expression: `new RegExp('${param.validation.pattern}').test(String(${param.name}))`,
      errorMessage: `Parameter '${param.name}' does not match required format`,
      priority,
    };
  }

  /**
   * Generate range validation rule
   */
  private generateRangeValidationRule(
    param: GeneratedMCPTool['parameters'][0], 
    priority: number
  ): ValidationRule | null {
    const validation = param.validation;
    if (!validation) return null;

    const conditions: string[] = [];
    const messages: string[] = [];

    if (validation.minimum !== undefined) {
      conditions.push(`Number(${param.name}) >= ${validation.minimum}`);
      messages.push(`at least ${validation.minimum}`);
    }

    if (validation.maximum !== undefined) {
      conditions.push(`Number(${param.name}) <= ${validation.maximum}`);
      messages.push(`at most ${validation.maximum}`);
    }

    if (validation.minLength !== undefined) {
      conditions.push(`String(${param.name}).length >= ${validation.minLength}`);
      messages.push(`at least ${validation.minLength} characters`);
    }

    if (validation.maxLength !== undefined) {
      conditions.push(`String(${param.name}).length <= ${validation.maxLength}`);
      messages.push(`at most ${validation.maxLength} characters`);
    }

    if (conditions.length === 0) return null;

    return {
      parameter: param.name,
      type: 'range',
      expression: conditions.join(' && '),
      errorMessage: `Parameter '${param.name}' must be ${messages.join(' and ')}`,
      priority,
    };
  }

  /**
   * Generate Zod schema for tool
   */
  private generateZodSchema(tool: GeneratedMCPTool): string {
    const properties: string[] = [];

    for (const param of tool.parameters) {
      let schema = this.getZodTypeForParameter(param);
      
      if (param.validation) {
        schema = this.addZodValidation(schema, param.validation);
      }

      if (!param.required) {
        schema += '.optional()';
      }

      properties.push(`  ${param.name}: ${schema}`);
    }

    return `z.object({\n${properties.join(',\n')}\n})`;
  }

  /**
   * Get Zod type for parameter
   */
  private getZodTypeForParameter(param: GeneratedMCPTool['parameters'][0]): string {
    switch (param.type) {
      case 'string':
        return 'z.string()';
      case 'number':
        return 'z.number()';
      case 'boolean':
        return 'z.boolean()';
      case 'object':
        if (param.name === 'headers') {
          return 'z.record(z.string())';
        }
        return 'z.record(z.any())';
      case 'array':
        return 'z.array(z.any())';
      default:
        return 'z.any()';
    }
  }

  /**
   * Add Zod validation rules
   */
  private addZodValidation(
    schema: string, 
    validation: GeneratedMCPTool['parameters'][0]['validation']
  ): string {
    if (!validation) return schema;

    if (validation.pattern) {
      schema += `.regex(/${validation.pattern}/)`;
    }

    if (validation.minimum !== undefined) {
      schema += `.min(${validation.minimum})`;
    }

    if (validation.maximum !== undefined) {
      schema += `.max(${validation.maximum})`;
    }

    if (validation.minLength !== undefined) {
      schema += `.min(${validation.minLength})`;
    }

    if (validation.maxLength !== undefined) {
      schema += `.max(${validation.maxLength})`;
    }

    return schema;
  }

  /**
   * Generate TypeScript interface for tool
   */
  private generateTypeInterface(tool: GeneratedMCPTool): string {
    const properties: string[] = [];

    for (const param of tool.parameters) {
      const optional = param.required ? '' : '?';
      const type = this.getTypeScriptTypeForParameter(param);
      properties.push(`  ${param.name}${optional}: ${type};`);
    }

    return `interface ${tool.name}Request {\n${properties.join('\n')}\n}`;
  }

  /**
   * Get TypeScript type for parameter
   */
  private getTypeScriptTypeForParameter(param: GeneratedMCPTool['parameters'][0]): string {
    switch (param.type) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        if (param.name === 'headers') {
          return 'Record<string, string>';
        }
        return 'Record<string, any>';
      case 'array':
        return 'any[]';
      default:
        return 'any';
    }
  }

  /**
   * Generate validation function for tool
   */
  private generateValidationFunction(tool: GeneratedMCPTool, rules: ValidationRule[]): string {
    const functionName = `validate${tool.name}Request`;
    const sortedRules = rules.sort((a, b) => a.priority - b.priority);

    const validationChecks = sortedRules.map(rule => {
      if (this.config.includeCustomErrors) {
        return `  if (!(${rule.expression})) {\n    throw new ValidationError('${rule.errorMessage}', '${rule.parameter}');\n  }`;
      } else {
        return `  if (!(${rule.expression})) {\n    throw new Error('${rule.errorMessage}');\n  }`;
      }
    }).join('\n');

    return `export function ${functionName}(params: any): ${tool.name}Request {
${validationChecks}
  return params as ${tool.name}Request;
}`;
  }

  // Additional helper methods for generating specific validation functions...
  private generateParameterZodSchema(param: GeneratedMCPTool['parameters'][0]): string {
    return this.getZodTypeForParameter(param);
  }

  private generateParameterTypeInterface(param: GeneratedMCPTool['parameters'][0]): string {
    return this.getTypeScriptTypeForParameter(param);
  }

  private generateParameterValidationFunction(
    param: GeneratedMCPTool['parameters'][0], 
    rules: ValidationRule[]
  ): string {
    const functionName = `validate${param.name}Parameter`;
    const validationChecks = rules.map(rule => 
      `  if (!(${rule.expression.replace(param.name, 'value')})) {\n    throw new Error('${rule.errorMessage}');\n  }`
    ).join('\n');

    return `function ${functionName}(value: any): ${this.getTypeScriptTypeForParameter(param)} {
${validationChecks}
  return value;
}`;
  }

  private generateBodyValidationFunction(tool: GeneratedMCPTool, rules: ValidationRule[]): string {
    const functionName = `validate${tool.name}Body`;
    const validationChecks = rules.map(rule => 
      `  if (!(${rule.expression})) {\n    throw new Error('${rule.errorMessage}');\n  }`
    ).join('\n');

    return `function ${functionName}(body: any): string | Record<string, any> {
${validationChecks}
  return body;
}`;
  }

  private generateHeaderValidationFunction(tool: GeneratedMCPTool, rules: ValidationRule[]): string {
    const functionName = `validate${tool.name}Headers`;
    const validationChecks = rules.map(rule => 
      `  if (!(${rule.expression})) {\n    throw new Error('${rule.errorMessage}');\n  }`
    ).join('\n');

    return `function ${functionName}(headers: any): Record<string, string> {
${validationChecks}
  return headers;
}`;
  }

  private generateQueryValidationFunction(tool: GeneratedMCPTool, rules: ValidationRule[]): string {
    const functionName = `validate${tool.name}Query`;
    const validationChecks = rules.map(rule => 
      `  if (!(${rule.expression})) {\n    throw new Error('${rule.errorMessage}');\n  }`
    ).join('\n');

    return `function ${functionName}(query: any): Record<string, any> {
${validationChecks}
  return query;
}`;
  }

  private generateQueryZodSchema(queryParams: GeneratedMCPTool['parameters']): string {
    const properties = queryParams.map(param => 
      `  ${param.name}: ${this.getZodTypeForParameter(param)}${param.required ? '' : '.optional()'}`
    );
    return `z.object({\n${properties.join(',\n')}\n})`;
  }

  private generateQueryTypeInterface(queryParams: GeneratedMCPTool['parameters']): string {
    const properties = queryParams.map(param => 
      `  ${param.name}${param.required ? '' : '?'}: ${this.getTypeScriptTypeForParameter(param)};`
    );
    return `{\n${properties.join('\n')}\n}`;
  }

  /**
   * Generate complete validation code
   */
  private generateValidationCode(schemas: Map<string, RequestResponseValidation>): string {
    const imports = `import { z } from 'zod';\n\n`;
    
    const errorClass = this.config.includeCustomErrors ? `
export class ValidationError extends Error {
  constructor(message: string, public parameter?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

` : '';

    const validationFunctions = Array.from(schemas.values())
      .map(schema => schema.requestSchema.validationFunction)
      .join('\n\n');

    return imports + errorClass + validationFunctions;
  }

  /**
   * Generate type definitions
   */
  private generateTypeDefinitions(schemas: Map<string, RequestResponseValidation>): string {
    const interfaces = Array.from(schemas.values())
      .map(schema => schema.requestSchema.typeInterface)
      .join('\n\n');

    return interfaces;
  }

  /**
   * Generate utility functions
   */
  private generateUtilityFunctions(): string {
    return `
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

export function formatValidationError(error: ValidationError): string {
  return error.parameter 
    ? \`Validation failed for parameter '\${error.parameter}': \${error.message}\`
    : \`Validation failed: \${error.message}\`;
}

export function validateRequest<T>(validator: (params: any) => T, params: any): T {
  try {
    return validator(params);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(\`Validation failed: \${error instanceof Error ? error.message : 'Unknown error'}\`);
  }
}
`;
  }

  /**
   * Update generator configuration
   */
  updateConfig(config: Partial<ValidationGeneratorConfig>): void {
    Object.assign(this.config, config);
    this.log('ValidationGenerator configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ValidationGeneratorConfig> {
    return { ...this.config };
  }

  /**
   * Log messages with optional debug filtering
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] ValidationGenerator: ${message}`, data);
      } else {
        console.error(`[${timestamp}] ValidationGenerator: ${message}`);
      }
    }
  }
}