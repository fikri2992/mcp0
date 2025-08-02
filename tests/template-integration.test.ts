/**
 * Integration test for template system
 * Tests end-to-end template generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeGenerator, createTemplateContext } from '../src/generator/code-generator.js';

async function testTemplateGeneration(): Promise<void> {
  console.log('Testing template generation...');

  // Create test output directory
  const testOutputDir = path.join(__dirname, '../test-output-template');
  
  // Clean up any existing test output
  try {
    await fs.promises.rm(testOutputDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }

  // Create code generator
  const generator = new CodeGenerator({
    outputDir: testOutputDir,
    templateDir: path.resolve(__dirname, '../../templates'), // Go up two levels from dist/tests
    debug: true,
    overwrite: true,
  });

  // Create test context
  const context = createTemplateContext({
    serverName: 'Test Weather API',
    serverVersion: '1.0.0',
    serverDescription: 'A test MCP server for weather API calls',
    packageName: 'test-weather-api-server',
    author: 'Test Author <test@example.com>',
    license: 'MIT',
    repository: 'https://github.com/test/test-weather-api-server.git',
    tools: [
      {
        name: 'weather_get_current',
        description: 'Get current weather for a location',
        functionName: 'getCurrentWeather',
        httpMethod: 'GET',
        hasBody: false,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri', description: 'Weather API URL' },
            headers: { type: 'object', description: 'Optional headers including API key' },
          },
          required: ['url'],
        },
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'The weather API URL' },
          { name: 'headers', type: 'object', required: false, description: 'Optional headers' },
        ],
      },
      {
        name: 'weather_get_forecast',
        description: 'Get weather forecast for a location',
        functionName: 'getWeatherForecast',
        httpMethod: 'GET',
        hasBody: false,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri', description: 'Weather forecast API URL' },
            headers: { type: 'object', description: 'Optional headers including API key' },
          },
          required: ['url'],
        },
        parameters: [
          { name: 'url', type: 'string', required: true, description: 'The weather forecast API URL' },
          { name: 'headers', type: 'object', required: false, description: 'Optional headers' },
        ],
      },
    ],
    apis: [
      {
        name: 'Current Weather',
        description: 'Get current weather conditions',
        method: 'GET',
        url: 'https://api.weather.com/v1/current',
        headers: { 'X-API-Key': 'your-api-key' },
        parameters: [
          { name: 'location', type: 'string', required: true, location: 'query', description: 'Location name or coordinates' },
          { name: 'units', type: 'string', required: false, location: 'query', description: 'Temperature units (metric/imperial)' },
        ],
      },
      {
        name: 'Weather Forecast',
        description: 'Get weather forecast',
        method: 'GET',
        url: 'https://api.weather.com/v1/forecast',
        headers: { 'X-API-Key': 'your-api-key' },
        parameters: [
          { name: 'location', type: 'string', required: true, location: 'query', description: 'Location name or coordinates' },
          { name: 'days', type: 'number', required: false, location: 'query', description: 'Number of forecast days' },
        ],
      },
    ],
    configuration: {
      timeout: 15000,
      maxResponseLength: 100000,
      allowLocalhost: false,
      allowPrivateIps: false,
      userAgent: 'Weather-MCP-Server/1.0.0',
    },
  });

  try {
    // Generate the server
    const result = await generator.generateServer(context);

    console.log('Generation completed:', {
      totalFiles: result.files.length,
      stats: result.stats,
      errors: result.errors,
    });

    // Check if generation was successful
    if (result.errors.length > 0) {
      console.error('Generation errors:', result.errors);
      throw new Error('Template generation failed with errors');
    }

    // Verify key files were generated
    const expectedFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      '.gitignore',
      'src/index.ts',
      'src/mcp-server.ts',
      'src/tools.ts',
      'src/types.ts',
      'src/api-client.ts',
      'src/request-validator.ts',
      'src/response-formatter.ts',
      'tests/tool-tests.ts',
    ];

    for (const expectedFile of expectedFiles) {
      const filePath = path.join(testOutputDir, expectedFile);
      try {
        await fs.promises.access(filePath);
        console.log(`✓ Generated: ${expectedFile}`);
      } catch {
        throw new Error(`Missing expected file: ${expectedFile}`);
      }
    }

    // Verify package.json content
    const packageJsonPath = path.join(testOutputDir, 'package.json');
    const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    if (packageJson.name !== 'test-weather-api-server') {
      throw new Error(`Incorrect package name: ${packageJson.name}`);
    }

    if (packageJson.version !== '1.0.0') {
      throw new Error(`Incorrect version: ${packageJson.version}`);
    }

    console.log('✓ Package.json content is correct');

    // Verify README content
    const readmePath = path.join(testOutputDir, 'README.md');
    const readmeContent = await fs.promises.readFile(readmePath, 'utf-8');

    if (!readmeContent.includes('Test Weather API')) {
      throw new Error('README does not contain server name');
    }

    if (!readmeContent.includes('weather_get_current')) {
      throw new Error('README does not contain tool names');
    }

    console.log('✓ README.md content is correct');

    // Verify tools.ts content
    const toolsPath = path.join(testOutputDir, 'src/tools.ts');
    const toolsContent = await fs.promises.readFile(toolsPath, 'utf-8');

    if (!toolsContent.includes('weather_get_current')) {
      throw new Error('tools.ts does not contain expected tool');
    }

    if (!toolsContent.includes('WEATHER_GET_CURRENT_TOOL')) {
      throw new Error('tools.ts does not contain expected constant');
    }

    console.log('✓ tools.ts content is correct');

    console.log('\n✅ Template generation integration test passed!');
    console.log(`Generated files in: ${testOutputDir}`);

  } catch (error) {
    console.error('❌ Template generation integration test failed:', error);
    throw error;
  }
}

/**
 * Run the integration test
 */
if (require.main === module) {
  testTemplateGeneration().catch((error) => {
    console.error('Integration test failed:', error);
    process.exit(1);
  });
}

export { testTemplateGeneration };