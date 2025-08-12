import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Annotation } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface AnnotationFormatterOptions extends FormatterOptions {
  // Error information
  hasError?: boolean;
  errorMessage?: string;
  errorType?: 'access' | 'not_found' | 'api' | 'unknown';
  accessErrors?: string[];
}

export interface AnnotationFormatter extends BaseFormatterInterface {
  formatAnnotations(annotations: Annotation[], options?: AnnotationFormatterOptions): string;
}

export abstract class BaseFormatter implements AnnotationFormatter {
  abstract name: string;
  
  abstract formatAnnotations(annotations: Annotation[], options?: AnnotationFormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
}
