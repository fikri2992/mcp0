import { ContentPreprocessor } from '../src/parser/content-preprocessor.js';
import { PreprocessedContent } from '../src/parser/types.js';

/**
 * Test suite for ContentPreprocessor
 */
export class ContentPreprocessorTest {
  private static testResults: { name: string; passed: boolean; error?: string }[] = [];

  public static runAllTests(): void {
    console.log('Running ContentPreprocessor tests...\n');

    this.testBasicPreprocessing();
    this.testNormalizeCurlCommands();
    this.testRemoveComments();
    this.testNormalizeWhitespace();
    this.testEnhanceStructure();
    this.testAddContextMarkers();
    this.testPrepareForAI();
    this.testPreprocessingOptions();
    this.testValidatePreprocessedContent();

    this.printResults();
  }

  private static testBasicPreprocessing(): void {
    const testName = 'Basic content preprocessing';
    try {
      const content = `# API Documentation

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users/123" \\
  -H "Authorization: Bearer token"
\`\`\``;

      const result = ContentPreprocessor.preprocessContent(content);

      this.assert(result.originalContent === content, 'Should preserve original content');
      this.assert(result.processedContent.length > 0, 'Should have processed content');
      this.assert(result.extractedCurls.length === 1, 'Should extract curl commands');
      this.assert(result.structure.headings.length === 2, 'Should extract structure');
      this.assert(result.metadata.transformations.length > 0, 'Should record transformations');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testNormalizeCurlCommands(): void {
    const testName = 'Normalize multiline curl commands';
    try {
      const content = `# API Test

\`\`\`bash
curl -X POST "https://api.example.com/users" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{
    "name": "John",
    "email": "john@example.com"
  }'
\`\`\``;

      const result = ContentPreprocessor.preprocessContent(content);
      
      // The normalized curl should be on fewer lines
      const originalLines = content.split('\n').length;
      const processedLines = result.processedContent.split('\n').length;
      
      this.assert(result.extractedCurls.length === 1, 'Should extract curl command');
      this.assert(result.metadata.transformations.includes('normalized_curl_commands'), 
        'Should record curl normalization');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testRemoveComments(): void {
    const testName = 'Remove comments from code blocks';
    try {
      const content = `# API Test

\`\`\`bash
# This is a comment
curl -X GET "https://api.example.com/users"
# Another comment
\`\`\``;

      const result = ContentPreprocessor.preprocessContent(content);
      
      this.assert(!result.processedContent.includes('# This is a comment'), 
        'Should remove comments');
      this.assert(!result.processedContent.includes('# Another comment'), 
        'Should remove all comments');
      this.assert(result.processedContent.includes('curl'), 
        'Should preserve curl commands');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testNormalizeWhitespace(): void {
    const testName = 'Normalize excessive whitespace';
    try {
      const content = `# API Test



## Section 1


Content here.



## Section 2`;

      const result = ContentPreprocessor.preprocessContent(content);
      
      // Should not have more than 2 consecutive newlines
      this.assert(!result.processedContent.includes('\n\n\n'), 
        'Should remove excessive blank lines');
      this.assert(result.metadata.transformations.includes('normalized_whitespace'), 
        'Should record whitespace normalization');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testEnhanceStructure(): void {
    const testName = 'Enhance markdown structure';
    try {
      const content = `# API Documentation
## Get User
\`\`\`bash
curl -X GET "https://api.example.com/users"
\`\`\``;

      const result = ContentPreprocessor.preprocessContent(content);
      
      this.assert(result.metadata.transformations.includes('enhanced_structure'), 
        'Should record structure enhancement');
      this.assert(result.processedContent.length >= content.length, 
        'Enhanced content should not be shorter');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testAddContextMarkers(): void {
    const testName = 'Add context markers for AI parsing';
    try {
      const content = `# API Documentation

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users"
\`\`\``;

      const result = ContentPreprocessor.preprocessContent(content);
      
      this.assert(result.processedContent.includes('CURL_BLOCK_START'), 
        'Should add curl block start markers');
      this.assert(result.processedContent.includes('CURL_BLOCK_END'), 
        'Should add curl block end markers');
      this.assert(result.metadata.transformations.includes('added_context_markers'), 
        'Should record context marker addition');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testPrepareForAI(): void {
    const testName = 'Prepare content for AI analysis';
    try {
      const content = `# User API

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users/123"
\`\`\``;

      const aiContent = ContentPreprocessor.prepareForAI(content);
      
      this.assert(aiContent.includes('AI PARSING INSTRUCTIONS'), 
        'Should include AI instructions');
      this.assert(aiContent.includes('DOCUMENT METADATA'), 
        'Should include document metadata');
      this.assert(aiContent.includes('curl commands'), 
        'Should mention curl commands in instructions');
      this.assert(aiContent.length > content.length, 
        'AI content should be longer than original');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testPreprocessingOptions(): void {
    const testName = 'Preprocessing with custom options';
    try {
      const content = `# API Test

\`\`\`bash
# Comment
curl -X GET "https://api.example.com/users"
\`\`\``;

      // Test with comments disabled
      const result1 = ContentPreprocessor.preprocessContent(content, {
        removeComments: false,
      });
      
      this.assert(result1.processedContent.includes('# Comment'), 
        'Should preserve comments when removeComments is false');

      // Test with normalization disabled
      const result2 = ContentPreprocessor.preprocessContent(content, {
        normalizeWhitespace: false,
        normalizeCurlCommands: false,
      });
      
      this.assert(!result2.metadata.transformations.includes('normalized_whitespace'), 
        'Should not normalize whitespace when disabled');
      this.assert(!result2.metadata.transformations.includes('normalized_curl_commands'), 
        'Should not normalize curl when disabled');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static testValidatePreprocessedContent(): void {
    const testName = 'Validate preprocessed content';
    try {
      const content = `# API Documentation

## Get User

\`\`\`bash
curl -X GET "https://api.example.com/users"
\`\`\``;

      const preprocessed = ContentPreprocessor.preprocessContent(content);
      const validation = ContentPreprocessor.validatePreprocessedContent(preprocessed);
      
      this.assert(validation.isValid === true, 'Valid preprocessed content should pass validation');
      this.assert(validation.errors.length === 0, 'Should have no errors');

      // Test with invalid content
      const invalidContent = `# API Documentation

Just text, no curl commands.`;

      const invalidPreprocessed = ContentPreprocessor.preprocessContent(invalidContent);
      const invalidValidation = ContentPreprocessor.validatePreprocessedContent(invalidPreprocessed);
      
      this.assert(invalidValidation.isValid === false, 'Invalid content should fail validation');
      this.assert(invalidValidation.errors.length > 0, 'Should have errors for missing curl commands');

      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: String(error) });
    }
  }

  private static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  private static printResults(): void {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;

    console.log(`\nContentPreprocessor Test Results: ${passed}/${total} passed\n`);

    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (passed === total) {
      console.log('\n🎉 All ContentPreprocessor tests passed!');
    } else {
      console.log(`\n⚠️  ${total - passed} ContentPreprocessor tests failed.`);
    }
  }
}