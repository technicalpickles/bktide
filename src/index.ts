#!/usr/bin/env node

import { Command } from 'commander';
import {
  BaseCommandHandler,
  ViewerCommandHandler,
  OrganizationCommandHandler,
  ViewerBuildsCommandHandler,
  PipelineCommandHandler
} from './commands/index.js';
import { initializeErrorHandling } from './utils/errorUtils.js';
import { displayCLIError } from './utils/cli-error-handler.js';

initializeErrorHandling();

// Set a global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
  displayCLIError(err, process.argv.includes('--debug'));
});

// Set a global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  displayCLIError(reason, process.argv.includes('--debug'));
});

const program = new Command();

const addCacheOptions = (command: Command): Command => {
  return command
    .option('--no-cache', 'Disable caching of API responses')
    .option('--cache-ttl <milliseconds>', 'Set cache time-to-live in milliseconds', parseInt)
    .option('--clear-cache', 'Clear all cached data before executing command');
};

const addTokenOption = (command: Command): Command => {
  return command
    .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)');
};

const addFormatOption = (command: Command): Command => {
  return command
    .option('-f, --format <format>', 'Output format (plain, json, alfred)', 'plain');
};

program
  .name('bk-cli')
  .description('Buildkite CLI tool')
  .version('1.0.0');

// Create a handler for command execution with error handling
function createCommandHandler<T extends BaseCommandHandler>(
  HandlerClass: new (token: string, options?: any) => T,
  methodName: keyof T
): (options: any) => void {
  return function(options: any): void {
    const isDebug = !!options.debug;
    
    (async () => {
      try {
        const token = BaseCommandHandler.getToken(options);
        const handler = new HandlerClass(token, {
          noCache: options.cache === false,
          cacheTTL: options.cacheTtl,
          clearCache: options.clearCache,
          debug: isDebug,
          format: options.format
        });
        
        // Call the specified method on the handler instance
        const method = handler[methodName] as unknown as (options: any) => Promise<void>;
        await method.call(handler, options);
      } catch (error) {
        displayCLIError(error, isDebug);
      }
    })();
  };
}

// GraphQL commands
const viewerCmd = program
  .command('viewer')
  .description('Show logged in user information')
  .option('-d, --debug', 'Show debug information for errors')

addCacheOptions(viewerCmd)
addTokenOption(viewerCmd)
addFormatOption(viewerCmd)
viewerCmd.action(
  createCommandHandler(ViewerCommandHandler, 'execute')
);

const orgsCmd = program
  .command('orgs')
  .description('List organizations')
  .option('-d, --debug', 'Show debug information for errors');

addCacheOptions(orgsCmd)
addTokenOption(orgsCmd)
addFormatOption(orgsCmd)
orgsCmd.action(
  createCommandHandler(OrganizationCommandHandler, 'listOrganizations')
);

const pipelinesCmd = program
  .command('pipelines')
  .description('List pipelines for an organization')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-n, --count <count>', 'Limit to specified number of pipelines per organization')
  .option('-d, --debug', 'Show debug information for errors')
  .option('--filter <name>', 'Filter pipelines by name (case insensitive)');

addCacheOptions(pipelinesCmd)
addTokenOption(pipelinesCmd)
addFormatOption(pipelinesCmd)
pipelinesCmd.action(
  createCommandHandler(PipelineCommandHandler, 'listPipelines')
);

// Update the builds command to include REST API filtering options
const buildsCmd = program
  .command('builds')
  .description('List builds for the current user')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-p, --pipeline <pipeline>', 'Filter by pipeline slug')
  .option('-b, --branch <branch>', 'Filter by branch name')
  .option('-s, --state <state>', 'Filter by build state (running, scheduled, passed, failing, failed, canceled, etc.)')
  .option('-n, --count <count>', 'Number of builds per page', '10')
  .option('--page <page>', 'Page number', '1')
  .option('--filter <filter>', 'Fuzzy filter builds by name or other properties')
  .option('-d, --debug', 'Show debug information for errors')

addCacheOptions(buildsCmd)
addTokenOption(buildsCmd)
addFormatOption(buildsCmd)
buildsCmd.action(
  createCommandHandler(ViewerBuildsCommandHandler, 'execute')
);

// Parse command line arguments
program.parse(); 