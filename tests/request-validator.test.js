"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Test file for RequestValidator functionality
const request_validator_js_1 = require("../src/request-validator.js");
console.log('Testing RequestValidator...');
const validator = new request_validator_js_1.RequestValidator();
// Test 1: Valid GET request
console.log('\n=== Test 1: Valid GET request ===');
const validGetResult = validator.validateToolCall('api_get', {
    url: 'https://api.example.com/data',
    headers: { 'Authorization': 'Bearer token123' }
});
if ('error' in validGetResult) {
    console.error('✗ Valid GET request failed:', validGetResult.error.message);
}
else {
    console.log('✓ Valid GET request passed');
}
// Test 2: Valid POST request with JSON body
console.log('\n=== Test 2: Valid POST request with JSON body ===');
const validPostResult = validator.validateToolCall('api_post', {
    url: 'https://httpbin.org/post',
    body: { key: 'value', number: 42 },
    headers: { 'Content-Type': 'application/json' }
});
if ('error' in validPostResult) {
    console.error('✗ Valid POST request failed:', validPostResult.error.message);
}
else {
    console.log('✓ Valid POST request passed');
}
// Test 3: Invalid URL format
console.log('\n=== Test 3: Invalid URL format ===');
const invalidUrlResult = validator.validateToolCall('api_get', {
    url: 'not-a-valid-url'
});
if ('error' in invalidUrlResult) {
    console.log('✓ Invalid URL correctly rejected:', invalidUrlResult.error.message);
}
else {
    console.error('✗ Invalid URL should have been rejected');
}
// Test 4: SSRF protection - localhost
console.log('\n=== Test 4: SSRF protection - localhost ===');
const localhostResult = validator.validateToolCall('api_get', {
    url: 'http://localhost:8080/admin'
});
if ('error' in localhostResult) {
    console.log('✓ Localhost URL correctly blocked:', localhostResult.error.message);
}
else {
    console.error('✗ Localhost URL should have been blocked');
}
// Test 5: SSRF protection - private IP
console.log('\n=== Test 5: SSRF protection - private IP ===');
const privateIpResult = validator.validateToolCall('api_get', {
    url: 'http://192.168.1.1/config'
});
if ('error' in privateIpResult) {
    console.log('✓ Private IP correctly blocked:', privateIpResult.error.message);
}
else {
    console.error('✗ Private IP should have been blocked');
}
// Test 6: Invalid HTTP method
console.log('\n=== Test 6: Invalid tool name ===');
const invalidToolResult = validator.validateToolCall('api_invalid', {
    url: 'https://api.example.com'
});
if ('error' in invalidToolResult) {
    console.log('✓ Invalid tool name correctly rejected:', invalidToolResult.error.message);
}
else {
    console.error('✗ Invalid tool name should have been rejected');
}
// Test 7: Missing required parameters
console.log('\n=== Test 7: Missing required parameters ===');
const missingParamsResult = validator.validateToolCall('api_get', {
    headers: { 'Authorization': 'Bearer token' }
    // Missing url parameter
});
if ('error' in missingParamsResult) {
    console.log('✓ Missing parameters correctly rejected:', missingParamsResult.error.message);
}
else {
    console.error('✗ Missing parameters should have been rejected');
}
// Test 8: Invalid header name
console.log('\n=== Test 8: Invalid header name ===');
const invalidHeaderResult = validator.validateToolCall('api_get', {
    url: 'https://api.example.com',
    headers: { 'Invalid Header Name With Spaces': 'value' }
});
if ('error' in invalidHeaderResult) {
    console.log('✓ Invalid header name correctly rejected:', invalidHeaderResult.error.message);
}
else {
    console.error('✗ Invalid header name should have been rejected');
}
// Test 9: Large request body
console.log('\n=== Test 9: Large request body ===');
const largeBody = 'x'.repeat(11 * 1024 * 1024); // 11MB, larger than default 10MB limit
const largeBodyResult = validator.validateToolCall('api_post', {
    url: 'https://api.example.com',
    body: largeBody
});
if ('error' in largeBodyResult) {
    console.log('✓ Large body correctly rejected:', largeBodyResult.error.message);
}
else {
    console.error('✗ Large body should have been rejected');
}
// Test 10: Invalid JSON in string body
console.log('\n=== Test 10: Invalid JSON in string body ===');
const invalidJsonResult = validator.validateToolCall('api_post', {
    url: 'https://api.example.com',
    body: '{"invalid": json}'
});
if ('error' in invalidJsonResult) {
    console.log('✓ Invalid JSON correctly rejected:', invalidJsonResult.error.message);
}
else {
    console.error('✗ Invalid JSON should have been rejected');
}
console.log('\n=== RequestValidator tests completed ===');
//# sourceMappingURL=request-validator.test.js.map