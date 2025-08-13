#!/usr/bin/env node

/**
 * Release management script for bktide Alfred workflow
 * 
 * This script:
 * 1. Validates the current state (clean git, tests pass)
 * 2. Bumps the version in package.json
 * 3. Creates a git tag
 * 4. Optionally pushes the tag to trigger GitHub Actions release
 */

import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
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

function header(message) {
  console.log();
  log(`${colors.bold}${colors.cyan}${message}${colors.reset}`);
  log('='.repeat(message.length), 'cyan');
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

async function getCommandOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    cwd: options.cwd || rootDir,
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stderr}`);
  }

  return result.stdout.trim();
}

async function readPackageJson() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  return JSON.parse(content);
}

async function writePackageJson(packageData) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const content = JSON.stringify(packageData, null, 2) + '\\n';
  await fs.writeFile(packageJsonPath, content);
}

async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function validateGitState() {
  info('Checking git status...');
  
  // Check if we're in a git repository
  try {
    await getCommandOutput('git', ['rev-parse', '--git-dir']);
  } catch {
    throw new Error('Not in a git repository');
  }
  
  // Check for uncommitted changes
  const gitStatus = await getCommandOutput('git', ['status', '--porcelain']);
  if (gitStatus) {
    throw new Error('Working directory has uncommitted changes. Please commit or stash them first.');
  }
  
  // Check current branch
  const currentBranch = await getCommandOutput('git', ['branch', '--show-current']);
  if (currentBranch !== 'main' && currentBranch !== 'master') {
    const answer = await prompt(`You're on branch '${currentBranch}'. Continue anyway? (y/N): `);
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      throw new Error('Release cancelled');
    }
  }
  
  success('Git state is clean');
}

async function runTests() {
  info('Running build and tests...');
  
  try {
    // Clean any existing build artifacts
    await runCommand('npm', ['run', 'package:clean']);
    
    // Install dependencies
    await runCommand('npm', ['ci']);
    
    // Build the project
    await runCommand('npm', ['run', 'build']);
    
    // Test packaging
    await runCommand('npm', ['run', 'package']);
    
    success('Build and packaging tests passed');
  } catch (error) {
    throw new Error(`Build/test failed: ${error.message}`);
  }
}

function parseVersion(version) {
  const match = version.match(/^(\\d+)\\.(\\d+)\\.(\\d+)(.*)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || ''
  };
}

function formatVersion(versionObj) {
  return `${versionObj.major}.${versionObj.minor}.${versionObj.patch}${versionObj.prerelease}`;
}

function bumpVersion(currentVersion, bumpType) {
  const version = parseVersion(currentVersion);
  
  switch (bumpType) {
    case 'major':
      version.major++;
      version.minor = 0;
      version.patch = 0;
      version.prerelease = '';
      break;
    case 'minor':
      version.minor++;
      version.patch = 0;
      version.prerelease = '';
      break;
    case 'patch':
      version.patch++;
      version.prerelease = '';
      break;
    case 'prerelease':
      if (version.prerelease) {
        // Increment existing prerelease
        const match = version.prerelease.match(/^-([a-z]+)\\.(\\d+)$/);
        if (match) {
          const num = parseInt(match[2]) + 1;
          version.prerelease = `-${match[1]}.${num}`;
        } else {
          version.prerelease = '-beta.1';
        }
      } else {
        version.prerelease = '-beta.1';
      }
      break;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
  
  return formatVersion(version);
}

async function selectVersionBump(currentVersion) {
  console.log();
  info(`Current version: ${currentVersion}`);
  console.log();
  
  const bumpTypes = ['patch', 'minor', 'major', 'prerelease'];
  
  log('Available version bumps:', 'cyan');
  bumpTypes.forEach((type, index) => {
    const newVersion = bumpVersion(currentVersion, type);
    console.log(`  ${index + 1}. ${type}: ${currentVersion} → ${newVersion}`);
  });
  
  console.log();
  const answer = await prompt('Select version bump (1-4, or enter custom version): ');
  
  // Check if it's a number (selecting from list)
  const selection = parseInt(answer);
  if (selection >= 1 && selection <= 4) {
    const bumpType = bumpTypes[selection - 1];
    return bumpVersion(currentVersion, bumpType);
  }
  
  // Check if it's a custom version
  if (answer.match(/^\\d+\\.\\d+\\.\\d+/)) {
    try {
      parseVersion(answer);
      return answer;
    } catch {
      throw new Error(`Invalid version format: ${answer}`);
    }
  }
  
  throw new Error('Invalid selection');
}

async function updateVersion(newVersion) {
  info(`Updating version to ${newVersion}...`);
  
  const packageData = await readPackageJson();
  packageData.version = newVersion;
  await writePackageJson(packageData);
  
  success(`Version updated to ${newVersion}`);
}

async function createGitTag(version) {
  info(`Creating git tag v${version}...`);
  
  // Stage the package.json change
  await runCommand('git', ['add', 'package.json']);
  
  // Commit the version bump
  await runCommand('git', ['commit', '-m', `Release v${version}`]);
  
  // Create the tag
  await runCommand('git', ['tag', '-a', `v${version}`, '-m', `Release v${version}`]);
  
  success(`Created git tag v${version}`);
}

async function showReleaseInstructions(version) {
  header('Release Ready!');
  
  log(`Version v${version} is ready for release.`, 'green');
  console.log();
  
  info('Next steps:');
  console.log('1. Push the tag to trigger GitHub Actions release:');
  log(`   git push origin v${version}`, 'cyan');
  console.log();
  console.log('2. Or push both commit and tag:');
  log(`   git push origin main v${version}`, 'cyan');
  console.log();
  console.log('3. Monitor the release at:');
  log('   https://github.com/yourusername/bktide/actions', 'cyan');
  console.log();
  
  const answer = await prompt('Push tag now? (y/N): ');
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    info('Pushing tag...');
    await runCommand('git', ['push', 'origin', `v${version}`]);
    success('Tag pushed! Release should start automatically.');
    console.log();
    info('Monitor progress at: https://github.com/yourusername/bktide/actions');
  }
}

async function showUsage() {
  console.log(`
Usage: node scripts/release.js [options]

Options:
  --help, -h          Show this help message
  --dry-run          Show what would be done without making changes
  --version <type>   Specify version bump type (patch|minor|major|prerelease)
  --skip-tests       Skip build and packaging tests (not recommended)
  --auto-push        Automatically push the tag after creation

Examples:
  node scripts/release.js                    # Interactive release
  node scripts/release.js --version patch    # Bump patch version
  node scripts/release.js --dry-run          # Show what would happen
  node scripts/release.js --auto-push        # Push tag automatically

This script helps create releases for the bktide Alfred workflow.
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const flags = {
    help: args.includes('--help') || args.includes('-h'),
    dryRun: args.includes('--dry-run'),
    skipTests: args.includes('--skip-tests'),
    autoPush: args.includes('--auto-push'),
    version: null
  };
  
  // Get version argument
  const versionIndex = args.indexOf('--version');
  if (versionIndex !== -1 && versionIndex + 1 < args.length) {
    flags.version = args[versionIndex + 1];
  }
  
  if (flags.help) {
    await showUsage();
    return;
  }
  
  try {
    header('bktide Release Script');
    
    if (flags.dryRun) {
      warn('DRY RUN MODE - No changes will be made');
      console.log();
    }
    
    // Validate git state
    await validateGitState();
    
    // Run tests unless skipped
    if (!flags.skipTests) {
      await runTests();
    } else {
      warn('Skipping tests as requested');
    }
    
    // Get current version
    const packageData = await readPackageJson();
    const currentVersion = packageData.version;
    
    // Determine new version
    let newVersion;
    if (flags.version) {
      if (['patch', 'minor', 'major', 'prerelease'].includes(flags.version)) {
        newVersion = bumpVersion(currentVersion, flags.version);
      } else {
        // Assume it's a custom version
        parseVersion(flags.version); // Validate format
        newVersion = flags.version;
      }
    } else {
      newVersion = await selectVersionBump(currentVersion);
    }
    
    if (flags.dryRun) {
      header('Dry Run Summary');
      info(`Would update version: ${currentVersion} → ${newVersion}`);
      info(`Would create git tag: v${newVersion}`);
      info('Would commit changes to package.json');
      if (flags.autoPush) {
        info('Would push tag to origin');
      }
      return;
    }
    
    // Confirm the release
    console.log();
    const confirm = await prompt(`Create release v${newVersion}? (y/N): `);
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      warn('Release cancelled');
      return;
    }
    
    // Perform the release
    await updateVersion(newVersion);
    await createGitTag(newVersion);
    
    if (flags.autoPush) {
      info('Pushing tag...');
      await runCommand('git', ['push', 'origin', `v${newVersion}`]);
      success('Tag pushed! Release should start automatically.');
    } else {
      await showReleaseInstructions(newVersion);
    }
    
  } catch (err) {
    console.log();
    error(err.message);
    process.exit(1);
  }
}

main();
