import OpenAI from 'openai';
import { z } from 'zod';
import { AIErrorHandler, AIRetryHandler, AICircuitBreaker } from './error-handler.js';

export interface OpenAIClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIParsingRequest {
  markdown: string;
  context?: ParsingContext;
}

export interface ParsingContext {
  baseUrl?: string;
  commonHeaders?: Record<string, string>;
  apiName?: string;
  expectedEndpoints?: number;
}

export interface AIParsingResult {
  apis: APISpec[];
  metadata: APIMetadata;
  confidence: number;
  warnings: string[];
}

export interface APISpec {
  name: string;
  description?: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  parameters?: APIParameter[];
  examples?: APIExample[];
  curlCommand?: string;
}

export interface APIParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  location: 'query' | 'header' | 'body' | 'path';
  example?: any;
}

export interface APIExample {
  description?: string;
  request?: any;
  response?: any;
}

export interface APIMetadata {
  name: string;
  description?: string;
  baseUrl?: string;
  authentication?: AuthenticationSpec;
  commonHeaders?: Record<string, string>;
}

export interface AuthenticationSpec {
  type: 'bearer' | 'basic' | 'apikey';
  location?: 'header' | 'query';
  name?: string;
}

// Zod schemas for structured AI responses
const APIParameterSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean(),
  description: z.string().optional(),
  location: z.enum(['query', 'header', 'body', 'path']),
  example: z.any().optional()
});

const APISpecSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  parameters: z.array(APIParameterSchema).optional(),
  curlCommand: z.string().optional()
});

const AuthenticationSpecSchema = z.object({
  type: z.enum(['bearer', 'basic', 'apikey']),
  location: z.enum(['header', 'query']).optional(),
  name: z.string().optional()
});

const APIMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  baseUrl: z.string().optional(),
  authentication: AuthenticationSpecSchema.optional(),
  commonHeaders: z.record(z.string()).optional()
});

const AIParsingResponseSchema = z.object({
  apis: z.array(APISpecSchema),
  metadata: APIMetadataSchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string())
});

export class OpenAIClient {
  private client: OpenAI;
  private config: OpenAIClientConfig;
  private retryHandler: AIRetryHandler;
  private circuitBreaker: AICircuitBreaker;

  constructor(config: OpenAIClientConfig) {
    this.config = {
      model: 'gpt-4',
      maxTokens: 4000,
      temperature: 0.1,
      ...config
    };
    
    this.client = new OpenAI({
      apiKey: this.config.apiKey
    });

    this.retryHandler = new AIRetryHandler(3, 1000);
    this.circuitBreaker = new AICircuitBreaker(5, 60000);
  }

  async parseMarkdownToAPISpecs(request: AIParsingRequest): Promise<AIParsingResult> {
    return this.circuitBreaker.execute(async () => {
      return this.retryHandler.executeWithRetry(async () => {
        try {
          const systemPrompt = this.buildSystemPrompt();
          const userPrompt = this.buildUserPrompt(request);

          const completion = await this.client.chat.completions.create({
            model: this.config.model!,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            response_format: { type: 'json_object' }
          });

          const responseContent = completion.choices[0]?.message?.content;
          if (!responseContent) {
            throw new Error('No response content from OpenAI');
          }

          const parsedResponse = JSON.parse(responseContent);
          const validatedResponse = AIParsingResponseSchema.parse(parsedResponse);
          
          return validatedResponse;
        } catch (error) {
          const aiError = AIErrorHandler.parseOpenAIError(error);
          throw new Error(aiError.message);
        }
      }, 'Markdown parsing');
    }, 'Markdown parsing');
  }

  async analyzeCurlCommand(curlCommand: string, context?: ParsingContext): Promise<APISpec> {
    return this.circuitBreaker.execute(async () => {
      return this.retryHandler.executeWithRetry(async () => {
        try {
          const systemPrompt = `You are an expert at analyzing curl commands and extracting API specifications.
            Parse the curl command and return a structured API specification as JSON.
            Focus on accuracy and completeness of the extracted information.`;

          const userPrompt = `Analyze this curl command and extract the API specification:

Curl Command: ${curlCommand}

${context ? `Context:
- Base URL: ${context.baseUrl || 'Not specified'}
- API Name: ${context.apiName || 'Not specified'}
- Common Headers: ${JSON.stringify(context.commonHeaders || {})}` : ''}

Extract:
1. HTTP method and URL
2. Headers and authentication
3. Request body and parameters
4. Parameter types and requirements
5. Generate a descriptive name for this API endpoint

Return the API specification as a JSON object matching this schema:
{
  "name": "string",
  "description": "string (optional)",
  "method": "string",
  "url": "string",
  "headers": "object (optional)",
  "body": "any (optional)",
  "parameters": "array of parameter objects (optional)"
}`;

          const completion = await this.client.chat.completions.create({
            model: this.config.model!,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            response_format: { type: 'json_object' }
          });

          const responseContent = completion.choices[0]?.message?.content;
          if (!responseContent) {
            throw new Error('No response content from OpenAI');
          }

          const parsedResponse = JSON.parse(responseContent);
          const validatedResponse = APISpecSchema.parse(parsedResponse);

          return {
            ...validatedResponse,
            curlCommand
          };
        } catch (error) {
          const aiError = AIErrorHandler.parseOpenAIError(error);
          throw new Error(aiError.message);
        }
      }, 'Curl command analysis');
    }, 'Curl command analysis');
  }

  async optimizeAPISpec(apiSpec: APISpec, context?: string): Promise<APISpec> {
    return this.circuitBreaker.execute(async () => {
      return this.retryHandler.executeWithRetry(async () => {
        try {
          const systemPrompt = `You are an expert at optimizing API specifications for MCP server generation.
            Review the API specification and improve it for better MCP tool generation.
            Focus on parameter validation, error handling, and MCP protocol compatibility.
            Return the optimized specification as JSON.`;

          const userPrompt = `Optimize this API specification for MCP server generation:

API Spec: ${JSON.stringify(apiSpec, null, 2)}

${context ? `Additional Context: ${context}` : ''}

Improvements to make:
1. Enhance parameter descriptions and validation
2. Improve error handling specifications
3. Ensure MCP protocol compatibility
4. Add missing parameter types or requirements
5. Optimize for code generation

Return the optimized API specification as a JSON object matching the same schema as the input.`;

          const completion = await this.client.chat.completions.create({
            model: this.config.model!,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            response_format: { type: 'json_object' }
          });

          const responseContent = completion.choices[0]?.message?.content;
          if (!responseContent) {
            throw new Error('No response content from OpenAI');
          }

          const parsedResponse = JSON.parse(responseContent);
          const validatedResponse = APISpecSchema.parse(parsedResponse);

          return validatedResponse;
        } catch (error) {
          const aiError = AIErrorHandler.parseOpenAIError(error);
          throw new Error(aiError.message);
        }
      }, 'API spec optimization');
    }, 'API spec optimization');
  }

  private buildSystemPrompt(): string {
    return `You are an expert API analyst and MCP (Model Context Protocol) specialist. 
    Your task is to parse markdown content containing curl commands and extract structured API specifications.
    
    Key responsibilities:
    1. Accurately parse curl commands to extract HTTP methods, URLs, headers, and bodies
    2. Infer parameter types and requirements from examples
    3. Generate descriptive names and documentation for API endpoints
    4. Identify authentication patterns and common headers
    5. Provide confidence scores and warnings for uncertain extractions
    6. Ensure compatibility with MCP protocol standards
    
    Focus on accuracy, completeness, and generating specifications that will work well for MCP server code generation.`;
  }

  private buildUserPrompt(request: AIParsingRequest): string {
    const contextSection = request.context ? `
Context Information:
- Base URL: ${request.context.baseUrl || 'Not specified'}
- API Name: ${request.context.apiName || 'Not specified'}
- Expected Endpoints: ${request.context.expectedEndpoints || 'Unknown'}
- Common Headers: ${JSON.stringify(request.context.commonHeaders || {})}
` : '';

    return `Please analyze this markdown content and extract API specifications from curl commands:

${contextSection}
Markdown Content:
${request.markdown}

Extract and return as JSON:
1. All API endpoints with their specifications
2. Metadata about the API collection (name, base URL, authentication)
3. Confidence score (0-1) for the extraction quality
4. Any warnings about incomplete or uncertain information

Requirements:
- Parse all curl commands found in code blocks
- Infer parameter types from examples (string, number, boolean, object, array)
- Identify parameter locations (query, header, body, path)
- Generate descriptive names for endpoints based on context
- Extract authentication patterns (Bearer tokens, API keys, etc.)
- Provide detailed parameter descriptions when possible
- Flag any incomplete or ambiguous information as warnings

Return the structured response as JSON matching this schema:
{
  "apis": [array of API specifications],
  "metadata": {
    "name": "string",
    "description": "string (optional)",
    "baseUrl": "string (optional)",
    "authentication": "object (optional)",
    "commonHeaders": "object (optional)"
  },
  "confidence": "number between 0 and 1",
  "warnings": ["array of warning strings"]
}`;
  }
}