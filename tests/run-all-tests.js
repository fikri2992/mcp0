#!/usr/bin/env node
"use strict";
/**
 * Test runner to execute all test suites
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllTests = runAllTests;
const api_request_validation_test_js_1 = require("./api-request-validation.test.js");
const complete_flow_test_js_1 = require("./complete-flow.test.js");
const tool_handlers_test_js_1 = require("./tool-handlers.test.js");
const response_types_test_js_1 = require("./response-types.test.js");
async function runAllTests() {
    console.log('🧪 Running MCP API Server Test Suite');
    console.log('====================================\n');
    const tests = [
        { name: 'API Request Validation', fn: api_request_validation_test_js_1.testAPIRequestValidation },
        { name: 'Tool Handlers', fn: tool_handlers_test_js_1.testToolHandlers },
        { name: 'Complete Flow', fn: complete_flow_test_js_1.testCompleteFlow },
        { name: 'Response Types', fn: response_types_test_js_1.testResponseTypes },
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
        }
        catch (error) {
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
    }
    else {
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
//# sourceMappingURL=run-all-tests.js.map