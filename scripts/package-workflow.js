#!/usr/bin/env node

/**
 * Package Alfred workflow bundle for distribution
 * 
 * This script:
 * 1. Builds the TypeScript code
 * 2. Creates a staging directory with all required files
 * 3. Installs production dependencies in the staging area
 * 4. Creates the .alfredworkflow bundle
 * 5. Generates checksums for verification
 */

import { spawnSync, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import plist from 'plist';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const stageDir = path.join(rootDir, '.stage', 'workflow');
const pkgDir = path.join(rootDir, 'pkg');

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

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stderr || result.stdout}`);
  }

  return result;
}

async function readPackageJson() {
  try {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to read package.json: ${err.message}`);
  }
}

async function cleanAndCreateStaging() {
  info('Creating staging directory...');
  
  try {
    // Remove existing staging area
    await fs.rm(path.join(rootDir, '.stage'), { recursive: true, force: true });
    
    // Create new staging directory
    await fs.mkdir(stageDir, { recursive: true });
    
    success('Staging directory created');
  } catch (err) {
    throw new Error(`Failed to create staging directory: ${err.message}`);
  }
}

async function buildProject() {
  info('Building TypeScript code...');
  
  try {
    await runCommand('npm', ['run', 'build']);
    success('Build completed');
  } catch (err) {
    throw new Error(`Build failed: ${err.message}`);
  }
}

async function copyWorkflowAssets() {
  info('Copying workflow assets...');
  
  const assetsToCopy = [
    'info.plist',
    'icon.png',
    'icons',
    'bin/alfred-entrypoint',
    'dist',
    'package.json',
    'package-lock.json',
    'env.example',
    'WORKFLOW_README.md'
  ];

  try {
    for (const asset of assetsToCopy) {
      const sourcePath = path.join(rootDir, asset);
      const destPath = path.join(stageDir, asset);
      
      // Create parent directory if needed
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch {
        warn(`Asset not found, skipping: ${asset}`);
        continue;
      }
      
      // Copy file or directory
      await fs.cp(sourcePath, destPath, { recursive: true });
      info(`Copied: ${asset}`);
    }
    
    success('Assets copied');
  } catch (err) {
    throw new Error(`Failed to copy assets: ${err.message}`);
  }
}

async function loadInfoPlist(plistPath) {
  const raw = await fs.readFile(plistPath, 'utf-8');
  return plist.parse(raw);
}

async function saveInfoPlist(plistPath, data) {
  const xml = plist.build(data);
  await fs.writeFile(plistPath, xml);
}

function extractShortDescription(readmeText) {
  const firstLine = readmeText.split(/\r?\n/).find(line => line.trim().length > 0) || '';
  return firstLine.replace(/^#\s+/, '').trim().slice(0, 200);
}

async function injectMetadataIntoInfoPlist(version) {
  info('Injecting metadata into info.plist...');
  const plistPath = path.join(stageDir, 'info.plist');

  const [pkgJsonRaw, readmeRaw, infoPlist] = await Promise.all([
    fs.readFile(path.join(stageDir, 'package.json'), 'utf-8').then(JSON.parse),
    fs.readFile(path.join(stageDir, 'WORKFLOW_README.md'), 'utf-8').catch(() => ''),
    loadInfoPlist(plistPath)
  ]);

  const repoUrl = (pkgJsonRaw.repository && (typeof pkgJsonRaw.repository === 'string' ? pkgJsonRaw.repository : pkgJsonRaw.repository.url)) || '';
  const author = pkgJsonRaw.author || '';
  const description = pkgJsonRaw.description || extractShortDescription(readmeRaw);

  infoPlist.version = version;
  if (!infoPlist.bundleid || infoPlist.bundleid.trim() === '') {
    // Create a deterministic default from package name
    const safeName = (pkgJsonRaw.name || 'bktide').replace(/[^a-zA-Z0-9.-]/g, '');
    infoPlist.bundleid = `com.${(author && typeof author === 'string' ? author.split(/[\s<>@]/)[0].toLowerCase() : 'bktide')}.${safeName}`;
  }
  if (!infoPlist.createdby || infoPlist.createdby.trim() === '') {
    infoPlist.createdby = typeof author === 'string' ? author : (author?.name || '');
  }
  if (!infoPlist.webaddress || infoPlist.webaddress.trim() === '') {
    infoPlist.webaddress = repoUrl;
  }
  if (!infoPlist.description || infoPlist.description.trim() === '') {
    infoPlist.description = description;
  }
  if (!infoPlist.readme || infoPlist.readme.trim() === '') {
    infoPlist.readme = readmeRaw;
  }

  await saveInfoPlist(plistPath, infoPlist);

  // Validate plist
  try {
    await runCommand('plutil', ['-lint', plistPath], { silent: true });
    success('info.plist metadata injected and validated');
  } catch (err) {
    warn('plutil not available or validation failed; continuing');
  }
}

async function installProductionDependencies() {
  info('Installing production dependencies...');
  
  try {
    await runCommand('npm', ['ci', '--omit=dev'], { cwd: stageDir });
    success('Production dependencies installed');
  } catch (err) {
    throw new Error(`Failed to install dependencies: ${err.message}`);
  }
}

async function validateNativeDependencies() {
  info('Validating native dependencies...');
  
  try {
    const keyringPath = path.join(stageDir, 'node_modules', '@napi-rs', 'keyring');
    await fs.access(keyringPath);
    
    // Check for platform-specific binaries
    const platformBindings = path.join(keyringPath, 'keyring.darwin-arm64.node');
    const hasArmBindings = await fs.access(platformBindings).then(() => true).catch(() => false);
    
    if (hasArmBindings) {
      success('Native dependencies validated (ARM64 bindings found)');
    } else {
      warn('ARM64 bindings not found, workflow may not work on Apple Silicon');
    }
  } catch (err) {
    error(`Native dependency validation failed: ${err.message}`);
    warn('Workflow may not work without @napi-rs/keyring');
  }
}

async function createWorkflowBundle(version) {
  info('Creating workflow bundle...');
  
  const workflowName = `bktide-workflow-${version}.alfredworkflow`;
  
  // Ensure pkg directory exists
  await fs.mkdir(pkgDir, { recursive: true });
  
  const bundlePath = path.join(pkgDir, workflowName);
  
  try {
    // Remove existing bundle
    await fs.rm(bundlePath, { force: true });
    
    // Create zip archive
    await runCommand('zip', ['-r', bundlePath, '.'], { cwd: stageDir });
    
    success(`Workflow bundle created: pkg/${workflowName}`);
    return { bundlePath, workflowName };
  } catch (err) {
    throw new Error(`Failed to create bundle: ${err.message}`);
  }
}

async function generateChecksum(bundlePath, workflowName) {
  info('Generating checksum...');
  
  try {
    const content = await fs.readFile(bundlePath);
    const hash = createHash('sha256').update(content).digest('hex');
    
    const checksumPath = `${bundlePath}.sha256`;
    const checksumContent = `${hash}  ${workflowName}\n`;
    
    await fs.writeFile(checksumPath, checksumContent);
    
    success(`Checksum generated: pkg/${path.basename(checksumPath)}`);
    return checksumPath;
  } catch (err) {
    throw new Error(`Failed to generate checksum: ${err.message}`);
  }
}

async function showSummary(bundlePath, checksumPath, version) {
  const bundleStats = await fs.stat(bundlePath);
  const bundleSizeMB = (bundleStats.size / 1024 / 1024).toFixed(2);
  
  console.log('\n' + '='.repeat(50));
  success('Packaging completed successfully!');
  console.log('='.repeat(50));
  console.log();
  info(`Version: ${version}`);
  info(`Bundle: pkg/${path.basename(bundlePath)} (${bundleSizeMB} MB)`);
  info(`Checksum: pkg/${path.basename(checksumPath)}`);
  console.log();
  info('Next steps:');
  console.log('  1. Test the workflow by importing into Alfred');
  console.log('  2. Create a GitHub release with these artifacts');
  console.log('  3. Update documentation with release notes');
  console.log();
}

async function main() {
  try {
    log('🚀 Starting Alfred workflow packaging...', 'blue');
    console.log();
    
    // Read package.json for version
    const packageJson = await readPackageJson();
    const version = packageJson.version;
    
    info(`Packaging version: ${version}`);
    console.log();
    
    // Execute packaging steps
    await cleanAndCreateStaging();
    await buildProject();
    await copyWorkflowAssets();
    await injectMetadataIntoInfoPlist(version);
    await installProductionDependencies();
    await validateNativeDependencies();
    
    const { bundlePath, workflowName } = await createWorkflowBundle(version);
    const checksumPath = await generateChecksum(bundlePath, workflowName);
    
    await showSummary(bundlePath, checksumPath, version);
    
  } catch (err) {
    console.log();
    error(err.message);
    process.exit(1);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/package-workflow.js [options]

Options:
  --help, -h    Show this help message

This script packages the bktide CLI into an Alfred workflow bundle ready for distribution.
`);
  process.exit(0);
}

// Run the packaging process
main();
