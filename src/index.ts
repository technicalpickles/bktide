#!/usr/bin/env node

import { Command } from 'commander';
import {
  BaseCommandHandler,
  HelloCommandHandler,
  ViewerCommandHandler,
  OrganizationCommandHandler,
  BuildCommandHandler,
  ViewerBuildsCommandHandler
} from './commands/index.js';

const program = new Command();

program
  .name('bk-cli')
  .description('Buildkite CLI tool')
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello')
  .action(() => {
    const handler = new HelloCommandHandler();
    handler.execute();
  });

// Example of a command with options
program
  .command('build')
  .description('Trigger a new build')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-p, --pipeline <pipeline>', 'Pipeline slug')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-c, --commit <commit>', 'Commit SHA')
  .option('-m, --message <message>', 'Build message')
  .option('-d, --debug', 'Show debug information for errors')
  .action(async (options) => {
    try {
      const token = BaseCommandHandler.getToken(options);
      const handler = new BuildCommandHandler(token);
      await handler.triggerBuild(options);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// GraphQL commands
program
  .command('viewer')
  .description('Show logged in user information')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-d, --debug', 'Show debug information for errors')
  .action(async (options) => {
    try {
      const token = BaseCommandHandler.getToken(options);
      const handler = new ViewerCommandHandler(token);
      await handler.execute(options);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('orgs')
  .description('List organizations')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-d, --debug', 'Show debug information for errors')
  .action(async (options) => {
    try {
      const token = BaseCommandHandler.getToken(options);
      const handler = new OrganizationCommandHandler(token);
      await handler.listOrganizations(options);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('pipelines')
  .description('List pipelines for an organization')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .requiredOption('-o, --org <org>', 'Organization slug')
  .option('-n, --count <count>', 'Number of pipelines to fetch', '10')
  .option('-d, --debug', 'Show debug information for errors')
  .action(async (options) => {
    try {
      const token = BaseCommandHandler.getToken(options);
      const handler = new OrganizationCommandHandler(token);
      await handler.listPipelines(options);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Add the builds command to view current user's builds
program
  .command('builds')
  .description('List builds started by the current user')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-n, --count <count>', 'Number of builds to fetch', '10')
  .option('-d, --debug', 'Show debug information for errors')
  .action(async (options) => {
    try {
      const token = BaseCommandHandler.getToken(options);
      const handler = new ViewerBuildsCommandHandler(token);
      await handler.execute(options);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(); 