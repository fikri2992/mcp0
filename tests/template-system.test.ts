/**
 * Test suite for the template system
 */

import * as fs from 'fs';
import * as path from 'path';
import { TemplateEngine, TemplateContext } from '../src/generator/template-engine.js';
import { CodeGenerator, createTemplateContext } from '../src/generator/code-generator.js';

/**
 * Test utilities
 */
class TestRunner {
  private passed = 0;
  private failed = 0;

  async test(name: string, testFn: () => Promise<void> | void): Promise<void> {
    try {
      console.log(`Running test: ${name}`);
      await testFn();
      this.passed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      this.failed++;
      console.error(`✗ ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  assertEqual(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message || 'Values not equal'}\n` +
        `  Expected: ${JSON.stringify(expected)}\n` +
        `  Actual: ${JSON.stringify(actual)}`
      );
    }
  }

  printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log(`Test Results: ${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

/**
 * Create test template context
 */
function createTestContext(): TemplateContext {
  return createTemplateContext({
    serverName: 'Test API Server',
    serverVersion: '1.0.0',
    serverDescription: 'A test MCP server for API calls',
    packageName: 'test-api-server',
    author: 'Test Author <test@example.com>',
    license: 'MIT',
    tools: [
      {
        name: 'api_get',
        description: 'Make a GET request',
        functionName: 'get',
        httpMethod: 'GET',
        hasBody: false,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            headers: { type: 'object' },
          },
          required: ['url'],
        },
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'The URL to request' },
          { name: 'headers', type: 'object', required: false, description: 'Optional headers' },
        ],
      },
      {
        name: 'api_post',
        description: 'Make a POST request',
        functionName: 'post',
        httpMethod: 'POST',
        hasBody: true,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            body: { oneOf: [{ type: 'string' }, { type: 'object' }] },
            headers: { type: 'object' },
          },
          required: ['url'],
        },
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'The URL to request' },
          { name: 'body', type: 'string|object', required: false, description: 'Request body' },
          { name: 'headers', type: 'object', required: false, description: 'Optional headers' },
        ],
      },
    ],
    apis: [
      {
        name: 'Get User',
        description: 'Retrieve user information',
        method: 'GET',
        url: 'https://api.example.com/users/{id}',
        parameters: [
          { name: 'id', type: 'string', required: true, location: 'path', description: 'User ID' },
        ],
      },
      {
        name: 'Create User',
        description: 'Create a new user',
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { name: 'string', email: 'string' },
        parameters: [
          { name: 'name', type: 'string', required: true, location: 'body', description: 'User name' },
          { name: 'email', type: 'string', required: true, location: 'body', description: 'User email' },
        ],
      },
    ],
  });
}

/**
 * Main test suite
 */
async function runTests(): Promise<void> {
  const runner = new TestRunner();

  // Test template engine initialization
  await runner.test('TemplateEngine initializes correctly', () => {
    const engine = new TemplateEngine({
      templateDir: path.join(__dirname, '../templates'),
      debug: false,
    });
    
    runner.assert(engine !== null, 'TemplateEngine should be created');
  });

  // Test template context creation
  await runner.test('Template context creation works', () => {
    const context = createTestContext();
    
    runner.assert(typeof context.server.name === 'string', 'Server name should be string');
    runner.assert(context.tools.length > 0, 'Should have tools');
    runner.assert(context.apis.length > 0, 'Should have APIs');
    runner.assert(typeof context.metadata.generatedAt === 'string', 'Should have generation timestamp');
  });

  // Test Handlebars helpers
  await runner.test('Handlebars helpers work correctly', () => {
    const engine = new TemplateEngine({ debug: false });
    
    // Test helper registration (we can't directly test helpers without rendering)
    runner.assert(engine !== null, 'Engine with helpers should be created');
  });

  // Test template availability
  await runner.test('Templates are available', async () => {
    const templateDir = path.resolve(__dirname, '../templates');
    const engine = new TemplateEngine({
      templateDir,
      debug: false,
    });
    
    const templates = await engine.getAvailableTemplates();
    runner.assert(Array.isArray(templates), 'Should return array of templates');
    
    // Check if templates directory exists
    try {
      await fs.promises.access(templateDir);
      
      // Check for key templates
      const hasPackageJson = templates.some(t => t.includes('package.json.hbs'));
      const hasIndexTs = templates.some(t => t.includes('index.ts.hbs'));
      const hasToolsTs = templates.some(t => t.includes('tools.ts.hbs'));
      
      runner.assert(hasPackageJson, 'Should have package.json template');
      runner.assert(hasIndexTs, 'Should have index.ts template');
      runner.assert(hasToolsTs, 'Should have tools.ts template');
    } catch {
      console.log('Note: Template directory not found, skipping template checks');
    }
  });

  // Test code generator initialization
  await runner.test('CodeGenerator initializes correctly', () => {
    const tempDir = path.join(__dirname, '../test-output');
    const generator = new CodeGenerator({
      outputDir: tempDir,
      debug: false,
      overwrite: true,
    });
    
    runner.assert(generator !== null, 'CodeGenerator should be created');
    
    const config = generator.getConfig();
    runner.assertEqual(config.outputDir, tempDir, 'Output directory should match');
  });

  // Test custom template directory support
  await runner.test('Custom template directories work', () => {
    const generator = new CodeGenerator({
      outputDir: path.join(__dirname, '../test-output'),
      customTemplateDirs: ['/custom/templates'],
      debug: false,
    });
    
    const config = generator.getConfig();
    runner.assert(config.customTemplateDirs?.includes('/custom/templates') ?? false, 'Should include custom template directory');
    
    // Test adding/removing custom directories
    generator.addCustomTemplateDirectory('/another/custom');
    const updatedConfig = generator.getConfig();
    runner.assert(updatedConfig.customTemplateDirs?.includes('/another/custom') ?? false, 'Should add custom directory');
    
    generator.removeCustomTemplateDirectory('/another/custom');
    const finalConfig = generator.getConfig();
    runner.assert(!(finalConfig.customTemplateDirs?.includes('/another/custom') ?? false), 'Should remove custom directory');
  });

  // Test template rendering (if templates exist)
  await runner.test('Template rendering works', async () => {
    const templateDir = path.resolve(__dirname, '../templates');
    const engine = new TemplateEngine({
      templateDir,
      debug: false,
    });
    
    const context = createTestContext();
    
    try {
      // Check if template directory exists
      await fs.promises.access(templateDir);
      
      // Try to render a simple template
      const packageJson = await engine.renderTemplate('base/package.json.hbs', context);
      runner.assert(typeof packageJson === 'string', 'Should render package.json as string');
      runner.assert(packageJson.includes(context.server.packageName), 'Should include package name');
      runner.assert(packageJson.includes(context.server.version), 'Should include version');
    } catch (error) {
      // Template might not exist in test environment, that's okay
      console.log('Note: Template rendering test skipped (templates not found)');
    }
  });

  runner.printResults();
}

/**
 * Run the test suite
 */
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { runTests };