#!/usr/bin/env node

/**
 * Test runner to execute all test suites
 */

import { testAPIRequestValidation } from './api-request-validation.test.js';
import { testCompleteFlow } from './complete-flow.test.js';
import { testToolHandlers } from './tool-handlers.test.js';
import { testResponseTypes } from './response-types.test.js';

async function runAllTests() {
  console.log('🧪 Running MCP API Server Test Suite');
  console.log('====================================\n');

  const tests = [
    { name: 'API Request Validation', fn: testAPIRequestValidation },
    { name: 'Tool Handlers', fn: testToolHandlers },
    { name: 'Complete Flow', fn: testCompleteFlow },
    { name: 'Response Types', fn: testResponseTypes },
  ];

  let passedSuites = 0;
  const totalSuites = tests.length;

  for (const test of tests) {
    console.log(`\n🔍 Running ${test.name} Tests`);
    console.log('='.repeat(50));
    
    try {
      await test.fn();
      console.log(`\n✅ ${test.name} tests completed successfully`);
      passedSuites++;
    } catch (error) {
      console.log(`\n❌ ${test.name} tests failed:`, error);
    }
    
    console.log('\n' + '='.repeat(50));
  }

  console.log(`\n📊 Test Suite Summary`);
  console.log('====================');
  console.log(`Passed: ${passedSuites}/${totalSuites} test suites`);
  
  if (passedSuites === totalSuites) {
    console.log('🎉 All test suites passed!');
    process.exit(0);
  } else {
    console.log('💥 Some test suites failed');
    process.exit(1);
  }
}

// Run all tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { runAllTests };