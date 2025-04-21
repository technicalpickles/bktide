import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Additional options specific to error formatting
 */
export interface ErrorFormatterOptions extends FormatterOptions {
  exitOnError?: boolean;
}

/**
 * Interface for error formatters
 */
export interface ErrorFormatter extends BaseFormatterInterface {
  /**
   * Format an error for display
   * @param error The error to format
   * @param options Formatting options
   * @returns Formatted error message
   */
  formatError(error: unknown, options?: ErrorFormatterOptions): string;
}

/**
 * Base class for error formatters
 */
export abstract class BaseErrorFormatter implements ErrorFormatter {
  abstract name: string;
  
  abstract formatError(error: unknown, options?: ErrorFormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Debug: Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 