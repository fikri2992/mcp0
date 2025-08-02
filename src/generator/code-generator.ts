import * as fs from 'fs';
import * as path from 'path';
import { TemplateEngine, TemplateContext } from './template-engine.js';
import { MCPToolGenerator, GeneratedMCPTool, ToolGenerationResult } from './mcp-tool-generator.js';
import { ServerGenerator, GeneratedServer, ServerGenerationResult } from './server-generator.js';
import { ValidationGenerator, ValidationGenerationResult } from './validation-generator.js';
import { DocumentationGenerator, DocumentationGenerationResult, createDocumentationGenerator } from './documentation-generator.js';
import { FileWriter, FileWriteResult, createFileWriter } from './file-writer.js';
import { ProjectScaffolder, ScaffoldingResult, ProjectStructure, createProjectScaffolder, createStandardMCPStructure } from './project-scaffolder.js';
import { ParsedAPICollection } from '../parser/types.js';
import { ProgressInfo } from '../cli/cli-types.js';

/**
 * Configuration for code generation
 */
export interface CodeGeneratorConfig {
  /** Output directory for generated code */
  outputDir: string;
  /** Template directory (optional, uses default if not specified) */
  templateDir?: string;
  /** Custom template directories */
  customTemplateDirs?: string[];
  /** Enable debug logging */
  debug?: boolean;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Create backup of existing files */
  backup?: boolean;
  /** Initialize git repository */
  initGit?: boolean;
  /** Create example files */
  createExamples?: boolean;
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
  /** Server configuration */
  server?: {
    name: string;
    version?: string;
    description?: string;
    packageName?: string;
    author?: string;
    license?: string;
    repository?: string;
  };
  /** Tool generation configuration */
  toolGeneration?: {
    includeDescriptions?: boolean;
    strictValidation?: boolean;
    toolNamePrefix?: string;
  };
  /** Validation generation configuration */
  validationGeneration?: {
    strictValidation?: boolean;
    includeCustomErrors?: boolean;
    runtimeTypeChecking?: boolean;
  };
  /** Documentation generation configuration */
  documentationGeneration?: {
    includeInlineComments?: boolean;
    includeExamples?: boolean;
    includeAPIReference?: boolean;
    includeTypeDefinitions?: boolean;
    includeTableOfContents?: boolean;
    includeInstallation?: boolean;
    includeDevelopmentSetup?: boolean;
  };
}

/**
 * Generated file information
 */
export interface GeneratedFile {
  /** Relative path from output directory */
  path: string;
  /** File content */
  content: string;
  /** File type category */
  type: 'source' | 'test' | 'config' | 'documentation';
  /** Whether file was created or updated */
  action: 'created' | 'updated' | 'skipped';
}

/**
 * Code generation result
 */
export interface GenerationResult {
  /** List of generated files */
  files: GeneratedFile[];
  /** Generated server structure */
  server: GeneratedServer;
  /** Generated tools */
  tools: GeneratedMCPTool[];
  /** Validation generation result */
  validation: ValidationGenerationResult;
  /** Documentation generation result */
  documentation?: DocumentationGenerationResult;
  /** File write result */
  fileWriteResult?: FileWriteResult;
  /** Project scaffolding result */
  scaffoldingResult?: ScaffoldingResult;
  /** Generation statistics */
  stats: {
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    toolsGenerated: number;
    apisProcessed: number;
    validationRulesGenerated: number;
    directoriesCreated: number;
    totalSize: number;
  };
  /** Any errors that occurred during generation */
  errors: string[];
  /** Warnings from generation process */
  warnings: string[];
}

/**
 * Main code generator for MCP servers
 */
export class CodeGenerator {
  private templateEngine: TemplateEngine;
  private config: Required<Omit<CodeGeneratorConfig, 'onProgress'>> & { onProgress?: (progress: ProgressInfo) => void };
  private fileWriter: FileWriter;
  private projectScaffolder: ProjectScaffolder;

  private toolGenerator: MCPToolGenerator;
  private serverGenerator: ServerGenerator;
  private validationGenerator: ValidationGenerator;
  private documentationGenerator: DocumentationGenerator;

  constructor(config: CodeGeneratorConfig) {
    this.config = {
      outputDir: config.outputDir,
      templateDir: config.templateDir ?? path.join(__dirname, '../../templates'),
      customTemplateDirs: config.customTemplateDirs ?? [],
      debug: config.debug ?? false,
      overwrite: config.overwrite ?? false,
      backup: config.backup ?? true,
      initGit: config.initGit ?? false,
      createExamples: config.createExamples ?? false,
      onProgress: config.onProgress,
      server: config.server ?? { name: 'Generated MCP Server' },
      toolGeneration: config.toolGeneration ?? {},
      validationGeneration: config.validationGeneration ?? {},
      documentationGeneration: config.documentationGeneration ?? {},
    };

    // Initialize template engine
    this.templateEngine = new TemplateEngine({
      templateDir: this.config.templateDir,
      customTemplateDirs: this.config.customTemplateDirs,
      debug: this.config.debug,
    });

    // Initialize file writer
    this.fileWriter = createFileWriter({
      outputDir: this.config.outputDir,
      overwrite: this.config.overwrite,
      backup: this.config.backup,
      debug: this.config.debug,
      onProgress: this.config.onProgress,
    });

    // Initialize project scaffolder
    this.projectScaffolder = createProjectScaffolder({
      outputDir: this.config.outputDir,
      overwrite: this.config.overwrite,
      backup: this.config.backup,
      debug: this.config.debug,
      initGit: this.config.initGit,
      createExamples: this.config.createExamples,
      onProgress: this.config.onProgress,
    });

    // Initialize generators
    this.toolGenerator = new MCPToolGenerator({
      debug: this.config.debug,
      ...this.config.toolGeneration,
    });

    this.serverGenerator = new ServerGenerator({
      serverName: this.config.server.name,
      debug: this.config.debug,
      ...this.config.server,
    });

    this.validationGenerator = new ValidationGenerator({
      debug: this.config.debug,
      ...this.config.validationGeneration,
    });

    this.documentationGenerator = createDocumentationGenerator({
      debug: this.config.debug,
      templateDir: path.join(this.config.templateDir, 'docs'),
      ...this.config.documentationGeneration,
    });

    this.log('CodeGenerator initialized', {
      outputDir: this.config.outputDir,
      templateDir: this.config.templateDir,
      customTemplateDirs: this.config.customTemplateDirs,
    });
  }

  /**
   * Generate complete MCP server project with scaffolding
   */
  async generateProject(apiCollection: ParsedAPICollection): Promise<GenerationResult> {
    const result: GenerationResult = {
      files: [],
      server: {} as GeneratedServer,
      tools: [],
      validation: {} as ValidationGenerationResult,
      documentation: undefined,
      stats: { 
        created: 0, 
        updated: 0, 
        skipped: 0, 
        errors: 0,
        toolsGenerated: 0,
        apisProcessed: 0,
        validationRulesGenerated: 0,
        directoriesCreated: 0,
        totalSize: 0,
      },
      errors: [],
      warnings: [],
    };

    try {
      this.log('Starting complete MCP server project generation', {
        collectionName: apiCollection.name,
        apiCount: apiCollection.apis.length,
      });

      // Generate code components first
      const codeResult = await this.generateFromAPICollection(apiCollection);
      
      // Merge code generation results
      result.files = codeResult.files;
      result.server = codeResult.server;
      result.tools = codeResult.tools;
      result.validation = codeResult.validation;
      result.errors.push(...codeResult.errors);
      result.warnings.push(...codeResult.warnings);

      // Create project structure
      const projectStructure = createStandardMCPStructure(
        this.config.server.name,
        this.config.server.description
      );
      projectStructure.files = result.files;

      // Scaffold the complete project
      const scaffoldingResult = await this.projectScaffolder.scaffoldProject(projectStructure);
      result.scaffoldingResult = scaffoldingResult;

      // Merge scaffolding results
      result.stats.created = scaffoldingResult.fileWriteResult.stats.created;
      result.stats.updated = scaffoldingResult.fileWriteResult.stats.updated;
      result.stats.skipped = scaffoldingResult.fileWriteResult.stats.skipped;
      result.stats.directoriesCreated = scaffoldingResult.fileWriteResult.stats.directories_created;
      result.stats.totalSize = scaffoldingResult.fileWriteResult.stats.total_size;
      result.stats.errors += scaffoldingResult.fileWriteResult.stats.errors;
      result.errors.push(...scaffoldingResult.errors);
      result.warnings.push(...scaffoldingResult.warnings);

      this.log('Complete MCP server project generation completed', {
        success: scaffoldingResult.success,
        totalFiles: scaffoldingResult.metadata.totalFiles,
        totalDirectories: scaffoldingResult.metadata.totalDirectories,
        hasErrors: result.errors.length > 0,
      });

      return result;

    } catch (error) {
      const errorMessage = `Complete project generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      result.stats.errors++;
      this.log('Complete project generation failed', error);
      return result;
    }
  }

  /**
   * Generate complete MCP server code from API collection
   */
  async generateFromAPICollection(apiCollection: ParsedAPICollection): Promise<GenerationResult> {
    const result: GenerationResult = {
      files: [],
      server: {} as GeneratedServer,
      tools: [],
      validation: {} as ValidationGenerationResult,
      documentation: undefined,
      stats: { 
        created: 0, 
        updated: 0, 
        skipped: 0, 
        errors: 0,
        toolsGenerated: 0,
        apisProcessed: 0,
        validationRulesGenerated: 0,
        directoriesCreated: 0,
        totalSize: 0,
      },
      errors: [],
      warnings: [],
    };

    try {
      this.log('Starting MCP server generation from API collection', {
        collectionName: apiCollection.name,
        apiCount: apiCollection.apis.length,
      });

      // Generate tools from API specifications
      const toolResult = this.toolGenerator.generateTools(apiCollection.apis);
      result.tools = toolResult.tools;
      result.stats.toolsGenerated = toolResult.stats.toolsGenerated;
      result.stats.apisProcessed = toolResult.stats.totalAPIs;
      result.errors.push(...toolResult.errors);
      result.warnings.push(...toolResult.warnings);

      // Generate server structure
      const serverResult = this.serverGenerator.generateServer(apiCollection, result.tools);
      result.server = serverResult.server;
      result.warnings.push(...serverResult.warnings);

      // Generate validation logic
      const validationResult = this.validationGenerator.generateValidation(result.tools);
      result.validation = validationResult;
      result.stats.validationRulesGenerated = validationResult.stats.rulesGenerated;
      result.warnings.push(...validationResult.warnings);

      // Generate files using template context
      const templateContext = serverResult.templateContext;
      const serverGenerationResult = await this.generateServer(templateContext);
      
      // Merge results
      result.files = serverGenerationResult.files;
      result.stats.toolsGenerated = result.stats.toolsGenerated;
      result.stats.apisProcessed = result.stats.apisProcessed;
      result.stats.validationRulesGenerated = result.stats.validationRulesGenerated;
      result.errors.push(...serverGenerationResult.errors);

      // Generate additional validation files
      await this.generateValidationFiles(validationResult, result);

      // Generate documentation
      const documentationResult = await this.documentationGenerator.generateDocumentation(
        apiCollection,
        result.tools,
        templateContext
      );
      result.documentation = documentationResult;
      
      // Add documentation files to the result
      documentationResult.documentation.forEach(doc => {
        result.files.push({
          path: doc.path,
          content: doc.content,
          type: 'documentation',
          action: 'created',
        });
      });

      // Update stats
      result.stats.totalSize += documentationResult.stats.totalSize;
      result.errors.push(...documentationResult.errors);
      result.warnings.push(...documentationResult.warnings);

      this.log('MCP server generation completed', {
        totalFiles: result.files.length,
        toolsGenerated: result.stats.toolsGenerated,
        validationRules: result.stats.validationRulesGenerated,
        documentationFiles: documentationResult.stats.filesGenerated,
        hasErrors: result.errors.length > 0,
      });

      return result;

    } catch (error) {
      const errorMessage = `MCP server generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      result.stats.errors++;
      this.log('MCP server generation failed', error);
      return result;
    }
  }

  /**
   * Generate complete MCP server code from template context
   */
  async generateServer(context: TemplateContext): Promise<GenerationResult> {
    const result: GenerationResult = {
      files: [],
      server: {} as GeneratedServer,
      tools: [],
      validation: {} as ValidationGenerationResult,
      documentation: undefined,
      stats: { 
        created: 0, 
        updated: 0, 
        skipped: 0, 
        errors: 0,
        toolsGenerated: 0,
        apisProcessed: 0,
        validationRulesGenerated: 0,
        directoriesCreated: 0,
        totalSize: 0,
      },
      errors: [],
      warnings: [],
    };

    try {
      this.log('Starting server generation', {
        serverName: context.server.name,
        toolCount: context.tools.length,
        apiCount: context.apis.length,
      });

      // Define template mappings
      const templateMappings = [
        // Base configuration files
        { template: 'base/package.json.hbs', output: 'package.json', type: 'config' as const },
        { template: 'base/tsconfig.json.hbs', output: 'tsconfig.json', type: 'config' as const },
        { template: 'base/README.md.hbs', output: 'README.md', type: 'documentation' as const },
        { template: 'base/.gitignore.hbs', output: '.gitignore', type: 'config' as const },
        
        // Source files
        { template: 'src/index.ts.hbs', output: 'src/index.ts', type: 'source' as const },
        { template: 'src/mcp-server.ts.hbs', output: 'src/mcp-server.ts', type: 'source' as const },
        { template: 'src/tools.ts.hbs', output: 'src/tools.ts', type: 'source' as const },
        { template: 'src/types.ts.hbs', output: 'src/types.ts', type: 'source' as const },
        { template: 'src/api-client.ts.hbs', output: 'src/api-client.ts', type: 'source' as const },
        { template: 'src/request-validator.ts.hbs', output: 'src/request-validator.ts', type: 'source' as const },
        { template: 'src/response-formatter.ts.hbs', output: 'src/response-formatter.ts', type: 'source' as const },
        
        // Test files
        { template: 'tests/tool-tests.ts.hbs', output: 'tests/tool-tests.ts', type: 'test' as const },
      ];

      // Generate files from templates
      for (const mapping of templateMappings) {
        try {
          const generatedFile = await this.generateFile(mapping.template, mapping.output, mapping.type, context);
          result.files.push(generatedFile);
        } catch (error) {
          const errorMessage = `Failed to generate ${mapping.output}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          result.stats.errors++;
          this.log('File generation error', { file: mapping.output, error });
        }
      }

      this.log('Server generation completed', {
        totalFiles: result.files.length,
        stats: result.stats,
        hasErrors: result.errors.length > 0,
      });

      return result;

    } catch (error) {
      const errorMessage = `Server generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      result.stats.errors++;
      this.log('Server generation failed', error);
      return result;
    }
  }

  /**
   * Generate validation files
   */
  private async generateValidationFiles(
    validationResult: ValidationGenerationResult,
    result: GenerationResult
  ): Promise<void> {
    try {
      // Generate validation.ts file directly (without template for now)
      const validationContent = [
        validationResult.validationCode,
        validationResult.typeDefinitions,
        validationResult.utilityFunctions,
      ].join('\n\n');

      const validationFile: GeneratedFile = {
        path: 'src/validation.ts',
        content: validationContent,
        type: 'source',
        action: 'created',
      };

      result.files.push(validationFile);

      this.log('Generated validation files', {
        schemasGenerated: validationResult.stats.schemasGenerated,
        rulesGenerated: validationResult.stats.rulesGenerated,
      });
    } catch (error) {
      const errorMessage = `Failed to generate validation files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      result.stats.errors++;
      this.log('Validation file generation error', error);
    }
  }

  /**
   * Generate a single file from template
   */
  private async generateFile(
    templatePath: string,
    outputPath: string,
    type: GeneratedFile['type'],
    context: TemplateContext
  ): Promise<GeneratedFile> {
    this.log(`Generating file: ${outputPath}`, { templatePath });

    // Render template
    const content = await this.templateEngine.renderTemplate(templatePath, context);

    this.log(`File generated: ${outputPath}`, { size: content.length });

    return {
      path: outputPath,
      content,
      type,
      action: 'created', // Action will be determined by FileWriter
    };
  }

  /**
   * Add custom template directory
   */
  addCustomTemplateDirectory(dir: string): void {
    this.templateEngine.addCustomTemplateDirectory(dir);
    this.config.customTemplateDirs.push(dir);
    this.log(`Added custom template directory: ${dir}`);
  }

  /**
   * Remove custom template directory
   */
  removeCustomTemplateDirectory(dir: string): void {
    this.templateEngine.removeCustomTemplateDirectory(dir);
    const index = this.config.customTemplateDirs.indexOf(dir);
    if (index !== -1) {
      this.config.customTemplateDirs.splice(index, 1);
    }
    this.log(`Removed custom template directory: ${dir}`);
  }

  /**
   * Get available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    return await this.templateEngine.getAvailableTemplates();
  }

  /**
   * Clear template cache
   */
  clearTemplateCache(): void {
    this.templateEngine.clearCache();
    this.log('Template cache cleared');
  }

  /**
   * Update generator configuration
   */
  updateConfig(config: Partial<CodeGeneratorConfig>): void {
    Object.assign(this.config, config);
    this.log('CodeGenerator configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): CodeGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.promises.access(dir, fs.constants.F_OK);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
      this.log(`Created directory: ${dir}`);
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log messages with optional debug filtering
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] CodeGenerator: ${message}`, data);
      } else {
        console.error(`[${timestamp}] CodeGenerator: ${message}`);
      }
    }
  }
}

/**
 * Utility function to create a basic template context
 */
export function createTemplateContext(options: {
  serverName: string;
  serverVersion?: string;
  serverDescription?: string;
  packageName?: string;
  author?: string;
  license?: string;
  repository?: string;
  tools?: any[];
  apis?: any[];
  configuration?: Partial<TemplateContext['configuration']>;
}): TemplateContext {
  const timestamp = new Date().toISOString();
  
  return {
    server: {
      name: options.serverName,
      version: options.serverVersion ?? '1.0.0',
      description: options.serverDescription ?? `MCP server for ${options.serverName}`,
      packageName: options.packageName ?? options.serverName.toLowerCase().replace(/\s+/g, '-'),
      author: options.author,
      license: options.license ?? 'MIT',
      repository: options.repository,
    },
    tools: options.tools ?? [],
    apis: options.apis ?? [],
    imports: [],
    exports: [],
    metadata: {
      generatedAt: timestamp,
      generatedBy: 'MCP Builder CLI',
      version: '1.0.0',
    },
    configuration: {
      timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
      maxResponseLength: parseInt(process.env.MAX_RESPONSE_LENGTH || '50000', 10),
      allowLocalhost: process.env.ALLOW_LOCALHOST === 'true',
      allowPrivateIps: false,
      userAgent: 'MCP-Server/1.0.0',
      ...options.configuration,
    },
  };
}