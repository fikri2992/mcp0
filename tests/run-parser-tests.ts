#!/usr/bin/env node

import { MarkdownParserTest } from './markdown-parser.test.js';
import { ContentPreprocessorTest } from './content-preprocessor.test.js';
import { ParserIntegrationTest } from './parser-integration.test.js';

/**
 * Test runner for all parser-related tests
 */
class ParserTestRunner {
  public static async runAllTests(): Promise<void> {
    console.log('🧪 Running Parser Module Tests\n');
    console.log('=' .repeat(50));

    try {
      // Run individual component tests
      MarkdownParserTest.runAllTests();
      console.log('\n' + '=' .repeat(50));
      
      ContentPreprocessorTest.runAllTests();
      console.log('\n' + '=' .repeat(50));
      
      ParserIntegrationTest.runAllTests();
      console.log('\n' + '=' .repeat(50));

      console.log('\n🎯 All parser tests completed!');
      
    } catch (error) {
      console.error('\n❌ Test runner failed:', error);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
// Note: import.meta.url check removed for compatibility

export { ParserTestRunner };