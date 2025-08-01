# MCP API Server

A Model Context Protocol (MCP) server that provides HTTP API calling capabilities. This server allows MCP clients to make HTTP requests (GET, POST, PUT, DELETE) through standardized MCP tools.

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
npx mcp-api-server
```

### Global Installation

```bash
npm install -g mcp-api-server
mcp-api-server
```

### Local Installation

```bash
npm install mcp-api-server
npx mcp-api-server
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

### Environment Variables

Configure the server using environment variables:

```bash
# Enable debug logging
DEBUG=true mcp-api-server

# Set custom timeout (in milliseconds)
API_TIMEOUT=60000 mcp-api-server

# Allow localhost and private IPs
ALLOW_LOCALHOST=true ALLOW_PRIVATE_IPS=true mcp-api-server

# Set maximum response length (in bytes)
MAX_RESPONSE_LENGTH=100000 mcp-api-server

# Set custom user agent
USER_AGENT="MyApp/1.0.0" mcp-api-server
```

### Configuration Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--debug` | `DEBUG` | `false` | Enable debug logging |
| `--allow-localhost` | `ALLOW_LOCALHOST` | `false` | Allow requests to localhost/127.0.0.1 |
| `--allow-private-ips` | `ALLOW_PRIVATE_IPS` | `false` | Allow requests to private IP ranges |
| N/A | `API_TIMEOUT` | `30000` | Request timeout in milliseconds |
| N/A | `MAX_RESPONSE_LENGTH` | `50000` | Maximum response length in bytes |
| N/A | `USER_AGENT` | `MCP-API-Server/1.0.0` | Custom user agent string |

## Available Tools

The server provides the following MCP tools:

### `api_get`
Make an HTTP GET request.

**Parameters:**
- `url` (string): The URL to request
- `headers` (object, optional): HTTP headers to include

### `api_post`
Make an HTTP POST request.

**Parameters:**
- `url` (string): The URL to request
- `body` (string, optional): Request body
- `headers` (object, optional): HTTP headers to include

### `api_put`
Make an HTTP PUT request.

**Parameters:**
- `url` (string): The URL to request
- `body` (string, optional): Request body
- `headers` (object, optional): HTTP headers to include

### `api_delete`
Make an HTTP DELETE request.

**Parameters:**
- `url` (string): The URL to request
- `headers` (object, optional): HTTP headers to include

## MCP Client Configuration

To use this server with an MCP client, add it to your MCP configuration:

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "npx",
      "args": ["mcp-api-server"],
      "env": {
        "DEBUG": "false"
      }
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
      "args": ["mcp-api-server", "--debug", "--allow-localhost"],
      "env": {
        "API_TIMEOUT": "60000",
        "MAX_RESPONSE_LENGTH": "100000"
      }
    }
  }
}
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-api-server.git
cd mcp-api-server

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run the server
npm start
```

### Development Mode

```bash
# Watch mode for development
npm run dev

# Run with development settings
npm run start:dev

# Run individual test suites
npm run test:validation
npm run test:handlers
npm run test:flow
```

## Security Considerations

- By default, requests to localhost and private IP ranges are blocked
- Use `--allow-localhost` and `--allow-private-ips` flags carefully in production
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

- Report issues: [GitHub Issues](https://github.com/yourusername/mcp-api-server/issues)
- Documentation: [GitHub Repository](https://github.com/yourusername/mcp-api-server)