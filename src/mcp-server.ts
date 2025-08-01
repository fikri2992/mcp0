import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { APIClient, APIClientConfig } from './api-client.js';
import { RequestValidator, RequestValidatorConfig } from './request-validator.js';
import { ResponseFormatter, ResponseFormatterConfig } from './response-formatter.js';
import { ALL_API_TOOLS, TOOL_MAP } from './tools.js';
import { ToolCallParams, ErrorResponse, APIRequest, HTTPMethod } from './types.js';

/**
 * Configuration options for the MCP server
 */
export interface MCPServerConfig {
  /** Server name and version information */
  name?: string;
  version?: string;
  /** API client configuration */
  apiClient?: APIClientConfig;
  /** Request validator configuration */
  requestValidator?: RequestValidatorConfig;
  /** Response formatter configuration */
  responseFormatter?: ResponseFormatterConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Main MCP server class that implements the Model Context Protocol
 * Provides HTTP API calling capabilities through MCP tools
 */
export class MCPServer {
  private server: Server;
  private apiClient: APIClient;
  private requestValidator: RequestValidator;
  private responseFormatter: ResponseFormatter;
  private config: Required<MCPServerConfig>;

  constructor(config: MCPServerConfig = {}) {
    // Set default configuration
    this.config = {
      name: config.name ?? 'mcp-api-server',
      version: config.version ?? '1.0.0',
      apiClient: config.apiClient ?? {},
      requestValidator: config.requestValidator ?? {},
      responseFormatter: config.responseFormatter ?? {},
      debug: config.debug ?? false,
    };

    // Initialize components
    this.apiClient = new APIClient(this.config.apiClient);
    this.requestValidator = new RequestValidator(this.config.requestValidator);
    this.responseFormatter = new ResponseFormatter(this.config.responseFormatter);

    // Initialize MCP server
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register handlers
    this.registerHandlers();

    this.log('MCPServer initialized with configuration:', {
      name: this.config.name,
      version: this.config.version,
      debug: this.config.debug,
    });
  }

  /**
   * Registers all MCP protocol handlers
   */
  private registerHandlers(): void {
    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.log('Received list_tools request');
      return {
        tools: ALL_API_TOOLS,
      };
    });

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      isError?: boolean;
    }> => {
      const { name, arguments: args } = request.params;
      
      // Log request details for debugging (requirement 5.5)
      this.log('Received call_tool request:', { 
        toolName: name, 
        parameters: args,
        timestamp: new Date().toISOString()
      });

      try {
        // Validate that the tool exists
        if (!TOOL_MAP[name]) {
          const errorResponse = {
            error: {
              type: 'validation' as const,
              message: `Unknown tool: ${name}`,
            },
          };
          const mcpErrorResponse = this.responseFormatter.formatErrorResponse(errorResponse);
          return {
            content: mcpErrorResponse.content,
            isError: mcpErrorResponse.isError,
          };
        }

        // Validate tool parameters
        const validatedParams = this.requestValidator.validateToolCall(name, args);
        if ('error' in validatedParams) {
          // Log validation errors (requirement 5.1)
          this.log('Tool parameter validation failed:', {
            toolName: name,
            error: validatedParams.error,
            parameters: args
          });
          const mcpErrorResponse = this.responseFormatter.formatErrorResponse(validatedParams);
          return {
            content: mcpErrorResponse.content,
            isError: mcpErrorResponse.isError,
          };
        }

        // Route to appropriate handler
        const result = await this.handleToolCall(name, validatedParams);
        
        // Log successful tool call completion
        this.log('Tool call completed successfully:', {
          toolName: name,
          success: !('error' in result)
        });
        
        // Format the response according to MCP CallToolResult schema
        const mcpResponse = this.responseFormatter.formatResponse(result);
        return {
          content: mcpResponse.content,
          isError: mcpResponse.isError,
        };
      } catch (error) {
        // Log error details (requirement 5.1)
        this.log('Error handling tool call:', {
          toolName: name,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        const errorResponse: ErrorResponse = {
          error: {
            type: 'network',
            message: `Tool call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { originalError: error },
          },
        };
        const mcpErrorResponse = this.responseFormatter.formatErrorResponse(errorResponse);
        return {
          content: mcpErrorResponse.content,
          isError: mcpErrorResponse.isError,
        };
      }
    });

    this.log('MCP handlers registered successfully');
  }

  /**
   * Routes tool calls to the appropriate handler based on tool name
   */
  private async handleToolCall(toolName: string, params: ToolCallParams) {
    this.log(`Handling tool call: ${toolName}`, {
      url: params.url,
      hasHeaders: !!params.headers,
      hasBody: 'body' in params && !!params.body,
      headerCount: params.headers ? Object.keys(params.headers).length : 0
    });

    // Convert tool parameters to API request
    const apiRequest = this.convertToAPIRequest(toolName, params);
    
    // Validate the API request
    const validatedRequest = this.requestValidator.validateAPIRequest(apiRequest);
    if ('error' in validatedRequest) {
      return validatedRequest;
    }

    // Make the API call using the appropriate method
    switch (toolName) {
      case 'api_get':
        return await this.apiClient.get(validatedRequest.url, validatedRequest.headers);
      
      case 'api_post':
        return await this.apiClient.post(
          validatedRequest.url,
          validatedRequest.body,
          validatedRequest.headers
        );
      
      case 'api_put':
        return await this.apiClient.put(
          validatedRequest.url,
          validatedRequest.body,
          validatedRequest.headers
        );
      
      case 'api_delete':
        return await this.apiClient.delete(validatedRequest.url, validatedRequest.headers);
      
      default:
        return {
          error: {
            type: 'validation' as const,
            message: `Unsupported tool: ${toolName}`,
          },
        };
    }
  }

  /**
   * Converts tool parameters to APIRequest format
   */
  private convertToAPIRequest(toolName: string, params: ToolCallParams): APIRequest {
    let method: HTTPMethod;
    
    switch (toolName) {
      case 'api_get':
        method = 'GET';
        break;
      case 'api_post':
        method = 'POST';
        break;
      case 'api_put':
        method = 'PUT';
        break;
      case 'api_delete':
        method = 'DELETE';
        break;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      url: params.url,
      method,
      headers: params.headers,
      body: 'body' in params ? params.body : undefined,
    };
  }

  /**
   * Starts the MCP server with stdio transport
   */
  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      // Log successful initialization (requirement 5.4)
      this.log('MCP API Server started successfully', {
        name: this.config.name,
        version: this.config.version,
        debug: this.config.debug,
        toolCount: ALL_API_TOOLS.length,
        timestamp: new Date().toISOString()
      });
      
      // Log server configuration details
      this.log('Server configuration:', {
        apiClient: {
          timeout: this.config.apiClient.timeout,
          userAgent: this.config.apiClient.userAgent,
        },
        requestValidator: {
          allowLocalhost: this.config.requestValidator.allowLocalhost,
          allowPrivateIps: this.config.requestValidator.allowPrivateIps,
        },
        responseFormatter: {
          maxResponseLength: this.config.responseFormatter.maxResponseLength,
          includeHeaders: this.config.responseFormatter.includeHeaders,
        }
      });
      
      // Log available tools
      this.log('Available tools:', ALL_API_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: Object.keys(tool.inputSchema.properties || {})
      })));
      
    } catch (error) {
      this.log('Failed to start MCP server:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Stops the MCP server
   */
  async stop(): Promise<void> {
    try {
      await this.server.close();
      this.log('MCP API Server stopped');
    } catch (error) {
      this.log('Error stopping MCP server:', error);
      throw error;
    }
  }

  /**
   * Logs messages with optional debug filtering
   */
  private log(message: string, data?: any): void {
    if (this.config.debug || process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] ${this.config.name}: ${message}`, data);
      } else {
        console.error(`[${timestamp}] ${this.config.name}: ${message}`);
      }
    }
  }

  /**
   * Gets server information
   */
  getServerInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      tools: ALL_API_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
      })),
    };
  }
}