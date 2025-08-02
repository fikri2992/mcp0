import * as fs from 'fs/promises';
import * as path from 'path';
import { GeneratedFile } from './code-generator.js';
import { ProgressInfo } from '../cli/cli-types.js';

/**
 * Configuration for file writing operations
 */
export interface FileWriterConfig {
  /** Base output directory */
  outputDir: string;
  /** Whether to overwrite existing files */
  overwrite: boolean;
  /** Whether to create backups before overwriting */
  backup: boolean;
  /** Whether to enable debug logging */
  debug: boolean;
  /** Progress callback function */
  onProgress?: (progress: ProgressInfo) => void;
  /** File operation callback */
  onFileOperation?: (operation: FileOperation) => void;
}

/**
 * File operation information
 */
export interface FileOperation {
  type: 'create' | 'update' | 'skip' | 'backup' | 'mkdir';
  path: string;
  size?: number;
  message?: string;
}

/**
 * File writing statistics
 */
export interface FileWriteStats {
  created: number;
  updated: number;
  skipped: number;
  backed_up: number;
  directories_created: number;
  total_size: number;
  errors: number;
}

/**
 * File writing result
 */
export interface FileWriteResult {
  success: boolean;
  stats: FileWriteStats;
  operations: FileOperation[];
  errors: string[];
  warnings: string[];
}

/**
 * File writer for MCP server generation
 */
export class FileWriter {
  private config: FileWriterConfig;
  private stats: FileWriteStats;
  private operations: FileOperation[];
  private errors: string[];
  private warnings: string[];

  constructor(config: FileWriterConfig) {
    this.config = config;
    this.stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      backed_up: 0,
      directories_created: 0,
      total_size: 0,
      errors: 0,
    };
    this.operations = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Write multiple files to the file system
   */
  async writeFiles(files: GeneratedFile[]): Promise<FileWriteResult> {
    this.log('Starting file write operation', {
      fileCount: files.length,
      outputDir: this.config.outputDir,
    });

    // Reset stats for this operation
    this.resetStats();

    try {
      // Ensure base output directory exists
      await this.ensureDirectory(this.config.outputDir);

      // Process files in order
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Report progress
        this.reportProgress({
          step: `Writing ${file.path}`,
          current: i + 1,
          total: files.length,
          message: `Processing ${file.type} file`,
        });

        try {
          await this.writeFile(file);
        } catch (error) {
          const errorMessage = `Failed to write ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.errors.push(errorMessage);
          this.stats.errors++;
          this.log('File write error', { file: file.path, error });
        }
      }

      const success = this.errors.length === 0;
      this.log('File write operation completed', {
        success,
        stats: this.stats,
        errorCount: this.errors.length,
      });

      return {
        success,
        stats: { ...this.stats },
        operations: [...this.operations],
        errors: [...this.errors],
        warnings: [...this.warnings],
      };

    } catch (error) {
      const errorMessage = `File write operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.errors.push(errorMessage);
      this.stats.errors++;
      this.log('File write operation failed', error);

      return {
        success: false,
        stats: { ...this.stats },
        operations: [...this.operations],
        errors: [...this.errors],
        warnings: [...this.warnings],
      };
    }
  }

  /**
   * Write a single file to the file system
   */
  async writeFile(file: GeneratedFile): Promise<void> {
    const fullPath = path.join(this.config.outputDir, file.path);
    const directory = path.dirname(fullPath);

    this.log(`Writing file: ${file.path}`, {
      fullPath,
      type: file.type,
      size: file.content.length,
    });

    // Ensure directory exists
    await this.ensureDirectory(directory);

    // Check if file exists
    const fileExists = await this.fileExists(fullPath);
    
    if (fileExists) {
      if (!this.config.overwrite) {
        // Skip existing file
        this.recordOperation({
          type: 'skip',
          path: file.path,
          message: 'File exists and overwrite is disabled',
        });
        this.stats.skipped++;
        this.log(`Skipped existing file: ${file.path}`);
        return;
      }

      // Create backup if requested
      if (this.config.backup) {
        await this.createBackup(fullPath);
      }
    }

    // Write the file
    await fs.writeFile(fullPath, file.content, 'utf-8');
    
    // Record operation
    const operation = fileExists ? 'update' : 'create';
    this.recordOperation({
      type: operation,
      path: file.path,
      size: file.content.length,
    });

    // Update stats
    this.stats[operation === 'create' ? 'created' : 'updated']++;
    this.stats.total_size += file.content.length;

    this.log(`File ${operation}d: ${file.path}`, {
      size: file.content.length,
      action: operation,
    });
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath, fs.constants.F_OK);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(dirPath, { recursive: true });
      
      this.recordOperation({
        type: 'mkdir',
        path: path.relative(this.config.outputDir, dirPath) || '.',
        message: 'Directory created',
      });
      
      this.stats.directories_created++;
      this.log(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Create backup of existing file
   */
  async createBackup(filePath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;

    try {
      await fs.copyFile(filePath, backupPath);
      
      this.recordOperation({
        type: 'backup',
        path: path.relative(this.config.outputDir, backupPath),
        message: `Backup of ${path.relative(this.config.outputDir, filePath)}`,
      });
      
      this.stats.backed_up++;
      this.log(`Created backup: ${backupPath}`);
      
    } catch (error) {
      const warningMessage = `Failed to create backup for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.warnings.push(warningMessage);
      this.log('Backup creation warning', { filePath, error });
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Validate write permissions for directory
   */
  async validateWritePermissions(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up empty directories
   */
  async cleanupEmptyDirectories(basePath: string): Promise<void> {
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      // Recursively clean up subdirectories first
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(basePath, entry.name);
          await this.cleanupEmptyDirectories(subPath);
        }
      }

      // Check if directory is now empty
      const remainingEntries = await fs.readdir(basePath);
      if (remainingEntries.length === 0 && basePath !== this.config.outputDir) {
        await fs.rmdir(basePath);
        this.log(`Removed empty directory: ${basePath}`);
      }
      
    } catch (error) {
      // Ignore errors during cleanup
      this.log('Directory cleanup warning', { basePath, error });
    }
  }

  /**
   * Record file operation
   */
  private recordOperation(operation: FileOperation): void {
    this.operations.push(operation);
    
    if (this.config.onFileOperation) {
      this.config.onFileOperation(operation);
    }
  }

  /**
   * Report progress
   */
  private reportProgress(progress: ProgressInfo): void {
    if (this.config.onProgress) {
      this.config.onProgress(progress);
    }
  }

  /**
   * Reset statistics for new operation
   */
  private resetStats(): void {
    this.stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      backed_up: 0,
      directories_created: 0,
      total_size: 0,
      errors: 0,
    };
    this.operations = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Log messages with optional debug filtering
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      const timestamp = new Date().toISOString();
      if (data !== undefined) {
        console.error(`[${timestamp}] FileWriter: ${message}`, data);
      } else {
        console.error(`[${timestamp}] FileWriter: ${message}`);
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats(): FileWriteStats {
    return { ...this.stats };
  }

  /**
   * Get recorded operations
   */
  getOperations(): FileOperation[] {
    return [...this.operations];
  }

  /**
   * Get errors
   */
  getErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Get warnings
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }
}

/**
 * Utility function to create a file writer with common configuration
 */
export function createFileWriter(config: Partial<FileWriterConfig> & { outputDir: string }): FileWriter {
  return new FileWriter({
    overwrite: false,
    backup: true,
    debug: false,
    ...config,
  });
}