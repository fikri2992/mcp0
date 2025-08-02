import { describe, it, expect } from 'vitest';
import { MCPToolGenerator } from '../src/generator/mcp-tool-generator.js';
import { APISpec } from '../src/parser/types.js';

describe('MCPToolGenerator', () => {
  const generator = new MCPToolGenerator({
    debug: false,
    includeDescriptions: true,
    strictValidation: true,
  });

  const sampleAPISpec: APISpec = {
    name: 'Get User',
    description: 'Retrieve user information by ID',
    method: 'GET',
    url: 'https://api.example.com/users/{id}',
    headers: {
      'Authorization': 'Bearer token',
    },
    parameters: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'User ID',
        location: 'path',
      },
      {
        name: 'include',
        type: 'string',
        required: false,
        description: 'Additional fields to include',
        location: 'query',
      },
    ],
    sourceLocation: {
      lineNumber: 10,
      heading: 'User API',
    },
  };

  it('should generate MCP tool from API specification', () => {
    const result = generator.generateTools([sampleAPISpec]);

    expect(result.tools).toHaveLength(1);
    expect(result.stats.toolsGenerated).toBe(1);
    expect(result.stats.errors).toBe(0);

    const tool = result.tools[0];
    expect(tool.name).toBe('get_get_user');
    expect(tool.description).toContain('GET request to Get User');
    expect(tool.httpMethod).toBe('GET');
    expect(tool.hasBody).toBe(false);
    expect(tool.functionName).toBe('getGetUser');
  });

  it('should generate proper input schema', () => {
    const result = generator.generateTools([sampleAPISpec]);
    const tool = result.tools[0];

    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties).toBeDefined();
    expect(tool.inputSchema.properties!.url).toBeDefined();
    expect(tool.inputSchema.properties!.headers).toBeDefined();
    expect(tool.inputSchema.required).toContain('url');
  });

  it('should extract parameters correctly', () => {
    const result = generator.generateTools([sampleAPISpec]);
    const tool = result.tools[0];

    expect(tool.parameters).toHaveLength(4); // url, id, include, headers
    
    const urlParam = tool.parameters.find(p => p.name === 'url');
    expect(urlParam).toBeDefined();
    expect(urlParam!.required).toBe(true);
    expect(urlParam!.type).toBe('string');

    const idParam = tool.parameters.find(p => p.name === 'id');
    expect(idParam).toBeDefined();
    expect(idParam!.required).toBe(true);
    expect(idParam!.location).toBe('path');

    const includeParam = tool.parameters.find(p => p.name === 'include');
    expect(includeParam).toBeDefined();
    expect(includeParam!.required).toBe(false);
    expect(includeParam!.location).toBe('query');
  });

  it('should generate validation rules', () => {
    const result = generator.generateTools([sampleAPISpec]);
    const tool = result.tools[0];

    expect(tool.validation.requiredParams).toContain('url');
    expect(tool.validation.requiredParams).toContain('id');
    expect(tool.validation.optionalParams).toContain('include');
    expect(tool.validation.optionalParams).toContain('headers');
  });

  it('should handle POST requests with body', () => {
    const postAPISpec: APISpec = {
      name: 'Create User',
      description: 'Create a new user',
      method: 'POST',
      url: 'https://api.example.com/users',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      sourceLocation: {
        lineNumber: 20,
      },
    };

    const result = generator.generateTools([postAPISpec]);
    const tool = result.tools[0];

    expect(tool.httpMethod).toBe('POST');
    expect(tool.hasBody).toBe(true);
    expect(tool.parameters.some(p => p.name === 'body')).toBe(true);
  });

  it('should generate warnings for potential issues', () => {
    const duplicateAPISpecs: APISpec[] = [
      {
        name: 'Get User',
        method: 'GET',
        url: 'https://api.example.com/users/1',
        sourceLocation: { lineNumber: 1 },
      },
      {
        name: 'Get User', // Duplicate name
        method: 'GET',
        url: 'https://api.example.com/users/2',
        sourceLocation: { lineNumber: 2 },
      },
    ];

    const result = generator.generateTools(duplicateAPISpecs);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('Duplicate tool names'))).toBe(true);
  });

  it('should handle validation patterns', () => {
    const apiSpecWithValidation: APISpec = {
      name: 'Get User by Email',
      method: 'GET',
      url: 'https://api.example.com/users',
      parameters: [
        {
          name: 'email',
          type: 'string',
          required: true,
          description: 'User email address',
          location: 'query',
        },
      ],
      sourceLocation: { lineNumber: 1 },
    };

    const result = generator.generateTools([apiSpecWithValidation]);
    const tool = result.tools[0];
    const emailParam = tool.parameters.find(p => p.name === 'email');

    expect(emailParam).toBeDefined();
    expect(emailParam!.validation?.pattern).toBeDefined();
    expect(emailParam!.validation!.pattern).toContain('@');
  });
});