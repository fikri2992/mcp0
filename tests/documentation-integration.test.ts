import { describe, it, expect } from 'vitest';
import { CodeGenerator } from '../src/generator/code-generator.js';
import { ParsedAPICollection } from '../src/parser/types.js';

describe('Documentation Integration', () => {
  it('should generate documentation as part of code generation', async () => {
    // Mock API collection
    const mockAPICollection: ParsedAPICollection = {
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
      ],
      curlCommands: [],
      rawMarkdown: '# Test API\n\n## Get User\n\n```bash\ncurl -X GET "https://api.example.com/users/123"\n```',
      metadata: {
        fileName: 'test-api.md',
        parsedAt: new Date().toISOString(),
        headings: ['Test API', 'Get User'],
        codeBlocks: 1,
        curlCommandsFound: 1,
      },
    };

    // Create code generator with documentation enabled
    const generator = new CodeGenerator({
      outputDir: './test-output',
      debug: false,
      server: {
        name: 'Test MCP Server',
        version: '1.0.0',
        description: 'A test MCP server',
      },
      documentationGeneration: {
        includeInlineComments: true,
        includeExamples: true,
        includeAPIReference: true,
        includeTypeDefinitions: true,
      },
    });

    // Generate code with documentation
    const result = await generator.generateFromAPICollection(mockAPICollection);

    // Verify documentation was generated
    expect(result.documentation).toBeDefined();
    expect(result.documentation!.documentation.length).toBeGreaterThan(0);
    expect(result.documentation!.stats.filesGenerated).toBeGreaterThan(0);
    expect(result.documentation!.errors).toEqual([]);

    // Verify documentation files are included in the main result
    const documentationFiles = result.files.filter(file => file.type === 'documentation');
    expect(documentationFiles.length).toBeGreaterThan(0);

    // Verify specific documentation files
    const readme = documentationFiles.find(file => file.path === 'README.md');
    expect(readme).toBeDefined();
    expect(readme!.content).toContain('# Test MCP Server');

    const apiReference = documentationFiles.find(file => file.path === 'docs/api-reference.md');
    expect(apiReference).toBeDefined();
    expect(apiReference!.content).toContain('# Test API API Reference');

    const typeDefinitions = documentationFiles.find(file => file.path === 'types/generated.d.ts');
    expect(typeDefinitions).toBeDefined();
    expect(typeDefinitions!.content).toContain('export interface');

    // Verify no errors occurred
    expect(result.errors).toEqual([]);
  });

  it('should handle documentation generation errors gracefully', async () => {
    // Mock API collection with invalid data
    const mockAPICollection: ParsedAPICollection = {
      name: '',
      apis: [],
      curlCommands: [],
      rawMarkdown: '',
      metadata: {
        parsedAt: new Date().toISOString(),
        headings: [],
        codeBlocks: 0,
        curlCommandsFound: 0,
      },
    };

    const generator = new CodeGenerator({
      outputDir: './test-output',
      debug: false,
      server: {
        name: 'Test MCP Server',
      },
      documentationGeneration: {
        includeInlineComments: true,
        includeExamples: true,
        includeAPIReference: true,
        includeTypeDefinitions: true,
      },
    });

    // Generate code - should not fail even with empty API collection
    const result = await generator.generateFromAPICollection(mockAPICollection);

    // Verify documentation was still generated (even if minimal)
    expect(result.documentation).toBeDefined();
    expect(result.documentation!.documentation.length).toBeGreaterThan(0);

    // Should have at least a README
    const readme = result.documentation!.documentation.find(doc => doc.type === 'readme');
    expect(readme).toBeDefined();
  });
});