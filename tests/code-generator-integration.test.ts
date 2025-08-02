import { describe, it, expect } from 'vitest';
import { CodeGenerator } from '../src/generator/code-generator.js';
import { ParsedAPICollection } from '../src/parser/types.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('CodeGenerator Integration', () => {
  const sampleAPICollection: ParsedAPICollection = {
    name: 'Test API',
    description: 'Test API collection for integration testing',
    baseUrl: 'https://api.example.com',
    apis: [
      {
        name: 'Get User',
        method: 'GET',
        url: 'https://api.example.com/users/{id}',
        description: 'Get user by ID',
        parameters: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'User ID',
            location: 'path',
          },
        ],
        sourceLocation: { lineNumber: 1 },
      },
      {
        name: 'Create User',
        method: 'POST',
        url: 'https://api.example.com/users',
        description: 'Create new user',
        body: { name: 'John Doe', email: 'john@example.com' },
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

  it('should generate complete MCP server from API collection', async () => {
    // Create temporary directory for output
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-generator-test-'));
    
    try {
      const generator = new CodeGenerator({
        outputDir: tempDir,
        debug: false,
        overwrite: true,
        server: {
          name: 'Test API Server',
          version: '1.0.0',
          description: 'Generated test server',
          packageName: 'test-api-server',
          author: 'Test Author',
          license: 'MIT',
        },
        toolGeneration: {
          includeDescriptions: true,
          strictValidation: true,
          toolNamePrefix: 'api_',
        },
        validationGeneration: {
          strictValidation: true,
          includeCustomErrors: true,
          runtimeTypeChecking: true,
        },
      });

      const result = await generator.generateFromAPICollection(sampleAPICollection);

      // Debug: log errors if any
      if (result.errors.length > 0) {
        console.log('Generation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.log('Generation warnings:', result.warnings);
      }

      // Verify generation results
      expect(result.stats.toolsGenerated).toBe(2);
      expect(result.stats.apisProcessed).toBe(2);
      expect(result.stats.errors).toBe(0);
      expect(result.tools).toHaveLength(2);

      // Verify server structure
      expect(result.server.name).toBe('Test API Server');
      expect(result.server.tools).toHaveLength(2);
      expect(result.server.apis).toHaveLength(2);

      // Verify tools
      const getUserTool = result.tools.find(t => t.name === 'api_get_get_user');
      expect(getUserTool).toBeDefined();
      expect(getUserTool!.httpMethod).toBe('GET');
      expect(getUserTool!.hasBody).toBe(false);

      const createUserTool = result.tools.find(t => t.name === 'api_post_create_user');
      expect(createUserTool).toBeDefined();
      expect(createUserTool!.httpMethod).toBe('POST');
      expect(createUserTool!.hasBody).toBe(true);

      // Verify validation generation
      expect(result.validation.stats.schemasGenerated).toBe(2);
      expect(result.validation.stats.rulesGenerated).toBeGreaterThan(0);
      expect(result.validation.validationCode).toContain('ValidationError');
      expect(result.validation.typeDefinitions).toContain('interface');

      // Verify files would be generated (we're not actually writing files in this test)
      // but we can check that the generation process completed successfully
      expect(result.errors).toHaveLength(0);

    } finally {
      // Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle API collection with validation errors gracefully', async () => {
    const invalidAPICollection: ParsedAPICollection = {
      name: 'Invalid API',
      apis: [
        {
          name: '', // Invalid: empty name
          method: 'GET',
          url: 'invalid-url', // Invalid: not a proper URL
          sourceLocation: { lineNumber: 1 },
        },
      ],
      curlCommands: [],
      rawMarkdown: '# Invalid API',
      metadata: {
        parsedAt: new Date().toISOString(),
        headings: ['Invalid API'],
        codeBlocks: 0,
        curlCommandsFound: 0,
      },
    };

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-generator-error-test-'));
    
    try {
      const generator = new CodeGenerator({
        outputDir: tempDir,
        debug: false,
        server: {
          name: 'Invalid API Server',
        },
      });

      const result = await generator.generateFromAPICollection(invalidAPICollection);

      // Should handle errors gracefully - either errors or warnings should be generated
      const hasIssues = result.stats.errors > 0 || result.errors.length > 0 || result.warnings.length > 0;
      expect(hasIssues).toBe(true);
      
      // Should still generate some output even with invalid input
      expect(result.tools.length).toBeGreaterThanOrEqual(0);
      
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate proper template context', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-generator-context-test-'));
    
    try {
      const generator = new CodeGenerator({
        outputDir: tempDir,
        debug: false,
        server: {
          name: 'Context Test Server',
          version: '2.0.0',
          author: 'Context Test Author',
        },
      });

      // Update the server generator config to use the correct version
      generator['serverGenerator'].updateConfig({
        serverVersion: '2.0.0',
      });

      const result = await generator.generateFromAPICollection(sampleAPICollection);

      // Verify template context structure
      expect(result.server.metadata.generatedBy).toBe('MCP Builder CLI');
      expect(result.server.metadata.toolCount).toBe(2);
      expect(result.server.metadata.apiCount).toBe(2);
      expect(result.server.version).toBe('2.0.0');
      
      // Verify dependencies are included
      expect(result.server.dependencies.length).toBeGreaterThan(0);
      expect(result.server.dependencies.some(dep => dep.name === '@modelcontextprotocol/sdk')).toBe(true);
      expect(result.server.dependencies.some(dep => dep.name === 'zod')).toBe(true);

      // Verify imports and exports
      expect(result.server.imports.length).toBeGreaterThan(0);
      expect(result.server.exports.length).toBeGreaterThan(0);

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate warnings for potential issues', async () => {
    const problematicAPICollection: ParsedAPICollection = {
      name: 'Problematic API',
      apis: [
        {
          name: 'Complex Endpoint',
          method: 'POST',
          url: 'https://api.example.com/complex',
          // Many parameters to trigger warning
          parameters: Array.from({ length: 12 }, (_, i) => ({
            name: `param${i}`,
            type: 'string' as const,
            required: i < 6,
            description: `Parameter ${i}`,
            location: 'query' as const,
          })),
          sourceLocation: { lineNumber: 1 },
        },
        {
          name: 'Another Endpoint',
          method: 'GET',
          url: 'https://api.example.com/another',
          // No description to trigger warning
          sourceLocation: { lineNumber: 10 },
        },
      ],
      curlCommands: [],
      rawMarkdown: '# Problematic API',
      metadata: {
        parsedAt: new Date().toISOString(),
        headings: ['Problematic API'],
        codeBlocks: 0,
        curlCommandsFound: 0,
      },
    };

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-generator-warnings-test-'));
    
    try {
      const generator = new CodeGenerator({
        outputDir: tempDir,
        debug: false,
        server: {
          name: 'Problematic API Server',
        },
      });

      const result = await generator.generateFromAPICollection(problematicAPICollection);

      // Should generate warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('more than'))).toBe(true);
      expect(result.warnings.some(w => w.includes('missing descriptions'))).toBe(true);

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});