// Test graceful shutdown functionality
const { spawn } = require('child_process');

console.log('Testing MCP API Server graceful shutdown...');

const server = spawn('node', ['dist/index.js', '--debug'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let errorOutput = '';

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

// Wait for server to start, then send SIGINT
setTimeout(() => {
  console.log('Sending SIGINT to server...');
  server.kill('SIGINT');
}, 1000);

server.on('close', (code, signal) => {
  console.log('Server output (stderr):');
  console.log(errorOutput);
  console.log(`\nServer exited with code ${code} and signal ${signal}`);
  
  // Check if graceful shutdown worked
  if (errorOutput.includes('Received SIGINT, shutting down gracefully') && 
      errorOutput.includes('Server shutdown completed successfully')) {
    console.log('✅ Graceful shutdown test PASSED');
  } else {
    console.log('❌ Graceful shutdown test FAILED');
  }
});