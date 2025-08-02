import { Command } from 'commander';
import { CLIOptions, ProgressInfo } from './cli-types.js';
import { CLIError } from './cli-error-handler.js';
import { validateInput, validateOutput } from './cli-validators.js';
import { reportProgress, logInfo, logError, logDebug, logSuccess } from './cli-output.js';
import { CodeGenerator } from '../generator/code-generator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Generate command implementation
 */
export const generateCommand = new Command('generate')
  .description('Generate MCP server from API specification')
  .argument('<input>', 'Path to API specification markdown file')
  .argument('<output>', 'Output directory for generated MCP server')
  .option('-n, --name <name>', 'Name for the generated MCP server')
  .option('-t, --template <path>', 'Path to custom template directory')
  .option('--overwrite', 'Overwrite existing files in output directory', false)
  .option('--no-tests', 'Skip generating test files')
  .option('--no-docs', 'Skip generating documentation')
  .option('--backup', 'Create backup of existing files before overwriting', false)
  .action(async (input: string, output: string, cmdOptions: any, command: Command) => {
    try {
      // Merge global and command options
      const globalOptions = command.parent?.opts() || {};
      const options: CLIOptions = {
        input,
        output,
        name: cmdOptions.name,
        template: cmdOptions.template,
        debug: globalOptions.debug || false,
        quiet: globalOptions.quiet || false,
        openaiApiKey: globalOptions.openaiApiKey,
        model: globalOptions.model || 'gpt-4',
        noAi: globalOptions.noAi || false,
        config: globalOptions.config,
        overwrite: cmdOptions.overwrite || false,
        backup: cmdOptions.backup || false,
        ...cmdOptions
      };

      await executeGenerate(options);
      
    } catch (error) {
      throw error; // Re-throw to be handled by main error handler
    }
  });

/**
 * Execute the generate command
 */
async function executeGenerate(options: CLIOptions): Promise<void> {
  logDebug('Starting generate command with options:', options, options.debug);
  
  // Step 1: Validate input file
  reportProgress({
    step: 'Validating input',
    current: 1,
    total: 6,
    message: `Checking ${options.input}`
  }, options.quiet);

  await validateInput(options.input);
  logInfo('✓ Input file validated', options.quiet);

  // Step 2: Validate output directory
  reportProgress({
    step: 'Preparing output',
    current: 2,
    total: 6,
    message: `Setting up ${options.output}`
  }, options.quiet);

  await validateOutput(options.output, options);
  logInfo('✓ Output directory prepared', options.quiet);

  // Step 3: Parse markdown (placeholder)
  reportProgress({
    step: 'Parsing API specification',
    current: 3,
    total: 6,
    message: 'Extracting API definitions'
  }, options.quiet);

  // TODO: This will be implemented in task 3
  logInfo('✓ API specification parsed (placeholder)', options.quiet);

  // Step 4: AI processing (placeholder)
  if (!options.noAi && options.openaiApiKey) {
    reportProgress({
      step: 'AI-powered optimization',
      current: 4,
      total: 6,
      message: 'Enhancing API specifications'
    }, options.quiet);

    // TODO: This will be implemented in task 4
    logInfo('✓ AI optimization completed (placeholder)', options.quiet);
  } else {
    logInfo('⚠ AI processing skipped (no API key or disabled)', options.quiet);
  }

  // Step 5: Code generation
  reportProgress({
    step: 'Generating MCP server',
    current: 5,
    total: 6,
    message: 'Creating server files'
  }, options.quiet);

  try {
    // Create code generator
    const generator = new CodeGenerator({
      outputDir: options.output,
      overwrite: options.overwrite,
      backup: options.backup,
      debug: options.debug,
      initGit: true,
      createExamples: true,
      onProgress: (progress: ProgressInfo) => {
        if (!options.quiet) {
          reportProgress(progress, options.quiet);
        }
      },
      server: {
        name: options.name || 'Generated MCP Server',
        description: `MCP server generated from ${path.basename(options.input)}`,
        version: '1.0.0',
        license: 'MIT',
      },
    });

    // For now, create a placeholder API collection
    // TODO: Replace with actual parsed API collection from previous steps
    const placeholderAPICollection = {
      name: options.name || 'Generated MCP Server',
      description: `MCP server generated from ${path.basename(options.input)}`,
      apis: [], // Will be populated by parser
      curlCommands: [], // Will be populated by parser
      rawMarkdown: await fs.readFile(options.input, 'utf-8'),
      metadata: {
        fileName: path.basename(options.input),
        parsedAt: new Date().toISOString(),
        headings: [],
        codeBlocks: 0,
        curlCommandsFound: 0,
      },
    };

    // Generate complete project
    const result = await generator.generateProject(placeholderAPICollection);

    if (!result.scaffoldingResult?.success) {
      throw new Error(`Project generation failed: ${result.errors.join(', ')}`);
    }

    // Log results
    logDebug('Generation completed', {
      files: result.scaffoldingResult.metadata.totalFiles,
      directories: result.scaffoldingResult.metadata.totalDirectories,
      size: result.scaffoldingResult.metadata.totalSize,
      duration: result.scaffoldingResult.metadata.duration,
    }, options.debug);

    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        logInfo(`⚠️  ${warning}`, options.quiet);
      });
    }

    logInfo('✓ MCP server generated successfully', options.quiet);

  } catch (error) {
    throw new CLIError(
      'generation_error',
      `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { error }
    );
  }

  // Step 6: Finalization
  reportProgress({
    step: 'Finalizing',
    current: 6,
    total: 6,
    message: 'Completing generation'
  }, options.quiet);

  logInfo('✅ MCP server generation completed successfully!', options.quiet);
  logInfo(`📁 Output directory: ${path.resolve(options.output)}`, options.quiet);
  
  if (!options.quiet) {
    console.log('\nNext steps:');
    console.log(`  cd ${options.output}`);
    console.log('  npm install');
    console.log('  npm run build');
    console.log('  npm start');
  }
}

/**
 * Create placeholder output files for testing
 * This will be replaced by actual code generation in later tasks
 */
async function createPlaceholderOutput(options: CLIOptions): Promise<void> {
  const serverName = options.name || path.basename(options.input, '.md');
  
  // Create basic package.json
  const packageJson = {
    name: `mcp-${serverName}`,
    version: '1.0.0',
    description: `Generated MCP server for ${serverName}`,
    main: 'dist/index.js',
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
      dev: 'tsc --watch'
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^0.5.0',
      'axios': '^1.6.0',
      'zod': '^3.22.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0'
    }
  };

  await fs.writeFile(
    path.join(options.output, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create basic README
  const readme = `# ${serverName} MCP Server

Generated MCP server for ${serverName} API.

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

This is a placeholder generated by MCP Builder CLI.
Actual implementation will be added in future tasks.
`;

  await fs.writeFile(
    path.join(options.output, 'README.md'),
    readme
  );

  logDebug('Placeholder files created', options.debug);
}