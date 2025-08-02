import { MarkdownParser } from '../src/parser/markdown-parser.js';
import { MarkdownStructure, CurlCommand, ValidationResult } from '../src/parser/types.js';

/**
 * Test suite for MarkdownParser
 */
export class MarkdownParserTest {
  private static testResults: { name: string; passed: boolean; error?: string }[] = [];

  public static runAllTests(): void {
    console.log('Running MarkdownParser tests...\n');

    this.testParseMarkdownBasic();
    this.testParseMarkdownWithHeadings();
    this.testParseMarkdownWithCodeBlocks();
    this.testExtractCurlCommands();
    this.testExtractCurlCommandsComplex();
    this.testValidateMarkdown();
    this.testValidateMarkdownErrors();
    this.testParseCurlCommandVariations();
    this.testMarkdownStructureExtraction();
    this.testCurlCommandContext();

    this.printResults();
  }

  private static testParseMarkdownBasic(): void {
    const testName = 'Parse basic markdown structure';
    try {
      const content = `# API Documentation

This is a simple API documentation.

## User API

Get user information.`;

      const result = MarkdownParser.parseMarkdown(content);

      this.assert(result.headings.length === 2, 'Should find 2 headings');
      this.assert(result.headings[0].text === 'API Documentation', 'First heading should be correct');
      this.assert(result.headings[0].level === 1, 'First heading level should be 1');
      this.assert(result.headings[1].text === 'User API', 'Second heading should be correct');
      this.assert(result.headings[1].level === 2, 'Second heading level should be 2');
      this.assert(result.codeBlocks.length === 0, 'Should find no code blocks');
      this.assert(result.metadata.lineCount === 7, 'Should count lines correctly');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testParseMarkdownWithHeadings(): void {
    const testName = 'Parse markdown with various heading levels';
    try {
      const content = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6`;

      const result = MarkdownParser.parseMarkdown(content);

      this.assert(result.headings.length === 6, 'Should find 6 headings');
      
      for (let i = 0; i < 6; i++) {
        this.assert(result.headings[i].level === i + 1, `Heading ${i + 1} should have correct level`);
        this.assert(result.headings[i].text === `Level ${i + 1}`, `Heading ${i + 1} should have correct text`);
        this.assert(result.headings[i].id === `level-${i + 1}`, `Heading ${i + 1} should have correct ID`);
      }

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testParseMarkdownWithCodeBlocks(): void {
    const testName = 'Parse markdown with code blocks';
    try {
      const content = `# API Examples

## Simple GET request

\`\`\`bash
curl -X GET "https://api.example.com/users"
\`\`\`

## POST request with data

\`\`\`javascript
const response = await fetch('/api/users');
\`\`\`

\`\`\`
curl -X POST "https://api.example.com/users" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John"}'
\`\`\``;

      const result = MarkdownParser.parseMarkdown(content);

      this.assert(result.codeBlocks.length === 3, 'Should find 3 code blocks');
      this.assert(result.codeBlocks[0].language === 'bash', 'First code block should be bash');
      this.assert(result.codeBlocks[0].isCurlCommand === true, 'First code block should be curl command');
      this.assert(result.codeBlocks[1].language === 'javascript', 'Second code block should be javascript');
      this.assert(result.codeBlocks[1].isCurlCommand === false, 'Second code block should not be curl command');
      this.assert(result.codeBlocks[2].language === undefined, 'Third code block should have no language');
      this.assert(result.codeBlocks[2].isCurlCommand === true, 'Third code block should be curl command');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testExtractCurlCommands(): void {
    const testName = 'Extract curl commands from markdown';
    try {
      const content = `# User API

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users/123" \\
  -H "Authorization: Bearer token123"
\`\`\`

## Create User

\`\`\`
curl -X POST "https://api.example.com/users" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John", "email": "john@example.com"}'
\`\`\``;

      const commands = MarkdownParser.extractCurlCommands(content);

      this.assert(commands.length === 2, 'Should extract 2 curl commands');
      
      // Test first command
      const cmd1 = commands[0];
      this.assert(cmd1.method === 'GET', 'First command should be GET');
      this.assert(cmd1.url === 'https://api.example.com/users/123', 'First command URL should be correct');
      this.assert(cmd1.headers['Authorization'] === 'Bearer token123', 'First command should have auth header');
      this.assert(cmd1.context.heading === 'Get User', 'First command should have correct context heading');

      // Test second command
      const cmd2 = commands[1];
      this.assert(cmd2.method === 'POST', 'Second command should be POST');
      this.assert(cmd2.url === 'https://api.example.com/users', 'Second command URL should be correct');
      this.assert(cmd2.headers['Content-Type'] === 'application/json', 'Second command should have content-type header');
      this.assert(typeof cmd2.body === 'object', 'Second command body should be parsed as object');
      this.assert(cmd2.context.heading === 'Create User', 'Second command should have correct context heading');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testExtractCurlCommandsComplex(): void {
    const testName = 'Extract complex curl commands';
    try {
      const content = `# Complex API

## Update User

\`\`\`bash
curl -X PUT "https://api.example.com/users/123" \\
  -H "Authorization: Bearer token123" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Version: v1" \\
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "settings": {
      "theme": "dark",
      "notifications": true
    }
  }'
\`\`\``;

      const commands = MarkdownParser.extractCurlCommands(content);

      this.assert(commands.length === 1, 'Should extract 1 curl command');
      
      const cmd = commands[0];
      this.assert(cmd.method === 'PUT', 'Command should be PUT');
      this.assert(cmd.url === 'https://api.example.com/users/123', 'URL should be correct');
      this.assert(Object.keys(cmd.headers).length === 3, 'Should have 3 headers');
      this.assert(cmd.headers['Authorization'] === 'Bearer token123', 'Should have auth header');
      this.assert(cmd.headers['Content-Type'] === 'application/json', 'Should have content-type header');
      this.assert(cmd.headers['X-API-Version'] === 'v1', 'Should have API version header');
      this.assert(typeof cmd.body === 'object', 'Body should be parsed as object');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testValidateMarkdown(): void {
    const testName = 'Validate valid markdown';
    try {
      const content = `# API Documentation

This API provides user management functionality.

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users/123"
\`\`\``;

      const validation = MarkdownParser.validateMarkdown(content);

      this.assert(validation.isValid === true, 'Valid markdown should pass validation');
      this.assert(validation.errors.length === 0, 'Should have no errors');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testValidateMarkdownErrors(): void {
    const testName = 'Validate markdown with errors';
    try {
      const content = `# API Documentation

This is just text with no code blocks or curl commands.`;

      const validation = MarkdownParser.validateMarkdown(content);

      this.assert(validation.isValid === false, 'Invalid markdown should fail validation');
      this.assert(validation.errors.length > 0, 'Should have errors');
      this.assert(validation.errors.some(e => e.type === 'content'), 'Should have content errors');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testParseCurlCommandVariations(): void {
    const testName = 'Parse various curl command formats';
    try {
      const testCases = [
        {
          curl: 'curl -X GET "https://api.example.com/users"',
          expectedMethod: 'GET',
          expectedUrl: 'https://api.example.com/users',
        },
        {
          curl: 'curl --request POST https://api.example.com/users',
          expectedMethod: 'POST',
          expectedUrl: 'https://api.example.com/users',
        },
        {
          curl: 'curl -H "Authorization: Bearer token" https://api.example.com/users',
          expectedMethod: 'GET',
          expectedUrl: 'https://api.example.com/users',
          expectedHeaders: { 'Authorization': 'Bearer token' },
        },
        {
          curl: 'curl -d \'{"name": "test"}\' -H "Content-Type: application/json" https://api.example.com/users',
          expectedMethod: 'GET', // Default method when not specified
          expectedUrl: 'https://api.example.com/users',
          expectedBody: { name: 'test' },
        },
      ];

      testCases.forEach((testCase, index) => {
        const content = `# Test ${index + 1}\n\n\`\`\`bash\n${testCase.curl}\n\`\`\``;
        const commands = MarkdownParser.extractCurlCommands(content);
        
        this.assert(commands.length === 1, `Test case ${index + 1} should extract 1 command`);
        
        const cmd = commands[0];
        this.assert(cmd.method === testCase.expectedMethod, `Test case ${index + 1} method should be ${testCase.expectedMethod}`);
        this.assert(cmd.url === testCase.expectedUrl, `Test case ${index + 1} URL should be correct`);
        
        if (testCase.expectedHeaders) {
          Object.entries(testCase.expectedHeaders).forEach(([key, value]) => {
            this.assert(cmd.headers[key] === value, `Test case ${index + 1} should have header ${key}: ${value}`);
          });
        }
        
        if (testCase.expectedBody) {
          this.assert(JSON.stringify(cmd.body) === JSON.stringify(testCase.expectedBody), 
            `Test case ${index + 1} body should match expected`);
        }
      });

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testMarkdownStructureExtraction(): void {
    const testName = 'Extract markdown structure metadata';
    try {
      const content = `# Main Title

This is a paragraph with some content.

## Section 1

More content here.

\`\`\`bash
curl -X GET "https://api.example.com/test"
\`\`\`

### Subsection

Final content.`;

      const structure = MarkdownParser.parseMarkdown(content);

      this.assert(structure.metadata.lineCount === 15, 'Should count lines correctly');
      this.assert(structure.metadata.wordCount > 0, 'Should count words');
      this.assert(structure.metadata.characterCount === content.length, 'Should count characters correctly');
      this.assert(structure.headings.length === 3, 'Should find all headings');
      this.assert(structure.codeBlocks.length === 1, 'Should find code block');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testCurlCommandContext(): void {
    const testName = 'Extract curl command context correctly';
    try {
      const content = `# API Documentation

## User Management

### Get User Details

This endpoint retrieves user information.

\`\`\`bash
curl -X GET "https://api.example.com/users/123"
\`\`\`

### Create New User

This endpoint creates a new user.

\`\`\`bash
curl -X POST "https://api.example.com/users" -d '{"name": "John"}'
\`\`\``;

      const commands = MarkdownParser.extractCurlCommands(content);

      this.assert(commands.length === 2, 'Should extract 2 commands');
      this.assert(commands[0].context.heading === 'Get User Details', 'First command should have correct heading context');
      this.assert(commands[1].context.heading === 'Create New User', 'Second command should have correct heading context');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  private static printResults(): void {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;

    console.log(`\nMarkdownParser Test Results: ${passed}/${total} passed\n`);

    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (passed === total) {
      console.log('\n🎉 All MarkdownParser tests passed!');
    } else {
      console.log(`\n⚠️  ${total - passed} MarkdownParser tests failed.`);
    }
  }
}