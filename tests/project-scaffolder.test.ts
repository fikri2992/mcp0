#!/usr/bin/env node

/**
 * Test script to verify ProjectScaffolder functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectScaffolder, createProjectScaffolder, createStandardMCPStructure } from '../src/generator/project-scaffolder.js';
import { GeneratedFile } from '../src/generator/code-generator.js';

async function testProjectScaffolder() {
  console.log('Testing ProjectScaffolder functionality...\n');

  const testOutputDir = path.join(__dirname, 'test-output-scaffolder');
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

  // Test 1: Basic project scaffolding
  await runTest('Basic project scaffolding', async () => {
    const scaffolder = createProjectScaffolder({
      outputDir: testOutputDir,
      overwrite: true,
      backup: false,
      debug: false,
    });

    const structure = createStandardMCPStructure('test-server', 'Test MCP server');
    
    // Add some test files
    structure.files = [
      {
        path: 'src/index.ts',
        content: 'export * from "./server";',
        type: 'source',
        action: 'created',
      },
      {
        path: 'src/server.ts',
        content: 'export class Server {}',
        type: 'source',
        action: 'created',
      },
    ];

    const result = await scaffolder.scaffoldProject(structure);

    if (!result.success) {
      throw new Error(`Scaffolding failed: ${result.errors.join(', ')}`);
    }

    if (result.metadata.totalFiles === 0) {
      throw new Error('No files were created');
    }

    if (result.metadata.totalDirectories === 0) {
      throw new Error('No directories were created');
    }

    // Verify directories were created
    for (const dir of structure.directories) {
      const dirPath = path.join(testOutputDir, dir);
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Directory ${dir} was not created`);
      }
    }

    // Verify files were created
    for (const file of structure.files) {
      const filePath = path.join(testOutputDir, file.path);
      const content = await fs.readFile(filePath, 'utf-8');
      if (content !== file.content) {
        throw new Error(`File ${file.path} content mismatch`);
      }
    }

    // Verify metadata file was created
    const metadataPath = path.join(testOutputDir, '.mcpbuilder');
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    if (metadata.projectName !== 'test-server') {
      throw new Error('Metadata file content is incorrect');
    }

    // Verify .gitignore was created
    const gitignorePath = path.join(testOutputDir, '.gitignore');
    await fs.access(gitignorePath); // Will throw if file doesn't exist

    // Verify README.md was created
    const readmePath = path.join(testOutputDir, 'README.md');
    const readmeContent = await fs.readFile(readmePath, 'utf-8');
    if (!readmeContent.includes('test-server')) {
      throw new Error('README content is incorrect');
    }
  });

  // Test 2: Standard MCP structure creation
  await runTest('Standard MCP structure creation', async () => {
    const structure = createStandardMCPStructure('my-server', 'My test server');

    if (structure.name !== 'my-server') {
      throw new Error('Structure name is incorrect');
    }

    if (structure.description !== 'My test server') {
      throw new Error('Structure description is incorrect');
    }

    if (!structure.directories.includes('src')) {
      throw new Error('Structure missing src directory');
    }

    if (!structure.directories.includes('tests')) {
      throw new Error('Structure missing tests directory');
    }

    if (!structure.packageConfig) {
      throw new Error('Structure missing package config');
    }

    if (structure.packageConfig.name !== 'my-server') {
      throw new Error('Package config name is incorrect');
    }

    if (!structure.metadata) {
      throw new Error('Structure missing metadata');
    }

    if (structure.metadata.generatedBy !== 'MCP Builder CLI') {
      throw new Error('Metadata generatedBy is incorrect');
    }
  });

  // Test 3: Custom directories
  await runTest('Custom directories support', async () => {
    const scaffolder = createProjectScaffolder({
      outputDir: testOutputDir,
      overwrite: true,
      backup: false,
      debug: false,
      customDirectories: ['custom1', 'custom2/nested'],
    });

    const structure = createStandardMCPStructure('test-server');
    structure.files = [];

    const result = await scaffolder.scaffoldProject(structure);

    if (!result.success) {
      throw new Error(`Scaffolding failed: ${result.errors.join(', ')}`);
    }

    // Verify custom directories were created
    const custom1Path = path.join(testOutputDir, 'custom1');
    const custom2Path = path.join(testOutputDir, 'custom2/nested');

    const custom1Stats = await fs.stat(custom1Path);
    const custom2Stats = await fs.stat(custom2Path);

    if (!custom1Stats.isDirectory()) {
      throw new Error('Custom directory custom1 was not created');
    }

    if (!custom2Stats.isDirectory()) {
      throw new Error('Custom directory custom2/nested was not created');
    }
  });

  // Test 4: Error handling
  await runTest('Error handling gracefully', async () => {
    const scaffolder = createProjectScaffolder({
      outputDir: testOutputDir,
      overwrite: true,
      backup: false,
      debug: false,
    });

    const structure = createStandardMCPStructure('test-server');
    
    // Test with valid files to ensure basic error handling works
    structure.files = [
      {
        path: 'src/test.ts',
        content: 'export const test = "test";',
        type: 'source',
        action: 'created',
      },
    ];

    const result = await scaffolder.scaffoldProject(structure);

    // This should succeed
    if (!result.success) {
      throw new Error(`Scaffolding failed unexpectedly: ${result.errors.join(', ')}`);
    }

    // Verify the result structure is complete
    if (!result.fileWriteResult) {
      throw new Error('File write result is missing');
    }

    if (!result.metadata) {
      throw new Error('Metadata is missing');
    }

    if (result.metadata.totalFiles === 0) {
      throw new Error('No files were reported as created');
    }
  });

  // Cleanup
  await cleanup();

  // Results
  console.log(`\nProjectScaffolder Tests: ${testsPassed}/${testsTotal} passed`);
  
  if (testsPassed === testsTotal) {
    console.log('✅ All ProjectScaffolder tests passed!');
    return true;
  } else {
    console.log('❌ Some ProjectScaffolder tests failed!');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testProjectScaffolder()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testProjectScaffolder };