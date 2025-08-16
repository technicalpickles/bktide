#!/usr/bin/env node

/**
 * Detect material changes that would require a new release
 * 
 * Material changes are those affecting:
 * 1. The npm package contents
 * 2. The Alfred workflow contents
 * 
 * Non-material changes include:
 * - Documentation (except README.md and WORKFLOW_README.md)
 * - GitHub workflows
 * - Development tooling that doesn't affect the build
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Files and patterns that are material to releases
const MATERIAL_PATTERNS = [
  // Source code (compiles to dist/)
  'src/**/*',
  
  // Package configuration
  'package.json',
  'package-lock.json',
  
  // Build configuration that affects output
  'tsconfig.json',
  
  // Scripts that affect the build/package process
  'scripts/package-workflow.js',
  'scripts/compute-version.js',
  
  // Binaries and entry points
  'bin/**/*',
  
  // Assets included in packages
  'icons/**/*',
  'icon.png',
  'info.plist',
  'env.example',
  
  // Documentation included in packages
  'README.md',
  'WORKFLOW_README.md',
  'LICENSE',
  
  // GraphQL schema changes
  'src/graphql/queries.ts',
  'src/graphql/generated/**/*',  // Generated types affect runtime
  'codegen.mjs'
];

// Files and patterns that are NOT material (for explicit exclusion)
const NON_MATERIAL_PATTERNS = [
  '.github/**/*',
  'docs/**/*',
  '*.md',  // Except README.md and WORKFLOW_README.md which are explicitly included
  'scripts/**/*', // Except specific scripts listed above
  'lefthook.yml',
  'mise.toml',
  '.cursor/**/*',
  'bk-cli/**/*',
  'log/**/*',
  'pkg/**/*',
  '.stage/**/*',
  'dist/**/*' // Generated JS files (TypeScript compiled output)
];

function runGit(args) {
  const res = spawnSync('git', args, { cwd: rootDir, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`Git command failed: ${args.join(' ')}\n${res.stderr}`);
  }
  return res.stdout.trim();
}

function getLastReleaseTag() {
  try {
    // Get the most recent tag that looks like a version
    const tag = runGit(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
    return tag || null;
  } catch {
    // No tags found
    return null;
  }
}

function getChangedFiles(sinceRef) {
  if (!sinceRef) {
    // If no previous release, consider all tracked files
    const files = runGit(['ls-files']);
    return files.split('\n').filter(f => f.trim());
  }
  
  // Get files changed since the reference
  const files = runGit(['diff', '--name-only', `${sinceRef}..HEAD`]);
  return files.split('\n').filter(f => f.trim());
}

function isFileMaterial(filePath) {
  // Normalize the path to be relative to root
  const normalizedPath = path.relative(rootDir, path.resolve(rootDir, filePath));
  
  // Check if file matches any material pattern
  for (const pattern of MATERIAL_PATTERNS) {
    if (matchesPattern(normalizedPath, pattern)) {
      // Special case: specific scripts are material even though scripts/**/* is excluded
      if (normalizedPath === 'scripts/package-workflow.js' || 
          normalizedPath === 'scripts/compute-version.js') {
        return true;
      }
      
      // Double-check it's not explicitly excluded
      for (const excludePattern of NON_MATERIAL_PATTERNS) {
        if (matchesPattern(normalizedPath, excludePattern)) {
          // Special case: README.md and WORKFLOW_README.md are material
          if (normalizedPath === 'README.md' || normalizedPath === 'WORKFLOW_README.md') {
            return true;
          }
          return false;
        }
      }
      return true;
    }
  }
  
  return false;
}

function matchesPattern(filePath, pattern) {
  // Handle simple file matches
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return filePath === pattern;
  }
  
  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars except * and ?
    .replace(/\*\*\/\*/g, '___GLOBSTAR___')  // Temporary placeholder for **/*
    .replace(/\*\*/g, '___DOUBLESTAR___')    // Temporary placeholder for **
    .replace(/\*/g, '[^/]*')                 // * matches any character except /
    .replace(/\?/g, '.')                     // ? matches single character
    .replace(/___GLOBSTAR___/g, '.*')        // **/* matches any depth
    .replace(/___DOUBLESTAR___/g, '.*');     // ** matches any depth
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

function detectMaterialChanges() {
  const lastTag = getLastReleaseTag();
  
  if (!lastTag) {
    console.log('No previous release tag found. First release - treating as material.');
    return {
      hasMaterialChanges: true,
      lastTag: null,
      changedFiles: [],
      materialFiles: [],
      reason: 'First release - no previous tag found'
    };
  }
  
  console.log(`Checking for changes since ${lastTag}...`);
  
  const changedFiles = getChangedFiles(lastTag);
  
  if (changedFiles.length === 0) {
    console.log('No files changed since last release.');
    return {
      hasMaterialChanges: false,
      lastTag,
      changedFiles: [],
      materialFiles: [],
      reason: 'No files changed'
    };
  }
  
  const materialFiles = changedFiles.filter(isFileMaterial);
  
  if (materialFiles.length > 0) {
    console.log('\nMaterial changes detected:');
    materialFiles.forEach(file => console.log(`  - ${file}`));
    
    return {
      hasMaterialChanges: true,
      lastTag,
      changedFiles,
      materialFiles,
      reason: `${materialFiles.length} material file(s) changed`
    };
  } else {
    console.log('\nNo material changes detected. Changed files:');
    changedFiles.forEach(file => console.log(`  - ${file} (non-material)`));
    
    return {
      hasMaterialChanges: false,
      lastTag,
      changedFiles,
      materialFiles: [],
      reason: 'Only non-material files changed'
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node scripts/detect-material-changes.js [options]

Options:
  --json        Output result as JSON
  --verbose     Show detailed information
  --help, -h    Show this help message

Exit codes:
  0 - Material changes detected (release needed)
  1 - No material changes (skip release)
  2 - Error occurred
`);
    process.exit(0);
  }
  
  const outputJson = args.includes('--json');
  const verbose = args.includes('--verbose');
  
  try {
    const result = detectMaterialChanges();
    
    if (outputJson) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!verbose && !result.hasMaterialChanges) {
      console.log(`\n✅ No material changes detected since ${result.lastTag || 'beginning'}`);
      console.log('Skipping release.');
    } else if (!verbose && result.hasMaterialChanges) {
      console.log(`\n🚀 Material changes detected! Release needed.`);
      console.log(`Reason: ${result.reason}`);
    }
    
    // Exit with 0 if material changes (release needed), 1 if not
    process.exit(result.hasMaterialChanges ? 0 : 1);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { detectMaterialChanges, isFileMaterial };
