#!/usr/bin/env node

/**
 * Simplified runner for TypeScript with source map support
 * This script avoids the issues with the ESM loader by using source-map-support directly
 */

import sourceMapSupport from 'source-map-support';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Setup source map support
sourceMapSupport.install({
  handleUncaughtExceptions: true,
  retrieveSourceMap: function(source) {
    // Custom source map retrieval function
    try {
      // For ts-node compiled sources
      if (source.includes('node_modules/ts-node/') || 
          source.endsWith('.ts') || 
          source.endsWith('.js')) {
        
        // Try to find the source map
        const mapPath = source + '.map';
        if (fs.existsSync(mapPath)) {
          return {
            url: source,
            map: fs.readFileSync(mapPath, 'utf8')
          };
        }
      }
      return null;
    } catch (err) {
      console.error('Error retrieving source map:', err);
      return null;
    }
  }
});

// Set long stack traces 
Error.stackTraceLimit = 50;

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Error handler for the parent process
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m%s\x1b[0m', '🚨 Uncaught Exception in runner:');
  if (err instanceof Error) {
    console.error('\x1b[31m%s\x1b[0m', err.stack || err.message);
  } else {
    console.error('\x1b[31m%s\x1b[0m', err);
  }
  process.exit(1);
});

// Command-line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please specify a TypeScript file to run');
  process.exit(1);
}

// The TypeScript file to run
const scriptPath = args[0];
const scriptArgs = args.slice(1);

// Verify file exists
if (!fs.existsSync(scriptPath)) {
  console.error(`File not found: ${scriptPath}`);
  process.exit(1);
}

console.log(`🚀 Running ${scriptPath} with source map support...`);

// Build the arguments for the Node.js process
const nodeArgs = [
  '--enable-source-maps',
  '--loader=ts-node/esm',
  scriptPath,
  ...scriptArgs
];

// Launch the child process
const child = spawn('node', nodeArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--enable-source-maps',
    TS_NODE_PROJECT: path.join(__dirname, 'tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'false'
  }
});

// Handle child process events
child.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Failed to start child process:');
  console.error('\x1b[31m%s\x1b[0m', err);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Child process exited with code ${code}`);
    process.exit(code);
  }
}); 