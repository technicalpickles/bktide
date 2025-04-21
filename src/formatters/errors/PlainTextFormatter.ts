import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';
import { formatErrorForCLI } from '../../utils/cli-error-handler.js';

/**
 * Plain text formatter for errors
 */
export class PlainTextFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'plain';

  /**
   * Format an error for display in plain text
   * Uses the existing CLI error formatter
   * 
   * @param error The error to format
   * @param options Formatting options
   * @returns Formatted error message
   */
  formatError(error: unknown, options?: ErrorFormatterOptions): string {
    return formatErrorForCLI(error, options?.debug);
  }
} 