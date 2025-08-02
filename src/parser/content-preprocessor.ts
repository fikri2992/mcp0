import {
  PreprocessedContent,
  MarkdownStructure,
  CurlCommand,
  ValidationResult,
} from './types.js';
import { MarkdownParser } from './markdown-parser.js';

/**
 * Content preprocessor for preparing markdown content for AI analysis
 */
export class ContentPreprocessor {
  private static readonly MULTILINE_CURL_REGEX = /curl\s+(?:[^\\]|\\.)*?(?:\\\s*\n\s*)*[^\\]*$/gm;
  private static readonly COMMENT_REGEX = /^\s*#.*$/gm;
  private static readonly EXCESSIVE_WHITESPACE_REGEX = /\n\s*\n\s*\n/g;

  /**
   * Preprocess markdown content for AI analysis
   */
  public static preprocessContent(
    content: string,
    options: PreprocessingOptions = {}
  ): PreprocessedContent {
    const startTime = new Date().toISOString();
    const originalLines = content.split('\n').length;
    const transformations: string[] = [];

    let processedContent = content;

    // Apply preprocessing transformations
    if (options.normalizeCurlCommands !== false) {
      processedContent = this.normalizeCurlCommands(processedContent);
      transformations.push('normalized_curl_commands');
    }

    if (options.removeComments !== false) {
      processedContent = this.removeComments(processedContent);
      transformations.push('removed_comments');
    }

    if (options.normalizeWhitespace !== false) {
      processedContent = this.normalizeWhitespace(processedContent);
      transformations.push('normalized_whitespace');
    }

    if (options.enhanceStructure !== false) {
      processedContent = this.enhanceStructure(processedContent);
      transformations.push('enhanced_structure');
    }

    if (options.addContextMarkers !== false) {
      processedContent = this.addContextMarkers(processedContent);
      transformations.push('added_context_markers');
    }

    // Extract structure and curl commands from processed content
    const structure = MarkdownParser.parseMarkdown(processedContent);
    const extractedCurls = MarkdownParser.extractCurlCommands(processedContent, structure);

    const processedLines = processedContent.split('\n').length;

    return {
      originalContent: content,
      processedContent,
      extractedCurls,
      structure,
      metadata: {
        preprocessedAt: startTime,
        transformations,
        statistics: {
          originalLines,
          processedLines,
          curlCommandsFound: extractedCurls.length,
          headingsFound: structure.headings.length,
          codeBlocksFound: structure.codeBlocks.length,
        },
      },
    };
  }

  /**
   * Normalize curl commands for better AI parsing
   */
  private static normalizeCurlCommands(content: string): string {
    return content.replace(this.MULTILINE_CURL_REGEX, (match) => {
      // Remove line continuation backslashes and normalize spacing
      let normalized = match
        .replace(/\\\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Ensure proper spacing around flags
      normalized = normalized
        .replace(/(-[A-Za-z])\s*([^-\s])/g, '$1 $2')
        .replace(/(--\w+)\s*([^-\s])/g, '$1 $2');

      return normalized;
    });
  }

  /**
   * Remove comments from code blocks
   */
  private static removeComments(content: string): string {
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBlockLanguage = '';

    return lines
      .map(line => {
        if (line.startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            codeBlockLanguage = line.slice(3).trim().toLowerCase();
          } else {
            inCodeBlock = false;
            codeBlockLanguage = '';
          }
          return line;
        }

        if (inCodeBlock && (codeBlockLanguage === 'bash' || codeBlockLanguage === 'sh' || codeBlockLanguage === '')) {
          // Remove comments from bash/shell code blocks, but preserve lines that contain curl
          if (line.trim().startsWith('#') && !line.includes('curl')) {
            return null; // Mark for removal
          }
        }

        return line;
      })
      .filter(line => line !== null) // Remove null lines
      .join('\n');
  }

  /**
   * Normalize whitespace and remove excessive blank lines
   */
  private static normalizeWhitespace(content: string): string {
    return content
      .replace(this.EXCESSIVE_WHITESPACE_REGEX, '\n\n')
      .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
      .replace(/^\s*\n/gm, '\n') // Remove leading whitespace on empty lines
      .trim();
  }

  /**
   * Enhance markdown structure for better AI understanding
   */
  private static enhanceStructure(content: string): string {
    const lines = content.split('\n');
    const enhanced: string[] = [];
    let inCodeBlock = false;
    let lastHeadingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];

      // Track code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }

      // Enhance headings
      if (!inCodeBlock && line.match(/^#{1,6}\s+/)) {
        const level = line.match(/^(#{1,6})/)?.[1].length || 0;
        lastHeadingLevel = level;

        // Add spacing before headings if needed
        if (enhanced.length > 0 && !enhanced[enhanced.length - 1].trim()) {
          enhanced.push('');
        }
      }

      // Add context before curl commands
      if (!inCodeBlock && nextLine?.startsWith('```') && 
          lines[i + 2]?.includes('curl')) {
        // Check if there's a description before the code block
        if (!line.trim() && enhanced.length > 0) {
          const prevLine = enhanced[enhanced.length - 1];
          if (!prevLine.startsWith('#') && prevLine.trim()) {
            // Add a separator comment
            enhanced.push('');
            enhanced.push('<!-- API Endpoint -->');
          }
        }
      }

      enhanced.push(line);
    }

    return enhanced.join('\n');
  }

  /**
   * Add context markers for AI parsing
   */
  private static addContextMarkers(content: string): string {
    const lines = content.split('\n');
    const marked: string[] = [];
    let inCodeBlock = false;
    let codeBlockCount = 0;
    let currentHeading = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track headings
      if (line.match(/^#{1,6}\s+/)) {
        currentHeading = line.replace(/^#{1,6}\s+/, '').trim();
      }

      // Track code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockCount++;
          
          // Check if this is a curl command block
          const nextFewLines = lines.slice(i + 1, i + 5).join('\n');
          if (nextFewLines.includes('curl')) {
            marked.push(`<!-- CURL_BLOCK_START: ${currentHeading || `Block_${codeBlockCount}`} -->`);
          }
        } else {
          inCodeBlock = false;
          
          // Check if we just closed a curl command block
          const prevFewLines = lines.slice(Math.max(0, i - 10), i).join('\n');
          if (prevFewLines.includes('curl')) {
            marked.push(line);
            marked.push(`<!-- CURL_BLOCK_END -->`);
            continue;
          }
        }
      }

      marked.push(line);
    }

    return marked.join('\n');
  }

  /**
   * Prepare content specifically for AI analysis
   */
  public static prepareForAI(
    content: string,
    options: AIPreparationOptions = {}
  ): string {
    const preprocessed = this.preprocessContent(content, {
      normalizeCurlCommands: true,
      removeComments: true,
      normalizeWhitespace: true,
      enhanceStructure: true,
      addContextMarkers: true,
      ...options,
    });

    let aiContent = preprocessed.processedContent;

    // Add AI-specific enhancements
    if (options.addInstructions !== false) {
      const instructions = this.generateAIInstructions(preprocessed);
      aiContent = `${instructions}\n\n${aiContent}`;
    }

    if (options.addMetadata !== false) {
      const metadata = this.generateMetadata(preprocessed);
      aiContent = `${aiContent}\n\n${metadata}`;
    }

    return aiContent;
  }

  /**
   * Generate AI instructions based on content analysis
   */
  private static generateAIInstructions(preprocessed: PreprocessedContent): string {
    const { statistics } = preprocessed.metadata;
    
    const instructions = [
      '<!-- AI PARSING INSTRUCTIONS -->',
      '<!-- This markdown document contains API specifications with curl commands. -->',
      `<!-- Found ${statistics.curlCommandsFound} curl commands in ${statistics.codeBlocksFound} code blocks. -->`,
      `<!-- Document has ${statistics.headingsFound} headings for organization. -->`,
      '<!-- Please extract API specifications from curl commands, including: -->',
      '<!-- - HTTP method and URL -->',
      '<!-- - Headers and authentication -->',
      '<!-- - Request body and parameters -->',
      '<!-- - Context from surrounding headings and descriptions -->',
      '<!-- END AI PARSING INSTRUCTIONS -->',
    ];

    return instructions.join('\n');
  }

  /**
   * Generate metadata section for AI context
   */
  private static generateMetadata(preprocessed: PreprocessedContent): string {
    const { statistics, transformations } = preprocessed.metadata;
    
    const metadata = [
      '<!-- DOCUMENT METADATA -->',
      `<!-- Processed at: ${preprocessed.metadata.preprocessedAt} -->`,
      `<!-- Transformations applied: ${transformations.join(', ')} -->`,
      `<!-- Statistics: -->`,
      `<!--   - Original lines: ${statistics.originalLines} -->`,
      `<!--   - Processed lines: ${statistics.processedLines} -->`,
      `<!--   - Curl commands: ${statistics.curlCommandsFound} -->`,
      `<!--   - Headings: ${statistics.headingsFound} -->`,
      `<!--   - Code blocks: ${statistics.codeBlocksFound} -->`,
      '<!-- END DOCUMENT METADATA -->',
    ];

    return metadata.join('\n');
  }

  /**
   * Validate preprocessed content
   */
  public static validatePreprocessedContent(
    preprocessed: PreprocessedContent
  ): ValidationResult {
    const validation = MarkdownParser.validateMarkdown(preprocessed.processedContent);
    
    // Add preprocessing-specific validations
    if (preprocessed.extractedCurls.length === 0) {
      validation.errors.push({
        type: 'content',
        message: 'No valid curl commands found after preprocessing',
        suggestions: [
          'Check that curl commands are properly formatted',
          'Ensure curl commands are in code blocks',
          'Verify that URLs are valid and complete',
        ],
      });
    }

    // Check for common preprocessing issues
    if (preprocessed.metadata.transformations.length === 0) {
      validation.warnings.push({
        type: 'content',
        message: 'No preprocessing transformations were applied',
        suggestions: ['Content may not be optimized for AI analysis'],
      });
    }

    return validation;
  }
}

/**
 * Options for content preprocessing
 */
export interface PreprocessingOptions {
  normalizeCurlCommands?: boolean;
  removeComments?: boolean;
  normalizeWhitespace?: boolean;
  enhanceStructure?: boolean;
  addContextMarkers?: boolean;
}

/**
 * Options for AI preparation
 */
export interface AIPreparationOptions extends PreprocessingOptions {
  addInstructions?: boolean;
  addMetadata?: boolean;
}