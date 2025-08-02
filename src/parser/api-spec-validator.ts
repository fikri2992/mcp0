import {
  APISpec,
  ParsedAPICollection,
  ValidationResult,
  ValidationError,
  CurlCommand,
  APISpecSchema,
  ParsedAPICollectionSchema,
} from './types.js';
import { isValidURL } from '../types.js';

/**
 * Validator for API specifications and parsed collections
 */
export class APISpecValidator {
  private static readonly COMMON_HEADERS = [
    'authorization',
    'content-type',
    'accept',
    'user-agent',
    'x-api-key',
    'x-auth-token',
  ];

  private static readonly REQUIRED_HEADERS_BY_METHOD = {
    POST: ['content-type'],
    PUT: ['content-type'],
    PATCH: ['content-type'],
    DELETE: [],
    GET: [],
  };

  /**
   * Validate a single API specification
   */
  public static validateAPISpec(apiSpec: APISpec): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: string[] = [];

    try {
      // Use Zod schema for basic validation
      APISpecSchema.parse(apiSpec);
    } catch (error) {
      errors.push({
        type: 'format',
        message: `Invalid API specification format: ${error}`,
        details: error,
      });
      return { isValid: false, errors, warnings, suggestions };
    }

    // Validate URL
    if (!isValidURL(apiSpec.url)) {
      errors.push({
        type: 'format',
        message: `Invalid URL: ${apiSpec.url}`,
        suggestions: ['Ensure URL includes protocol (http:// or https://)'],
      });
    }

    // Validate method-specific requirements
    this.validateMethodRequirements(apiSpec, errors, warnings, suggestions);

    // Validate headers
    this.validateHeaders(apiSpec, errors, warnings, suggestions);

    // Validate body for methods that support it
    this.validateBody(apiSpec, errors, warnings, suggestions);

    // Validate parameters if present
    if (apiSpec.parameters) {
      this.validateParameters(apiSpec, errors, warnings, suggestions);
    }

    // Generate suggestions for improvement
    this.generateImprovementSuggestions(apiSpec, suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate method-specific requirements
   */
  private static validateMethodRequirements(
    apiSpec: APISpec,
    errors: ValidationError[],
    warnings: ValidationError[],
    suggestions: string[]
  ): void {
    const requiredHeaders = this.REQUIRED_HEADERS_BY_METHOD[apiSpec.method] || [];
    
    requiredHeaders.forEach(headerName => {
      const hasHeader = apiSpec.headers && 
        Object.keys(apiSpec.headers).some(key => 
          key.toLowerCase() === headerName.toLowerCase()
        );
      
      if (!hasHeader) {
        warnings.push({
          type: 'content',
          message: `Missing recommended header '${headerName}' for ${apiSpec.method} request`,
          suggestions: [`Add ${headerName} header to the request`],
        });
      }
    });

    // Check for body in GET/DELETE requests
    if ((apiSpec.method === 'GET' || apiSpec.method === 'DELETE') && apiSpec.body) {
      warnings.push({
        type: 'content',
        message: `${apiSpec.method} requests typically should not have a body`,
        suggestions: ['Consider using query parameters instead of request body'],
      });
    }

    // Check for missing body in POST/PUT requests
    if ((apiSpec.method === 'POST' || apiSpec.method === 'PUT') && !apiSpec.body) {
      warnings.push({
        type: 'content',
        message: `${apiSpec.method} requests typically require a request body`,
        suggestions: ['Add request body with the data to be sent'],
      });
    }
  }

  /**
   * Validate headers
   */
  private static validateHeaders(
    apiSpec: APISpec,
    errors: ValidationError[],
    warnings: ValidationError[],
    suggestions: string[]
  ): void {
    if (!apiSpec.headers) {
      return;
    }

    Object.entries(apiSpec.headers).forEach(([key, value]) => {
      // Check for empty header values
      if (!value || value.trim() === '') {
        warnings.push({
          type: 'content',
          message: `Empty value for header '${key}'`,
          suggestions: ['Provide a valid value for the header or remove it'],
        });
      }

      // Check for common header naming issues
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('_')) {
        suggestions.push(`Consider using kebab-case for header '${key}' (e.g., '${key.replace(/_/g, '-')}')`);
      }

      // Check for authentication headers
      if (lowerKey === 'authorization') {
        if (!value.includes('Bearer ') && !value.includes('Basic ')) {
          warnings.push({
            type: 'content',
            message: 'Authorization header may be missing authentication scheme',
            suggestions: ['Use "Bearer <token>" or "Basic <credentials>" format'],
          });
        }
      }

      // Check content-type for requests with body
      if (lowerKey === 'content-type' && apiSpec.body) {
        if (typeof apiSpec.body === 'object' && !value.includes('application/json')) {
          warnings.push({
            type: 'content',
            message: 'Content-Type may not match request body format',
            suggestions: ['Use "application/json" for JSON request bodies'],
          });
        }
      }
    });
  }

  /**
   * Validate request body
   */
  private static validateBody(
    apiSpec: APISpec,
    errors: ValidationError[],
    warnings: ValidationError[],
    suggestions: string[]
  ): void {
    if (!apiSpec.body) {
      return;
    }

    // Check if body is valid JSON when it's an object
    if (typeof apiSpec.body === 'object') {
      try {
        JSON.stringify(apiSpec.body);
      } catch (error) {
        errors.push({
          type: 'format',
          message: 'Request body contains invalid JSON',
          details: error,
          suggestions: ['Ensure request body is valid JSON format'],
        });
      }
    }

    // Check if string body looks like JSON but isn't parsed
    if (typeof apiSpec.body === 'string') {
      const trimmed = apiSpec.body.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(apiSpec.body);
          suggestions.push('Consider parsing JSON string body as object for better validation');
        } catch {
          errors.push({
            type: 'format',
            message: 'Request body appears to be malformed JSON',
            suggestions: ['Fix JSON syntax in request body'],
          });
        }
      }
    }
  }

  /**
   * Validate parameters
   */
  private static validateParameters(
    apiSpec: APISpec,
    errors: ValidationError[],
    warnings: ValidationError[],
    suggestions: string[]
  ): void {
    if (!apiSpec.parameters) {
      return;
    }

    const paramNames = new Set<string>();
    
    apiSpec.parameters.forEach((param, index) => {
      // Check for duplicate parameter names
      if (paramNames.has(param.name)) {
        errors.push({
          type: 'content',
          message: `Duplicate parameter name '${param.name}'`,
          suggestions: ['Ensure parameter names are unique'],
        });
      }
      paramNames.add(param.name);

      // Validate parameter location
      if (param.location === 'path' && !apiSpec.url.includes(`{${param.name}}`)) {
        warnings.push({
          type: 'content',
          message: `Path parameter '${param.name}' not found in URL`,
          suggestions: [`Add {${param.name}} placeholder to URL or change parameter location`],
        });
      }

      // Validate required parameters
      if (param.required && !param.example && !param.description) {
        warnings.push({
          type: 'content',
          message: `Required parameter '${param.name}' lacks description or example`,
          suggestions: ['Add description or example for better documentation'],
        });
      }

      // Validate parameter types
      if (param.type === 'array' && param.example && !Array.isArray(param.example)) {
        warnings.push({
          type: 'content',
          message: `Parameter '${param.name}' type is array but example is not an array`,
          suggestions: ['Provide array example or correct parameter type'],
        });
      }
    });
  }

  /**
   * Generate improvement suggestions
   */
  private static generateImprovementSuggestions(
    apiSpec: APISpec,
    suggestions: string[]
  ): void {
    // Suggest adding description if missing
    if (!apiSpec.description) {
      suggestions.push('Add description to explain what this API endpoint does');
    }

    // Suggest adding examples if missing
    if (!apiSpec.examples || apiSpec.examples.length === 0) {
      suggestions.push('Add examples to demonstrate API usage');
    }

    // Suggest parameter documentation
    if (apiSpec.parameters && apiSpec.parameters.some(p => !p.description)) {
      suggestions.push('Add descriptions to all parameters for better documentation');
    }

    // Suggest authentication documentation
    if (apiSpec.headers && Object.keys(apiSpec.headers).some(key => 
        key.toLowerCase().includes('auth') || key.toLowerCase().includes('token'))) {
      suggestions.push('Document authentication requirements clearly');
    }
  }

  /**
   * Validate a parsed API collection
   */
  public static validateAPICollection(collection: ParsedAPICollection): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: string[] = [];

    try {
      // Use Zod schema for basic validation
      ParsedAPICollectionSchema.parse(collection);
    } catch (error) {
      errors.push({
        type: 'format',
        message: `Invalid API collection format: ${error}`,
        details: error,
      });
      return { isValid: false, errors, warnings, suggestions };
    }

    // Validate individual API specs
    collection.apis.forEach((apiSpec, index) => {
      const apiValidation = this.validateAPISpec(apiSpec);
      
      // Prefix errors and warnings with API index
      apiValidation.errors.forEach(error => {
        errors.push({
          ...error,
          message: `API ${index + 1} (${apiSpec.name}): ${error.message}`,
        });
      });

      apiValidation.warnings.forEach(warning => {
        warnings.push({
          ...warning,
          message: `API ${index + 1} (${apiSpec.name}): ${warning.message}`,
        });
      });

      suggestions.push(...apiValidation.suggestions.map(s => 
        `API ${index + 1} (${apiSpec.name}): ${s}`
      ));
    });

    // Validate collection-level consistency
    this.validateCollectionConsistency(collection, errors, warnings, suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate consistency across the API collection
   */
  private static validateCollectionConsistency(
    collection: ParsedAPICollection,
    errors: ValidationError[],
    warnings: ValidationError[],
    suggestions: string[]
  ): void {
    // Check for duplicate API names
    const apiNames = new Set<string>();
    collection.apis.forEach(api => {
      if (apiNames.has(api.name)) {
        errors.push({
          type: 'content',
          message: `Duplicate API name '${api.name}'`,
          suggestions: ['Ensure API names are unique within the collection'],
        });
      }
      apiNames.add(api.name);
    });

    // Check for consistent base URLs
    if (collection.baseUrl) {
      const inconsistentApis = collection.apis.filter(api => 
        !api.url.startsWith(collection.baseUrl!)
      );
      
      if (inconsistentApis.length > 0) {
        warnings.push({
          type: 'content',
          message: `${inconsistentApis.length} APIs don't use the collection base URL`,
          suggestions: ['Consider updating URLs to use consistent base URL'],
        });
      }
    }

    // Check for consistent authentication patterns
    const authHeaders = collection.apis
      .map(api => api.headers && Object.keys(api.headers).find(key => 
        key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')
      ))
      .filter(Boolean);

    if (authHeaders.length > 0 && authHeaders.length < collection.apis.length) {
      warnings.push({
        type: 'content',
        message: 'Inconsistent authentication patterns across APIs',
        suggestions: ['Ensure all APIs use consistent authentication methods'],
      });
    }

    // Suggest collection-level improvements
    if (!collection.description) {
      suggestions.push('Add description to explain the purpose of this API collection');
    }

    if (collection.apis.length === 0) {
      errors.push({
        type: 'content',
        message: 'API collection contains no APIs',
        suggestions: ['Add at least one API specification to the collection'],
      });
    }
  }

  /**
   * Validate curl commands for completeness and correctness
   */
  public static validateCurlCommands(curlCommands: CurlCommand[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: string[] = [];

    curlCommands.forEach((curl, index) => {
      // Validate URL
      if (!isValidURL(curl.url)) {
        errors.push({
          type: 'curl',
          message: `Invalid URL in curl command ${index + 1}: ${curl.url}`,
          lineNumber: curl.lineNumber,
          suggestions: ['Ensure URL includes protocol (http:// or https://)'],
        });
      }

      // Check for common curl command issues
      if (!curl.raw.includes('curl')) {
        errors.push({
          type: 'curl',
          message: `Command ${index + 1} doesn't appear to be a curl command`,
          lineNumber: curl.lineNumber,
        });
      }

      // Validate headers
      Object.entries(curl.headers).forEach(([key, value]) => {
        if (!value || value.trim() === '') {
          warnings.push({
            type: 'curl',
            message: `Empty header value for '${key}' in curl command ${index + 1}`,
            lineNumber: curl.lineNumber,
          });
        }
      });

      // Check for missing context
      if (!curl.context.heading) {
        warnings.push({
          type: 'structure',
          message: `Curl command ${index + 1} has no associated heading`,
          lineNumber: curl.lineNumber,
          suggestions: ['Add descriptive headings above curl commands'],
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}