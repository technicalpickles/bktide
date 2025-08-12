import { BaseFormatter, AnnotationFormatterOptions } from './Formatter.js';
import { Annotation } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  name = 'JSON';

  formatAnnotations(annotations: Annotation[], options?: AnnotationFormatterOptions): string {
    if (options?.hasError) {
      return JSON.stringify({
        error: true,
        message: options.errorMessage || 'Unknown error occurred',
        type: options.errorType || 'unknown'
      }, null, 2);
    }

    const result = {
      annotations: annotations || [],
      count: annotations ? annotations.length : 0,
      ...(options?.contextFilter && { contextFilter: options.contextFilter })
    };

    return JSON.stringify(result, null, 2);
  }
}
