import { BaseFormatter, AnnotationFormatterOptions } from './Formatter.js';
import { Annotation } from '../../types/index.js';
import { formatAnnotationBody } from '../../utils/textFormatter.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'PlainText';

  formatAnnotations(annotations: Annotation[], options?: AnnotationFormatterOptions): string {
    if (options?.hasError) {
      return `Error: ${options.errorMessage || 'Unknown error occurred'}`;
    }

    if (!annotations || annotations.length === 0) {
      if (options?.contextFilter) {
        return `No annotations found for this build with context '${options.contextFilter}'.`;
      }
      return 'No annotations found for this build.';
    }

    const lines: string[] = [];
    
    annotations.forEach((annotation, index) => {
      if (index > 0) {
        lines.push(''); // Add blank line between annotations
      }
      
      lines.push(`Annotation ${index + 1}:`);
      lines.push(`  Context: ${annotation.context}`);
      lines.push(`  Style: ${annotation.style}`);
      
      // Format the body HTML with proper HTML/markdown handling
      const formattedBody = formatAnnotationBody(annotation.body.html);
      
      // Indent the formatted body properly
      const indentedBody = formattedBody
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n');
      
      lines.push(`  Body: ${indentedBody}`);
    });

    return lines.join('\n');
  }
}
