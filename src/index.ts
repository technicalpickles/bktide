#!/usr/bin/env node

import { Command } from 'commander';
import {
  BaseCommandHandler,
  ViewerCommandHandler,
  OrganizationCommandHandler,
  ViewerBuildsCommandHandler,
} from './commands/index.js';

const program = new Command();

// Helper to add cache options to commands
const addCacheOptions = (command: Command): Command => {
  return command
    .option('--no-cache', 'Disable caching of API responses')
    .option('--cache-ttl <milliseconds>', 'Set cache time-to-live in milliseconds', parseInt)
    .option('--clear-cache', 'Clear all cached data before executing command');
};

program
  .name('bk-cli')
  .description('Buildkite CLI tool')
  .version('1.0.0');

// GraphQL commands
const viewerCmd = program
  .command('viewer')
  .description('Show logged in user information')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-d, --debug', 'Show debug information for errors');

addCacheOptions(viewerCmd).action(async (options) => {
  try {
    const token = BaseCommandHandler.getToken(options);
    const handler = new ViewerCommandHandler(token, {
      noCache: options.cache === false,
      cacheTTL: options.cacheTtl,
      clearCache: options.clearCache,
      debug: options.debug
    });
    await handler.execute(options);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
});

const orgsCmd = program
  .command('orgs')
  .description('List organizations')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-d, --debug', 'Show debug information for errors');

addCacheOptions(orgsCmd).action(async (options) => {
  try {
    const token = BaseCommandHandler.getToken(options);
    const handler = new OrganizationCommandHandler(token, {
      noCache: options.cache === false,
      cacheTTL: options.cacheTtl,
      clearCache: options.clearCache,
      debug: options.debug
    });
    await handler.listOrganizations(options);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
});

const pipelinesCmd = program
  .command('pipelines')
  .description('List pipelines for an organization')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .requiredOption('-o, --org <org>', 'Organization slug')
  .option('-n, --count <count>', 'Number of pipelines to fetch', '10')
  .option('-d, --debug', 'Show debug information for errors');

addCacheOptions(pipelinesCmd).action(async (options) => {
  try {
    const token = BaseCommandHandler.getToken(options);
    const handler = new OrganizationCommandHandler(token, {
      noCache: options.cache === false,
      cacheTTL: options.cacheTtl,
      clearCache: options.clearCache,
      debug: options.debug
    });
    await handler.listPipelines(options);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
});

// Update the builds command to include REST API filtering options
const buildsCmd = program
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
  .option('--alfred', 'Output results in Alfred-compatible JSON format');

addCacheOptions(buildsCmd).action(async (options) => {
  try {
    const token = BaseCommandHandler.getToken(options);
    const handler = new ViewerBuildsCommandHandler(token, {
      noCache: options.cache === false,
      cacheTTL: options.cacheTtl,
      clearCache: options.clearCache,
      debug: options.debug
    });
    await handler.execute(options);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
});

program.parse(); 