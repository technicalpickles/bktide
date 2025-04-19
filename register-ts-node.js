import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import sourceMapSupport from 'source-map-support';

// Install source map support for better stack traces
sourceMapSupport.install({
  handleUncaughtExceptions: true,
  hookRequire: true
});

// Enable more detailed stack traces
Error.stackTraceLimit = 50;

// Helper function to format errors
function formatError(err) {
  if (!err) return 'Unknown error (null or undefined)';

  // For Error objects
  if (err instanceof Error) {
    return err.stack || err.message || err.toString();
  }
  
  // For objects with util.inspect.custom symbol (like ESM errors)
  const customInspect = Object.getOwnPropertySymbols(err)
    .find(sym => sym.toString().includes('inspect.custom'));
  
  if (customInspect && typeof err[customInspect] === 'function') {
    try {
      return `Custom error: ${err[customInspect]()}`;
    } catch (inspectError) {
      // Fallback if the custom inspector fails
    }
  }
  
  // For other objects
  if (typeof err === 'object') {
    try {
      const props = Object.getOwnPropertyNames(err);
      if (props.length === 0) return '[Empty object error]';
      
      // Create a string representation with all properties
      return `Error object:\n${props.map(prop => 
        `  ${prop}: ${typeof err[prop] === 'object' ? JSON.stringify(err[prop]) : err[prop]}`
      ).join('\n')}`;
    } catch (formatError) {
      return `[Object error that cannot be stringified: ${formatError.message}]`;
    }
  }
  
  // For primitives
  return String(err);
}

// Configure better error handling
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m%s\x1b[0m', '🚨 Uncaught Exception:');
  console.error('\x1b[31m%s\x1b[0m', formatError(err));
  
  // Print environment info
  console.error('\x1b[36m%s\x1b[0m', '\nEnvironment Information:');
  console.error('\x1b[36m%s\x1b[0m', `Node Version: ${process.version}`);
  console.error('\x1b[36m%s\x1b[0m', `Platform: ${process.platform} (${process.arch})`);
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\x1b[31m%s\x1b[0m', '🚨 Unhandled Promise Rejection:');
  console.error('\x1b[31m%s\x1b[0m', formatError(reason));
  process.exit(1);
});

// Register ts-node loader with source map support
try {
  console.log('Registering ts-node/esm with source map support...');
  
  register('ts-node/esm', {
    parentURL: pathToFileURL('./'),
    experimentalSpecifierResolution: 'node'
  });
  
  console.log('ts-node registration completed successfully');
} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error registering ts-node:');
  console.error('\x1b[31m%s\x1b[0m', formatError(err));
  process.exit(1);
} 