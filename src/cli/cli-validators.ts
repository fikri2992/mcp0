import * as fs from 'fs/promises';
import * as path from 'path';
import { CLIOptions } from './cli-types.js';
import { CLIError, ErrorFactory } from './cli-error-handler.js';

/**
 * Validate input file exists and is readable
 */
export async function validateInput(inputPath: string): Promise<void> {
  const resolvedPath = path.resolve(inputPath);
  
  try {
    const stats = await fs.stat(resolvedPath);
    
    if (!stats.isFile()) {
      throw ErrorFactory.inputInvalid(inputPath, 'Path is not a file');
    }
    
    // Check if file is readable
    await fs.access(resolvedPath, fs.constants.R_OK);
    
    // Basic validation of file extension
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== '.md' && ext !== '.markdown') {
      throw ErrorFactory.inputInvalid(
        inputPath, 
        'File must have .md or .markdown extension'
      );
    }
    
    // Basic content validation
    const content = await fs.readFile(resolvedPath, 'utf-8');
    if (content.trim().length === 0) {
      throw ErrorFactory.inputInvalid(inputPath, 'File is empty');
    }
    
    // Check for basic markdown structure
    if (!content.includes('#') && !content.includes('```')) {
      throw ErrorFactory.inputInvalid(
        inputPath, 
        'File does not appear to contain markdown content'
      );
    }
    
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw ErrorFactory.inputNotFound(inputPath);
    }
    
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw ErrorFactory.inputInvalid(inputPath, 'File is not readable');
    }
    
    throw ErrorFactory.inputInvalid(
      inputPath, 
      `Unexpected error: ${(error as Error).message}`
    );
  }
}

/**
 * Validate and prepare output directory
 */
export async function validateOutput(outputPath: string, options: CLIOptions): Promise<void> {
  const resolvedPath = path.resolve(outputPath);
  
  try {
    // Check if output path exists
    let stats: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, create it
        await fs.mkdir(resolvedPath, { recursive: true });
        return;
      }
      throw error;
    }
    
    // If path exists, check if it's a directory
    if (!stats.isDirectory()) {
      throw ErrorFactory.outputError(
        outputPath, 
        'Output path exists but is not a directory'
      );
    }
    
    // Check if directory is writable
    await fs.access(resolvedPath, fs.constants.W_OK);
    
    // Check if directory is empty or if overwrite is allowed
    const files = await fs.readdir(resolvedPath);
    const nonHiddenFiles = files.filter(file => !file.startsWith('.'));
    
    if (nonHiddenFiles.length > 0) {
      if (!options.overwrite) {
        throw ErrorFactory.outputError(
          outputPath,
          'Output directory is not empty. Use --overwrite to overwrite existing files'
        );
      }
      
      // If backup is requested, create backup
      if (options.backup) {
        await createBackup(resolvedPath);
      }
    }
    
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw ErrorFactory.outputError(
        outputPath, 
        'No write permission to output directory'
      );
    }
    
    if ((error as NodeJS.ErrnoException).code === 'ENOTDIR') {
      throw ErrorFactory.outputError(
        outputPath, 
        'Parent path is not a directory'
      );
    }
    
    throw ErrorFactory.outputError(
      outputPath, 
      `Unexpected error: ${(error as Error).message}`
    );
  }
}

/**
 * Create backup of existing directory
 */
async function createBackup(dirPath: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dirPath}.backup.${timestamp}`;
  
  try {
    await fs.cp(dirPath, backupPath, { recursive: true });
  } catch (error) {
    throw ErrorFactory.outputError(
      dirPath,
      `Failed to create backup: ${(error as Error).message}`
    );
  }
}

/**
 * Validate OpenAI API key format
 */
export function validateOpenAIKey(apiKey: string): boolean {
  // OpenAI API keys start with 'sk-' and are typically 51 characters long
  return /^sk-[a-zA-Z0-9]{48}$/.test(apiKey);
}

/**
 * Validate server name format
 */
export function validateServerName(name: string): boolean {
  // Server name should be a valid npm package name
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && name.length <= 214;
}

/**
 * Validate template directory
 */
export async function validateTemplateDirectory(templatePath: string): Promise<void> {
  const resolvedPath = path.resolve(templatePath);
  
  try {
    const stats = await fs.stat(resolvedPath);
    
    if (!stats.isDirectory()) {
      throw new CLIError(
        'template_error',
        'Template path is not a directory',
        { templatePath }
      );
    }
    
    // Check for required template files
    const requiredTemplates = [
      'package.json.hbs',
      'index.ts.hbs',
      'README.md.hbs'
    ];
    
    for (const template of requiredTemplates) {
      const templateFile = path.join(resolvedPath, template);
      try {
        await fs.access(templateFile, fs.constants.R_OK);
      } catch {
        throw new CLIError(
          'template_error',
          `Required template file not found: ${template}`,
          { templatePath, missingFile: template }
        );
      }
    }
    
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    }
    
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CLIError(
        'template_error',
        'Template directory not found',
        { templatePath }
      );
    }
    
    throw new CLIError(
      'template_error',
      `Template validation failed: ${(error as Error).message}`,
      { templatePath, error }
    );
  }
}

/**
 * Validate markdown content for API specifications
 */
export async function validateMarkdownContent(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Check for curl commands
  const curlPattern = /```(?:bash|shell|sh)?\s*\n\s*curl\s+/gm;
  const curlMatches = content.match(curlPattern);
  
  if (!curlMatches || curlMatches.length === 0) {
    throw ErrorFactory.inputInvalid(
      filePath,
      'No curl commands found in markdown file'
    );
  }
  
  // Basic validation of curl commands
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  let validCurlCount = 0;
  
  for (const block of codeBlocks) {
    if (block.includes('curl')) {
      // Basic curl command validation
      if (block.includes('http://') || block.includes('https://')) {
        validCurlCount++;
      }
    }
  }
  
  if (validCurlCount === 0) {
    throw ErrorFactory.inputInvalid(
      filePath,
      'No valid curl commands with URLs found'
    );
  }
}