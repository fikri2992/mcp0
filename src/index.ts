#!/usr/bin/env node

import { MCPServer } from './mcp-server.js';

/**
 * Configuration interface for command line arguments
 */
interface ServerOptions {
  debug: boolean;
  timeout: number;
  allowLocalhost: boolean;
  allowPrivateIps: boolean;
  maxResponseLength: number;
  userAgent: string;
}

/**
 * Parse command line arguments and environment variables
 */
function parseServerOptions(): ServerOptions {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options: ServerOptions = {
    debug: args.includes('--debug') || process.env.DEBUG === 'true',
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    allowLocalhost: args.includes('--allow-localhost') || process.env.ALLOW_LOCALHOST === 'true',
    allowPrivateIps: args.includes('--allow-private-ips') || process.env.ALLOW_PRIVATE_IPS === 'true',
    maxResponseLength: parseInt(process.env.MAX_RESPONSE_LENGTH || '50000', 10),
    userAgent: process.env.USER_AGENT || 'MCP-API-Server/1.0.0',
  };

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Validate timeout
  if (options.timeout < 1000 || options.timeout > 300000) {
    console.error('Error: Timeout must be between 1000ms and 300000ms (5 minutes)');
    process.exit(1);
  }

  // Validate max response length
  if (options.maxResponseLength < 1000 || options.maxResponseLength > 10000000) {
    console.error('Error: Max response length must be between 1000 and 10000000 bytes');
    process.exit(1);
  }

  return options;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
MCP API Server - A Model Context Protocol server for making HTTP API calls

Usage: node dist/index.js [options]

Options:
  --debug                 Enable debug logging
  --allow-localhost       Allow requests to localhost/127.0.0.1
  --allow-private-ips     Allow requests to private IP ranges
  --help, -h             Show this help message

Environment Variables:
  DEBUG                   Enable debug logging (true/false)
  API_TIMEOUT            Request timeout in milliseconds (default: 30000)
  ALLOW_LOCALHOST        Allow localhost requests (true/false)
  ALLOW_PRIVATE_IPS      Allow private IP requests (true/false)
  MAX_RESPONSE_LENGTH    Maximum response length in bytes (default: 50000)
  USER_AGENT             Custom user agent string

Examples:
  node dist/index.js --debug
  DEBUG=true node dist/index.js
  API_TIMEOUT=60000 node dist/index.js --allow-localhost
`);
}

/**
 * Main entry point for the MCP API Server
 * Initializes and starts the server with stdio transport
 */
async function main() {
  try {
    // Parse configuration from command line and environment
    const options = parseServerOptions();
    
    if (options.debug) {
      console.error('Starting MCP API Server with options:', options);
    }
    
    // Create and configure the MCP server
    const server = new MCPServer({
      name: 'mcp-api-server',
      version: '1.0.0',
      debug: options.debug,
      // Configure components with parsed options
      apiClient: {
        timeout: options.timeout,
        userAgent: options.userAgent,
      },
      requestValidator: {
        allowLocalhost: options.allowLocalhost,
        allowPrivateIps: options.allowPrivateIps,
      },
      responseFormatter: {
        includeHeaders: true,
        prettyPrintJson: true,
        maxResponseLength: options.maxResponseLength,
      },
    });

    // Handle graceful shutdown
    let isShuttingDown = false;
    
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        console.error('Force shutdown requested, exiting immediately...');
        process.exit(1);
      }
      
      isShuttingDown = true;
      console.error(`Received ${signal}, shutting down gracefully...`);
      
      try {
        // Set a timeout for graceful shutdown
        const shutdownTimeout = setTimeout(() => {
          console.error('Shutdown timeout reached, forcing exit...');
          process.exit(1);
        }, 5000); // 5 second timeout
        
        await server.stop();
        clearTimeout(shutdownTimeout);
        
        if (options.debug) {
          console.error('Server shutdown completed successfully');
        }
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      if (!isShuttingDown) {
        gracefulShutdown('uncaughtException');
      }
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      if (!isShuttingDown) {
        gracefulShutdown('unhandledRejection');
      }
    });

    // Start the server
    await server.start();
    
    // Log successful startup (requirement 5.4)
    console.error('MCP API Server is ready and listening for requests');
    
  } catch (error) {
    console.error('Failed to start MCP API Server:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});