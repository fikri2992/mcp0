// Main code generator
export { CodeGenerator, CodeGeneratorConfig, GenerationResult, GeneratedFile } from './code-generator.js';

// Template engine
export { TemplateEngine, TemplateContext, TemplateEngineConfig } from './template-engine.js';

// File writer
export { 
  FileWriter, 
  FileWriterConfig, 
  FileWriteResult, 
  FileOperation, 
  FileWriteStats,
  createFileWriter 
} from './file-writer.js';

// Project scaffolder
export { 
  ProjectScaffolder, 
  ScaffoldingConfig, 
  ScaffoldingResult, 
  ProjectStructure, 
  PackageConfig, 
  ProjectMetadata,
  ScaffoldingStep,
  createProjectScaffolder,
  createStandardMCPStructure
} from './project-scaffolder.js';

// MCP tool generator
export { 
  MCPToolGenerator, 
  MCPToolGeneratorConfig, 
  GeneratedMCPTool, 
  ToolGenerationResult 
} from './mcp-tool-generator.js';

// Server generator
export { 
  ServerGenerator, 
  ServerGeneratorConfig, 
  GeneratedServer, 
  ServerGenerationResult,
  PackageDependency,
  ImportStatement,
  ExportStatement
} from './server-generator.js';

// Validation generator
export { 
  ValidationGenerator, 
  ValidationGeneratorConfig, 
  ValidationRule, 
  ValidationSchema, 
  RequestResponseValidation, 
  ValidationGenerationResult 
} from './validation-generator.js';

// Documentation generator
export {
  DocumentationGenerator,
  DocumentationGeneratorConfig,
  GeneratedDocumentation,
  DocumentationGenerationResult,
  APIDocumentation,
  APIDocumentationExample,
  APIDocumentationResponse,
  TypeDefinition,
  TypeProperty,
  TypeMethod,
  createDocumentationGenerator
} from './documentation-generator.js';

// Utility function
export { createTemplateContext } from './code-generator.js';