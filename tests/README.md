# MCP API Server Tests

This directory contains comprehensive tests for the MCP API Server functionality.

## Test Structure

### Individual Test Files

- **`api-request-validation.test.ts`** - Tests API request validation and tool call integration
- **`complete-flow.test.ts`** - Tests complete end-to-end tool call flow
- **`request-validator.test.ts`** - Tests RequestValidator functionality in isolation
- **`tool-handlers.test.ts`** - Tests tool call handlers work correctly
- **`response-types.test.ts`** - Tests tool call handlers with different response types

### Test Runner

- **`run-all-tests.ts`** - Executes all test suites and provides summary

## Running Tests

### Run All Tests
```bash
npm test
# or
npm run test:all
```

### Run Individual Test Suites
```bash
# API request validation tests
npm run test:validation

# Tool handler tests
npm run test:handlers

# Complete flow tests
npm run test:flow

# Response type tests
npm run test:types

# Request validator tests
npm run test:validator
```

### Run Tests Directly
```bash
# After building the project
node dist/tests/run-all-tests.js
node dist/tests/request-validator.test.js
# etc.
```

## Test Coverage

The tests cover:

### ✅ Parameter Validation
- Valid and invalid URLs
- Required parameter checking
- Header validation
- Body size limits
- JSON parsing validation

### ✅ Security Features
- SSRF protection (localhost blocking)
- Private IP address blocking
- URL scheme validation
- Header name validation

### ✅ Tool Call Integration
- GET, POST, PUT, DELETE request handling
- Parameter to API request conversion
- Error handling and propagation
- Response formatting

### ✅ End-to-End Flow
- Complete tool call lifecycle
- HTTP client integration
- Response formatter integration
- Error scenarios

### ✅ Response Handling
- JSON response parsing
- Different content types
- Error response formatting
- Large response handling

## Test Dependencies

Tests use real HTTP endpoints for integration testing:
- **httpbin.org** - For HTTP method testing
- **jsonplaceholder.typicode.com** - For JSON API testing

## Development

### Adding New Tests

1. Create a new test file in the `tests/` directory
2. Follow the naming convention: `*.test.ts`
3. Export a test function for use in the test runner
4. Add the test to `run-all-tests.ts`
5. Add a corresponding npm script in `package.json`

### Test Structure Template

```typescript
#!/usr/bin/env node

import { MCPServer } from '../src/mcp-server.js';

async function testMyFeature() {
  console.log('Testing My Feature...\n');
  
  // Test implementation here
  
  console.log('✅ My Feature tests completed');
}

if (require.main === module) {
  testMyFeature().catch(console.error);
}

export { testMyFeature };
```

## Notes

- Tests require network connectivity for HTTP endpoint testing
- Some tests may fail if external services are unavailable
- Tests are excluded from the published NPM package via `.npmignore`
- All tests are built to `dist/tests/` during the build process