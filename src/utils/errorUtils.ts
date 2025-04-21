/**
 * Error handling utilities with source map support
 */
import * as sourceMap from 'source-map-support';
import { logger } from '../services/logger.js';
import { displayCLIError } from './cli-error-handler.js';

/**
 * Initialize error handling for the application
 * This sets up source map support and global handlers
 */
export function initializeErrorHandling(): void {
  // Install source map support for better stack traces
  sourceMap.install({
    handleUncaughtExceptions: false, // We'll handle these ourselves
    hookRequire: true
  });
  
  // Set up custom handlers for uncaught exceptions and unhandled rejections
  // These will be replaced by the handlers in index.ts, but provide a fallback
  process.on('uncaughtException', (err) => {
    // Use our CLI error handler to format the error correctly
    displayCLIError(err, false);
  });

  process.on('unhandledRejection', (reason) => {
    // Use our CLI error handler to format the error correctly
    displayCLIError(reason, false);
  });

  logger.debug('Error handling system initialized with improved stack traces');
}

/**
 * Log an error with proper formatting
 * @param error The error to log
 */
export function logError(error: unknown): void {
  if (error instanceof Error) {
    logger.error('❌ Error occurred:');
    logger.error(error.stack || error.message);
  } else {
    logger.error('Unknown error:', error);
  }
}

/**
 * Wrap an async function with better error handling
 * 
 * @param fn Function to wrap
 * @returns Wrapped function with better error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async function(...args: Parameters<T>): Promise<ReturnType<T>> {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        // Log the error with its stack trace
        console.error('\x1b[31m%s\x1b[0m', '❌ Error occurred:');
        console.error('\x1b[31m%s\x1b[0m', error.stack || error.message);
      } else {
        console.error('\x1b[31m%s\x1b[0m', 'Unknown error:', error);
      }
      // Re-throw to let the caller handle it
      throw error;
    }
  };
} 