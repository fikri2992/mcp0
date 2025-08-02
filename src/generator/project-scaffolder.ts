import * as fs from 'fs/promises';
import * as path from 'path';
import { FileWriter, FileWriterConfig, FileWriteResult } from './file-writer.js';
import { GeneratedFile } from './code-generator.js';
import { ProgressInfo } from '../cli/cli-types.js';

/**
 * Project structure definition
 */
export interface ProjectStructure {
  /** Project name */
  name: string;
  /** Project description */
  description?: string;
  /** Base directories to create */
  directories: string[];
  /** Files to generate */
  files: GeneratedFile[];
  /** Package.json configuration */
  packageConfig?: PackageConfig;
  /** Additional metadata */
  metadata?: ProjectMetadata;
}

/**
 * Package.json configuration
 */
export interface PackageConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
  types?: string;
  bin?: Record<string, string>;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  generatedAt: string;
  generatedBy: string;
  version: string;
  sourceFile?: string;
  templateVersion?: string;
}

/**
 * Scaffolding configuration
 */
export interface ScaffoldingConfig extends Omit<FileWriterConfig, 'outputDir'> {
  /** Base output directory */
  outputDir: string;
  /** Whether to create git repository */
  initGit?: boolean;
  /** Whether to install dependencies */
  installDependencies?: boolean;
  /** Whether to create example files */
  createExamples?: boolean;
  /** Custom directory structure */
  customDirectories?: string[];
  /** Progress callback for scaffolding steps */
  onScaffoldProgress?: (step: ScaffoldingStep) => void;
}

/**
 * Scaffolding step information
 */
export interface ScaffoldingStep {
  step: string;
  current: number;
  total: number;
  message?: string;
  substep?: string;
}

/**
 * Scaffolding result
 */
export interface ScaffoldingResult {
  success: boolean;
  projectPath: string;
  structure: ProjectStructure;
  fileWriteResult: FileWriteResult;
  steps: ScaffoldingStep[];
  errors: string[];
  warnings: string[];
  metadata: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    duration: number;
  };
}

/**
 * Project scaffolder for MCP servers
 */
export class ProjectScaffolder {
  private config: ScaffoldingConfig;
  private fileWriter: FileWriter;
  private steps: ScaffoldingStep[];
  private errors: string[];
  private warnings: string[];
  private startTime: number;

  constructor(config: ScaffoldingConfig) {
    this.config = config;
    this.fileWriter = new FileWriter({
      outputDir: config.outputDir,
      overwrite: config.overwrite,
      backup: config.backup,
      debug: config.debug,
      onProgress: this.handleFileProgress.bind(this),
      onFileOperation: this.handleFileOperation.bind(this),
    });
    this.steps = [];
    this.errors = [];
    this.warnings = [];
    this.startTime = 0;
  }

  /**
   * Scaffold a complete MCP server project
   */
  async scaffoldProject(structure: ProjectStructure): Promise<ScaffoldingResult> {
    this.startTime = Date.now();
    this.log('Starting project scaffolding', {
      projectName: structure.name,
      outputDir: this.config.outputDir,
      fileCount: structure.files.length,
      directoryCount: structure.directories.length,
    });

    // Reset state
    this.resetState();

    try {
      // Step 1: Validate and prepare output directory
      await this.executeStep({
        step: 'Preparing project directory',
        current: 1,
        total: 6,
        message: `Creating project at ${this.config.outputDir}`,
      }, () => this.prepareOutputDirectory());

      // Step 2: Create directory structure
      const directoriesCreated = await this.executeStep({
        step: 'Creating directory structure',
        current: 2,
        total: 6,
        message: `Creating ${structure.directories.length} directories`,
      }, () => this.createDirectoryStructure(structure.directories));

      // Step 3: Generate and write files
      const fileWriteResult = await this.executeStep({
        step: 'Generating project files',
        current: 3,
        total: 6,
        message: `Writing ${structure.files.length} files`,
      }, () => this.fileWriter.writeFiles(structure.files));

      // Step 4: Create additional project files
      await this.executeStep({
        step: 'Creating project configuration',
        current: 4,
        total: 6,
        message: 'Setting up package.json and configuration files',
      }, () => this.createProjectConfiguration(structure));

      // Step 5: Initialize git repository (if requested)
      if (this.config.initGit) {
        await this.executeStep({
          step: 'Initializing git repository',
          current: 5,
          total: 6,
          message: 'Setting up version control',
        }, () => this.initializeGitRepository());
      }

      // Step 6: Final validation and cleanup
      await this.executeStep({
        step: 'Finalizing project',
        current: 6,
        total: 6,
        message: 'Validating project structure',
      }, () => this.finalizeProject(structure));

      const duration = Date.now() - this.startTime;
      const success = this.errors.length === 0;

      this.log('Project scaffolding completed', {
        success,
        duration,
        stats: fileWriteResult.stats,
        errorCount: this.errors.length,
      });

      return {
        success,
        projectPath: this.config.outputDir,
        structure,
        fileWriteResult,
        steps: [...this.steps],
        errors: [...this.errors],
        warnings: [...this.warnings],
        metadata: {
          totalFiles: fileWriteResult.stats.created + fileWriteResult.stats.updated,
          totalDirectories: directoriesCreated + fileWriteResult.stats.directories_created,
          totalSize: fileWriteResult.stats.total_size,
          duration,
        },
      };

    } catch (error) {
      const errorMessage = `Project scaffolding failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMessage);
      this.log('Project scaffolding failed', error);

      return {
        success: false,
        projectPath: this.config.outputDir,
        structure,
        fileWriteResult: {
          success: false,
          stats: this.fileWriter.getStats(),
          operations: this.fileWriter.getOperations(),
          errors: this.fileWriter.getErrors(),
          warnings: this.fileWriter.getWarnings(),
        },
        steps: [...this.steps],
        errors: [...this.errors],
        warnings: [...this.warnings],
        metadata: {
          totalFiles: 0,
          totalDirectories: 0,
          totalSize: 0,
          duration: Date.now() - this.startTime,
        },
      };
    }
  }

  /**
   * Prepare output directory
   */
  private async prepareOutputDirectory(): Promise<void> {
    try {
      // Check if directory exists
      const exists = await this.directoryExists(this.config.outputDir);
      
      if (!exists) {
        // Create directory
        await fs.mkdir(this.config.outputDir, { recursive: true });
        this.log(`Created output directory: ${this.config.outputDir}`);
      } else {
        // Validate existing directory
        const canWrite = await this.validateWritePermissions(this.config.outputDir);
        if (!canWrite) {
          throw new Error(`No write permission to output directory: ${this.config.outputDir}`);
        }

        // Check if directory is empty or if overwrite is allowed
        const files = await fs.readdir(this.config.outputDir);
        const nonHiddenFiles = files.filter(file => !file.startsWith('.'));
        
        if (nonHiddenFiles.length > 0 && !this.config.overwrite) {
          throw new Error(`Output directory is not empty: ${this.config.outputDir}. Use --overwrite to overwrite existing files.`);
        }
      }
    } catch (error) {
      throw new Error(`Failed to prepare output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create directory structure
   */
  private async createDirectoryStructure(directories: string[]): Promise<number> {
    const allDirectories = [
      ...directories,
      ...(this.config.customDirectories || []),
    ];

    let directoriesCreated = 0;

    for (const dir of allDirectories) {
      const fullPath = path.join(this.config.outputDir, dir);
      
      try {
        // Check if directory already exists
        const exists = await this.directoryExists(fullPath);
        if (!exists) {
          await fs.mkdir(fullPath, { recursive: true });
          directoriesCreated++;
          this.log(`Created directory: ${dir}`);
        } else {
          this.log(`Directory already exists: ${dir}`);
        }
      } catch (error) {
        const warningMessage = `Failed to create directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.warnings.push(warningMessage);
        this.log('Directory creation warning', { dir, error });
      }
    }

    return directoriesCreated;
  }

  /**
   * Create project configuration files
   */
  private async createProjectConfiguration(structure: ProjectStructure): Promise<void> {
    // Create .mcpbuilder metadata file
    const metadataFile: GeneratedFile = {
      path: '.mcpbuilder',
      content: JSON.stringify({
        ...structure.metadata,
        projectName: structure.name,
        scaffoldedAt: new Date().toISOString(),
        directories: structure.directories,
        fileCount: structure.files.length,
      }, null, 2),
      type: 'config',
      action: 'created',
    };

    await this.fileWriter.writeFile(metadataFile);

    // Create .gitignore if it doesn't exist
    const gitignoreExists = await this.fileExists(path.join(this.config.outputDir, '.gitignore'));
    if (!gitignoreExists) {
      const gitignoreFile: GeneratedFile = {
        path: '.gitignore',
        content: this.generateGitignoreContent(),
        type: 'config',
        action: 'created',
      };
      await this.fileWriter.writeFile(gitignoreFile);
    }

    // Create README.md if it doesn't exist
    const readmeExists = await this.fileExists(path.join(this.config.outputDir, 'README.md'));
    if (!readmeExists) {
      const readmeFile: GeneratedFile = {
        path: 'README.md',
        content: this.generateReadmeContent(structure),
        type: 'documentation',
        action: 'created',
      };
      await this.fileWriter.writeFile(readmeFile);
    }
  }

  /**
   * Initialize git repository
   */
  private async initializeGitRepository(): Promise<void> {
    try {
      const { execSync } = await import('child_process');
      
      // Check if git is available
      try {
        execSync('git --version', { cwd: this.config.outputDir, stdio: 'ignore' });
      } catch {
        this.warnings.push('Git is not available, skipping repository initialization');
        return;
      }

      // Check if already a git repository
      const gitDir = path.join(this.config.outputDir, '.git');
      const isGitRepo = await this.directoryExists(gitDir);
      
      if (!isGitRepo) {
        execSync('git init', { cwd: this.config.outputDir, stdio: 'ignore' });
        this.log('Initialized git repository');
      } else {
        this.log('Git repository already exists');
      }
      
    } catch (error) {
      const warningMessage = `Failed to initialize git repository: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.warnings.push(warningMessage);
      this.log('Git initialization warning', error);
    }
  }

  /**
   * Finalize project setup
   */
  private async finalizeProject(structure: ProjectStructure): Promise<void> {
    // Validate that all expected files were created
    const missingFiles: string[] = [];
    
    for (const file of structure.files) {
      const fullPath = path.join(this.config.outputDir, file.path);
      const exists = await this.fileExists(fullPath);
      
      if (!exists) {
        missingFiles.push(file.path);
      }
    }

    if (missingFiles.length > 0) {
      const warningMessage = `Some files were not created: ${missingFiles.join(', ')}`;
      this.warnings.push(warningMessage);
      this.log('Missing files warning', { missingFiles });
    }

    // Create examples if requested
    if (this.config.createExamples) {
      await this.createExampleFiles(structure);
    }

    this.log('Project finalization completed');
  }

  /**
   * Create example files
   */
  private async createExampleFiles(structure: ProjectStructure): Promise<void> {
    const exampleDir = path.join(this.config.outputDir, 'examples');
    
    try {
      await fs.mkdir(exampleDir, { recursive: true });
      
      // Create example usage file
      const exampleFile: GeneratedFile = {
        path: 'examples/usage.md',
        content: this.generateExampleUsage(structure),
        type: 'documentation',
        action: 'created',
      };
      
      await this.fileWriter.writeFile(exampleFile);
      this.log('Created example files');
      
    } catch (error) {
      const warningMessage = `Failed to create example files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.warnings.push(warningMessage);
      this.log('Example creation warning', error);
    }
  }

  /**
   * Execute a scaffolding step with progress reporting
   */
  private async executeStep<T>(
    step: ScaffoldingStep,
    operation: () => Promise<T>
  ): Promise<T> {
    this.steps.push(step);
    this.reportScaffoldProgress(step);
    
    try {
      const result = await operation();
      this.log(`Completed step: ${step.step}`);
      return result;
    } catch (error) {
      const errorMessage = `Step failed - ${step.step}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMessage);
      this.log('Step execution error', { step: step.step, error });
      throw error;
    }
  }

  /**
   * Handle file progress from FileWriter
   */
  private handleFileProgress(progress: ProgressInfo): void {
    // Forward file progress as substep
    const currentStep = this.steps[this.steps.length - 1];
    if (currentStep) {
      this.reportScaffoldProgress({
        ...currentStep,
        substep: progress.step,
      });
    }
  }

  /**
   * Handle file operations from FileWriter
   */
  private handleFileOperation(operation: any): void {
    this.log(`File operation: ${operation.type}`, {
      path: operation.path,
      size: operation.size,
      message: operation.message,
    });
  }

  /**
   * Report scaffolding progress
   */
  private reportScaffoldProgress(step: ScaffoldingStep): void {
    if (this.config.onScaffoldProgress) {
      this.config.onScaffoldProgress(step);
    }
  }

  /**
   * Generate .gitignore content
   */
  private generateGitignoreContent(): string {
    return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.*.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Backup files
*.backup.*

# Temporary files
tmp/
temp/
`;
  }

  /**
   * Generate README.md content
   */
  private generateReadmeContent(structure: ProjectStructure): string {
    return `# ${structure.name}

${structure.description || 'MCP server generated by MCP Builder CLI'}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Generated Files

This project was generated using MCP Builder CLI on ${new Date().toISOString()}.

- **Source files**: Located in \`src/\` directory
- **Tests**: Located in \`tests/\` directory
- **Configuration**: Various config files in the root directory

## Project Structure

\`\`\`
${structure.directories.map(dir => `${dir}/`).join('\n')}
\`\`\`

## License

${structure.packageConfig?.license || 'MIT'}
`;
  }

  /**
   * Generate example usage content
   */
  private generateExampleUsage(structure: ProjectStructure): string {
    return `# ${structure.name} - Usage Examples

This file contains examples of how to use the generated MCP server.

## Basic Usage

\`\`\`javascript
// Example usage code will be generated based on your API specifications
\`\`\`

## Configuration

\`\`\`javascript
// Configuration examples
\`\`\`

## Testing

\`\`\`bash
# Run tests
npm test
\`\`\`

Generated on: ${new Date().toISOString()}
`;
  }

  /**
   * Utility methods
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async validateWritePermissions(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  private resetState(): void {
    this.steps = [];
    this.errors = [];
    this.warnings = [];
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] ProjectScaffolder: ${message}`, data);
      } else {
        console.error(`[${timestamp}] ProjectScaffolder: ${message}`);
      }
    }
  }
}

/**
 * Utility function to create a project scaffolder with common configuration
 */
export function createProjectScaffolder(config: Partial<ScaffoldingConfig> & { outputDir: string }): ProjectScaffolder {
  return new ProjectScaffolder({
    overwrite: false,
    backup: true,
    debug: false,
    initGit: false,
    installDependencies: false,
    createExamples: false,
    ...config,
  });
}

/**
 * Create a standard MCP server project structure
 */
export function createStandardMCPStructure(name: string, description?: string): ProjectStructure {
  return {
    name,
    description,
    directories: [
      'src',
      'tests',
      'examples',
      'docs',
    ],
    files: [], // Will be populated by code generator
    packageConfig: {
      name: name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: description || `MCP server for ${name}`,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        start: 'node dist/index.js',
        dev: 'ts-node src/index.ts',
        test: 'jest',
        'test:watch': 'jest --watch',
        lint: 'eslint src/**/*.ts',
        'lint:fix': 'eslint src/**/*.ts --fix',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.4.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'ts-node': '^10.0.0',
        'jest': '^29.0.0',
        '@types/jest': '^29.0.0',
        'eslint': '^8.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0',
      },
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: 'MCP Builder CLI',
      version: '1.0.0',
    },
  };
}