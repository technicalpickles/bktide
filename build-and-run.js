#!/usr/bin/env node

/**
 * Build and run script for TypeScript applications with robust error handling
 * 
 * This script:
 * 1. Compiles TypeScript with source maps
 * 2. Runs the compiled JavaScript with source maps enabled
 * 3. Provides better error messages with source map translation
 */

import { spawnSync } from 'child_process';
import sourceMapSupport from 'source-map-support';
import path from 'path';
import fs from 'fs';

// Install source map support
sourceMapSupport.install();

console.log('🔨 Building TypeScript code...');

// Run TypeScript compiler
const tscResult = spawnSync('npx', ['tsc'], {
  stdio: [null, 'pipe', 'pipe'],
  encoding: 'utf8'
});

if (tscResult.status !== 0) {
  console.error('❌ TypeScript compilation failed:');
  console.error(tscResult.stderr || tscResult.stdout);
  process.exit(1);
}

console.log('✅ Build successful');

// Get command line arguments
const args = process.argv.slice(2);
let entryPoint = 'dist/index.js'; // Default entry point
let cliArgs = [];

// Extract a TypeScript file if specified, otherwise pass all args to the Node process
if (args.length > 0 && args[0].endsWith('.ts')) {
  // Convert src/file.ts to dist/file.js
  const tsPath = args[0];
  const relativePath = path.relative('src', tsPath);
  
  if (relativePath.startsWith('..')) {
    // Not under src directory, use default
    cliArgs = [...args];
  } else {
    const jsPath = path.join('dist', relativePath.replace(/\.ts$/, '.js'));
    
    if (fs.existsSync(jsPath)) {
      entryPoint = jsPath;
      cliArgs = args.slice(1);
    } else {
      // If the specific file doesn't exist, pass all args as-is
      console.warn(`⚠️ Could not find compiled file: ${jsPath}, using default entry point`);
      cliArgs = [...args.slice(1)];
    }
  }
} else {
  // No TypeScript file specified, pass all args to the Node process
  cliArgs = [...args];
}

if (cliArgs.length > 0) {
  console.log(`🚀 Running: ${entryPoint} ${cliArgs.join(' ')}`);
} else {
  console.log(`🚀 Running: ${entryPoint}`);
}
console.log('────────────────────────── bktide output ──────────────────────────');

// Run the compiled code with source maps enabled
const nodeResult = spawnSync('node', ['--enable-source-maps', entryPoint, ...cliArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--enable-source-maps'
  }
});

// Exit with the same code as the node process
process.exit(nodeResult.status || 0); 