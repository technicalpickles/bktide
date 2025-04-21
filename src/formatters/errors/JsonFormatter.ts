import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';

/**
 * JSON formatter for errors
 */
export class JsonFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'json';

  /**
   * Format an error for display in JSON format
   * 
   * @param error The error to format
   * @param options Formatting options
   * @returns JSON formatted error message
   */
  formatError(error: unknown, options?: ErrorFormatterOptions): string {
    const errorObj: Record<string, unknown> = {
      success: false,
      error: {}
    };

    if (error instanceof Error) {
      // Handle standard Error objects
      const errorData: Record<string, unknown> = {
        name: error.name,
        message: error.message,
        stack: options?.debug ? error.stack : undefined
      };
      
      // Handle API errors
      const apiError = error as any;
      if (apiError.response?.errors) {
        errorData.apiErrors = apiError.response.errors;
      }
      
      if (options?.debug && apiError.request) {
        errorData.request = {
          url: apiError.request.url,
          method: apiError.request.method
        };
      }
      
      // If error has a cause, include it
      if (apiError.cause) {
        errorData.cause = this.extractErrorDetails(apiError.cause, options?.debug);
      }
      
      errorObj.error = errorData;
    } else if (error && typeof error === 'object') {
      // For non-Error objects, we attempt to serialize them directly
      try {
        errorObj.error = this.extractErrorDetails(error, options?.debug);
      } catch (e) {
        errorObj.error = { message: 'Unable to stringify error object' };
      }
    } else {
      // Handle primitive values
      errorObj.error = { message: String(error) };
    }
    
    // Add debug information if requested
    if (options?.debug) {
      errorObj.debug = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: `${process.platform} (${process.arch})`
      };
    }
    
    return JSON.stringify(errorObj, null, 2);
  }
  
  /**
   * Extract relevant details from an error object
   * @param error The error object
   * @param includeDebug Whether to include debug information
   * @returns An object with error details
   */
  private extractErrorDetails(error: unknown, includeDebug = false): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: includeDebug ? error.stack : undefined
      };
    } else if (error && typeof error === 'object') {
      const result: Record<string, unknown> = {};
      const errorObj = error as Record<string, unknown>;
      
      // Add message if it exists
      if (errorObj.message) {
        result.message = errorObj.message;
      }
      
      // Add other properties for debug mode
      if (includeDebug) {
        for (const key in errorObj) {
          if (key !== 'stack' && key !== 'message') {
            try {
              result[key] = errorObj[key];
            } catch {
              result[key] = '[Cannot stringify]';
            }
          }
        }
      }
      
      return result;
    }
    
    // Fallback for primitives
    return { message: String(error) };
  }
} 