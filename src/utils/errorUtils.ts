/**
 * Error handling utilities with source map support
 */
import sourceMapSupport from 'source-map-support';

/**
 * Initialize improved error handling with source maps
 * Call this function early in your application to ensure all errors have proper stack traces
 */
export function initializeErrorHandling(): void {
  // Install source map support for better stack traces
  sourceMapSupport.install({
    handleUncaughtExceptions: true,
    hookRequire: true
  });
  
  // Set long stack traces for async operations
  Error.stackTraceLimit = 30;

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('\n\x1b[31m%s\x1b[0m', '🚨 UNCAUGHT EXCEPTION 🚨');
    console.error('\x1b[31m%s\x1b[0m', err.stack || err.toString());
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n\x1b[31m%s\x1b[0m', '🚨 UNHANDLED PROMISE REJECTION 🚨');
    console.error('\x1b[31m%s\x1b[0m', reason instanceof Error ? reason.stack : reason);
    process.exit(1);
  });

  // Log start of error handling system
  if (process.env.DEBUG) {
    console.debug('Error handling system initialized with improved stack traces');
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