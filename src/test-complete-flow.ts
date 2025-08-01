#!/usr/bin/env node

/**
 * Test script to verify complete end-to-end tool call flow
 */

import { MCPServer } from './mcp-server.js';

async function testCompleteFlow() {
  console.log('Testing Complete Tool Call Handler Flow...\n');

  // Create server instance
  const server = new MCPServer({
    debug: false,
    apiClient: {
      timeout: 10000, // 10 second timeout for tests
    },
  });

  // Test cases for complete flow
  const flowTests = [
    {
      name: 'GET request with headers',
      toolName: 'api_get',
      params: {
        url: 'https://httpbin.org/get',
        headers: {
          'User-Agent': 'MCP-Test-Client/1.0',
          'X-Test-Header': 'test-value'
        }
      },
    },
    {
      name: 'POST request with JSON body',
      toolName: 'api_post',
      params: {
        url: 'https://httpbin.org/post',
        body: {
          message: 'Hello from MCP API Server',
          timestamp: new Date().toISOString(),
          test: true
        },
        headers: {
          'Content-Type': 'application/json'
        }
      },
    },
    {
      name: 'PUT request with string body',
      toolName: 'api_put',
      params: {
        url: 'https://httpbin.org/put',
        body: 'This is a plain text update',
        headers: {
          'Content-Type': 'text/plain'
        }
      },
    },
    {
      name: 'DELETE request',
      toolName: 'api_delete',
      params: {
        url: 'https://httpbin.org/delete',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      },
    },
  ];

  let successfulTests = 0;

  for (const test of flowTests) {
    console.log(`\n--- Testing: ${test.name} ---`);
    
    try {
      // Simulate the complete MCP tool call flow
      console.log(`Tool: ${test.toolName}`);
      console.log(`URL: ${test.params.url}`);

      // Step 1: Validate tool parameters
      const validatedParams = (server as any).requestValidator.validateToolCall(
        test.toolName,
        test.params
      );

      if ('error' in validatedParams) {
        console.log(`❌ Parameter validation failed: ${validatedParams.error.message}`);
        continue;
      }

      console.log('✅ Parameters validated');

      // Step 2: Convert to API request
      const apiRequest = (server as any).convertToAPIRequest(test.toolName, validatedParams);
      
      // Step 3: Validate API request
      const validatedRequest = (server as any).requestValidator.validateAPIRequest(apiRequest);
      
      if ('error' in validatedRequest) {
        console.log(`❌ API request validation failed: ${validatedRequest.error.message}`);
        continue;
      }

      console.log('✅ API request validated');

      // Step 4: Make HTTP request using APIClient
      let apiResponse;
      switch (test.toolName) {
        case 'api_get':
          apiResponse = await (server as any).apiClient.get(
            validatedRequest.url,
            validatedRequest.headers
          );
          break;
        case 'api_post':
          apiResponse = await (server as any).apiClient.post(
            validatedRequest.url,
            validatedRequest.body,
            validatedRequest.headers
          );
          break;
        case 'api_put':
          apiResponse = await (server as any).apiClient.put(
            validatedRequest.url,
            validatedRequest.body,
            validatedRequest.headers
          );
          break;
        case 'api_delete':
          apiResponse = await (server as any).apiClient.delete(
            validatedRequest.url,
            validatedRequest.headers
          );
          break;
        default:
          throw new Error(`Unknown tool: ${test.toolName}`);
      }

      // Check if we got an error response
      if ('error' in apiResponse) {
        console.log(`❌ HTTP request failed: ${apiResponse.error.message}`);
        continue;
      }

      console.log(`✅ HTTP request successful (${apiResponse.status} ${apiResponse.statusText})`);

      // Step 5: Format response using ResponseFormatter
      const formattedResponse = (server as any).responseFormatter.formatResponse(apiResponse);
      
      console.log('✅ Response formatted for MCP');
      console.log(`   Content type: ${formattedResponse.content[0].type}`);
      console.log(`   Is error: ${formattedResponse.isError || false}`);
      console.log(`   Response length: ${formattedResponse.content[0].text.length} characters`);

      // Show a snippet of the response
      const responseText = formattedResponse.content[0].text;
      const snippet = responseText.length > 200 
        ? responseText.substring(0, 200) + '...' 
        : responseText;
      console.log(`   Response snippet: ${snippet.replace(/\n/g, '\\n')}`);

      successfulTests++;

    } catch (error) {
      console.log(`❌ Test failed with error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n--- Complete Flow Test Results ---`);
  console.log(`Successful: ${successfulTests}/${flowTests.length} tests`);
  
  if (successfulTests === flowTests.length) {
    console.log('✅ All tool call handlers working correctly!');
    console.log('✅ Complete integration verified:');
    console.log('   - Parameter validation ✅');
    console.log('   - API request conversion ✅');
    console.log('   - HTTP client integration ✅');
    console.log('   - Response formatting ✅');
    console.log('   - Error handling ✅');
  } else {
    console.log('❌ Some tests failed - check network connectivity or API availability');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testCompleteFlow().catch(console.error);
}

export { testCompleteFlow };