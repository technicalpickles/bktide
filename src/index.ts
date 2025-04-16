#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('bk-cli')
  .description('Buildkite CLI tool')
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello')
  .action(() => {
    console.log('Hello from bk-cli!');
  });

// Example of a command with options
program
  .command('build')
  .description('Trigger a new build')
  .option('-p, --pipeline <pipeline>', 'Pipeline slug')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-c, --commit <commit>', 'Commit SHA')
  .option('-m, --message <message>', 'Build message')
  .action((options) => {
    console.log('Triggering build with options:', options);
    // Implementation would go here
  });

program.parse(); 