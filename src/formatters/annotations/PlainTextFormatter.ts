import { BaseFormatter, AnnotationFormatterOptions } from './Formatter.js';
import { Annotation } from '../../types/index.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'PlainText';

  formatAnnotations(annotations: Annotation[], options?: AnnotationFormatterOptions): string {
    if (options?.hasError) {
      return `Error: ${options.errorMessage || 'Unknown error occurred'}`;
    }

    if (!annotations || annotations.length === 0) {
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
      lines.push(`  Body: ${annotation.body.text}`);
    });

    return lines.join('\n');
  }
}
