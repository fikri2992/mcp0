import * as path from 'path';
import { TemplateEngine, TemplateContext } from './template-engine.js';
import { GeneratedMCPTool } from './mcp-tool-generator.js';
import { ParsedAPICollection, APISpec, APIParameter } from '../parser/types.js';
import { GeneratedFile } from './code-generator.js';

/**
 * Configuration for documentation generation
 */
export interface DocumentationGeneratorConfig {
    /** Enable debug logging */
    debug?: boolean;
    /** Include inline code comments */
    includeInlineComments?: boolean;
    /** Include usage examples */
    includeExamples?: boolean;
    /** Include API reference documentation */
    includeAPIReference?: boolean;
    /** Include TypeScript type definitions */
    includeTypeDefinitions?: boolean;
    /** Custom template directory for documentation templates */
    templateDir?: string;
    /** Output format for documentation */
    outputFormat?: 'markdown' | 'html' | 'json';
    /** Include table of contents */
    includeTableOfContents?: boolean;
    /** Include installation instructions */
    includeInstallation?: boolean;
    /** Include development setup instructions */
    includeDevelopmentSetup?: boolean;
}

/**
 * Generated documentation file information
 */
export interface GeneratedDocumentation {
    /** File path relative to output directory */
    path: string;
    /** Documentation content */
    content: string;
    /** Documentation type */
    type: 'readme' | 'api-reference' | 'type-definitions' | 'inline-comments' | 'examples';
    /** File format */
    format: 'markdown' | 'typescript' | 'json' | 'html';
}

/**
 * Documentation generation result
 */
export interface DocumentationGenerationResult {
    /** Generated documentation files */
    documentation: GeneratedDocumentation[];
    /** Generation statistics */
    stats: {
        filesGenerated: number;
        readmeGenerated: boolean;
        apiReferenceGenerated: boolean;
        typeDefinitionsGenerated: boolean;
        inlineCommentsGenerated: boolean;
        examplesGenerated: number;
        totalSize: number;
    };
    /** Any errors that occurred during generation */
    errors: string[];
    /** Warnings from generation process */
    warnings: string[];
}

/**
 * API documentation structure
 */
export interface APIDocumentation {
    name: string;
    description?: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    parameters?: APIParameter[];
    examples?: APIDocumentationExample[];
    responses?: APIDocumentationResponse[];
    authentication?: string;
    rateLimit?: string;
    notes?: string[];
}

/**
 * API documentation example
 */
export interface APIDocumentationExample {
    name: string;
    description?: string;
    request: {
        url: string;
        method: string;
        headers?: Record<string, string>;
        body?: any;
    };
    response?: {
        status: number;
        headers?: Record<string, string>;
        body?: any;
    };
    curlCommand?: string;
}

/**
 * API documentation response
 */
export interface APIDocumentationResponse {
    status: number;
    description: string;
    headers?: Record<string, string>;
    body?: any;
    example?: any;
}

/**
 * TypeScript type definition information
 */
export interface TypeDefinition {
    name: string;
    type: 'interface' | 'type' | 'enum' | 'class';
    definition: string;
    description?: string;
    properties?: TypeProperty[];
    methods?: TypeMethod[];
    examples?: string[];
}

/**
 * TypeScript type property
 */
export interface TypeProperty {
    name: string;
    type: string;
    optional: boolean;
    description?: string;
    example?: any;
}

/**
 * TypeScript type method
 */
export interface TypeMethod {
    name: string;
    parameters: TypeProperty[];
    returnType: string;
    description?: string;
    example?: string;
}

/**
 * Documentation generator for MCP servers
 */
export class DocumentationGenerator {
    private config: Required<DocumentationGeneratorConfig>;
    private templateEngine?: TemplateEngine;

    constructor(config: DocumentationGeneratorConfig = {}) {
        this.config = {
            debug: config.debug ?? false,
            includeInlineComments: config.includeInlineComments ?? true,
            includeExamples: config.includeExamples ?? true,
            includeAPIReference: config.includeAPIReference ?? true,
            includeTypeDefinitions: config.includeTypeDefinitions ?? true,
            templateDir: config.templateDir ?? path.join(__dirname, '../../templates/docs'),
            outputFormat: config.outputFormat ?? 'markdown',
            includeTableOfContents: config.includeTableOfContents ?? true,
            includeInstallation: config.includeInstallation ?? true,
            includeDevelopmentSetup: config.includeDevelopmentSetup ?? true,
        };

        // Initialize template engine if template directory is provided
        if (this.config.templateDir) {
            this.templateEngine = new TemplateEngine({
                templateDir: this.config.templateDir,
                debug: this.config.debug,
            });
        }

        this.log('DocumentationGenerator initialized', this.config);
    }

    /**
     * Generate complete documentation for MCP server
     */
    async generateDocumentation(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[],
        templateContext: TemplateContext
    ): Promise<DocumentationGenerationResult> {
        const result: DocumentationGenerationResult = {
            documentation: [],
            stats: {
                filesGenerated: 0,
                readmeGenerated: false,
                apiReferenceGenerated: false,
                typeDefinitionsGenerated: false,
                inlineCommentsGenerated: false,
                examplesGenerated: 0,
                totalSize: 0,
            },
            errors: [],
            warnings: [],
        };

        try {
            this.log('Starting documentation generation', {
                collectionName: apiCollection.name,
                toolCount: tools.length,
                apiCount: apiCollection.apis.length,
            });

            // Generate README documentation
            if (this.config.includeInstallation || this.config.includeExamples) {
                const readme = await this.generateREADME(apiCollection, tools, templateContext);
                result.documentation.push(readme);
                result.stats.readmeGenerated = true;
                result.stats.filesGenerated++;
                result.stats.totalSize += readme.content.length;
            }

            // Generate API reference documentation
            if (this.config.includeAPIReference) {
                const apiReference = await this.generateAPIReference(apiCollection, tools);
                result.documentation.push(apiReference);
                result.stats.apiReferenceGenerated = true;
                result.stats.filesGenerated++;
                result.stats.totalSize += apiReference.content.length;
            }

            // Generate TypeScript type definitions
            if (this.config.includeTypeDefinitions) {
                const typeDefinitions = await this.generateTypeDefinitions(apiCollection, tools);
                result.documentation.push(typeDefinitions);
                result.stats.typeDefinitionsGenerated = true;
                result.stats.filesGenerated++;
                result.stats.totalSize += typeDefinitions.content.length;
            }

            // Generate inline code documentation
            if (this.config.includeInlineComments) {
                const inlineComments = await this.generateInlineComments(apiCollection, tools);
                result.documentation.push(inlineComments);
                result.stats.inlineCommentsGenerated = true;
                result.stats.filesGenerated++;
                result.stats.totalSize += inlineComments.content.length;
            }

            // Generate examples documentation
            if (this.config.includeExamples) {
                const examples = await this.generateExamples(apiCollection, tools);
                result.documentation.push(...examples);
                result.stats.examplesGenerated = examples.length;
                result.stats.filesGenerated += examples.length;
                result.stats.totalSize += examples.reduce((sum, ex) => sum + ex.content.length, 0);
            }

            this.log('Documentation generation completed', {
                filesGenerated: result.stats.filesGenerated,
                totalSize: result.stats.totalSize,
                hasErrors: result.errors.length > 0,
            });

            return result;

        } catch (error) {
            const errorMessage = `Documentation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMessage);
            this.log('Documentation generation failed', error);
            return result;
        }
    }

    /**
     * Generate README documentation with usage instructions and examples
     */
    async generateREADME(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[],
        templateContext: TemplateContext
    ): Promise<GeneratedDocumentation> {
        this.log('Generating README documentation');

        try {
            let content: string;

            // Use template engine if available, otherwise generate manually
            if (this.templateEngine) {
                try {
                    content = await this.templateEngine.renderTemplate('docs/README.md.hbs', templateContext);
                } catch (templateError) {
                    // Fall back to manual generation if template is not found
                    this.log('Template not found, falling back to manual generation', templateError);
                    content = this.generateREADMEContent(apiCollection, tools, templateContext);
                }
            } else {
                content = this.generateREADMEContent(apiCollection, tools, templateContext);
            }

            return {
                path: 'README.md',
                content,
                type: 'readme',
                format: 'markdown',
            };

        } catch (error) {
            throw new Error(`Failed to generate README: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate README content manually (fallback when no template is available)
     */
    private generateREADMEContent(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[],
        templateContext: TemplateContext
    ): string {
        const sections: string[] = [];

        // Title and description
        sections.push(`# ${templateContext.server.name}`);
        sections.push('');
        sections.push(templateContext.server.description || `MCP server for ${apiCollection.name}`);
        sections.push('');

        // Table of contents
        if (this.config.includeTableOfContents) {
            sections.push('## Table of Contents');
            sections.push('');
            sections.push('- [Overview](#overview)');
            if (this.config.includeInstallation) {
                sections.push('- [Installation](#installation)');
                sections.push('- [Usage](#usage)');
            }
            sections.push('- [Available Tools](#available-tools)');
            if (this.config.includeAPIReference) {
                sections.push('- [API Endpoints](#api-endpoints)');
            }
            sections.push('- [Configuration](#configuration)');
            if (this.config.includeDevelopmentSetup) {
                sections.push('- [Development](#development)');
            }
            sections.push('');
        }

        // Overview
        sections.push('## Overview');
        sections.push('');
        sections.push('This MCP server provides HTTP API calling capabilities through the Model Context Protocol. It was generated automatically from API specifications and includes the following tools:');
        sections.push('');
        tools.forEach(tool => {
            sections.push(`- **${tool.name}**: ${tool.description}`);
        });
        sections.push('');

        // Installation
        if (this.config.includeInstallation) {
            sections.push('## Installation');
            sections.push('');
            sections.push('```bash');
            sections.push(`npm install ${templateContext.server.packageName}`);
            sections.push('```');
            sections.push('');

            // Usage
            sections.push('## Usage');
            sections.push('');
            sections.push('### As an MCP Server');
            sections.push('');
            sections.push('Add this server to your MCP client configuration:');
            sections.push('');
            sections.push('```json');
            sections.push('{');
            sections.push('  "mcpServers": {');
            sections.push(`    "${this.kebabCase(templateContext.server.name)}": {`);
            sections.push(`      "command": "${this.kebabCase(templateContext.server.name)}",`);
            sections.push('      "args": []');
            sections.push('    }');
            sections.push('  }');
            sections.push('}');
            sections.push('```');
            sections.push('');

            // Environment variables
            sections.push('### Environment Variables');
            sections.push('');
            sections.push('- `DEBUG`: Enable debug logging (true/false)');
            sections.push(`- \`API_TIMEOUT\`: Request timeout in milliseconds (default: ${templateContext.configuration.timeout})`);
            sections.push('- `ALLOW_LOCALHOST`: Allow localhost requests (true/false)');
            sections.push('- `ALLOW_PRIVATE_IPS`: Allow private IP requests (true/false)');
            sections.push(`- \`MAX_RESPONSE_LENGTH\`: Maximum response length in bytes (default: ${templateContext.configuration.maxResponseLength})`);
            sections.push(`- \`USER_AGENT\`: Custom user agent string (default: ${templateContext.configuration.userAgent})`);
            sections.push('');
        }

        // Available tools
        sections.push('## Available Tools');
        sections.push('');
        tools.forEach(tool => {
            sections.push(`### ${tool.name}`);
            sections.push('');
            sections.push(tool.description);
            sections.push('');

            if (tool.inputSchema && tool.inputSchema.properties) {
                sections.push('**Parameters:**');
                const properties = tool.inputSchema.properties;
                const required = tool.inputSchema.required || [];

                Object.entries(properties).forEach(([name, schema]: [string, any]) => {
                    const isRequired = required.includes(name);
                    const typeStr = this.getTypeFromSchema(schema);
                    const description = schema.description || 'No description available';
                    sections.push(`- \`${name}\` (${typeStr}${isRequired ? '' : ', optional'}): ${description}`);
                });
                sections.push('');
            }

            // Example usage
            if (this.config.includeExamples) {
                sections.push('**Example:**');
                sections.push('```json');
                sections.push('{');
                sections.push(`  "name": "${tool.name}",`);
                sections.push('  "arguments": {');

                if (tool.inputSchema && tool.inputSchema.properties) {
                    const properties = tool.inputSchema.properties;
                    const required = tool.inputSchema.required || [];
                    const requiredProps = Object.entries(properties).filter(([name]) => required.includes(name));

                    requiredProps.forEach(([name, schema]: [string, any], index) => {
                        const example = this.generateExampleValue(schema);
                        const comma = index < requiredProps.length - 1 ? ',' : '';
                        sections.push(`    "${name}": ${JSON.stringify(example)}${comma}`);
                    });
                }

                sections.push('  }');
                sections.push('}');
                sections.push('```');
                sections.push('');
            }
        });

        // API endpoints
        if (this.config.includeAPIReference && apiCollection.apis.length > 0) {
            sections.push('## API Endpoints');
            sections.push('');
            sections.push('This server provides access to the following API endpoints:');
            sections.push('');

            apiCollection.apis.forEach(api => {
                sections.push(`### ${api.name}`);
                sections.push('');
                if (api.description) {
                    sections.push(api.description);
                } else {
                    sections.push('No description available');
                }
                sections.push('');
                sections.push(`- **Method**: ${api.method}`);
                sections.push(`- **URL**: \`${api.url}\``);

                if (api.headers && Object.keys(api.headers).length > 0) {
                    sections.push('- **Headers**:');
                    Object.entries(api.headers).forEach(([key, value]) => {
                        sections.push(`  - \`${key}\`: ${value}`);
                    });
                }

                if (api.parameters && api.parameters.length > 0) {
                    sections.push('- **Parameters**:');
                    api.parameters.forEach(param => {
                        const requiredStr = param.required ? '' : ', optional';
                        const description = param.description || 'No description available';
                        sections.push(`  - \`${param.name}\` (${param.type}, ${param.location}${requiredStr}): ${description}`);
                    });
                }
                sections.push('');
            });
        }

        // Configuration
        sections.push('## Configuration');
        sections.push('');
        sections.push('The server can be configured through environment variables or command line arguments. See the usage section above for available options.');
        sections.push('');

        // Error handling
        sections.push('## Error Handling');
        sections.push('');
        sections.push('The server includes comprehensive error handling for:');
        sections.push('');
        sections.push('- Network connectivity issues');
        sections.push('- Invalid API responses');
        sections.push('- Request validation failures');
        sections.push('- Rate limiting and timeouts');
        sections.push('');
        sections.push('All errors are returned in a structured format with helpful error messages.');
        sections.push('');

        // Development
        if (this.config.includeDevelopmentSetup) {
            sections.push('## Development');
            sections.push('');
            sections.push('### Building');
            sections.push('');
            sections.push('```bash');
            sections.push('npm run build');
            sections.push('```');
            sections.push('');
            sections.push('### Running in Development Mode');
            sections.push('');
            sections.push('```bash');
            sections.push('npm run dev');
            sections.push('```');
            sections.push('');
            sections.push('### Testing');
            sections.push('');
            sections.push('```bash');
            sections.push('npm test');
            sections.push('```');
            sections.push('');
        }

        // Generated information
        sections.push('## Generated Information');
        sections.push('');
        sections.push(`- **Generated at**: ${templateContext.metadata.generatedAt}`);
        sections.push(`- **Generated by**: ${templateContext.metadata.generatedBy}`);
        sections.push(`- **Version**: ${templateContext.metadata.version}`);
        if (templateContext.metadata.sourceFile) {
            sections.push(`- **Source file**: ${templateContext.metadata.sourceFile}`);
        }
        sections.push('');

        // License
        sections.push('## License');
        sections.push('');
        sections.push(templateContext.server.license || 'MIT');

        return sections.join('\n');
    }
    /**
      * Generate API reference documentation from extracted specifications
      */
    async generateAPIReference(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[]
    ): Promise<GeneratedDocumentation> {
        this.log('Generating API reference documentation');

        try {
            const apiDocs = this.buildAPIDocumentation(apiCollection.apis);
            const content = this.generateAPIReferenceContent(apiDocs, apiCollection);

            return {
                path: 'docs/api-reference.md',
                content,
                type: 'api-reference',
                format: 'markdown',
            };

        } catch (error) {
            throw new Error(`Failed to generate API reference: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build API documentation structure from API specifications
     */
    private buildAPIDocumentation(apis: APISpec[]): APIDocumentation[] {
        return apis.map(api => ({
            name: api.name,
            description: api.description,
            method: api.method,
            url: api.url,
            headers: api.headers,
            parameters: api.parameters,
            examples: api.examples ? api.examples.map(ex => ({
                name: ex.name || 'Example',
                description: ex.description,
                request: ex.request,
                response: ex.response,
                curlCommand: this.generateCurlCommand(ex.request),
            })) : [],
            responses: this.generateResponseDocumentation(api),
            authentication: this.detectAuthentication(api.headers),
            notes: this.generateAPINotes(api),
        }));
    }

    /**
     * Generate API reference content
     */
    private generateAPIReferenceContent(apiDocs: APIDocumentation[], apiCollection: ParsedAPICollection): string {
        const sections: string[] = [];

        // Title
        sections.push(`# ${apiCollection.name} API Reference`);
        sections.push('');
        if (apiCollection.description) {
            sections.push(apiCollection.description);
            sections.push('');
        }

        // Base URL
        if (apiCollection.baseUrl) {
            sections.push(`**Base URL**: \`${apiCollection.baseUrl}\``);
            sections.push('');
        }

        // Table of contents
        if (this.config.includeTableOfContents) {
            sections.push('## Table of Contents');
            sections.push('');
            apiDocs.forEach(api => {
                const anchor = this.generateAnchor(api.name);
                sections.push(`- [${api.name}](#${anchor})`);
            });
            sections.push('');
        }

        // API endpoints
        sections.push('## API Endpoints');
        sections.push('');

        apiDocs.forEach((api, index) => {
            if (index > 0) sections.push('---');
            sections.push('');

            // Endpoint title
            sections.push(`### ${api.name}`);
            sections.push('');

            // Description
            if (api.description) {
                sections.push(api.description);
                sections.push('');
            }

            // Method and URL
            sections.push('**Request**');
            sections.push('');
            sections.push(`\`${api.method} ${api.url}\``);
            sections.push('');

            // Authentication
            if (api.authentication) {
                sections.push('**Authentication**');
                sections.push('');
                sections.push(api.authentication);
                sections.push('');
            }

            // Headers
            if (api.headers && Object.keys(api.headers).length > 0) {
                sections.push('**Headers**');
                sections.push('');
                sections.push('| Header | Value | Required |');
                sections.push('|--------|-------|----------|');
                Object.entries(api.headers).forEach(([key, value]) => {
                    const required = this.isRequiredHeader(key) ? 'Yes' : 'No';
                    sections.push(`| \`${key}\` | \`${value}\` | ${required} |`);
                });
                sections.push('');
            }

            // Parameters
            if (api.parameters && api.parameters.length > 0) {
                sections.push('**Parameters**');
                sections.push('');
                sections.push('| Name | Type | Location | Required | Description |');
                sections.push('|------|------|----------|----------|-------------|');
                api.parameters.forEach(param => {
                    const required = param.required ? 'Yes' : 'No';
                    const description = param.description || 'No description';
                    sections.push(`| \`${param.name}\` | ${param.type} | ${param.location} | ${required} | ${description} |`);
                });
                sections.push('');
            }

            // Examples
            if (api.examples && api.examples.length > 0) {
                sections.push('**Examples**');
                sections.push('');

                api.examples.forEach((example, exIndex) => {
                    if (exIndex > 0) sections.push('');

                    sections.push(`**${example.name}**`);
                    sections.push('');

                    if (example.description) {
                        sections.push(example.description);
                        sections.push('');
                    }

                    // cURL command
                    if (example.curlCommand) {
                        sections.push('*cURL:*');
                        sections.push('```bash');
                        sections.push(example.curlCommand);
                        sections.push('```');
                        sections.push('');
                    }

                    // Request
                    sections.push('*Request:*');
                    sections.push('```http');
                    sections.push(`${example.request.method} ${example.request.url}`);
                    if (example.request.headers) {
                        Object.entries(example.request.headers).forEach(([key, value]) => {
                            sections.push(`${key}: ${value}`);
                        });
                    }
                    if (example.request.body) {
                        sections.push('');
                        sections.push(typeof example.request.body === 'string'
                            ? example.request.body
                            : JSON.stringify(example.request.body, null, 2));
                    }
                    sections.push('```');
                    sections.push('');

                    // Response
                    if (example.response) {
                        sections.push('*Response:*');
                        sections.push('```http');
                        sections.push(`HTTP/1.1 ${example.response.status}`);
                        if (example.response.headers) {
                            Object.entries(example.response.headers).forEach(([key, value]) => {
                                sections.push(`${key}: ${value}`);
                            });
                        }
                        if (example.response.body) {
                            sections.push('');
                            sections.push(typeof example.response.body === 'string'
                                ? example.response.body
                                : JSON.stringify(example.response.body, null, 2));
                        }
                        sections.push('```');
                        sections.push('');
                    }
                });
            }

            // Responses
            if (api.responses && api.responses.length > 0) {
                sections.push('**Responses**');
                sections.push('');
                sections.push('| Status | Description |');
                sections.push('|--------|-------------|');
                api.responses.forEach(response => {
                    sections.push(`| ${response.status} | ${response.description} |`);
                });
                sections.push('');
            }

            // Notes
            if (api.notes && api.notes.length > 0) {
                sections.push('**Notes**');
                sections.push('');
                api.notes.forEach(note => {
                    sections.push(`- ${note}`);
                });
                sections.push('');
            }
        });

        return sections.join('\n');
    }

    /**
     * Generate TypeScript type definitions
     */
    async generateTypeDefinitions(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[]
    ): Promise<GeneratedDocumentation> {
        this.log('Generating TypeScript type definitions');

        try {
            const typeDefinitions = this.buildTypeDefinitions(apiCollection, tools);
            const content = this.generateTypeDefinitionsContent(typeDefinitions);

            return {
                path: 'types/generated.d.ts',
                content,
                type: 'type-definitions',
                format: 'typescript',
            };

        } catch (error) {
            throw new Error(`Failed to generate type definitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build TypeScript type definitions
     */
    private buildTypeDefinitions(apiCollection: ParsedAPICollection, tools: GeneratedMCPTool[]): TypeDefinition[] {
        const definitions: TypeDefinition[] = [];

        // Generate API request/response types
        apiCollection.apis.forEach(api => {
            // Request type
            if (api.parameters && api.parameters.length > 0) {
                const requestTypeName = `${this.pascalCase(api.name)}Request`;
                const properties = api.parameters.map(param => ({
                    name: param.name,
                    type: this.mapParameterTypeToTypeScript(param.type),
                    optional: !param.required,
                    description: param.description,
                    example: param.example,
                }));

                definitions.push({
                    name: requestTypeName,
                    type: 'interface',
                    definition: this.generateInterfaceDefinition(requestTypeName, properties),
                    description: `Request parameters for ${api.name} API`,
                    properties,
                });
            }

            // Response type (generic for now)
            const responseTypeName = `${this.pascalCase(api.name)}Response`;
            definitions.push({
                name: responseTypeName,
                type: 'interface',
                definition: this.generateResponseInterfaceDefinition(responseTypeName),
                description: `Response type for ${api.name} API`,
            });
        });

        // Generate tool parameter types
        tools.forEach(tool => {
            if (tool.inputSchema && tool.inputSchema.properties) {
                const toolTypeName = `${this.pascalCase(tool.name)}Params`;
                const properties = Object.entries(tool.inputSchema.properties).map(([name, schema]: [string, any]) => ({
                    name,
                    type: this.getTypeFromSchema(schema),
                    optional: !(tool.inputSchema.required || []).includes(name),
                    description: schema.description,
                    example: schema.example,
                }));

                definitions.push({
                    name: toolTypeName,
                    type: 'interface',
                    definition: this.generateInterfaceDefinition(toolTypeName, properties),
                    description: `Parameters for ${tool.name} tool`,
                    properties,
                });
            }
        });

        // Generate common types
        definitions.push({
            name: 'HTTPMethod',
            type: 'type',
            definition: "export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';",
            description: 'Supported HTTP methods',
        });

        definitions.push({
            name: 'APIError',
            type: 'interface',
            definition: this.generateAPIErrorInterface(),
            description: 'Standard API error response',
        });

        return definitions;
    }

    /**
     * Generate type definitions content
     */
    private generateTypeDefinitionsContent(definitions: TypeDefinition[]): string {
        const sections: string[] = [];

        // Header
        sections.push('/**');
        sections.push(' * Generated TypeScript type definitions');
        sections.push(' * This file contains type definitions for the MCP server API');
        sections.push(' * Generated automatically - do not edit manually');
        sections.push(' */');
        sections.push('');

        // Imports
        sections.push("import { JSONSchema } from '@modelcontextprotocol/sdk/types.js';");
        sections.push('');

        // Type definitions
        definitions.forEach((def, index) => {
            if (index > 0) sections.push('');

            // JSDoc comment
            sections.push('/**');
            if (def.description) {
                sections.push(` * ${def.description}`);
            }
            if (def.examples && def.examples.length > 0) {
                sections.push(' * @example');
                def.examples.forEach(example => {
                    sections.push(` * ${example}`);
                });
            }
            sections.push(' */');

            // Type definition
            sections.push(def.definition);
        });

        return sections.join('\n');
    }

    /**
     * Generate inline code documentation
     */
    async generateInlineComments(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[]
    ): Promise<GeneratedDocumentation> {
        this.log('Generating inline code documentation');

        try {
            const comments = this.buildInlineComments(apiCollection, tools);
            const content = this.generateInlineCommentsContent(comments);

            return {
                path: 'docs/inline-comments.md',
                content,
                type: 'inline-comments',
                format: 'markdown',
            };

        } catch (error) {
            throw new Error(`Failed to generate inline comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build inline comments structure
     */
    private buildInlineComments(apiCollection: ParsedAPICollection, tools: GeneratedMCPTool[]): Record<string, string[]> {
        const comments: Record<string, string[]> = {};

        // Tool handler comments
        tools.forEach(tool => {
            const functionName = `handle${this.pascalCase(tool.name)}`;
            comments[functionName] = [
                `/**`,
                ` * ${tool.description}`,
                ` * @param args - Tool arguments`,
                ` * @returns Promise<MCPToolResponse> - Tool response`,
                ` */`,
            ];
        });

        // API client comments
        apiCollection.apis.forEach(api => {
            const methodName = `${api.method.toLowerCase()}${this.pascalCase(api.name)}`;
            comments[methodName] = [
                `/**`,
                ` * ${api.description || `Call ${api.name} API endpoint`}`,
                ` * @param url - API endpoint URL`,
                ` * @param options - Request options`,
                ` * @returns Promise<APIResponse> - API response`,
                ` */`,
            ];
        });

        // Validation comments
        tools.forEach(tool => {
            const validatorName = `validate${this.pascalCase(tool.name)}Params`;
            comments[validatorName] = [
                `/**`,
                ` * Validate parameters for ${tool.name} tool`,
                ` * @param params - Parameters to validate`,
                ` * @throws {ValidationError} When validation fails`,
                ` */`,
            ];
        });

        return comments;
    }

    /**
     * Generate inline comments content
     */
    private generateInlineCommentsContent(comments: Record<string, string[]>): string {
        const sections: string[] = [];

        sections.push('# Inline Code Documentation');
        sections.push('');
        sections.push('This document contains JSDoc comments that should be added to the generated code files.');
        sections.push('');

        Object.entries(comments).forEach(([functionName, commentLines]) => {
            sections.push(`## ${functionName}`);
            sections.push('');
            sections.push('```typescript');
            sections.push(...commentLines);
            sections.push('```');
            sections.push('');
        });

        return sections.join('\n');
    }

    /**
     * Generate examples documentation
     */
    async generateExamples(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[]
    ): Promise<GeneratedDocumentation[]> {
        this.log('Generating examples documentation');

        const examples: GeneratedDocumentation[] = [];

        try {
            // Generate tool usage examples
            const toolExamples = await this.generateToolExamples(tools);
            examples.push(toolExamples);

            // Generate API usage examples
            const apiExamples = await this.generateAPIExamples(apiCollection);
            examples.push(apiExamples);

            // Generate integration examples
            const integrationExamples = await this.generateIntegrationExamples(apiCollection, tools);
            examples.push(integrationExamples);

            return examples;

        } catch (error) {
            throw new Error(`Failed to generate examples: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate tool usage examples
     */
    private async generateToolExamples(tools: GeneratedMCPTool[]): Promise<GeneratedDocumentation> {
        const sections: string[] = [];

        sections.push('# Tool Usage Examples');
        sections.push('');
        sections.push('This document provides examples of how to use each generated MCP tool.');
        sections.push('');

        tools.forEach(tool => {
            sections.push(`## ${tool.name}`);
            sections.push('');
            sections.push(tool.description);
            sections.push('');

            // Basic usage
            sections.push('### Basic Usage');
            sections.push('');
            sections.push('```json');
            sections.push('{');
            sections.push(`  "name": "${tool.name}",`);
            sections.push('  "arguments": {');

            if (tool.inputSchema && tool.inputSchema.properties) {
                const properties = tool.inputSchema.properties;
                const required = tool.inputSchema.required || [];
                const requiredProps = Object.entries(properties).filter(([name]) => required.includes(name));

                requiredProps.forEach(([name, schema]: [string, any], index) => {
                    const example = this.generateExampleValue(schema);
                    const comma = index < requiredProps.length - 1 ? ',' : '';
                    sections.push(`    "${name}": ${JSON.stringify(example)}${comma}`);
                });
            }

            sections.push('  }');
            sections.push('}');
            sections.push('```');
            sections.push('');

            // Advanced usage with all parameters
            if (tool.inputSchema && tool.inputSchema.properties) {
                const allProps = Object.entries(tool.inputSchema.properties);
                if (allProps.length > (tool.inputSchema.required || []).length) {
                    sections.push('### Advanced Usage (All Parameters)');
                    sections.push('');
                    sections.push('```json');
                    sections.push('{');
                    sections.push(`  "name": "${tool.name}",`);
                    sections.push('  "arguments": {');

                    allProps.forEach(([name, schema]: [string, any], index) => {
                        const example = this.generateExampleValue(schema);
                        const comma = index < allProps.length - 1 ? ',' : '';
                        sections.push(`    "${name}": ${JSON.stringify(example)}${comma}`);
                    });

                    sections.push('  }');
                    sections.push('}');
                    sections.push('```');
                    sections.push('');
                }
            }
        });

        return {
            path: 'examples/tool-usage.md',
            content: sections.join('\n'),
            type: 'examples',
            format: 'markdown',
        };
    }

    /**
     * Generate API usage examples
     */
    private async generateAPIExamples(apiCollection: ParsedAPICollection): Promise<GeneratedDocumentation> {
        const sections: string[] = [];

        sections.push('# API Usage Examples');
        sections.push('');
        sections.push('This document provides examples of direct API usage.');
        sections.push('');

        apiCollection.apis.forEach(api => {
            sections.push(`## ${api.name}`);
            sections.push('');
            if (api.description) {
                sections.push(api.description);
                sections.push('');
            }

            // cURL example
            sections.push('### cURL Example');
            sections.push('');
            sections.push('```bash');
            const curlCommand = this.generateCurlCommandFromAPI(api);
            sections.push(curlCommand);
            sections.push('```');
            sections.push('');

            // JavaScript example
            sections.push('### JavaScript Example');
            sections.push('');
            sections.push('```javascript');
            sections.push('const response = await fetch(');
            sections.push(`  '${api.url}',`);
            sections.push('  {');
            sections.push(`    method: '${api.method}',`);

            if (api.headers && Object.keys(api.headers).length > 0) {
                sections.push('    headers: {');
                Object.entries(api.headers).forEach(([key, value], index, arr) => {
                    const comma = index < arr.length - 1 ? ',' : '';
                    sections.push(`      '${key}': '${value}'${comma}`);
                });
                sections.push('    },');
            }

            if (api.body && (api.method === 'POST' || api.method === 'PUT')) {
                sections.push('    body: JSON.stringify({');
                if (typeof api.body === 'object') {
                    Object.entries(api.body).forEach(([key, value], index, arr) => {
                        const comma = index < arr.length - 1 ? ',' : '';
                        sections.push(`      ${key}: ${JSON.stringify(value)}${comma}`);
                    });
                }
                sections.push('    })');
            }

            sections.push('  }');
            sections.push(');');
            sections.push('');
            sections.push('const data = await response.json();');
            sections.push('console.log(data);');
            sections.push('```');
            sections.push('');
        });

        return {
            path: 'examples/api-usage.md',
            content: sections.join('\n'),
            type: 'examples',
            format: 'markdown',
        };
    }

    /**
     * Generate integration examples
     */
    private async generateIntegrationExamples(
        apiCollection: ParsedAPICollection,
        tools: GeneratedMCPTool[]
    ): Promise<GeneratedDocumentation> {
        const sections: string[] = [];

        sections.push('# Integration Examples');
        sections.push('');
        sections.push('This document provides examples of integrating the MCP server with various clients.');
        sections.push('');

        // Claude Desktop integration
        sections.push('## Claude Desktop Integration');
        sections.push('');
        sections.push('Add the following configuration to your Claude Desktop config file:');
        sections.push('');
        sections.push('```json');
        sections.push('{');
        sections.push('  "mcpServers": {');
        sections.push(`    "${this.kebabCase(apiCollection.name)}": {`);
        sections.push(`      "command": "node",`);
        sections.push(`      "args": ["path/to/your/server/dist/index.js"]`);
        sections.push('    }');
        sections.push('  }');
        sections.push('}');
        sections.push('```');
        sections.push('');

        // Node.js integration
        sections.push('## Node.js Integration');
        sections.push('');
        sections.push('```javascript');
        sections.push("const { Client } = require('@modelcontextprotocol/sdk/client/index.js');");
        sections.push("const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');");
        sections.push('');
        sections.push('async function main() {');
        sections.push('  const transport = new StdioClientTransport({');
        sections.push("    command: 'node',");
        sections.push("    args: ['dist/index.js']");
        sections.push('  });');
        sections.push('');
        sections.push('  const client = new Client({');
        sections.push("    name: 'example-client',");
        sections.push("    version: '1.0.0'");
        sections.push('  }, {');
        sections.push('    capabilities: {}');
        sections.push('  });');
        sections.push('');
        sections.push('  await client.connect(transport);');
        sections.push('');
        sections.push('  // List available tools');
        sections.push('  const tools = await client.listTools();');
        sections.push('  console.log("Available tools:", tools);');
        sections.push('');
        sections.push('  // Call a tool');
        if (tools.length > 0) {
            const firstTool = tools[0];
            sections.push(`  const result = await client.callTool({`);
            sections.push(`    name: '${firstTool.name}',`);
            sections.push('    arguments: {');

            if (firstTool.inputSchema && firstTool.inputSchema.properties) {
                const properties = firstTool.inputSchema.properties;
                const required = firstTool.inputSchema.required || [];
                const requiredProps = Object.entries(properties).filter(([name]) => required.includes(name));

                requiredProps.forEach(([name, schema]: [string, any], index) => {
                    const example = this.generateExampleValue(schema);
                    const comma = index < requiredProps.length - 1 ? ',' : '';
                    sections.push(`      ${name}: ${JSON.stringify(example)}${comma}`);
                });
            }

            sections.push('    }');
            sections.push('  });');
            sections.push('');
            sections.push('  console.log("Tool result:", result);');
        }
        sections.push('');
        sections.push('  await client.close();');
        sections.push('}');
        sections.push('');
        sections.push('main().catch(console.error);');
        sections.push('```');
        sections.push('');

        // Python integration
        sections.push('## Python Integration');
        sections.push('');
        sections.push('```python');
        sections.push('import asyncio');
        sections.push('from mcp import ClientSession, StdioServerParameters');
        sections.push('from mcp.client.stdio import stdio_client');
        sections.push('');
        sections.push('async def main():');
        sections.push('    server_params = StdioServerParameters(');
        sections.push("        command='node',");
        sections.push("        args=['dist/index.js']");
        sections.push('    )');
        sections.push('');
        sections.push('    async with stdio_client(server_params) as (read, write):');
        sections.push('        async with ClientSession(read, write) as session:');
        sections.push('            # Initialize the client');
        sections.push('            await session.initialize()');
        sections.push('');
        sections.push('            # List available tools');
        sections.push('            tools = await session.list_tools()');
        sections.push('            print("Available tools:", [tool.name for tool in tools.tools])');
        sections.push('');
        sections.push('            # Call a tool');
        if (tools.length > 0) {
            const firstTool = tools[0];
            sections.push(`            result = await session.call_tool('${firstTool.name}', {`);

            if (firstTool.inputSchema && firstTool.inputSchema.properties) {
                const properties = firstTool.inputSchema.properties;
                const required = firstTool.inputSchema.required || [];
                const requiredProps = Object.entries(properties).filter(([name]) => required.includes(name));

                requiredProps.forEach(([name, schema]: [string, any], index) => {
                    const example = this.generateExampleValue(schema);
                    const comma = index < requiredProps.length - 1 ? ',' : '';
                    sections.push(`                '${name}': ${JSON.stringify(example)}${comma}`);
                });
            }

            sections.push('            })');
            sections.push('');
            sections.push('            print("Tool result:", result)');
        }
        sections.push('');
        sections.push('if __name__ == "__main__":');
        sections.push('    asyncio.run(main())');
        sections.push('```');

        return {
            path: 'examples/integration.md',
            content: sections.join('\n'),
            type: 'examples',
            format: 'markdown',
        };
    }

    // =============================================================================
    // Utility Methods
    // =============================================================================

    /**
     * Generate curl command from API request
     */
    private generateCurlCommand(request: { url: string; method: string; headers?: Record<string, string>; body?: any }): string {
        const parts = ['curl'];

        // Method
        if (request.method !== 'GET') {
            parts.push(`-X ${request.method}`);
        }

        // Headers
        if (request.headers) {
            Object.entries(request.headers).forEach(([key, value]) => {
                parts.push(`-H "${key}: ${value}"`);
            });
        }

        // Body
        if (request.body && (request.method === 'POST' || request.method === 'PUT')) {
            const bodyStr = typeof request.body === 'string'
                ? request.body
                : JSON.stringify(request.body);
            parts.push(`-d '${bodyStr}'`);
        }

        // URL
        parts.push(`"${request.url}"`);

        return parts.join(' \\\n  ');
    }

    /**
     * Generate curl command from API specification
     */
    private generateCurlCommandFromAPI(api: APISpec): string {
        const parts = ['curl'];

        // Method
        if (api.method !== 'GET') {
            parts.push(`-X ${api.method}`);
        }

        // Headers
        if (api.headers) {
            Object.entries(api.headers).forEach(([key, value]) => {
                parts.push(`-H "${key}: ${value}"`);
            });
        }

        // Body
        if (api.body && (api.method === 'POST' || api.method === 'PUT')) {
            const bodyStr = typeof api.body === 'string'
                ? api.body
                : JSON.stringify(api.body);
            parts.push(`-d '${bodyStr}'`);
        }

        // URL
        parts.push(`"${api.url}"`);

        return parts.join(' \\\n  ');
    }

    /**
     * Generate response documentation
     */
    private generateResponseDocumentation(api: APISpec): APIDocumentationResponse[] {
        const responses: APIDocumentationResponse[] = [];

        // Default success response
        const successStatus = api.method === 'POST' ? 201 : 200;
        responses.push({
            status: successStatus,
            description: `Successful ${api.method} request`,
        });

        // Common error responses
        responses.push(
            { status: 400, description: 'Bad Request - Invalid parameters' },
            { status: 401, description: 'Unauthorized - Authentication required' },
            { status: 403, description: 'Forbidden - Insufficient permissions' },
            { status: 404, description: 'Not Found - Resource not found' },
            { status: 500, description: 'Internal Server Error' }
        );

        return responses;
    }

    /**
     * Detect authentication from headers
     */
    private detectAuthentication(headers?: Record<string, string>): string | undefined {
        if (!headers) return undefined;

        const authHeader = Object.keys(headers).find(key =>
            key.toLowerCase() === 'authorization'
        );

        if (authHeader) {
            const value = headers[authHeader];
            if (value.startsWith('Bearer ')) {
                return 'Bearer token authentication required';
            } else if (value.startsWith('Basic ')) {
                return 'Basic authentication required';
            } else {
                return 'Custom authentication required';
            }
        }

        // Check for API key in headers
        const apiKeyHeaders = ['x-api-key', 'api-key', 'apikey'];
        const apiKeyHeader = Object.keys(headers).find(key =>
            apiKeyHeaders.includes(key.toLowerCase())
        );

        if (apiKeyHeader) {
            return `API key required in ${apiKeyHeader} header`;
        }

        return undefined;
    }

    /**
     * Generate API notes
     */
    private generateAPINotes(api: APISpec): string[] {
        const notes: string[] = [];

        // Rate limiting note
        notes.push('This endpoint may be subject to rate limiting');

        // Authentication note
        if (api.headers && this.detectAuthentication(api.headers)) {
            notes.push('Authentication is required for this endpoint');
        }

        // Parameter validation note
        if (api.parameters && api.parameters.some(p => p.required)) {
            notes.push('All required parameters must be provided');
        }

        return notes;
    }

    /**
     * Check if header is required
     */
    private isRequiredHeader(headerName: string): boolean {
        const requiredHeaders = ['authorization', 'content-type', 'x-api-key', 'api-key'];
        return requiredHeaders.includes(headerName.toLowerCase());
    }

    /**
     * Generate anchor for markdown links
     */
    private generateAnchor(text: string): string {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Map parameter type to TypeScript type
     */
    private mapParameterTypeToTypeScript(type: string): string {
        switch (type) {
            case 'string':
                return 'string';
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'object':
                return 'Record<string, any>';
            case 'array':
                return 'any[]';
            default:
                return 'any';
        }
    }

    /**
     * Generate interface definition
     */
    private generateInterfaceDefinition(name: string, properties: TypeProperty[]): string {
        const lines = [`export interface ${name} {`];

        properties.forEach(prop => {
            if (prop.description) {
                lines.push(`  /** ${prop.description} */`);
            }
            const optional = prop.optional ? '?' : '';
            lines.push(`  ${prop.name}${optional}: ${prop.type};`);
        });

        lines.push('}');
        return lines.join('\n');
    }

    /**
     * Generate response interface definition
     */
    private generateResponseInterfaceDefinition(name: string): string {
        return [
            `export interface ${name} {`,
            '  /** Response status code */',
            '  status: number;',
            '  /** Response status text */',
            '  statusText: string;',
            '  /** Response headers */',
            '  headers: Record<string, string>;',
            '  /** Response data */',
            '  data: any;',
            '}',
        ].join('\n');
    }

    /**
     * Generate API error interface
     */
    private generateAPIErrorInterface(): string {
        return [
            'export interface APIError {',
            '  /** Error type */',
            '  type: "validation" | "network" | "http" | "parsing";',
            '  /** Error message */',
            '  message: string;',
            '  /** HTTP status code (if applicable) */',
            '  statusCode?: number;',
            '  /** Additional error details */',
            '  details?: any;',
            '}',
        ].join('\n');
    }

    /**
     * Get TypeScript type from JSON schema
     */
    private getTypeFromSchema(schema: any): string {
        if (!schema) return 'any';

        switch (schema.type) {
            case 'string':
                return 'string';
            case 'number':
            case 'integer':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'array':
                const itemType = schema.items ? this.getTypeFromSchema(schema.items) : 'any';
                return `${itemType}[]`;
            case 'object':
                if (schema.properties) {
                    const props = Object.entries(schema.properties)
                        .map(([key, value]: [string, any]) => `${key}: ${this.getTypeFromSchema(value)}`)
                        .join('; ');
                    return `{ ${props} }`;
                }
                return 'Record<string, any>';
            default:
                return 'any';
        }
    }

    /**
     * Generate example value from schema
     */
    private generateExampleValue(schema: any): any {
        if (schema.example !== undefined) {
            return schema.example;
        }

        switch (schema.type) {
            case 'string':
                return schema.format === 'uri' ? 'https://api.example.com/endpoint' : 'example-value';
            case 'number':
            case 'integer':
                return 123;
            case 'boolean':
                return true;
            case 'array':
                return [];
            case 'object':
                return {};
            default:
                return null;
        }
    }

    /**
     * Convert string to kebab-case
     */
    private kebabCase(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
    }

    /**
     * Convert string to PascalCase
     */
    private pascalCase(str: string): string {
        return str
            .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
            .replace(/^(.)/, (_, c) => c.toUpperCase());
    }

    /**
     * Log messages with optional debug filtering
     */
    private log(message: string, data?: any): void {
        if (this.config.debug) {
            const timestamp = new Date().toISOString();
            if (data !== undefined) {
                console.error(`[${timestamp}] DocumentationGenerator: ${message}`, data);
            } else {
                console.error(`[${timestamp}] DocumentationGenerator: ${message}`);
            }
        }
    }
}

/**
 * Create a documentation generator with default configuration
 */
export function createDocumentationGenerator(config: DocumentationGeneratorConfig = {}): DocumentationGenerator {
    return new DocumentationGenerator(config);
}