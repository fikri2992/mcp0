import { Parser } from '../src/parser/index.js';
import { ParsedAPICollection, ValidationResult } from '../src/parser/types.js';

/**
 * Integration test suite for the Parser module
 */
export class ParserIntegrationTest {
  private static testResults: { name: string; passed: boolean; error?: string }[] = [];

  public static runAllTests(): void {
    console.log('Running Parser Integration tests...\n');

    this.testParseMarkdownToAPICollection();
    this.testParseAndPreprocessForAI();
    this.testValidateContent();
    this.testComplexAPICollection();
    this.testErrorHandling();
    this.testBaseUrlExtraction();
    this.testDescriptionExtraction();

    this.printResults();
  }

  private static testParseMarkdownToAPICollection(): void {
    const testName = 'Parse markdown to API collection';
    try {
      const content = `# User Management API

This API provides comprehensive user management functionality.

## Get User

Retrieve user information by ID.

\`\`\`bash
curl -X GET "https://api.example.com/users/123" \\
  -H "Authorization: Bearer token123"
\`\`\`

## Create User

Create a new user account.

\`\`\`bash
curl -X POST "https://api.example.com/users" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name": "John Doe", "email": "john@example.com"}'
\`\`\``;

      const collection = Parser.parseMarkdownToAPICollection(content, 'user-api.md');

      this.assert(collection.name === 'user-api', 'Collection name should be derived from filename');
      this.assert(collection.apis.length === 2, 'Should extract 2 APIs');
      this.assert(collection.baseUrl === 'https://api.example.com', 'Should extract base URL');
      this.assert(collection.description?.includes('comprehensive user management') === true, 'Should extract description');

      // Test first API
      const getUser = collection.apis[0];
      this.assert(getUser.name === 'Get User', 'First API name should be correct');
      this.assert(getUser.method === 'GET', 'First API method should be GET');
      this.assert(getUser.url === 'https://api.example.com/users/123', 'First API URL should be correct');
      this.assert(getUser.headers?.['Authorization'] === 'Bearer token123', 'First API should have auth header');

      // Test second API
      const createUser = collection.apis[1];
      this.assert(createUser.name === 'Create User', 'Second API name should be correct');
      this.assert(createUser.method === 'POST', 'Second API method should be POST');
      this.assert(createUser.url === 'https://api.example.com/users', 'Second API URL should be correct');
      this.assert(typeof createUser.body === 'object', 'Second API should have parsed body');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testParseAndPreprocessForAI(): void {
    const testName = 'Parse and preprocess for AI analysis';
    try {
      const content = `# Payment API

## Process Payment

\`\`\`bash
curl -X POST "https://api.payment.com/charges" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1000, "currency": "USD"}'
\`\`\``;

      const result = Parser.parseAndPreprocessForAI(content, 'payment-api.md');

      this.assert(result.collection.name === 'payment-api', 'Collection name should be correct');
      this.assert(result.collection.apis.length === 1, 'Should extract 1 API');
      this.assert(result.preprocessed.extractedCurls.length === 1, 'Should extract curl commands');
      this.assert(result.aiContent.includes('AI PARSING INSTRUCTIONS'), 'AI content should include instructions');
      this.assert(result.aiContent.includes('DOCUMENT METADATA'), 'AI content should include metadata');
      this.assert(result.aiContent.length > content.length, 'AI content should be enhanced');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testValidateContent(): void {
    const testName = 'Validate content comprehensively';
    try {
      const validContent = `# Valid API

## Get Data

\`\`\`bash
curl -X GET "https://api.example.com/data"
\`\`\``;

      const validResult = Parser.validateContent(validContent, 'valid-api.md');

      this.assert(validResult.markdownValidation.isValid === true, 'Valid markdown should pass validation');
      this.assert(validResult.collectionValidation.isValid === true, 'Valid collection should pass validation');
      this.assert(validResult.curlValidation.isValid === true, 'Valid curl should pass validation');

      const invalidContent = `# Invalid API

Just text with no curl commands.`;

      const invalidResult = Parser.validateContent(invalidContent, 'invalid-api.md');

      this.assert(invalidResult.markdownValidation.isValid === false, 'Invalid markdown should fail validation');
      this.assert(invalidResult.markdownValidation.errors.length > 0, 'Should have markdown errors');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testComplexAPICollection(): void {
    const testName = 'Parse complex API collection';
    try {
      const content = `# E-commerce API

Complete e-commerce platform API with user management, products, and orders.

## Authentication

### Login

\`\`\`bash
curl -X POST "https://api.ecommerce.com/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "secret"}'
\`\`\`

## Products

### List Products

\`\`\`bash
curl -X GET "https://api.ecommerce.com/products?page=1&limit=10" \\
  -H "Authorization: Bearer token"
\`\`\`

### Create Product

\`\`\`bash
curl -X POST "https://api.ecommerce.com/products" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{
    "name": "Laptop",
    "price": 999.99,
    "category": "electronics"
  }'
\`\`\`

## Orders

### Create Order

\`\`\`bash
curl -X POST "https://api.ecommerce.com/orders" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{
    "items": [{"productId": "123", "quantity": 2}],
    "shippingAddress": "123 Main St"
  }'
\`\`\``;

      const collection = Parser.parseMarkdownToAPICollection(content, 'ecommerce-api.md');

      this.assert(collection.name === 'ecommerce-api', 'Collection name should be correct');
      this.assert(collection.apis.length === 4, 'Should extract 4 APIs');
      this.assert(collection.baseUrl === 'https://api.ecommerce.com', 'Should extract base URL');
      this.assert(collection.description?.includes('Complete e-commerce platform') === true, 'Should extract description');

      // Test API names are correctly extracted from headings
      const apiNames = collection.apis.map((api: any) => api.name);
      this.assert(apiNames.includes('Login'), 'Should include Login API');
      this.assert(apiNames.includes('List Products'), 'Should include List Products API');
      this.assert(apiNames.includes('Create Product'), 'Should include Create Product API');
      this.assert(apiNames.includes('Create Order'), 'Should include Create Order API');

      // Test different HTTP methods
      const methods = collection.apis.map((api: any) => api.method);
      this.assert(methods.includes('GET'), 'Should include GET method');
      this.assert(methods.includes('POST'), 'Should include POST method');
      this.assert(methods.filter((m: any) => m === 'POST').length === 3, 'Should have 3 POST methods');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testErrorHandling(): void {
    const testName = 'Handle parsing errors gracefully';
    try {
      // Test with malformed curl commands
      const malformedContent = `# Bad API

## Bad Curl

\`\`\`bash
curl -X INVALID "not-a-url"
\`\`\``;

      const collection = Parser.parseMarkdownToAPICollection(malformedContent);
      
      // Should still create collection but with no valid APIs
      this.assert(collection.apis.length === 0, 'Should extract no APIs from malformed curl');
      this.assert(collection.curlCommands.length === 0, 'Should extract no curl commands');

      // Test validation catches the issues
      const validation = Parser.validateContent(malformedContent);
      this.assert(validation.markdownValidation.isValid === false, 'Should fail markdown validation');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testBaseUrlExtraction(): void {
    const testName = 'Extract base URL correctly';
    try {
      // Test with consistent base URL
      const consistentContent = `# API

\`\`\`bash
curl -X GET "https://api.example.com/users"
\`\`\`

\`\`\`bash
curl -X GET "https://api.example.com/products"
\`\`\``;

      const consistentCollection = Parser.parseMarkdownToAPICollection(consistentContent);
      this.assert(consistentCollection.baseUrl === 'https://api.example.com', 'Should extract consistent base URL');

      // Test with mixed base URLs
      const mixedContent = `# API

\`\`\`bash
curl -X GET "https://api1.example.com/users"
\`\`\`

\`\`\`bash
curl -X GET "https://api2.example.com/products"
\`\`\``;

      const mixedCollection = Parser.parseMarkdownToAPICollection(mixedContent);
      // Should pick the most common one (or first one if tied)
      this.assert(mixedCollection.baseUrl !== undefined, 'Should extract some base URL even with mixed URLs');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testDescriptionExtraction(): void {
    const testName = 'Extract description from markdown structure';
    try {
      const content = `# User API

This is a comprehensive user management API that provides
all the functionality needed for user operations.

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users/123"
\`\`\``;

      const collection = Parser.parseMarkdownToAPICollection(content);
      
      this.assert(collection.description !== undefined, 'Should extract description');
      this.assert(collection.description?.includes('comprehensive user management') === true, 'Description should contain key content');

      // Test with no description
      const noDescContent = `# API

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users/123"
\`\`\``;

      const noDescCollection = Parser.parseMarkdownToAPICollection(noDescContent);
      this.assert(noDescCollection.description === undefined, 'Should handle missing description');

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

    console.log(`\nParser Integration Test Results: ${passed}/${total} passed\n`);

    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (passed === total) {
      console.log('\n🎉 All Parser Integration tests passed!');
    } else {
      console.log(`\n⚠️  ${total - passed} Parser Integration tests failed.`);
    }
  }
}