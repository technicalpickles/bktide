import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';

/**
 * Alfred formatter for errors
 * 
 * This formatter provides Alfred-compatible JSON output for error conditions
 * that can be processed by Alfred workflows
 */
export class AlfredFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'alfred';

  /**
   * Format an error for display in Alfred JSON format
   * 
   * @param error The error to format
   * @param options Formatting options
   * @returns Alfred JSON formatted error message
   */
  formatError(error: unknown, options?: ErrorFormatterOptions): string {
    const errorMessage = this.getErrorMessage(error);
    const subtitle = this.getErrorSubtitle(error);
    
    // Create an Alfred JSON response with the error
    const alfredResponse = {
      items: [
        {
          uid: 'error',
          title: `Error: ${errorMessage}`,
          subtitle: subtitle,
          arg: errorMessage,
          icon: {
            path: 'icons/error.png'
          },
          valid: true
        }
      ]
    };
    
    // If debug is enabled, add additional error details
    if (options?.debug) {
      if (error instanceof Error && error.stack) {
        const stackItems = error.stack.split('\n').map((line, index) => ({
          uid: `stack-${index}`,
          title: line.trim(),
          subtitle: 'Stack trace line',
          arg: line,
          icon: {
            path: 'icons/stack.png'
          },
          valid: true
        }));
        
        alfredResponse.items.push(...stackItems);
      }
      
      // Add system info
      alfredResponse.items.push({
        uid: 'system-info',
        title: 'System Information',
        subtitle: `Node ${process.version} on ${process.platform} (${process.arch})`,
        arg: `Node ${process.version} on ${process.platform} (${process.arch})`,
        icon: {
          path: 'icons/info.png'
        },
        valid: false
      });
    }
    
    return JSON.stringify(alfredResponse);
  }
  
  /**
   * Get the primary error message from an error object
   * @param error The error object
   * @returns A string message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message && typeof errorObj.message === 'string') {
        return errorObj.message;
      }
      return 'Unknown object error';
    }
    return String(error);
  }
  
  /**
   * Get a subtitle for the error to display in Alfred
   * @param error The error object
   * @returns A subtitle string
   */
  private getErrorSubtitle(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name} - Press Enter to copy error message`;
    }
    
    // For API errors, check for response errors
    const apiError = error as any;
    if (apiError?.response?.errors && Array.isArray(apiError.response.errors)) {
      const firstError = apiError.response.errors[0];
      if (firstError?.message) {
        return `API Error: ${firstError.message}`;
      }
    }
    
    return 'Press Enter to copy error message';
  }
} 