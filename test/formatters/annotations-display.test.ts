import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlainTextFormatter } from '../../src/formatters/annotations/PlainTextFormatter.js';
import { Annotation } from '../../src/types/index.js';

describe('Annotations PlainTextFormatter - Visual Display', () => {
  let formatter: PlainTextFormatter;
  let originalColumns: string | undefined;
  let originalAscii: string | undefined;

  beforeEach(() => {
    formatter = new PlainTextFormatter();
    // Save original env vars
    originalColumns = process.env.COLUMNS;
    originalAscii = process.env.BKTIDE_ASCII;
    // Set consistent terminal width for tests
    process.env.COLUMNS = '100';
    // Clear ASCII mode by default
    delete process.env.BKTIDE_ASCII;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalColumns !== undefined) {
      process.env.COLUMNS = originalColumns;
    } else {
      delete process.env.COLUMNS;
    }
    if (originalAscii !== undefined) {
      process.env.BKTIDE_ASCII = originalAscii;
    } else {
      delete process.env.BKTIDE_ASCII;
    }
  });

  const createAnnotation = (
    id: string,
    context: string,
    style: 'info' | 'warning' | 'error' | 'success',
    htmlBody: string
  ): Annotation => ({
    id,
    context,
    style,
    body: {
      html: htmlBody,
      text: htmlBody.replace(/<[^>]*>/g, '') // Simple HTML strip for text
    },
    createdAt: '2024-01-15T10:00:00Z',
    createdBy: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      avatar: {
        url: 'https://example.com/avatar.png'
      }
    }
  });

  describe('Box-drawing characters and dividers', () => {
    it('should display horizontal dividers between multiple annotations', () => {
      const annotations = [
        createAnnotation('1', 'Test 1', 'error', '<p>Error message</p>'),
        createAnnotation('2', 'Test 2', 'warning', '<p>Warning message</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should contain horizontal divider (─ repeated)
      expect(result).toMatch(/─{40,}/); // At least 40 dashes
      
      // Should have divider between annotations but not before first or after last
      const lines = result.split('\n');
      const dividerLines = lines.filter(line => line.includes('─'));
      expect(dividerLines.length).toBeGreaterThanOrEqual(1); // At least one divider between annotations
    });

    it('should not display dividers for single annotation', () => {
      const annotations = [
        createAnnotation('1', 'Single Test', 'info', '<p>Info message</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should not contain horizontal dividers for single annotation
      expect(result).not.toMatch(/─{40,}/);
    });

    it('should display summary divider when multiple annotations exist', () => {
      const annotations = [
        createAnnotation('1', 'Test 1', 'error', '<p>Error</p>'),
        createAnnotation('2', 'Test 2', 'warning', '<p>Warning</p>'),
        createAnnotation('3', 'Test 3', 'info', '<p>Info</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should have divider before summary
      expect(result).toContain('3 annotations found');
      const lines = result.split('\n');
      const summaryIndex = lines.findIndex(line => line.includes('3 annotations found'));
      // Should have a divider line before the summary
      expect(lines[summaryIndex - 2]).toMatch(/─{40,}/);
    });
  });

  describe('Vertical pipes for continuous blocks', () => {
    it('should display vertical pipes for annotation body content', () => {
      const annotations = [
        createAnnotation('1', 'Test Block', 'error', '<p>Line 1</p><p>Line 2</p><p>Line 3</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should contain vertical pipes (│)
      expect(result).toContain('│');
      
      // Each body line should start with a vertical pipe
      const lines = result.split('\n');
      const bodyLines = lines.filter(line => line.startsWith('│'));
      expect(bodyLines.length).toBeGreaterThan(0);
    });

    it('should maintain vertical pipes for multi-line content', () => {
      const annotations = [
        createAnnotation('1', 'Multi-line', 'warning', 
          '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>')
      ];

      const result = formatter.formatAnnotations(annotations);
      const lines = result.split('\n');
      
      // Count lines with vertical pipes
      const pipedLines = lines.filter(line => line.startsWith('│'));
      expect(pipedLines.length).toBeGreaterThanOrEqual(3); // At least 3 lines for the list items
    });

    it('should handle empty lines in body with pipes', () => {
      const annotations = [
        createAnnotation('1', 'With Empty Lines', 'info', 
          '<p>Paragraph 1</p><br/><p>Paragraph 2</p>')
      ];

      const result = formatter.formatAnnotations(annotations);
      
      // Should have pipes even for empty lines
      const lines = result.split('\n');
      const pipedLines = lines.filter(line => line.startsWith('│'));
      
      // Should have at least one empty piped line
      const emptyPipedLine = pipedLines.find(line => line === '│');
      expect(emptyPipedLine).toBeDefined();
    });
  });

  describe('ASCII fallback mode', () => {
    beforeEach(() => {
      process.env.BKTIDE_ASCII = '1';
    });

    it('should use ASCII characters for dividers in ASCII mode', () => {
      const annotations = [
        createAnnotation('1', 'Test 1', 'error', '<p>Error</p>'),
        createAnnotation('2', 'Test 2', 'warning', '<p>Warning</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should use regular dashes (-) instead of box-drawing (─)
      expect(result).toMatch(/-{40,}/);
      expect(result).not.toContain('─');
    });

    it('should use ASCII vertical pipes in ASCII mode', () => {
      const annotations = [
        createAnnotation('1', 'ASCII Test', 'info', '<p>Content line 1</p><p>Content line 2</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should use regular pipe (|) instead of box-drawing (│)
      expect(result).toContain('|');
      expect(result).not.toContain('│');
    });

    it('should use ASCII symbols for annotation styles', () => {
      const annotations = [
        createAnnotation('1', 'Error', 'error', '<p>Error</p>'),
        createAnnotation('2', 'Warning', 'warning', '<p>Warning</p>'),
        createAnnotation('3', 'Info', 'info', '<p>Info</p>'),
        createAnnotation('4', 'Success', 'success', '<p>Success</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should use ASCII symbols
      expect(result).toContain('[X]'); // Error
      expect(result).toContain('[!]'); // Warning
      expect(result).toContain('[i]'); // Info
      expect(result).toContain('[✓]'); // Success (or could be [OK])
      
      // Should not use Unicode symbols
      expect(result).not.toContain('✖');
      expect(result).not.toContain('⚠');
      expect(result).not.toContain('ℹ');
    });
  });

  describe('Terminal width responsiveness', () => {
    it('should adapt divider width to terminal size', () => {
      process.env.COLUMNS = '60';
      const annotations = [
        createAnnotation('1', 'Test 1', 'error', '<p>Error</p>'),
        createAnnotation('2', 'Test 2', 'warning', '<p>Warning</p>')
      ];

      const result = formatter.formatAnnotations(annotations);
      const lines = result.split('\n');
      const dividerLine = lines.find(line => line.includes('─'));
      
      // Divider should be constrained to terminal width minus padding
      expect(dividerLine).toBeDefined();
      if (dividerLine) {
        // Should be less than 60 - 2 (padding) = 58 characters
        expect(dividerLine.length).toBeLessThanOrEqual(58);
      }
    });

    it('should handle very narrow terminals', () => {
      process.env.COLUMNS = '40'; // Minimum width
      const annotations = [
        createAnnotation('1', 'Narrow', 'info', '<p>Content for narrow terminal</p>')
      ];

      const result = formatter.formatAnnotations(annotations);
      
      // Should still format correctly
      expect(result).toBeTruthy();
      expect(result).toContain('│'); // Should still have pipes
    });
  });

  describe('Annotation styling and headers', () => {
    it('should display context and style on single line with pipe', () => {
      const annotations = [
        createAnnotation('1', 'Security Check', 'error', '<p>Vulnerability found</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should have single line header with pipe, symbol, style, and context
      expect(result).toContain('│ ✖ error: Security Check');
      
      // Should not have separate style badge
      expect(result).not.toContain('[error]');
    });

    it('should apply color styling to headers', () => {
      const annotations = [
        createAnnotation('1', 'Error Context', 'error', '<p>Error</p>'),
        createAnnotation('2', 'Warning Context', 'warning', '<p>Warning</p>'),
        createAnnotation('3', 'Info Context', 'info', '<p>Info</p>'),
        createAnnotation('4', 'Success Context', 'success', '<p>Success</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Headers should include pipes, symbols, style and context
      expect(result).toMatch(/│\s*[✖×X].*error:.*Error Context/);
      expect(result).toMatch(/│\s*[⚠!].*warning:.*Warning Context/);
      expect(result).toMatch(/│\s*[ℹi].*info:.*Info Context/);
      expect(result).toMatch(/│\s*[✓✔].*success:.*Success Context/);
    });
  });

  describe('Empty states and errors', () => {
    it('should display empty state for no annotations', () => {
      const result = formatter.formatAnnotations([]);

      expect(result).toContain('No annotations found for this build');
      expect(result).toContain('Annotations are created by build steps');
      expect(result).not.toContain('│'); // No pipes in empty state
      expect(result).not.toContain('─'); // No dividers in empty state
    });

    it('should display context-filtered empty state', () => {
      const result = formatter.formatAnnotations([], { contextFilter: 'deployment' });

      expect(result).toContain("No annotations found for this build with context 'deployment'");
      expect(result).toContain('Check the build has completed');
    });

    it('should display error state', () => {
      const result = formatter.formatAnnotations([], { 
        hasError: true, 
        errorMessage: 'Failed to fetch annotations from API' 
      });

      expect(result).toContain('Failed to fetch annotations from API');
      expect(result).toContain('bktide annotations --help');
    });
  });

  describe('Complex content formatting', () => {
    it('should handle HTML lists properly', () => {
      const annotations = [
        createAnnotation('1', 'Task List', 'info', 
          '<ul><li>First item</li><li>Second item</li><li>Third item</li></ul>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should format list items with pipes
      // Note: htmlToText formats lists with varying indentation
      expect(result).toMatch(/│\s+\* First item/);
      expect(result).toMatch(/│\s+\* Second item/);
      expect(result).toMatch(/│\s+\* Third item/);
    });

    it('should handle code blocks', () => {
      const annotations = [
        createAnnotation('1', 'Code Example', 'warning', 
          '<pre>npm run test\nnpm run build</pre>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Code should be indented with pipes
      expect(result).toContain('│ npm run test');
      expect(result).toContain('│ npm run build');
    });

    it('should handle mixed content', () => {
      const annotations = [
        createAnnotation('1', 'Build Report', 'error', 
          '<p>Build failed with errors:</p>' +
          '<ul><li>TypeScript error in file.ts</li><li>Linting issues</li></ul>' +
          '<p>Run <code>npm run fix</code> to resolve.</p>')
      ];

      const result = formatter.formatAnnotations(annotations);

      // Should handle all content types
      expect(result).toContain('│ Build failed with errors:');
      expect(result).toContain('│  * TypeScript error');
      expect(result).toContain('│ Run npm run fix to resolve.');
    });
  });

  describe('Visual continuity and scrollability', () => {
    it('should create visually continuous blocks with pipes', () => {
      const annotations = [
        createAnnotation('1', 'Long Annotation', 'info',
          '<p>Line 1 of content</p>' +
          '<p>Line 2 of content</p>' +
          '<p>Line 3 of content</p>' +
          '<p>Line 4 of content</p>' +
          '<p>Line 5 of content</p>')
      ];

      const result = formatter.formatAnnotations(annotations);
      const lines = result.split('\n');
      
      // Find start and end of piped content
      const firstPipeIndex = lines.findIndex(line => line.startsWith('│'));
      const lastPipeIndex = lines.lastIndexOf(lines.filter(line => line.startsWith('│')).pop() || '');
      
      // All lines between should be continuous (all have pipes)
      for (let i = firstPipeIndex; i <= lastPipeIndex; i++) {
        expect(lines[i].startsWith('│')).toBe(true);
      }
    });

    it('should separate multiple annotations clearly', () => {
      const annotations = [
        createAnnotation('1', 'First Block', 'error', '<p>Content 1</p>'),
        createAnnotation('2', 'Second Block', 'warning', '<p>Content 2</p>'),
        createAnnotation('3', 'Third Block', 'info', '<p>Content 3</p>')
      ];

      const result = formatter.formatAnnotations(annotations);
      
      // Should have clear separation between annotations
      const dividerCount = (result.match(/─{40,}/g) || []).length;
      expect(dividerCount).toBeGreaterThanOrEqual(3); // Between annotations + before summary
    });
  });
});
