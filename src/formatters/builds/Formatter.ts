import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Build } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface BuildFormatterOptions extends FormatterOptions {
  // Error information
  hasError?: boolean;
  errorMessage?: string;
  errorType?: 'access' | 'not_found' | 'api' | 'unknown';
  accessErrors?: string[];
}

export interface BuildFormatter extends BaseFormatterInterface {
  formatBuilds(builds: Build[], options?: BuildFormatterOptions): string;
}

export abstract class BaseFormatter implements BuildFormatter {
  abstract name: string;
  
  abstract formatBuilds(builds: Build[], options?: BuildFormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 