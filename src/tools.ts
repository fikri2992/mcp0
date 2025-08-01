import { MCPTool } from './types.js';

// =============================================================================
// MCP Tool Definitions
// =============================================================================

/**
 * Tool definition for making GET requests
 */
export const API_GET_TOOL: MCPTool = {
  name: 'api_get',
  description: 'Make an HTTP GET request to the specified URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: 'The URL to make the GET request to',
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string',
        },
      },
    },
    required: ['url'],
  },
};

/**
 * Tool definition for making POST requests
 */
export const API_POST_TOOL: MCPTool = {
  name: 'api_post',
  description: 'Make an HTTP POST request to the specified URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: 'The URL to make the POST request to',
      },
      body: {
        oneOf: [
          { type: 'string' },
          { type: 'object' },
        ],
        description: 'The request body (string or JSON object)',
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string',
        },
      },
    },
    required: ['url'],
  },
};

/**
 * Tool definition for making PUT requests
 */
export const API_PUT_TOOL: MCPTool = {
  name: 'api_put',
  description: 'Make an HTTP PUT request to the specified URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: 'The URL to make the PUT request to',
      },
      body: {
        oneOf: [
          { type: 'string' },
          { type: 'object' },
        ],
        description: 'The request body (string or JSON object)',
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string',
        },
      },
    },
    required: ['url'],
  },
};

/**
 * Tool definition for making DELETE requests
 */
export const API_DELETE_TOOL: MCPTool = {
  name: 'api_delete',
  description: 'Make an HTTP DELETE request to the specified URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: 'The URL to make the DELETE request to',
      },
      headers: {
        type: 'object',
        description: 'Optional headers to include in the request',
        additionalProperties: {
          type: 'string',
        },
      },
    },
    required: ['url'],
  },
};

/**
 * Array of all available API tools
 */
export const ALL_API_TOOLS: MCPTool[] = [
  API_GET_TOOL,
  API_POST_TOOL,
  API_PUT_TOOL,
  API_DELETE_TOOL,
];

/**
 * Map of tool names to tool definitions for quick lookup
 */
export const TOOL_MAP: Record<string, MCPTool> = {
  [API_GET_TOOL.name]: API_GET_TOOL,
  [API_POST_TOOL.name]: API_POST_TOOL,
  [API_PUT_TOOL.name]: API_PUT_TOOL,
  [API_DELETE_TOOL.name]: API_DELETE_TOOL,
};