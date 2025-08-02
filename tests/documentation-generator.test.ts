import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentationGenerator, createDocumentationGenerator } from '../src/generator/documentation-generator.js';
import { ParsedAPICollection, APISpec } from '../src/parser/types.js';
import { GeneratedMCPTool } from '../src/generator/mcp-tool-generator.js';
import { TemplateContext } from '../src/generator/template-engine.js';

describe('DocumentationGenerator', () => {
  let generator: DocumentationGenerator;
  let mockAPICollection: ParsedAPICollection;
  let mockTools: GeneratedMCPTool[];
  let mockTemplateContext: TemplateContext;

  beforeEach(() => {
    generator = createDocumentationGenerator({
      debug: false,
      includeInlineComments: true,
      includeExamples: true,
      includeAPIReference: true,
      includeTypeDefinitions: true,
      // Don't specify templateDir so it falls back to manual generation
    });

    // Mock API collection
    mockAPICollection = {
      name: 'Test API',
      description: 'A test API collection',
      baseUrl: 'https://api.example.com',
      apis: [
        {
          name: 'getUser',
          description: 'Get user information',
          method: 'GET',
          url: 'https://api.example.com/users/{id}',
          headers: {
            'Authorization': 'Bearer token',
            'Content-Type': 'application/json',
          },
          parameters: [
            {
              name: 'id',
              type: 'string',
              required: true,
              location: 'path',
              description: 'User ID',
            },
          ],
          sourceLocation: {
            lineNumber: 1,
            heading: 'Get User',
          },
        },
        {
          name: 'createUser',
          description: 'Create a new user',
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: {
            'Authorization': 'Bearer token',
            'Content-Type': 'application/json',
          },
          body: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          parameters: [
            {
              name: 'name',
              type: 'string',
              required: true,
              location: 'body',
              description: 'User name',
            },
            {
              name: 'email',
              type: 'string',
              required: true,
              location: 'body',
              description: 'User email',
            },
          ],
          sourceLocation: {
            lineNumber: 10,
            heading: 'Create User',
          },
        },
      ],
      curlCommands: [],
      rawMarkdown: '# Test API\n\n## Get User\n\n```bash\ncurl -X GET "https://api.example.com/users/123"\n```',
      metadata: {
        fileName: 'test-api.md',
        parsedAt: new Date().toISOString(),
        headings: ['Test API', 'Get User', 'Create User'],
        codeBlocks: 2,
        curlCommandsFound: 2,
      },
    };

    // Mock tools
    mockTools = [
      {
        name: 'get_user',
        description: 'Get user information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
            },
          },
          required: ['id'],
        },
        apiSpec: mockAPICollection.apis[0],
        functionName: 'getUserTool',
        httpMethod: 'GET',
        hasBody: false,
        parameters: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'User ID',
            location: 'path',
          },
        ],
        validation: {
          requiredParams: ['id'],
          optionalParams: [],
        },
      },
      {
        name: 'create_user',
        description: 'Create a new user',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User name',
            },
            email: {
              type: 'string',
              description: 'User email',
            },
          },
          required: ['name', 'email'],
        },
        apiSpec: mockAPICollection.apis[1],
        functionName: 'createUserTool',
        httpMethod: 'POST',
        hasBody: true,
        parameters: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'User name',
            location: 'body',
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'User email',
            location: 'body',
          },
        ],
        validation: {
          requiredParams: ['name', 'email'],
          optionalParams: [],
        },
      },
    ];

    // Mock template context
    mockTemplateContext = {
      server: {
        name: 'Test MCP Server',
        version: '1.0.0',
        description: 'A test MCP server',
        packageName: 'test-mcp-server',
        author: 'Test Author',
        license: 'MIT',
      },
      tools: mockTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        functionName: tool.name.replace(/_/g, ''),
        httpMethod: tool.apiSpec.method,
        inputSchema: tool.inputSchema,
        hasBody: tool.apiSpec.method === 'POST' || tool.apiSpec.method === 'PUT',
        parameters: tool.apiSpec.parameters || [],
      })),
      apis: mockAPICollection.apis,
      imports: [],
      exports: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'MCP Builder CLI Test',
        version: '1.0.0',
      },
      configuration: {
        timeout: 30000,
        maxResponseLength: 50000,
        allowLocalhost: false,
        allowPrivateIps: false,
        userAgent: 'MCP-Server/1.0.0',
      },
    };
  });

  describe('generateDocumentation', () => {
    it('should generate complete documentation', async () => {
      const result = await generator.generateDocumentation(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      expect(result.documentation).toBeDefined();
      expect(result.documentation.length).toBeGreaterThan(0);
      expect(result.stats.filesGenerated).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
    });

    it('should generate README documentation', async () => {
      const result = await generator.generateDocumentation(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      const readme = result.documentation.find(doc => doc.type === 'readme');
      expect(readme).toBeDefined();
      expect(readme?.path).toBe('README.md');
      expect(readme?.format).toBe('markdown');
      expect(readme?.content).toContain('# Test MCP Server');
      expect(readme?.content).toContain('get_user');
      expect(readme?.content).toContain('create_user');
    });

    it('should generate API reference documentation', async () => {
      const result = await generator.generateDocumentation(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      const apiRef = result.documentation.find(doc => doc.type === 'api-reference');
      expect(apiRef).toBeDefined();
      expect(apiRef?.path).toBe('docs/api-reference.md');
      expect(apiRef?.format).toBe('markdown');
      expect(apiRef?.content).toContain('# Test API API Reference');
      expect(apiRef?.content).toContain('getUser');
      expect(apiRef?.content).toContain('createUser');
    });

    it('should generate TypeScript type definitions', async () => {
      const result = await generator.generateDocumentation(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      const typeDefs = result.documentation.find(doc => doc.type === 'type-definitions');
      expect(typeDefs).toBeDefined();
      expect(typeDefs?.path).toBe('types/generated.d.ts');
      expect(typeDefs?.format).toBe('typescript');
      expect(typeDefs?.content).toContain('export interface');
      expect(typeDefs?.content).toContain('GetUserParams');
      expect(typeDefs?.content).toContain('CreateUserParams');
    });

    it('should generate inline comments documentation', async () => {
      const result = await generator.generateDocumentation(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      const inlineComments = result.documentation.find(doc => doc.type === 'inline-comments');
      expect(inlineComments).toBeDefined();
      expect(inlineComments?.path).toBe('docs/inline-comments.md');
      expect(inlineComments?.format).toBe('markdown');
      expect(inlineComments?.content).toContain('handleGetUser');
      expect(inlineComments?.content).toContain('handleCreateUser');
    });

    it('should generate examples documentation', async () => {
      const result = await generator.generateDocumentation(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      const examples = result.documentation.filter(doc => doc.type === 'examples');
      expect(examples.length).toBeGreaterThan(0);
      
      const toolExamples = examples.find(ex => ex.path === 'examples/tool-usage.md');
      expect(toolExamples).toBeDefined();
      expect(toolExamples?.content).toContain('get_user');
      expect(toolExamples?.content).toContain('create_user');

      const apiExamples = examples.find(ex => ex.path === 'examples/api-usage.md');
      expect(apiExamples).toBeDefined();
      expect(apiExamples?.content).toContain('curl');
      expect(apiExamples?.content).toContain('fetch');

      const integrationExamples = examples.find(ex => ex.path === 'examples/integration.md');
      expect(integrationExamples).toBeDefined();
      expect(integrationExamples?.content).toContain('Claude Desktop');
      expect(integrationExamples?.content).toContain('Node.js');
    });
  });

  describe('generateREADME', () => {
    it('should generate README with proper structure', async () => {
      const readme = await generator.generateREADME(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      expect(readme.path).toBe('README.md');
      expect(readme.type).toBe('readme');
      expect(readme.format).toBe('markdown');
      expect(readme.content).toContain('# Test MCP Server');
      expect(readme.content).toContain('## Overview');
      expect(readme.content).toContain('## Available Tools');
      expect(readme.content).toContain('## API Endpoints');
      expect(readme.content).toContain('## Configuration');
    });

    it('should include tool information in README', async () => {
      const readme = await generator.generateREADME(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      expect(readme.content).toContain('get_user');
      expect(readme.content).toContain('Get user information by ID');
      expect(readme.content).toContain('create_user');
      expect(readme.content).toContain('Create a new user');
    });

    it('should include API endpoint information in README', async () => {
      const readme = await generator.generateREADME(
        mockAPICollection,
        mockTools,
        mockTemplateContext
      );

      expect(readme.content).toContain('getUser');
      expect(readme.content).toContain('GET');
      expect(readme.content).toContain('createUser');
      expect(readme.content).toContain('POST');
    });
  });

  describe('generateAPIReference', () => {
    it('should generate API reference with proper structure', async () => {
      const apiRef = await generator.generateAPIReference(mockAPICollection, mockTools);

      expect(apiRef.path).toBe('docs/api-reference.md');
      expect(apiRef.type).toBe('api-reference');
      expect(apiRef.format).toBe('markdown');
      expect(apiRef.content).toContain('# Test API API Reference');
      expect(apiRef.content).toContain('## Table of Contents');
      expect(apiRef.content).toContain('## API Endpoints');
    });

    it('should include authentication information', async () => {
      const apiRef = await generator.generateAPIReference(mockAPICollection, mockTools);

      expect(apiRef.content).toContain('Bearer token authentication required');
    });

    it('should include parameter tables', async () => {
      const apiRef = await generator.generateAPIReference(mockAPICollection, mockTools);

      expect(apiRef.content).toContain('| Name | Type | Location | Required | Description |');
      expect(apiRef.content).toContain('| `id` | string | path | Yes |');
    });
  });

  describe('generateTypeDefinitions', () => {
    it('should generate TypeScript type definitions', async () => {
      const typeDefs = await generator.generateTypeDefinitions(mockAPICollection, mockTools);

      expect(typeDefs.path).toBe('types/generated.d.ts');
      expect(typeDefs.type).toBe('type-definitions');
      expect(typeDefs.format).toBe('typescript');
      expect(typeDefs.content).toContain('export interface GetUserParams');
      expect(typeDefs.content).toContain('export interface CreateUserParams');
      expect(typeDefs.content).toContain('export type HTTPMethod');
    });

    it('should include JSDoc comments', async () => {
      const typeDefs = await generator.generateTypeDefinitions(mockAPICollection, mockTools);

      expect(typeDefs.content).toContain('/**');
      expect(typeDefs.content).toContain('* Parameters for');
      expect(typeDefs.content).toContain('*/');
    });
  });

  describe('utility methods', () => {
    it('should convert strings to kebab-case', () => {
      const generator = createDocumentationGenerator();
      // Access private method through type assertion for testing
      const kebabCase = (generator as any).kebabCase;
      
      expect(kebabCase('TestString')).toBe('test-string');
      expect(kebabCase('test_string')).toBe('test-string');
      expect(kebabCase('test string')).toBe('test-string');
    });

    it('should convert strings to PascalCase', () => {
      const generator = createDocumentationGenerator();
      // Access private method through type assertion for testing
      const pascalCase = (generator as any).pascalCase;
      
      expect(pascalCase('test-string')).toBe('TestString');
      expect(pascalCase('test_string')).toBe('TestString');
      expect(pascalCase('test string')).toBe('TestString');
    });

    it('should generate example values from schema', () => {
      const generator = createDocumentationGenerator();
      // Access private method through type assertion for testing
      const generateExampleValue = (generator as any).generateExampleValue;
      
      expect(generateExampleValue({ type: 'string' })).toBe('example-value');
      expect(generateExampleValue({ type: 'number' })).toBe(123);
      expect(generateExampleValue({ type: 'boolean' })).toBe(true);
      expect(generateExampleValue({ type: 'array' })).toEqual([]);
      expect(generateExampleValue({ type: 'object' })).toEqual({});
    });
  });
});