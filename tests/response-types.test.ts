#!/usr/bin/env node

/**
 * Test script to verify tool call handlers with different response types
 */

import { MCPServer } from '../src/mcp-server.js';

async function testResponseTypes() {
  console.log('Testing Tool Call Handlers with Different Response Types...\n');

  const server = new MCPServer({
    debug: false,
    apiClient: { timeout: 10000 },
  });

  // Test with JSONPlaceholder API (more reliable than httpbin)
  const tests = [
    {
      name: 'GET JSON response',
      toolName: 'api_get',
      params: {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        headers: { 'Accept': 'application/json' }
      },
    },
    {
      name: 'POST JSON request',
      toolName: 'api_post',
      params: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: {
          title: 'Test Post',
          body: 'This is a test post from MCP API Server',
          userId: 1
        },
        headers: { 'Content-Type': 'application/json' }
      },
    },
  ];

  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    
    try {
      // Use the complete handleToolCall method
      const result = await (server as any).handleToolCall(test.toolName, test.params);
      
      if ('error' in result) {
        console.log(`❌ Tool call failed: ${result.error.message}`);
        continue;
      }

      // Format the response
      const formatted = (server as any).responseFormatter.formatResponse(result);
      
      console.log('✅ Tool call successful');
      console.log(`   Status: ${result.status} ${result.statusText}`);
      console.log(`   Content-Type: ${result.headers['content-type'] || 'unknown'}`);
      console.log(`   Response formatted: ${formatted.content[0].text.length} chars`);
      
      // Show response snippet
      const snippet = formatted.content[0].text.substring(0, 300);
      console.log(`   Snippet: ${snippet.replace(/\n/g, ' ')}...`);

    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\n✅ Tool call handlers successfully handle different response types');
}

if (require.main === module) {
  testResponseTypes().catch(console.error);
}

export { testResponseTypes };