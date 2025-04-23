import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';

/**
 * JSON formatter for errors
 */
export class JsonFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'json';

  /**
   * Format one or more errors for display in JSON format
   * 
   * @param errors The error(s) to format
   * @param options Formatting options
   * @returns JSON formatted error message
   */
  formatError(errors: unknown | unknown[], options?: ErrorFormatterOptions): string {
    const errorArray = Array.isArray(errors) ? errors : [errors];
    const formattedErrors = errorArray.map(error => this.formatSingleError(error, options?.debug));
    
    const result = {
      success: false,
      errors: formattedErrors,
      debug: options?.debug ? this.getDebugInfo() : undefined
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Format a single error object
   * @param error The error to format
   * @param includeDebug Whether to include debug information
   * @returns Formatted error object
   */
  private formatSingleError(error: unknown, includeDebug = false): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.getErrorName(error),
      message: this.getErrorMessage(error)
    };

    if (includeDebug) {
      const stack = this.getStackTrace(error);
      if (stack) {
        result.stack = stack;
      }
    }

    const apiErrors = this.getApiErrors(error);
    if (apiErrors?.length) {
      result.apiErrors = apiErrors;
    }

    const request = this.getRequestDetails(error);
    if (request && includeDebug) {
      result.request = request;
    }

    return result;
  }

  /**
   * Get debug information about the system
   * @returns Debug information object
   */
  private getDebugInfo(): Record<string, string> {
    return {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: `${process.platform} (${process.arch})`
    };
  }
} 