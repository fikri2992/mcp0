#!/usr/bin/env node

/**
 * Test script to verify API request validation and tool call integration
 */

import { MCPServer } from './mcp-server.js';

async function testAPIRequestValidation() {
  console.log('Testing API Request Validation and Tool Call Integration...\n');

  // Create server instance
  const server = new MCPServer({
    debug: false, // Reduce noise for this test
  });

  // Test cases for validation
  const validationTests = [
    {
      name: 'Valid HTTPS URL',
      toolName: 'api_get',
      params: { url: 'https://httpbin.org/get' },
      shouldPass: true,
    },
    {
      name: 'Valid HTTP URL',
      toolName: 'api_get', 
      params: { url: 'http://httpbin.org/get' },
      shouldPass: true,
    },
    {
      name: 'Invalid URL format',
      toolName: 'api_get',
      params: { url: 'not-a-url' },
      shouldPass: false,
    },
    {
      name: 'FTP URL (not allowed)',
      toolName: 'api_get',
      params: { url: 'ftp://example.com/file.txt' },
      shouldPass: false,
    },
    {
      name: 'Localhost URL (blocked by default)',
      toolName: 'api_get',
      params: { url: 'http://localhost:3000/api' },
      shouldPass: false,
    },
    {
      name: 'POST with JSON body',
      toolName: 'api_post',
      params: {
        url: 'https://httpbin.org/post',
        body: { key: 'value', number: 42 },
        headers: { 'Content-Type': 'application/json' }
      },
      shouldPass: true,
    },
    {
      name: 'POST with string body',
      toolName: 'api_post',
      params: {
        url: 'https://httpbin.org/post',
        body: 'plain text data',
        headers: { 'Content-Type': 'text/plain' }
      },
      shouldPass: true,
    },
    {
      name: 'PUT with body',
      toolName: 'api_put',
      params: {
        url: 'https://httpbin.org/put',
        body: { updated: true },
      },
      shouldPass: true,
    },
    {
      name: 'DELETE request',
      toolName: 'api_delete',
      params: {
        url: 'https://httpbin.org/delete',
        headers: { 'Authorization': 'Bearer token123' }
      },
      shouldPass: true,
    },
    {
      name: 'Invalid headers (non-string values)',
      toolName: 'api_get',
      params: {
        url: 'https://httpbin.org/get',
        headers: { 'X-Number': 123 } // Should be string
      },
      shouldPass: false,
    },
  ];

  let passedTests = 0;
  let totalTests = validationTests.length;

  for (const test of validationTests) {
    console.log(`\n--- ${test.name} ---`);
    
    try {
      // Test the validation through the tool call handler
      const validatedParams = (server as any).requestValidator.validateToolCall(
        test.toolName,
        test.params
      );

      if ('error' in validatedParams) {
        if (!test.shouldPass) {
          console.log(`✅ Correctly rejected: ${validatedParams.error.message}`);
          passedTests++;
        } else {
          console.log(`❌ Unexpectedly rejected: ${validatedParams.error.message}`);
        }
        continue;
      }

      // Convert to API request and validate
      const apiRequest = (server as any).convertToAPIRequest(test.toolName, validatedParams);
      const validatedRequest = (server as any).requestValidator.validateAPIRequest(apiRequest);

      if ('error' in validatedRequest) {
        if (!test.shouldPass) {
          console.log(`✅ Correctly rejected at API level: ${validatedRequest.error.message}`);
          passedTests++;
        } else {
          console.log(`❌ Unexpectedly rejected at API level: ${validatedRequest.error.message}`);
        }
        continue;
      }

      if (test.shouldPass) {
        console.log('✅ Validation passed as expected');
        console.log(`   Method: ${validatedRequest.method}`);
        console.log(`   URL: ${validatedRequest.url}`);
        if (validatedRequest.headers) {
          console.log(`   Headers: ${Object.keys(validatedRequest.headers).length} header(s)`);
        }
        if (validatedRequest.body) {
          console.log(`   Body: ${typeof validatedRequest.body}`);
        }
        passedTests++;
      } else {
        console.log('❌ Should have been rejected but passed validation');
      }

    } catch (error) {
      if (!test.shouldPass) {
        console.log(`✅ Correctly threw error: ${error instanceof Error ? error.message : error}`);
        passedTests++;
      } else {
        console.log(`❌ Unexpected error: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  console.log(`\n--- Validation Test Results ---`);
  console.log(`Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('✅ All validation tests passed!');
    console.log('✅ Tool call handlers properly integrate RequestValidator');
    console.log('✅ Security checks are working correctly');
  } else {
    console.log('❌ Some validation tests failed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAPIRequestValidation().catch(console.error);
}

export { testAPIRequestValidation };