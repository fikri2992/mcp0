#!/usr/bin/env node

/**
 * Test script to verify FileWriter functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileWriter, createFileWriter } from '../src/generator/file-writer.js';
import { GeneratedFile } from '../src/generator/code-generator.js';

async function testFileWriter() {
  console.log('Testing FileWriter functionality...\n');

  const testOutputDir = path.join(__dirname, 'test-output-file-writer');
  let testsPassed = 0;
  let testsTotal = 0;

  // Helper function to run a test
  async function runTest(name: string, testFn: () => Promise<void>) {
    testsTotal++;
    try {
      console.log(`  Running: ${name}`);
      await testFn();
      console.log(`  ✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.log(`  ❌ ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Clean up function
  async function cleanup() {
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  }

  // Setup
  await cleanup();

  // Test 1: Basic file writing
  await runTest('Basic file writing', async () => {
    const fileWriter = createFileWriter({
      outputDir: testOutputDir,
      overwrite: true,
      backup: false,
      debug: false,
    });

    const files: GeneratedFile[] = [
      {
        path: 'src/index.ts',
        content: 'export * from "./server";',
        type: 'source',
        action: 'created',
      },
      {
        path: 'package.json',
        content: JSON.stringify({ name: 'test-package' }, null, 2),
        type: 'config',
        action: 'created',
      },
    ];

    const result = await fileWriter.writeFiles(files);

    if (!result.success) {
      throw new Error(`File writing failed: ${result.errors.join(', ')}`);
    }

    if (result.stats.created !== 2) {
      throw new Error(`Expected 2 files created, got ${result.stats.created}`);
    }

    // Verify files exist
    const indexContent = await fs.readFile(path.join(testOutputDir, 'src/index.ts'), 'utf-8');
    if (indexContent !== 'export * from "./server";') {
      throw new Error('Index file content mismatch');
    }

    const packageContent = await fs.readFile(path.join(testOutputDir, 'package.json'), 'utf-8');
    const packageData = JSON.parse(packageContent);
    if (packageData.name !== 'test-package') {
      throw new Error('Package.json content mismatch');
    }
  });

  // Test 2: Skip existing files
  await runTest('Skip existing files when overwrite disabled', async () => {
    const fileWriter = createFileWriter({
      outputDir: testOutputDir,
      overwrite: false,
      backup: false,
      debug: false,
    });

    // Create existing file
    await fs.mkdir(path.join(testOutputDir, 'test'), { recursive: true });
    await fs.writeFile(path.join(testOutputDir, 'test/existing.txt'), 'original content');

    const files: GeneratedFile[] = [
      {
        path: 'test/existing.txt',
        content: 'new content',
        type: 'source',
        action: 'created',
      },
    ];

    const result = await fileWriter.writeFiles(files);

    if (!result.success) {
      throw new Error(`File writing failed: ${result.errors.join(', ')}`);
    }

    if (result.stats.skipped !== 1) {
      throw new Error(`Expected 1 file skipped, got ${result.stats.skipped}`);
    }

    // Verify original content preserved
    const content = await fs.readFile(path.join(testOutputDir, 'test/existing.txt'), 'utf-8');
    if (content !== 'original content') {
      throw new Error('Original content was not preserved');
    }
  });

  // Test 3: Backup functionality
  await runTest('Create backups when enabled', async () => {
    const fileWriter = createFileWriter({
      outputDir: testOutputDir,
      overwrite: true,
      backup: true,
      debug: false,
    });

    // Create existing file
    await fs.mkdir(path.join(testOutputDir, 'backup-test'), { recursive: true });
    await fs.writeFile(path.join(testOutputDir, 'backup-test/file.txt'), 'original content');

    const files: GeneratedFile[] = [
      {
        path: 'backup-test/file.txt',
        content: 'new content',
        type: 'source',
        action: 'created',
      },
    ];

    const result = await fileWriter.writeFiles(files);

    if (!result.success) {
      throw new Error(`File writing failed: ${result.errors.join(', ')}`);
    }

    if (result.stats.updated !== 1) {
      throw new Error(`Expected 1 file updated, got ${result.stats.updated}`);
    }

    if (result.stats.backed_up !== 1) {
      throw new Error(`Expected 1 file backed up, got ${result.stats.backed_up}`);
    }

    // Verify new content
    const content = await fs.readFile(path.join(testOutputDir, 'backup-test/file.txt'), 'utf-8');
    if (content !== 'new content') {
      throw new Error('New content was not written');
    }

    // Verify backup exists
    const backupFiles = await fs.readdir(path.join(testOutputDir, 'backup-test'));
    const backupFile = backupFiles.find(file => file.startsWith('file.txt.backup.'));
    if (!backupFile) {
      throw new Error('Backup file was not created');
    }

    const backupContent = await fs.readFile(path.join(testOutputDir, 'backup-test', backupFile), 'utf-8');
    if (backupContent !== 'original content') {
      throw new Error('Backup content is incorrect');
    }
  });

  // Cleanup
  await cleanup();

  // Results
  console.log(`\nFileWriter Tests: ${testsPassed}/${testsTotal} passed`);
  
  if (testsPassed === testsTotal) {
    console.log('✅ All FileWriter tests passed!');
    return true;
  } else {
    console.log('❌ Some FileWriter tests failed!');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testFileWriter()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testFileWriter };