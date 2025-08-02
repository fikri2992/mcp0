# MCP Builder CLI

A command-line interface for generating Model Context Protocol (MCP) servers from API specifications. This package provides two separate tools:

1. **MCP Builder CLI** (`mcp-builder`) - Generate custom MCP servers from API specification documents
2. **MCP API Server** (`mcp-api-server`) - Make HTTP requests from AI assistants like Claude

## What is this for?

This package contains two distinct tools that serve different purposes:

### MCP Builder CLI (`mcp-builder`)
Generate custom MCP servers from API specification documents. This tool helps developers create MCP servers tailored to specific APIs.

### MCP API Server (`mcp-api-server`)
Allow AI assistants like Claude to make HTTP requests (GET, POST, PUT, DELETE) to any web API directly. This acts as a bridge between AI assistants and web APIs, enabling them to:
- Fetch data from REST APIs
- Send data to web services
- Interact with online tools and platforms

For example, you could ask Claude to check the weather by making a request to a weather API, or ask it to shorten a URL using a URL shortening service.

## Quickstart Guide

### 1. Using the Built-in API Server with Claude Desktop (Easiest)

First, configure Claude Desktop to use the built-in MCP API server:

1. Open Claude Desktop
2. Go to the MCP configuration file (usually located at `~/.config/claude/claude_desktop_config.json` on Mac/Linux or `%APPDATA%/Claude/claude_desktop_config.json` on Windows)
3. Add this server configuration:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server"]
    }
  }
}
```

4. Restart Claude Desktop
5. You can now use the API tools in Claude!

### 2. Running the API Server Directly

The easiest way to run the API server is using NPX (no installation required):

```bash
npx mcp-api-server
```

For development/testing, you might want to enable debug logging and allow localhost requests:

```bash
npx mcp-api-server --debug --allow-localhost
```

You can also run the server directly with Node:

```bash
node dist/src/index.js
```

With debug and localhost access:

```bash
node dist/src/index.js --debug --allow-localhost
```

### 3. Installing Globally

To install the tools globally on your system:

```bash
npm install -g mcp-builder
```

Then run the API server with:

```bash
mcp-api-server
```

### 4. Using with Claude

Once configured, you can ask Claude to make API requests:

> "Can you get the latest news from https://api.example.com/news/latest?"

> "Please post this data to my webhook: {\"message\": \"Hello World\"}"

Claude will automatically use the appropriate tool (`api_get`, `api_post`, etc.) based on what you're asking for.

## Features

- 🚀 **HTTP API Tools**: GET, POST, PUT, DELETE request support
- 🔒 **Security**: Request validation with configurable security policies
- 📝 **Logging**: Comprehensive debug logging and request tracking
- ⚙️ **Configurable**: Flexible configuration via CLI args and environment variables
- 🛡️ **Error Handling**: Robust error handling with detailed error messages
- 🔄 **Graceful Shutdown**: Proper cleanup and shutdown handling

## Installation

### NPX (Recommended)

Run directly without installation:

```bash
npx mcp-builder
```

### Global Installation

```bash
npm install -g mcp-builder
mcp-builder
```

### Local Installation

```bash
npm install mcp-builder
npx mcp-builder
```

## Usage

### API Server Usage

```bash
# Start the API server
mcp-api-server

# Start with debug logging
mcp-api-server --debug

# Allow localhost requests (useful for development)
mcp-api-server --allow-localhost

# Allow private IP requests
mcp-api-server --allow-private-ips

# Show help
mcp-api-server --help
```

You can also run the API server directly with Node:

```bash
# Start the API server directly
node dist/src/index.js

# Start with debug logging
node dist/src/index.js --debug

# Allow localhost requests
node dist/src/index.js --allow-localhost

# Allow private IP requests
node dist/src/index.js --allow-private-ips

# Show help
node dist/src/index.js --help
```

### Environment Variables

Configure the API server using environment variables:

```bash
# Server Configuration
API_TIMEOUT=60000          # Request timeout in milliseconds
ALLOW_LOCALHOST=true      # Allow requests to localhost (127.0.0.1)
ALLOW_PRIVATE_IPS=false   # Allow requests to private IP ranges
MAX_RESPONSE_LENGTH=100000 # Maximum response length in bytes
USER_AGENT="MyApp/1.0.0"   # Custom user agent string for requests

# Debug Configuration
DEBUG=true                # Enable detailed logging
```

### MCP Builder CLI Usage

The MCP Builder CLI is used to generate custom MCP servers from API specification documents:

```bash
# Generate an MCP server from an API specification
mcp-builder generate <api-spec.md> <output-directory>

# Validate an API specification file
mcp-builder validate <api-spec.md>

# Show help
mcp-builder --help

# Show help for a specific command
mcp-builder help generate
```

### Configuration Options

| CLI Option | Environment Variable | Default | Description |
|------------|---------------------|---------|-------------|
| `--debug` | `DEBUG` | `false` | Enable debug logging |
| `--allow-localhost` | `ALLOW_LOCALHOST` | `false` | Allow requests to localhost |
| `--allow-private-ips` | `ALLOW_PRIVATE_IPS` | `false` | Allow requests to private IPs |
| N/A | `API_TIMEOUT` | `30000` | Request timeout in milliseconds |
| N/A | `MAX_RESPONSE_LENGTH` | `50000` | Maximum response length in bytes |
| N/A | `USER_AGENT` | `MCP-API-Server/1.0.0` | Custom user agent string |

## Available Tools

The API server provides the following MCP tools that Claude or other MCP clients can use:

### `api_get`
Make an HTTP GET request to retrieve data from a URL.

**Parameters:**
- `url` (string): The URL to request data from
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Can you fetch the JSON data from https://api.example.com/users?"

### `api_post`
Make an HTTP POST request to send data to a URL.

**Parameters:**
- `url` (string): The URL to send data to
- `body` (string or object, optional): The data to send
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Please post this JSON to my webhook: {\"name\": \"John\", \"age\": 30}"

### `api_put`
Make an HTTP PUT request to update data at a URL.

**Parameters:**
- `url` (string): The URL to update data at
- `body` (string or object, optional): The updated data
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Update my user profile with this data: {\"name\": \"John Smith\", \"age\": 31}"

### `api_delete`
Make an HTTP DELETE request to remove data at a URL.

**Parameters:**
- `url` (string): The URL to delete data from
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Please delete the user with ID 123 from https://api.example.com/users/123"

## MCP Client Configuration

To use this server with an MCP client, add it to your MCP configuration:

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server"]
    }
  }
}
```

### With Custom Configuration

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server", "--debug", "--allow-localhost"]
    }
  }
}
```

You can also run the server directly with Node:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "node",
      "args": ["dist/src/index.js", "--debug", "--allow-localhost"]
    }
  }
}
```

## Security Considerations

- By default, requests to localhost and private IP ranges are blocked to prevent SSRF attacks
- Only enable `--allow-localhost` and `--allow-private-ips` in trusted environments
- The server validates all requests and sanitizes responses
- Request timeouts prevent hanging connections
- Response size limits prevent memory exhaustion

## Error Handling

The server provides detailed error messages for:
- Invalid URLs
- Network timeouts
- JSON parsing errors
- Validation failures
- HTTP errors

All errors are logged with timestamps and context for debugging.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

- Report issues: [GitHub Issues](https://github.com/yourusername/mcp-builder/issues)
- Documentation: [GitHub Repository](https://github.com/yourusername/mcp-builder)

## Installation

### NPX (Recommended)

Run directly without installation:

```bash
npx mcp-builder
```

### Global Installation

```bash
npm install -g mcp-builder
mcp-builder
```

### Local Installation

```bash
npm install mcp-builder
npx mcp-builder
```

## Usage

### Basic Usage

```bash
# Start the server
mcp-api-server

# Start with debug logging
mcp-api-server --debug

# Allow localhost requests (useful for development)
mcp-api-server --allow-localhost

# Allow private IP requests
mcp-api-server --allow-private-ips

# Show help
mcp-api-server --help
```

You can also run the server directly with Node:

```bash
# Start the server
node dist/src/index.js

# Start with debug logging
node dist/src/index.js --debug

# Allow localhost requests
node dist/src/index.js --allow-localhost

# Allow private IP requests
node dist/src/index.js --allow-private-ips

# Show help
node dist/src/index.js --help
```

### Environment Variables

Configure the server using environment variables:

```bash
# Server Configuration
API_TIMEOUT=60000          # Request timeout in milliseconds
ALLOW_LOCALHOST=true      # Allow requests to localhost (127.0.0.1)
ALLOW_PRIVATE_IPS=false   # Allow requests to private IP ranges
MAX_RESPONSE_LENGTH=100000 # Maximum response length in bytes
USER_AGENT="MyApp/1.0.0"   # Custom user agent string for requests

# Debug Configuration
DEBUG=true                # Enable detailed logging
```

### Configuration Options

| CLI Option | Environment Variable | Default | Description |
|------------|---------------------|---------|-------------|
| `--debug` | `DEBUG` | `false` | Enable debug logging |
| `--allow-localhost` | `ALLOW_LOCALHOST` | `false` | Allow requests to localhost |
| `--allow-private-ips` | `ALLOW_PRIVATE_IPS` | `false` | Allow requests to private IPs |
| N/A | `API_TIMEOUT` | `30000` | Request timeout in milliseconds |
| N/A | `MAX_RESPONSE_LENGTH` | `50000` | Maximum response length in bytes |
| N/A | `USER_AGENT` | `MCP-API-Server/1.0.0` | Custom user agent string |

## Available Tools

The server provides the following MCP tools that Claude or other MCP clients can use:

### `api_get`
Make an HTTP GET request to retrieve data from a URL.

**Parameters:**
- `url` (string): The URL to request data from
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Can you fetch the JSON data from https://api.example.com/users?"

### `api_post`
Make an HTTP POST request to send data to a URL.

**Parameters:**
- `url` (string): The URL to send data to
- `body` (string or object, optional): The data to send
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Please post this JSON to my webhook: {\"name\": \"John\", \"age\": 30}"

### `api_put`
Make an HTTP PUT request to update data at a URL.

**Parameters:**
- `url` (string): The URL to update data at
- `body` (string or object, optional): The updated data
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Update my user profile with this data: {\"name\": \"John Smith\", \"age\": 31}"

### `api_delete`
Make an HTTP DELETE request to remove data at a URL.

**Parameters:**
- `url` (string): The URL to delete data from
- `headers` (object, optional): HTTP headers to include in the request

**Example usage with Claude:**
> "Please delete the user with ID 123 from https://api.example.com/users/123"

## MCP Client Configuration

To use this server with an MCP client, add it to your MCP configuration:

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server"]
    }
  }
}
```

### With Custom Configuration

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server", "--debug", "--allow-localhost"]
    }
  }
}
```

## Security Considerations

- By default, requests to localhost and private IP ranges are blocked to prevent SSRF attacks
- Only enable `--allow-localhost` and `--allow-private-ips` in trusted environments
- The server validates all requests and sanitizes responses
- Request timeouts prevent hanging connections
- Response size limits prevent memory exhaustion

## Error Handling

The server provides detailed error messages for:
- Invalid URLs
- Network timeouts
- JSON parsing errors
- Validation failures
- HTTP errors

All errors are logged with timestamps and context for debugging.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

- Report issues: [GitHub Issues](https://github.com/yourusername/mcp-builder/issues)
- Documentation: [GitHub Repository](https://github.com/yourusername/mcp-builder)