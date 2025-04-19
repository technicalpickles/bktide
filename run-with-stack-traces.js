#!/usr/bin/env node

/**
 * Enhanced runner script for TypeScript with better error handling and stack traces
 * Run with: node run-with-stack-traces.js src/index.ts [args...]
 */

// Import required modules
import { spawnSync } from 'child_process';
import sourceMapSupport from 'source-map-support';
import path from 'path';
import fs from 'fs';

// Install source map support
sourceMapSupport.install();

// Set long stack traces
Error.stackTraceLimit = 50;

// Get the script to run from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Please specify a script to run');
  process.exit(1);
}

const scriptPath = args[0];
const scriptArgs = args.slice(1);

// Ensure the script exists
if (!fs.existsSync(scriptPath)) {
  console.error(`Script not found: ${scriptPath}`);
  process.exit(1);
}

console.log(`🚀 Running ${scriptPath} with enhanced error handling...`);

// Run the script with ts-node and --enable-source-maps
const nodeArgs = [
  '--enable-source-maps',
  '--no-warnings',
  '--loader',
  'ts-node/esm',
  scriptPath,
  ...scriptArgs
];

// Execute the command
const result = spawnSync('node', nodeArgs, { 
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_PRETTY: 'true',
    TS_NODE_TRANSPILE_ONLY: 'false'
  }
});

// Handle process exit
if (result.status !== 0) {
  // If process exited with error
  if (result.error) {
    console.error('\n🔥 Error executing script:');
    console.error(result.error);
  }
  // Exit with the same code
  process.exit(result.status || 1);
} else {
  console.log('✅ Script completed successfully');
} 