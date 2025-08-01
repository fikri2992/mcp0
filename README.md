# MCP API Server

A Model Context Protocol server for making HTTP API calls.

## Development

### Prerequisites
- Node.js 18+ 
- npm

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

### Development
```bash
npm run dev  # Watch mode
```

### Run
```bash
npm start
```

## Project Structure
```
src/           # TypeScript source files
dist/          # Compiled JavaScript output
tsconfig.json  # TypeScript configuration
package.json   # Project dependencies and scripts
```

## Dependencies
- `@modelcontextprotocol/sdk`: MCP SDK for TypeScript
- `axios`: HTTP client library
- `zod`: Runtime type validation