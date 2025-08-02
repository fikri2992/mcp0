#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

import { Command } from 'commander';
import { CLIOptions, CLICommand } from './cli-types.js';
import { generateCommand } from './cli-commands.js';
import { loadConfig, validateConfig } from './cli-config.js';
import { CLIError, handleError } from './cli-error-handler.js';

/**
 * Main CLI application class
 */
export class MCPBuilderCLI {
  private program: Command;
  private version: string = '1.0.0';

  constructor() {
    this.program = new Command();
    this.setupProgram();
    this.registerCommands();
  }

  /**
   * Setup the main program configuration
   */
  private setupProgram(): void {
    this.program
      .name('mcp-builder')
      .description('MCP Builder CLI - Generate MCP servers from API specifications')
      .version(this.version, '-v, --version', 'Display version number')
      .helpOption('-h, --help', 'Display help for command')
      .configureHelp({
        sortSubcommands: true,
        showGlobalOptions: true,
      });

    // Global options
    this.program
      .option('-d, --debug', 'Enable debug logging', false)
      .option('-c, --config <path>', 'Path to configuration file')
      .option('--openai-api-key <key>', 'OpenAI API key for AI parsing')
      .option('--model <model>', 'OpenAI model to use', process.env.OPENAI_MODEL || 'gpt-4')
      .option('--no-ai', 'Disable AI-powered parsing and optimization')
      .option('--quiet', 'Suppress non-error output', process.env.QUIET === 'true');

    // Note: Removed exitOverride() to allow normal help/version exits
  }

  /**
   * Register all available commands
   */
  private registerCommands(): void {
    // Register the generate command
    this.program.addCommand(generateCommand);

    // Add validate command for future implementation
    this.program
      .command('validate')
      .description('Validate API specification file')
      .argument('<input>', 'Path to API specification markdown file')
      .option('-f, --format <format>', 'Output format (json|yaml|text)', 'text')
      .action(async (input: string, options: any) => {
        console.log('Validate command not yet implemented');
        console.log('Input:', input);
        console.log('Options:', options);
      });

    // Add config command for configuration management
    this.program
      .command('config')
      .description('Manage CLI configuration')
      .option('--show', 'Show current configuration')
      .option('--init', 'Initialize configuration file')
      .action(async (options: any) => {
        console.log('Config command not yet implemented');
        console.log('Options:', options);
      });
  }

  /**
   * Parse command line arguments and execute
   */
  async run(argv?: string[]): Promise<void> {
    try {
      // Parse and execute command first
      await this.program.parseAsync(argv);

    } catch (error) {
      // Check if this is a commander.js help/version exit
      if (error && typeof error === 'object' && 'code' in error) {
        const commanderError = error as any;
        if (commanderError.code === 'commander.help' || commanderError.code === 'commander.version') {
          // These are normal exits, don't treat as errors
          return;
        }
      }

      const globalOptions = this.program.opts();
      await handleError(error, globalOptions?.debug || false);
      process.exit(1);
    }
  }

  /**
   * Get the commander program instance
   */
  getProgram(): Command {
    return this.program;
  }
}

/**
 * Main entry point for the CLI
 */
export async function main(): Promise<void> {
  const cli = new MCPBuilderCLI();
  await cli.run();
}

// Run if this file is executed directly
// Note: This check is simplified for CommonJS compatibility
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}