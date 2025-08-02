import { describe, it, expect } from 'vitest';
import { ServerGenerator } from '../src/generator/server-generator.js';
import { ParsedAPICollection } from '../src/parser/types.js';
import { GeneratedMCPTool } from '../src/generator/mcp-tool-generator.js';

describe('ServerGenerator', () => {
  const generator = new ServerGenerator({
    serverName: 'Test API Server',
    serverVersion: '1.0.0',
    serverDescription: 'Test MCP server for API testing',
    debug: false,
  });

  const sampleAPICollection: ParsedAPICollection = {
    name: 'Test API',
    description: 'Test API collection',
    baseUrl: 'https://api.example.com',
    apis: [
      {
        name: 'Get User',
        method: 'GET',
        url: 'https://api.example.com/users/{id}',
        description: 'Get user by ID',
        sourceLocation: { lineNumber: 1 },
      },
      {
        name: 'Create User',
        method: 'POST',
        url: 'https://api.example.com/users',
        description: 'Create new user',
        body: { name: 'string', email: 'string' },
        sourceLocation: { lineNumber: 10 },
      },
    ],
    curlCommands: [],
    rawMarkdown: '# Test API\n\n## Get User\n\n## Create User',
    metadata: {
      fileName: 'test-api.md',
      parsedAt: new Date().toISOString(),
      headings: ['Test API', 'Get User', 'Create User'],
      codeBlocks: 2,
      curlCommandsFound: 2,
    },
  };

  const sampleTools: GeneratedMCPTool[] = [
    {
      name: 'get_get_user',
      description: 'Make a GET request to Get User',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          headers: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['url'],
      },
      apiSpec: sampleAPICollection.apis[0],
      functionName: 'getGetUser',
      httpMethod: 'GET',
      hasBody: false,
      parameters: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'The URL to make the request to',
          location: 'path',
        },
      ],
      validation: {
        requiredParams: ['url'],
        optionalParams: ['headers'],
      },
    },
    {
      name: 'post_create_user',
      description: 'Make a POST request to Create User',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          body: { oneOf: [{ type: 'string' }, { type: 'object' }] },
          headers: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['url'],
      },
      apiSpec: sampleAPICollection.apis[1],
      functionName: 'postCreateUser',
      httpMethod: 'POST',
      hasBody: true,
      parameters: [
        {
          name: 'url',
          type: 'string',
          required: true,
          description: 'The URL to make the request to',
          location: 'path',
        },
        {
          name: 'body',
          type: 'object',
          required: false,
          description: 'Request body data',
          location: 'body',
        },
      ],
      validation: {
        requiredParams: ['url'],
        optionalParams: ['body', 'headers'],
        bodySchema: { type: 'object' },
      },
    },
  ];

  it('should generate server structure', () => {
    const result = generator.generateServer(sampleAPICollection, sampleTools);

    expect(result.server.name).toBe('Test API Server');
    expect(result.server.version).toBe('1.0.0');
    expect(result.server.tools).toHaveLength(2);
    expect(result.server.apis).toHaveLength(2);
    expect(result.server.metadata.toolCount).toBe(2);
    expect(result.server.metadata.apiCount).toBe(2);
  });

  it('should generate package dependencies', () => {
    const result = generator.generateServer(sampleAPICollection, sampleTools);

    expect(result.server.dependencies.length).toBeGreaterThan(0);
    
    const mcpSDK = result.server.dependencies.find(dep => dep.name === '@modelcontextprotocol/sdk');
    expect(mcpSDK).toBeDefined();
    expect(mcpSDK!.type).toBe('dependency');

    const zod = result.server.dependencies.find(dep => dep.name === 'zod');
    expect(zod).toBeDefined();
    expect(zod!.type).toBe('dependency');

    const typescript = result.server.dependencies.find(dep => dep.name === 'typescript');
    expect(typescript).toBeDefined();
    expect(typescript!.type).toBe('devDependency');
  });

  it('should generate import statements', () => {
    const result = generator.generateServer(sampleAPICollection, sampleTools);

    expect(result.server.imports.length).toBeGreaterThan(0);
    
    const serverImport = result.server.imports.find(imp => imp.module === '@modelcontextprotocol/sdk/server/index.js');
    expect(serverImport).toBeDefined();
    expect(serverImport!.imports).toContain('Server');

    const zodImport = result.server.imports.find(imp => imp.module === 'zod');
    expect(zodImport).toBeDefined();
    expect(zodImport!.imports).toContain('z');
  });

  it('should generate export statements', () => {
    const result = generator.generateServer(sampleAPICollection, sampleTools);

    expect(result.server.exports.length).toBeGreaterThan(0);
    
    const mcpServerExport = result.server.exports.find(exp => exp.name === 'MCPServer');
    expect(mcpServerExport).toBeDefined();
    expect(mcpServerExport!.type).toBe('class');
    expect(mcpServerExport!.isDefault).toBe(true);

    const toolsExport = result.server.exports.find(exp => exp.name === 'ALL_TOOLS');
    expect(toolsExport).toBeDefined();
    expect(toolsExport!.type).toBe('const');
  });

  it('should create template context', () => {
    const result = generator.generateServer(sampleAPICollection, sampleTools);

    expect(result.templateContext.server.name).toBe('Test API Server');
    expect(result.templateContext.tools).toHaveLength(2);
    expect(result.templateContext.apis).toHaveLength(2);
    expect(result.templateContext.imports.length).toBeGreaterThan(0);
    expect(result.templateContext.exports.length).toBeGreaterThan(0);
    expect(result.templateContext.metadata.generatedBy).toBe('MCP Builder CLI');
  });

  it('should generate warnings for potential issues', () => {
    const duplicateAPICollection: ParsedAPICollection = {
      ...sampleAPICollection,
      apis: [
        {
          name: 'Get User',
          method: 'GET',
          url: 'https://api.example.com/users/1',
          sourceLocation: { lineNumber: 1 },
        },
        {
          name: 'Get User 2',
          method: 'GET',
          url: 'https://api.example.com/users/1', // Duplicate endpoint
          sourceLocation: { lineNumber: 2 },
        },
      ],
    };

    const result = generator.generateServer(duplicateAPICollection, sampleTools);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle missing descriptions', () => {
    const apiCollectionWithoutDescriptions: ParsedAPICollection = {
      ...sampleAPICollection,
      apis: [
        {
          name: 'Get User',
          method: 'GET',
          url: 'https://api.example.com/users/{id}',
          // No description
          sourceLocation: { lineNumber: 1 },
        },
      ],
    };

    const result = generator.generateServer(apiCollectionWithoutDescriptions, [sampleTools[0]]);
    expect(result.warnings.some(w => w.includes('missing descriptions'))).toBe(true);
  });

  it('should generate proper package name', () => {
    const generatorWithSpecialName = new ServerGenerator({
      serverName: 'My Special API Server!',
      debug: false,
    });

    const result = generatorWithSpecialName.generateServer(sampleAPICollection, sampleTools);
    expect(result.server.packageName).toBe('my-special-api-server');
  });

  it('should include configuration options', () => {
    const result = generator.generateServer(sampleAPICollection, sampleTools);

    expect(result.server.configuration.timeout).toBe(30000);
    expect(result.server.configuration.maxResponseLength).toBe(50000);
    expect(result.server.configuration.allowLocalhost).toBe(false);
    expect(result.server.configuration.allowPrivateIps).toBe(false);
    expect(result.server.configuration.userAgent).toContain('MCP-Server');
  });
});