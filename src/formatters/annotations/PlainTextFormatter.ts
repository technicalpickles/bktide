import { BaseFormatter, AnnotationFormatterOptions } from './Formatter.js';
import { Annotation } from '../../types/index.js';
import { formatAnnotationBody } from '../../utils/textFormatter.js';
import { SEMANTIC_COLORS, formatEmptyState, formatError } from '../../ui/theme.js';

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
    
    // Style symbols for different annotation types
    const styleSymbols: Record<string, string> = {
      error: '✖',
      warning: '⚠',
      info: 'ℹ',
      success: '✓'
    };
    
    // Style colors for different annotation types
    const styleColors: Record<string, (s: string) => string> = {
      error: SEMANTIC_COLORS.error,
      warning: SEMANTIC_COLORS.warning,
      info: SEMANTIC_COLORS.info,
      success: SEMANTIC_COLORS.success
    };
    
    annotations.forEach((annotation, index) => {
      if (index > 0) {
        lines.push(''); // Add blank line between annotations
      }
      
      const symbol = styleSymbols[annotation.style] || '•';
      const colorFn = styleColors[annotation.style] || ((s: string) => s);
      
      // Style with symbol and color
      lines.push(colorFn(`${symbol} ${annotation.context} (${annotation.style})`));
      lines.push('');
      
      // Format the body HTML with proper HTML/markdown handling
      const formattedBody = formatAnnotationBody(annotation.body.html);
      
      // Indent the formatted body properly
      const indentedBody = formattedBody
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      
      lines.push(indentedBody);
    });
    
    // Add summary if multiple annotations
    if (annotations.length > 1) {
      lines.push('');
      lines.push(SEMANTIC_COLORS.dim(`${SEMANTIC_COLORS.count(annotations.length.toString())} annotations found`));
    }

    return lines.join('\n');
  }
}
