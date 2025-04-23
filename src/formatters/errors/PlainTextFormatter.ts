import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';

/**
 * Plain text formatter for errors
 */
export class PlainTextFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'plain';

  /**
   * Format one or more errors for display in plain text
   * 
   * @param errors The error(s) to format
   * @param options Formatting options
   * @returns Formatted error message
   */
  formatError(errors: unknown | unknown[], options?: ErrorFormatterOptions): string {
    const errorArray = Array.isArray(errors) ? errors : [errors];
    let output = '';

    for (const error of errorArray) {
      if (output) output += '\n\n'; // Add spacing between multiple errors

      // Add error header
      output += `\x1b[31m${this.getErrorName(error)}: ${this.getErrorMessage(error)}\x1b[0m\n`;

      // Add stack trace if available and debug is enabled
      const stack = this.getStackTrace(error);
      if (stack && options?.debug) {
        output += `\n\x1b[33mStack Trace:\x1b[0m\n${stack}\n`;
      }

      // Add API errors if present
      const apiErrors = this.getApiErrors(error);
      if (apiErrors?.length) {
        output += '\n\x1b[33mAPI Errors:\x1b[0m\n';
        apiErrors.forEach((apiError, index) => {
          output += `  Error ${index + 1}: ${apiError.message || 'Unknown error'}\n`;
          if (apiError.path) output += `  Path: ${apiError.path.join('.')}\n`;
          if (apiError.locations) output += `  Locations: ${JSON.stringify(apiError.locations)}\n`;
        });
      }

      // Add request details if available and debug is enabled
      const request = this.getRequestDetails(error);
      if (request && options?.debug) {
        output += '\n\x1b[36mRequest Details:\x1b[0m\n';
        if (request.url) output += `  URL: ${request.url}\n`;
        if (request.method) output += `  Method: ${request.method}\n`;
      }
    }

    return output;
  }
} 