/**
 * CLI Error Handler - Provides error display for CLI applications
 */

import { logger } from '../services/logger.js';
import { FormatterFactory, FormatterType } from '../formatters/FormatterFactory.js';
import { ErrorFormatter } from '../formatters/errors/index.js';

// Default format to use for error output
let globalErrorFormat = 'plain';

/**
 * Set the global error output format
 * @param format The format to use ('plain', 'json', 'alfred')
 */
export function setErrorFormat(format: string): void {
  const normalizedFormat = format.toLowerCase().trim();
  if (['plain', 'json', 'alfred'].includes(normalizedFormat)) {
    globalErrorFormat = normalizedFormat;
    logger.debug(`Error output format set to ${normalizedFormat}`);
  } else {
    logger.warn(`Unknown format '${format}', error output format remains as ${globalErrorFormat}`);
  }
}

/**
 * Display a formatted error message
 * 
 * @param error The error to display
 * @param debug Whether to include debug information
 * @param format Output format (plain, json, alfred), defaults to global setting
 */
export function displayCLIError(
  error: unknown, 
  debug = false, 
  format?: string
): void {
  // Use provided format or fall back to global format
  const outputFormat = format || globalErrorFormat;
  
  // Get the appropriate formatter based on format
  const formatter = FormatterFactory.getFormatter(FormatterType.ERROR, outputFormat) as ErrorFormatter;
  
  // Format the error using the selected formatter
  const formattedError = formatter.formatError(error, { debug });
  
  // Print the formatted output
  if (outputFormat === 'plain') {
    logger.error(formattedError);
  } else {
    logger.console(formattedError);
  }
  
  process.exit(1);
}

/**
 * Get the current global error output format
 * @returns The current format
 */
export function getErrorFormat(): string {
  return globalErrorFormat;
}

/**
 * Format an error object for display in the CLI
 * Extracts as much useful information as possible, including stack traces
 * 
 * @param error The error object to format
 * @param debug Whether to include debug information
 * @returns Formatted error message
 */
export function formatErrorForCLI(error: unknown, debug = false): string {
  let output = '';
  
  // Add a separator and heading
  output += '\n\x1b[31m════════════════════════ ERROR ════════════════════════\x1b[0m\n\n';
  
  if (error instanceof Error) {
    // Handle standard Error objects
    output += `\x1b[31m${error.name}: ${error.message}\x1b[0m\n\n`;
    
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      // First line usually contains the error message, which we've already displayed
      const stackTrace = stackLines.slice(1).join('\n');
      output += `\x1b[33mStack Trace:\x1b[0m\n${stackTrace}\n\n`;
    }
    
    // Handle additional properties that might be present in API errors
    const apiError = error as any;
    if (apiError.response?.errors) {
      output += '\x1b[33mAPI Errors:\x1b[0m\n';
      apiError.response.errors.forEach((e: any, i: number) => {
        output += `  Error ${i + 1}: ${e.message || 'Unknown error'}\n`;
        if (e.path) output += `  Path: ${e.path.join('.')}\n`;
        if (e.locations) output += `  Locations: ${JSON.stringify(e.locations)}\n`;
        output += '\n';
      });
    }
    
    if (debug && apiError.request) {
      output += '\x1b[36mRequest Details:\x1b[0m\n';
      output += `  URL: ${apiError.request.url || 'N/A'}\n`;
      output += `  Method: ${apiError.request.method || 'N/A'}\n\n`;
    }
    
    // If error has a cause, include it
    if (apiError.cause) {
      output += '\x1b[33mCaused by:\x1b[0m\n';
      output += formatErrorForCLI(apiError.cause, debug);
    }
  } else if (error && typeof error === 'object') {
    // Handle non-Error objects
    try {
      output += '\x1b[31mError Object:\x1b[0m\n';
      output += JSON.stringify(error, null, 2) + '\n\n';
      
      // Try to extract more detailed information
      const errorObj = error as Record<string, any>;
      if (errorObj.message) {
        output += `Message: ${errorObj.message}\n`;
      }
      
      if (debug) {
        output += '\x1b[36mProperties:\x1b[0m\n';
        for (const key in errorObj) {
          try {
            if (key !== 'stack' && key !== 'message') {
              const value = errorObj[key];
              output += `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
            }
          } catch {
            output += `  ${key}: [Cannot stringify]\n`;
          }
        }
        output += '\n';
      }
    } catch {
      output += '\x1b[31mUnable to stringify error object\x1b[0m\n\n';
    }
  } else {
    // Handle primitive values
    output += `\x1b[31m${String(error)}\x1b[0m\n\n`;
  }
  
  if (debug) {
    // Add debug information
    output += '\x1b[36mDebug Information:\x1b[0m\n';
    output += `  Timestamp: ${new Date().toISOString()}\n`;
    output += `  Node Version: ${process.version}\n`;
    output += `  Platform: ${process.platform} (${process.arch})\n`;
    
    try {
      // Get the current call stack
      const stack = new Error().stack;
      if (stack) {
        const stackLines = stack.split('\n').slice(2); // Skip the Error creation line and this function
        output += '\n\x1b[36mCurrent Stack:\x1b[0m\n';
        output += stackLines.join('\n') + '\n';
      }
    } catch {
      // Ignore stack trace errors
    }
  }
  
  // Add a closing separator
  output += '\n\x1b[31m═══════════════════════════════════════════════════════\x1b[0m\n';
  
  return output;
}

/**
 * Wraps a function with CLI error handling
 * 
 * @param fn The function to wrap
 * @param options Error handling options
 * @returns A wrapped function with error handling
 */
export function withCLIErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    debugMode?: boolean;
    format?: string;
  } = {}
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async function(...args: Parameters<T>): Promise<ReturnType<T>> {
    try {
      return await fn(...args);
    } catch (error) {
      displayCLIError(
        error, 
        options.debugMode || false, 
        options.format
      );
      process.exit(1);
    }
  };
} 