import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

/**
 * Template context interface for generating MCP server code
 */
export interface TemplateContext {
  server: {
    name: string;
    version: string;
    description: string;
    packageName: string;
    author?: string;
    license?: string;
    repository?: string;
  };
  tools: Array<{
    name: string;
    description: string;
    functionName: string;
    httpMethod: string;
    inputSchema: any;
    hasBody: boolean;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  }>;
  apis: Array<{
    name: string;
    description?: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    parameters?: Array<{
      name: string;
      type: string;
      required: boolean;
      location: 'query' | 'header' | 'body' | 'path';
      description?: string;
    }>;
  }>;
  imports: string[];
  exports: string[];
  metadata: {
    generatedAt: string;
    generatedBy: string;
    sourceFile?: string;
    version: string;
  };
  configuration: {
    timeout: number;
    maxResponseLength: number;
    allowLocalhost: boolean;
    allowPrivateIps: boolean;
    userAgent: string;
  };
}

/**
 * Template engine configuration
 */
export interface TemplateEngineConfig {
  /** Default template directory */
  templateDir?: string;
  /** Custom template directories to search */
  customTemplateDirs?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Template engine for generating MCP server code using Handlebars
 */
export class TemplateEngine {
  private handlebars: typeof Handlebars;
  private config: Required<TemplateEngineConfig>;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(config: TemplateEngineConfig = {}) {
    this.config = {
      templateDir: config.templateDir ?? path.join(__dirname, '../../templates'),
      customTemplateDirs: config.customTemplateDirs ?? [],
      debug: config.debug ?? false,
    };

    // Create a new Handlebars instance
    this.handlebars = Handlebars.create();
    
    // Register custom helpers
    this.registerHelpers();
    
    this.log('TemplateEngine initialized', {
      templateDir: this.config.templateDir,
      customTemplateDirs: this.config.customTemplateDirs,
    });
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Helper to convert string to camelCase
    this.handlebars.registerHelper('camelCase', (str: string) => {
      return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    });

    // Helper to convert string to PascalCase
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      const camelCase = str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });

    // Helper to convert string to kebab-case
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[\s_]+/g, '-')
                .toLowerCase();
    });

    // Helper to convert string to UPPER_SNAKE_CASE
    this.handlebars.registerHelper('upperSnakeCase', (str: string) => {
      return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[\s-]+/g, '_')
                .toUpperCase();
    });

    // Helper to format JSON with proper indentation
    this.handlebars.registerHelper('json', (obj: any, indent = 2) => {
      return JSON.stringify(obj, null, indent);
    });

    // Helper to check if array has items
    this.handlebars.registerHelper('hasItems', (array: any[]) => {
      return Array.isArray(array) && array.length > 0;
    });

    // Helper for conditional logic
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);

    // Helper to format HTTP method for function names
    this.handlebars.registerHelper('httpMethodToFunction', (method: string) => {
      return method.toLowerCase();
    });

    // Helper to generate TypeScript type from parameter
    this.handlebars.registerHelper('parameterType', (param: any) => {
      switch (param.type) {
        case 'string':
          return 'string';
        case 'number':
          return 'number';
        case 'boolean':
          return 'boolean';
        case 'object':
          return 'Record<string, any>';
        case 'array':
          return 'any[]';
        default:
          return 'any';
      }
    });

    // Helper to generate import statements
    this.handlebars.registerHelper('generateImports', (imports: string[]) => {
      return imports.map(imp => `import ${imp};`).join('\n');
    });

    // Helper to check if array includes a value
    this.handlebars.registerHelper('includes', (array: any[], value: any) => {
      return Array.isArray(array) && array.includes(value);
    });

    // Helper to check if value is an object
    this.handlebars.registerHelper('isObject', (value: any) => {
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    });

    // Helper to check if header is required
    this.handlebars.registerHelper('isRequiredHeader', (headerName: string) => {
      const requiredHeaders = ['authorization', 'content-type', 'x-api-key', 'api-key'];
      return requiredHeaders.includes(headerName.toLowerCase());
    });

    // Helper to get unique values from array
    this.handlebars.registerHelper('unique', (array: any[]) => {
      return Array.isArray(array) ? [...new Set(array)] : [];
    });

    // Helper to pluck property from array of objects
    this.handlebars.registerHelper('pluck', (array: any[], property: string) => {
      return Array.isArray(array) ? array.map(item => item[property]).filter(Boolean) : [];
    });

    // Helper to map parameter type to TypeScript
    this.handlebars.registerHelper('mapParameterTypeToTypeScript', (type: string) => {
      switch (type) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'boolean': return 'boolean';
        case 'object': return 'Record<string, any>';
        case 'array': return 'any[]';
        default: return 'any';
      }
    });

    // Helper to generate Zod schema from type
    this.handlebars.registerHelper('zodSchemaFromType', (schema: any) => {
      if (!schema) return 'z.any()';
      
      switch (schema.type) {
        case 'string':
          return 'z.string()';
        case 'number':
        case 'integer':
          return 'z.number()';
        case 'boolean':
          return 'z.boolean()';
        case 'array':
          return 'z.array(z.any())';
        case 'object':
          return 'z.record(z.any())';
        default:
          return 'z.any()';
      }
    });

    // Helper to generate Zod schema from parameter type
    this.handlebars.registerHelper('zodSchemaFromParameterType', (type: string) => {
      switch (type) {
        case 'string': return 'z.string()';
        case 'number': return 'z.number()';
        case 'boolean': return 'z.boolean()';
        case 'object': return 'z.record(z.any())';
        case 'array': return 'z.array(z.any())';
        default: return 'z.any()';
      }
    });

    this.log('Handlebars helpers registered');
  }

  /**
   * Load and compile a template from file
   */
  private async loadTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath)!;
    }

    // Try to find template in configured directories
    const templateFile = await this.findTemplate(templatePath);
    if (!templateFile) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    // Read and compile template
    const templateContent = await fs.promises.readFile(templateFile, 'utf-8');
    const compiledTemplate = this.handlebars.compile(templateContent);
    
    // Cache the compiled template
    this.templateCache.set(templatePath, compiledTemplate);
    
    this.log(`Template loaded and cached: ${templatePath}`);
    return compiledTemplate;
  }

  /**
   * Find template file in configured directories
   */
  private async findTemplate(templatePath: string): Promise<string | null> {
    const searchDirs = [
      ...this.config.customTemplateDirs,
      this.config.templateDir,
    ];

    for (const dir of searchDirs) {
      const fullPath = path.join(dir, templatePath);
      try {
        await fs.promises.access(fullPath, fs.constants.F_OK);
        this.log(`Template found: ${fullPath}`);
        return fullPath;
      } catch {
        // Template not found in this directory, continue searching
      }
    }

    return null;
  }

  /**
   * Render a template with the provided context
   */
  async renderTemplate(templatePath: string, context: TemplateContext): Promise<string> {
    try {
      const template = await this.loadTemplate(templatePath);
      const rendered = template(context);
      
      this.log(`Template rendered successfully: ${templatePath}`);
      return rendered;
    } catch (error) {
      this.log(`Error rendering template ${templatePath}:`, error);
      throw new Error(`Failed to render template ${templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render multiple templates with the same context
   */
  async renderTemplates(templatePaths: string[], context: TemplateContext): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const templatePath of templatePaths) {
      try {
        const rendered = await this.renderTemplate(templatePath, context);
        results.set(templatePath, rendered);
      } catch (error) {
        this.log(`Failed to render template ${templatePath}:`, error);
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    this.log('Template cache cleared');
  }

  /**
   * Get available templates in configured directories
   */
  async getAvailableTemplates(): Promise<string[]> {
    const templates: string[] = [];
    const searchDirs = [
      ...this.config.customTemplateDirs,
      this.config.templateDir,
    ];

    for (const dir of searchDirs) {
      try {
        const files = await this.walkDirectory(dir);
        templates.push(...files.filter(file => file.endsWith('.hbs')));
      } catch (error) {
        this.log(`Error reading template directory ${dir}:`, error);
      }
    }

    return [...new Set(templates)]; // Remove duplicates
  }

  /**
   * Recursively walk directory to find all files
   */
  private async walkDirectory(dir: string, basePath = ''): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath, relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /**
   * Add a custom template directory
   */
  addCustomTemplateDirectory(dir: string): void {
    if (!this.config.customTemplateDirs.includes(dir)) {
      this.config.customTemplateDirs.unshift(dir); // Add to beginning for priority
      this.log(`Added custom template directory: ${dir}`);
    }
  }

  /**
   * Remove a custom template directory
   */
  removeCustomTemplateDirectory(dir: string): void {
    const index = this.config.customTemplateDirs.indexOf(dir);
    if (index !== -1) {
      this.config.customTemplateDirs.splice(index, 1);
      this.log(`Removed custom template directory: ${dir}`);
    }
  }

  /**
   * Log messages with optional debug filtering
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] TemplateEngine: ${message}`, data);
      } else {
        console.error(`[${timestamp}] TemplateEngine: ${message}`);
      }
    }
  }
}