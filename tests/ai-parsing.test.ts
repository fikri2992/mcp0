import { AIParser, createAIParser, DEFAULT_AI_PARSER_CONFIG } from '../src/ai/index.js';
import { CurlAnalyzer } from '../src/ai/curl-analyzer.js';
import { OpenAIClient } from '../src/ai/openai-client.js';

// Test data
const SAMPLE_MARKDOWN = `# User Management API

This API provides endpoints for managing users in the system.

## Get User

Retrieve a user by ID:

\`\`\`bash
curl -X GET "https://api.example.com/users/123" \\
  -H "Authorization: Bearer your-token-here" \\
  -H "Content-Type: application/json"
\`\`\`

## Create User

Create a new user:

\`\`\`bash
curl -X POST "https://api.example.com/users" \\
  -H "Authorization: Bearer your-token-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }'
\`\`\`

## Update User

Update an existing user:

\`\`\`bash
curl -X PUT "https://api.example.com/users/123" \\
  -H "Authorization: Bearer your-token-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Smith",
    "email": "johnsmith@example.com"
  }'
\`\`\`
`;

const SIMPLE_MARKDOWN = `# Simple API

\`\`\`bash
curl -X GET "https://api.test.com/data"
\`\`\`
`;

const MALFORMED_MARKDOWN = `# Broken API

\`\`\`bash
curl -X GET
\`\`\`

\`\`\`bash
not-a-curl-command
\`\`\`
`;

// Mock OpenAI responses for testing
const mockOpenAIResponse = {
  apis: [
    {
      name: "Get User",
      description: "Retrieve a user by ID",
      method: "GET",
      url: "https://api.example.com/users/123",
      headers: {
        "Authorization": "Bearer your-token-here",
        "Content-Type": "application/json"
      },
      parameters: [
        {
          name: "id",
          type: "string" as const,
          required: true,
          location: "path" as const,
          description: "User ID"
        }
      ]
    }
  ],
  metadata: {
    name: "User Management API",
    baseUrl: "https://api.example.com",
    authentication: {
      type: "bearer" as const,
      location: "header" as const,
      name: "Authorization"
    }
  },
  confidence: 0.9,
  warnings: []
};

class TestRunner {
  private testCount = 0;
  private passedTests = 0;
  private failedTests = 0;

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    this.testCount++;
    try {
      await testFn();
      console.log(`✅ ${name}`);
      this.passedTests++;
    } catch (error) {
      console.log(`❌ ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.failedTests++;
    }
  }

  printSummary(): void {
    console.log(`\n📊 Test Summary:`);
    console.log(`Total: ${this.testCount}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.failedTests}`);
    console.log(`Success Rate: ${((this.passedTests / this.testCount) * 100).toFixed(1)}%`);
  }
}

// Test utilities
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExists<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

// Mock OpenAI client for testing
class MockOpenAIClient extends OpenAIClient {
  constructor() {
    super({ apiKey: 'test-key' });
  }

  async parseMarkdownToAPISpecs(): Promise<any> {
    return mockOpenAIResponse;
  }

  async analyzeCurlCommand(): Promise<any> {
    return mockOpenAIResponse.apis[0];
  }

  async optimizeAPISpec(apiSpec: any): Promise<any> {
    return { ...apiSpec, optimized: true };
  }
}

async function runTests(): Promise<void> {
  const runner = new TestRunner();

  console.log('🧪 Running AI Parsing Tests\n');

  // Test CurlAnalyzer
  await runner.runTest('CurlAnalyzer - Extract curl commands from markdown', async () => {
    const mockClient = new MockOpenAIClient();
    const analyzer = new CurlAnalyzer(mockClient);
    
    const commands = analyzer.extractCurlCommands(SAMPLE_MARKDOWN);
    assert(commands.length === 3, `Expected 3 curl commands, got ${commands.length}`);
    assert(commands[0].raw.includes('GET'), 'First command should be GET');
    assert(commands[1].raw.includes('POST'), 'Second command should be POST');
    assert(commands[2].raw.includes('PUT'), 'Third command should be PUT');
  });

  await runner.runTest('CurlAnalyzer - Handle simple curl command', async () => {
    const mockClient = new MockOpenAIClient();
    const analyzer = new CurlAnalyzer(mockClient);
    
    const commands = analyzer.extractCurlCommands(SIMPLE_MARKDOWN);
    assert(commands.length === 1, `Expected 1 curl command, got ${commands.length}`);
    assert(commands[0].raw.includes('GET'), 'Command should be GET');
  });

  await runner.runTest('CurlAnalyzer - Handle malformed markdown', async () => {
    const mockClient = new MockOpenAIClient();
    const analyzer = new CurlAnalyzer(mockClient);
    
    const commands = analyzer.extractCurlCommands(MALFORMED_MARKDOWN);
    // Should still extract the partial curl command
    assert(commands.length >= 1, 'Should extract at least one command');
  });

  // Test AIParser configuration
  await runner.runTest('AIParser - Create with default config', async () => {
    const config = {
      ...DEFAULT_AI_PARSER_CONFIG,
      apiKey: 'test-key'
    };
    const parser = createAIParser(config);
    
    const safeConfig = parser.getConfig();
    assert(safeConfig.model === 'gpt-4', 'Should use gpt-4 model');
    assert(safeConfig.temperature === 0.1, 'Should use low temperature');
  });

  await runner.runTest('AIParser - Update configuration', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    
    parser.updateConfig({ model: 'gpt-3.5-turbo', temperature: 0.5 });
    const config = parser.getConfig();
    
    assert(config.model === 'gpt-3.5-turbo', 'Model should be updated');
    assert(config.temperature === 0.5, 'Temperature should be updated');
  });

  // Test input validation
  await runner.runTest('AIParser - Validate input - empty markdown', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    
    try {
      await parser.parseMarkdown('');
      assert(false, 'Should throw error for empty markdown');
    } catch (error) {
      assert(error instanceof Error, 'Should throw Error instance');
      assert((error as Error).message.includes('empty'), 'Error should mention empty content');
    }
  });

  await runner.runTest('AIParser - Validate input - no curl commands', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    
    try {
      await parser.parseMarkdown('# API\n\nThis is just text with no curl commands.');
      assert(false, 'Should throw error for no curl commands');
    } catch (error) {
      assert(error instanceof Error, 'Should throw Error instance');
      assert((error as Error).message.includes('curl'), 'Error should mention curl commands');
    }
  });

  await runner.runTest('AIParser - Validate input - too large', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    const largeMarkdown = 'curl -X GET "https://api.com"' + 'x'.repeat(100000);
    
    try {
      await parser.parseMarkdown(largeMarkdown);
      assert(false, 'Should throw error for large content');
    } catch (error) {
      assert(error instanceof Error, 'Should throw Error instance');
      assert((error as Error).message.includes('large'), 'Error should mention large content');
    }
  });

  // Test context inference
  await runner.runTest('AIParser - Infer context from markdown', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    
    // Use reflection to access private method for testing
    const inferContext = (parser as any).inferContextFromMarkdown.bind(parser);
    const context = inferContext(SAMPLE_MARKDOWN);
    
    assert(context.apiName === 'User Management API', 'Should infer API name from title');
    assert(context.baseUrl === 'https://api.example.com', 'Should infer base URL');
    assert(context.expectedEndpoints === 3, 'Should count curl commands');
  });

  // Test result validation
  await runner.runTest('AIParser - Validate successful result', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    
    const result = {
      success: true,
      apis: [
        {
          name: 'Test API',
          method: 'GET',
          url: 'https://api.test.com/data'
        }
      ],
      metadata: { name: 'Test' },
      confidence: 0.8,
      warnings: [],
      errors: [],
      processingStats: {
        totalCurlCommands: 1,
        successfullyParsed: 1,
        failedToParse: 0,
        averageConfidence: 0.8
      },
      processingTime: 1000
    };
    
    const validation = parser.validateResult(result);
    assert(validation.isValid, 'Valid result should pass validation');
    assert(validation.issues.length === 0, 'Valid result should have no issues');
  });

  await runner.runTest('AIParser - Validate failed result', async () => {
    const parser = createAIParser({ apiKey: 'test-key' });
    
    const result = {
      success: false,
      apis: [],
      metadata: { name: 'Failed' },
      confidence: 0.2,
      warnings: [],
      errors: ['Test error'],
      processingStats: {
        totalCurlCommands: 0,
        successfullyParsed: 0,
        failedToParse: 1,
        averageConfidence: 0
      },
      processingTime: 500
    };
    
    const validation = parser.validateResult(result);
    assert(!validation.isValid, 'Failed result should not pass validation');
    assert(validation.issues.length > 0, 'Failed result should have issues');
  });

  // Test error handling
  await runner.runTest('AIParser - Handle API errors gracefully', async () => {
    // Create parser with invalid API key to simulate API errors
    const parser = createAIParser({ apiKey: 'invalid-key' });
    
    const result = await parser.parseMarkdown(SIMPLE_MARKDOWN);
    
    assert(!result.success, 'Should fail with invalid API key');
    assert(result.errors.length > 0, 'Should have error messages');
    assert(result.processingTime > 0, 'Should track processing time');
  });

  // Test confidence scoring
  await runner.runTest('CurlAnalyzer - Calculate confidence scores', async () => {
    const mockClient = new MockOpenAIClient();
    const analyzer = new CurlAnalyzer(mockClient);
    
    // Test with well-formed curl command
    const goodCommand = { raw: 'curl -X GET "https://api.example.com/users" -H "Authorization: Bearer token"' };
    const goodResult = await analyzer.analyzeCurlCommand(goodCommand);
    
    assert(goodResult.confidence > 0.7, 'Well-formed command should have high confidence');
    
    // Test with minimal curl command
    const minimalCommand = { raw: 'curl https://api.com' };
    const minimalResult = await analyzer.analyzeCurlCommand(minimalCommand);
    
    assert(minimalResult.confidence < goodResult.confidence, 'Minimal command should have lower confidence');
  });

  // Test warning generation
  await runner.runTest('CurlAnalyzer - Generate appropriate warnings', async () => {
    const mockClient = new MockOpenAIClient();
    const analyzer = new CurlAnalyzer(mockClient);
    
    const incompleteCommand = { raw: 'curl -X GET' };
    const result = await analyzer.analyzeCurlCommand(incompleteCommand);
    
    assert(result.warnings.length > 0, 'Incomplete command should generate warnings');
    assert(result.warnings.some(w => w.includes('URL')), 'Should warn about missing URL');
  });

  runner.printSummary();
}

// Run tests if this file is executed directly
// Note: This check is disabled for TypeScript compatibility

export { runTests };