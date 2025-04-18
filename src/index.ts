#!/usr/bin/env node

import { Command } from 'commander';
import {
  BaseCommandHandler,
  HelloCommandHandler,
  ViewerCommandHandler,
  OrganizationCommandHandler,
  BuildCommandHandler,
  ViewerBuildsCommandHandler,
  UserBuildsCommandHandler
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

// Update the builds command to include REST API filtering options
program
  .command('builds')
  .description('List builds for the current user')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-p, --pipeline <pipeline>', 'Filter by pipeline slug')
  .option('-b, --branch <branch>', 'Filter by branch name')
  .option('-s, --state <state>', 'Filter by build state (running, scheduled, passed, failing, failed, canceled, etc.)')
  .option('-n, --count <count>', 'Number of builds per page', '10')
  .option('--page <page>', 'Page number', '1')
  .option('-d, --debug', 'Show debug information for errors')
  .option('--json', 'Output results in JSON format')
  .option('--alfred', 'Output results in Alfred-compatible JSON format')
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