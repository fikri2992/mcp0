import { ProgressInfo } from './cli-types.js';

/**
 * Report progress to the user
 */
export function reportProgress(progress: ProgressInfo, quiet: boolean = false): void {
  if (quiet) return;
  
  const percentage = Math.round((progress.current / progress.total) * 100);
  const progressBar = createProgressBar(percentage);
  
  console.error(`[${progress.current}/${progress.total}] ${progressBar} ${progress.step}`);
  
  if (progress.message) {
    console.error(`    ${progress.message}`);
  }
}

/**
 * Create a simple progress bar
 */
function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${percentage}%`;
}

/**
 * Log informational message
 */
export function logInfo(message: string, quiet: boolean = false): void {
  if (!quiet) {
    console.error(message);
  }
}

/**
 * Log error message
 */
export function logError(message: string): void {
  console.error(`❌ ${message}`);
}

/**
 * Log warning message
 */
export function logWarning(message: string, quiet: boolean = false): void {
  if (!quiet) {
    console.error(`⚠️  ${message}`);
  }
}

/**
 * Log debug message
 */
export function logDebug(message: string, data?: any, debug: boolean = false): void {
  if (debug) {
    console.error(`🐛 ${message}`);
    if (data !== undefined) {
      console.error('   ', JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Log success message
 */
export function logSuccess(message: string, quiet: boolean = false): void {
  if (!quiet) {
    console.error(`✅ ${message}`);
  }
}

/**
 * Create a formatted table for displaying data
 */
export function createTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';
  
  // Calculate column widths
  const widths = headers.map((header, i) => {
    const maxRowWidth = Math.max(...rows.map(row => (row[i] || '').length));
    return Math.max(header.length, maxRowWidth);
  });
  
  // Create separator line
  const separator = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  
  // Create header row
  const headerRow = '|' + headers.map((header, i) => 
    ` ${header.padEnd(widths[i])} `
  ).join('|') + '|';
  
  // Create data rows
  const dataRows = rows.map(row => 
    '|' + row.map((cell, i) => 
      ` ${(cell || '').padEnd(widths[i])} `
    ).join('|') + '|'
  );
  
  return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

/**
 * Display a list with bullets
 */
export function displayList(items: string[], bullet: string = '•'): void {
  items.forEach(item => {
    console.error(`  ${bullet} ${item}`);
  });
}

/**
 * Display a numbered list
 */
export function displayNumberedList(items: string[]): void {
  items.forEach((item, index) => {
    console.error(`  ${index + 1}. ${item}`);
  });
}

/**
 * Clear the current line (for updating progress)
 */
export function clearLine(): void {
  if (process.stderr.isTTY) {
    process.stderr.write('\r\x1b[K');
  }
}

/**
 * Move cursor up n lines
 */
export function moveCursorUp(lines: number): void {
  if (process.stderr.isTTY) {
    process.stderr.write(`\x1b[${lines}A`);
  }
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Spinner for long-running operations
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: NodeJS.Timeout | null = null;
  private currentFrame = 0;
  private message: string;
  
  constructor(message: string = 'Loading...') {
    this.message = message;
  }
  
  start(): void {
    if (!process.stderr.isTTY) return;
    
    this.interval = setInterval(() => {
      process.stderr.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 100);
  }
  
  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (process.stderr.isTTY) {
      process.stderr.write('\r\x1b[K');
      if (finalMessage) {
        console.error(finalMessage);
      }
    }
  }
  
  updateMessage(message: string): void {
    this.message = message;
  }
}