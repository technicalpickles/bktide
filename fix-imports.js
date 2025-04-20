#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const GENERATED_DIR = './src/graphql/generated';

// Function to add .js extension to relative imports that don't have an extension
function fixImports(filePath) {
  console.log(`Fixing imports in ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to match import statements with relative paths without extensions
  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"](\.[^'"]*)['"]/g;
  
  // Replace relative imports to add .js extension if missing
  content = content.replace(importRegex, (match, importPath) => {
    // Skip if the import path already has an extension
    if (path.extname(importPath) !== '') {
      return match;
    }
    
    return match.replace(importPath, `${importPath}.js`);
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed imports in ${filePath}`);
}

// Process all TypeScript files in the generated directory
function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts')) {
      fixImports(filePath);
    }
  }
}

// Make sure the directory exists
if (fs.existsSync(GENERATED_DIR)) {
  processDirectory(GENERATED_DIR);
  console.log('Import paths fixed successfully.');
} else {
  console.error(`Directory ${GENERATED_DIR} does not exist.`);
  process.exit(1);
} 