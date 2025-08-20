import { BaseFormatter, AnnotationFormatterOptions } from './Formatter.js';
import { Annotation } from '../../types/index.js';
import { formatAnnotationBody } from '../../utils/textFormatter.js';
import { SEMANTIC_COLORS, formatEmptyState, formatError } from '../../ui/theme.js';
import { useAscii } from '../../ui/symbols.js';
import { termWidth } from '../../ui/width.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'PlainText';

  formatAnnotations(annotations: Annotation[], options?: AnnotationFormatterOptions): string {
    if (options?.hasError) {
      return formatError(options.errorMessage || 'Failed to fetch annotations', {
        showHelp: true,
        helpCommand: 'bktide annotations --help'
      });
    }

    if (!annotations || annotations.length === 0) {
      const message = options?.contextFilter
        ? `No annotations found for this build with context '${options.contextFilter}'`
        : 'No annotations found for this build';
      
      return formatEmptyState(message, [
        'Annotations are created by build steps',
        'Check the build has completed and has annotation steps'
      ]);
    }

    const lines: string[] = [];
    const isAscii = useAscii();
    const terminalWidth = termWidth();
    
    // Box drawing characters
    const boxChars = isAscii ? {
      horizontal: '-',
      vertical: '|',
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      cross: '+',
      verticalRight: '+',
      verticalLeft: '+',
      horizontalDown: '+',
      horizontalUp: '+'
    } : {
      horizontal: '─',
      vertical: '│',
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      cross: '┼',
      verticalRight: '├',
      verticalLeft: '┤',
      horizontalDown: '┬',
      horizontalUp: '┴'
    };
    
    // Style symbols for different annotation types (handle both cases)
    const styleSymbols: Record<string, string> = {
      error: isAscii ? '[X]' : '✖',
      ERROR: isAscii ? '[X]' : '✖',
      warning: isAscii ? '[!]' : '⚠',
      WARNING: isAscii ? '[!]' : '⚠',
      info: isAscii ? '[i]' : 'ℹ',
      INFO: isAscii ? '[i]' : 'ℹ',
      success: isAscii ? '[✓]' : '✓',
      SUCCESS: isAscii ? '[✓]' : '✓'
    };
    
    // Style colors for different annotation types (handle both cases)
    const styleColors: Record<string, (s: string) => string> = {
      error: SEMANTIC_COLORS.error,
      ERROR: SEMANTIC_COLORS.error,
      warning: SEMANTIC_COLORS.warning,
      WARNING: SEMANTIC_COLORS.warning,
      info: SEMANTIC_COLORS.info,
      INFO: SEMANTIC_COLORS.info,
      success: SEMANTIC_COLORS.success,
      SUCCESS: SEMANTIC_COLORS.success
    };
    
    // Create a horizontal divider with padding and centering
    const createDivider = (width: number = 80) => {
      const padding = 2; // 1 space on each side
      const maxWidth = Math.min(width, terminalWidth - padding);
      const dividerLength = Math.max(20, maxWidth - padding); // Minimum 20 chars
      const divider = boxChars.horizontal.repeat(dividerLength);
      
      // Center the divider within the terminal width
      const totalPadding = terminalWidth - dividerLength;
      const leftPadding = Math.floor(totalPadding / 2);
      const spaces = ' '.repeat(Math.max(0, leftPadding));
      
      return SEMANTIC_COLORS.dim(spaces + divider);
    };
    
    annotations.forEach((annotation, index) => {
      const symbol = styleSymbols[annotation.style] || (isAscii ? '*' : '•');
      const colorFn = styleColors[annotation.style] || ((s: string) => s);
      
      // Add divider between annotations (but not before the first one)
      if (index > 0) {
        lines.push('');
        lines.push(createDivider());
        lines.push('');
      }
      
      // Single line header with pipe: "│ ℹ info: test-mapping-build"
      const pipe = colorFn(boxChars.vertical);
      const header = `${pipe} ${symbol} ${annotation.style.toLowerCase()}: ${annotation.context}`;
      lines.push(header);
      
      // Add blank line with pipe for visual continuity
      lines.push(pipe);
      
      // Format the body HTML with proper HTML/markdown handling
      const formattedBody = formatAnnotationBody(annotation.body.html);
      
      // Add vertical pipes to the left of the body content for visual continuity
      // Use the same color as the header for the pipes
      const bodyLines = formattedBody.split('\n');
      bodyLines.forEach((line) => {
        const paddedLine = line ? ` ${line}` : '';
        lines.push(`${pipe}${paddedLine}`);
      });
    });
    
    // Add summary footer
    if (annotations.length > 1) {
      lines.push('');
      lines.push(createDivider());
      lines.push('');
      lines.push(SEMANTIC_COLORS.dim(`${SEMANTIC_COLORS.count(annotations.length.toString())} annotations found`));
    }

    return lines.join('\n');
  }
}
