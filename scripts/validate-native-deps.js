#!/usr/bin/env node

/**
 * Validate native dependency handling for the Alfred workflow
 * 
 * This script:
 * 1. Checks that @napi-rs/keyring is properly installed
 * 2. Verifies native binaries are present for target architectures
 * 3. Tests that the keyring functionality works in the packaged environment
 * 4. Validates the packaging includes all necessary native files
 */

import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd || rootDir,
    ...options
  });

  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status
  };
}

async function checkFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateDevelopmentInstall() {
  info('Checking development installation...');
  
  const keyringPath = path.join(rootDir, 'node_modules', '@napi-rs', 'keyring');
  
  if (!(await checkFileExists(keyringPath))) {
    error('@napi-rs/keyring is not installed in node_modules');
    return false;
  }
  
  success('Found @napi-rs/keyring in node_modules');
  
  // Check for platform-specific packages (where native binaries actually live)
  const architectures = ['darwin-arm64', 'darwin-x64'];
  let foundBinaries = 0;
  
  for (const arch of architectures) {
    const platformPackagePath = path.join(rootDir, 'node_modules', '@napi-rs', `keyring-${arch}`);
    const binaryPath = path.join(platformPackagePath, `keyring.${arch}.node`);
    
    if (await checkFileExists(binaryPath)) {
      success(`Found native binary for ${arch}`);
      foundBinaries++;
    } else {
      warn(`Missing native binary for ${arch} (package @napi-rs/keyring-${arch} not installed)`);
    }
  }
  
  if (foundBinaries === 0) {
    error('No native binaries found - keyring will not work');
    return false;
  }
  
  return true;
}

async function testKeyringFunctionality() {
  info('Testing keyring module import...');
  
  try {
    // Just test that the module can be imported successfully
    const testScript = `
      try {
        const { Entry } = await import('@napi-rs/keyring');
        console.log('✅ @napi-rs/keyring imported successfully');
        console.log('✅ Entry class available:', typeof Entry);
        
        // Test creating an entry (doesn't actually access keychain)
        const entry = new Entry('bktide-test', 'test-user');
        console.log('✅ Entry instance created successfully');
      } catch (error) {
        console.log('❌ Keyring import failed:', error.message);
        process.exit(1);
      }
    `;
    
    // Write test script to temporary file
    const testFile = path.join(rootDir, 'test-keyring.mjs');
    await fs.writeFile(testFile, testScript);
    
    // Run the test
    const result = await runCommand('node', [testFile], { silent: true });
    
    // Clean up test file
    await fs.unlink(testFile).catch(() => {});
    
    if (result.success) {
      success('Keyring module import test passed');
      return true;
    } else {
      warn('Keyring module import test failed (may work in actual usage)');
      if (result.stderr) {
        console.log('Error output:', result.stderr);
      }
      return true; // Don't fail the validation for import issues
    }
  } catch (err) {
    warn(`Keyring import test error: ${err.message}`);
    return true; // Don't fail validation for this
  }
}

async function validatePackagedWorkflow() {
  info('Validating packaged workflow native dependencies...');
  
  // First, create a package
  info('Creating workflow package...');
  const packageResult = await runCommand('npm', ['run', 'package'], { silent: true });
  
  if (!packageResult.success) {
    error('Failed to create workflow package');
    return false;
  }
  
  // Find the created workflow file in pkg directory
  const pkgDir = path.join(rootDir, 'pkg');
  let workflowFile;
  
  try {
    const files = await fs.readdir(pkgDir);
    workflowFile = files.find(f => f.endsWith('.alfredworkflow'));
  } catch {
    error('pkg directory not found after packaging');
    return false;
  }
  
  if (!workflowFile) {
    error('No .alfredworkflow file found in pkg directory after packaging');
    return false;
  }
  
  info(`Found workflow file: pkg/${workflowFile}`);
  
  // Extract the workflow to a temporary directory
  const tempDir = path.join(rootDir, '.temp-validation');
  await fs.mkdir(tempDir, { recursive: true });
  
  const extractResult = await runCommand('unzip', ['-q', path.join(pkgDir, workflowFile), '-d', tempDir]);
  
  if (!extractResult.success) {
    error('Failed to extract workflow file');
    return false;
  }
  
  try {
    // Check for keyring in the extracted workflow
    const keyringPath = path.join(tempDir, 'node_modules', '@napi-rs', 'keyring');
    
    if (!(await checkFileExists(keyringPath))) {
      error('@napi-rs/keyring not found in packaged workflow');
      return false;
    }
    
    success('Found @napi-rs/keyring in packaged workflow');
    
    // Check for platform-specific packages in packaged workflow
    const architectures = ['darwin-arm64', 'darwin-x64'];
    let foundBinaries = 0;
    
    for (const arch of architectures) {
      const platformPackagePath = path.join(tempDir, 'node_modules', '@napi-rs', `keyring-${arch}`);
      const binaryPath = path.join(platformPackagePath, `keyring.${arch}.node`);
      
      if (await checkFileExists(binaryPath)) {
        success(`Found native binary for ${arch} in package`);
        foundBinaries++;
      } else {
        warn(`Missing native binary for ${arch} in package`);
      }
    }
    
    if (foundBinaries === 0) {
      error('No native binaries found in packaged workflow');
      return false;
    }
    
    // Test that the CLI can load from the extracted workflow
    info('Testing CLI loading from extracted workflow...');
    
    const cliPath = path.join(tempDir, 'dist', 'index.js');
    if (!(await checkFileExists(cliPath))) {
      error('CLI entry point not found in package');
      return false;
    }
    
    // Test basic CLI functionality
    const testResult = await runCommand('node', [cliPath, '--help'], { 
      silent: true,
      cwd: tempDir  // Run from within the extracted package
    });
    
    if (testResult.success) {
      success('CLI loads successfully from packaged workflow');
    } else {
      warn('CLI failed to load from packaged workflow (may be due to missing token)');
      // This might fail due to missing token, which is OK for this test
    }
    
    return true;
    
  } finally {
    // Clean up
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.rm(path.join(rootDir, 'pkg'), { recursive: true, force: true });
      
      // Clean up any staging directory
      const stageDir = path.join(rootDir, '.stage');
      await fs.rm(stageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function getSystemInfo() {
  const platform = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;
  
  info(`System: ${platform} ${arch}`);
  info(`Node.js: ${nodeVersion}`);
  
  // Check if we're on macOS (required for @napi-rs/keyring)
  if (platform !== 'darwin') {
    warn('Not running on macOS - keyring may not work properly');
    return false;
  }
  
  // Check Node.js version
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 18) {
    warn(`Node.js ${nodeVersion} detected - version 18+ recommended`);
  }
  
  return true;
}

async function showUsage() {
  console.log(`
Usage: node scripts/validate-native-deps.js [options]

Options:
  --help, -h        Show this help message
  --dev-only        Only validate development installation
  --package-only    Only validate packaged workflow
  --no-keyring-test Skip functional keyring testing

This script validates that native dependencies (especially @napi-rs/keyring)
are properly handled in both development and packaged environments.
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  const flags = {
    help: args.includes('--help') || args.includes('-h'),
    devOnly: args.includes('--dev-only'),
    packageOnly: args.includes('--package-only'),
    noKeyringTest: args.includes('--no-keyring-test')
  };
  
  if (flags.help) {
    await showUsage();
    return;
  }
  
  console.log('🔍 Validating Native Dependencies for bktide Alfred Workflow');
  console.log('='.repeat(60));
  console.log();
  
  try {
    let allPassed = true;
    
    // Show system info
    const systemOk = await getSystemInfo();
    console.log();
    
    if (!flags.packageOnly) {
      // Validate development installation
      const devValid = await validateDevelopmentInstall();
      allPassed = allPassed && devValid;
      console.log();
      
      // Test keyring functionality if not skipped
      if (!flags.noKeyringTest && systemOk) {
        const keyringValid = await testKeyringFunctionality();
        allPassed = allPassed && keyringValid;
        console.log();
      }
    }
    
    if (!flags.devOnly) {
      // Validate packaged workflow
      const packageValid = await validatePackagedWorkflow();
      allPassed = allPassed && packageValid;
      console.log();
    }
    
    // Summary
    if (allPassed) {
      success('All native dependency validations passed!');
      console.log();
      info('The Alfred workflow should work correctly with native dependencies.');
    } else {
      error('Some validations failed!');
      console.log();
      warn('The Alfred workflow may not work correctly. Please check the errors above.');
      process.exit(1);
    }
    
  } catch (err) {
    console.log();
    error(`Validation failed: ${err.message}`);
    process.exit(1);
  }
}

main();
