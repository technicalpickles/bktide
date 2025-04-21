#!/usr/bin/env node

import { Command } from 'commander';

import {
  BaseCommand,
  ShowViewer,
  ListOrganizations,
  ListBuilds,
  ListPipelines
} from './commands/index.js';
import { initializeErrorHandling } from './utils/errorUtils.js';
import { displayCLIError } from './utils/cli-error-handler.js';
import { logger, setLogLevel } from './services/logger.js';

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

program
  .name('bktide')
  .description('Buildkite CLI tool')
  .version('1.0.0')
  .configureHelp({ showGlobalOptions: true })
  .option('--log-level <level>', 'Set logging level (trace, debug, info, warn, error, fatal)', 'info')
  .option('-d, --debug', 'Show debug information for errors')
  .option('--no-cache', 'Disable caching of API responses')
  .option('--cache-ttl <milliseconds>', 'Set cache time-to-live in milliseconds', parseInt)
  .option('--clear-cache', 'Clear all cached data before executing command')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-f, --format <format>', 'Output format (plain, json, alfred)', 'plain');

// Add hooks for common behaviors across all commands
program
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Merge global options with command-specific options
    const globalOpts = program.opts();
    const commandOpts = actionCommand.opts();
    const mergedOptions = { ...globalOpts, ...commandOpts };
    
    // Store merged options for access in the action handler
    // @ts-ignore: Adding a custom property to the command object
    actionCommand.mergedOptions = mergedOptions;
    
    if (mergedOptions.debug) {
      logger.debug(`Executing command: ${actionCommand.name()}`);
      logger.debug('Options:', mergedOptions);
    }
  })
  .hook('postAction', (_thisCommand, actionCommand) => {
    // @ts-ignore: Accessing the custom property
    const options = actionCommand.mergedOptions || {};
    if (options.debug) {
      logger.debug(`Command ${actionCommand.name()} completed`);
    }
  });

// Define a generic interface for the command classes that includes the execute method
interface CommandWithExecute {
  execute(options: any): Promise<void>;
}

// Common function to create action handlers for commands
const createCommandHandler = (CommandClass: new (token: string, options?: any) => BaseCommand & CommandWithExecute) => {
  return async function() {
    try {
      // @ts-ignore: Accessing the custom property added in preAction
      const options = this.mergedOptions || this.opts();
      const token = BaseCommand.getToken(options);
      
      const handler = new CommandClass(token, {
        noCache: options.cache === false,
        cacheTTL: options.cacheTtl,
        clearCache: options.clearCache,
        debug: options.debug,
        format: options.format
      });
      
      await handler.execute(options);
    } catch (error) {
      // @ts-ignore: Accessing the custom property
      const debug = this.mergedOptions?.debug || this.opts().debug || false;
      displayCLIError(error, debug);
    }
  };
};

// GraphQL commands with simplified action handlers
program
  .command('viewer')
  .description('Show logged in user information')
  .action(createCommandHandler(ShowViewer));

program
  .command('orgs')
  .description('List organizations')
  .action(createCommandHandler(ListOrganizations));

program
  .command('pipelines')
  .description('List pipelines for an organization')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-n, --count <count>', 'Limit to specified number of pipelines per organization')
  .option('--filter <name>', 'Filter pipelines by name (case insensitive)')
  .action(createCommandHandler(ListPipelines));

// Update the builds command to include REST API filtering options
program
  .command('builds')
  .description('List builds for the current user')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-p, --pipeline <pipeline>', 'Filter by pipeline slug')
  .option('-b, --branch <branch>', 'Filter by branch name')
  .option('-s, --state <state>', 'Filter by build state (running, scheduled, passed, failing, failed, canceled, etc.)')
  .option('-n, --count <count>', 'Number of builds per page', '10')
  .option('--page <page>', 'Page number', '1')
  .option('--filter <filter>', 'Fuzzy filter builds by name or other properties')
  .action(createCommandHandler(ListBuilds));

// Parse command line arguments
program.parse();

// Apply log level from command line options
const options = program.opts();
if (options.debug) {
  // Debug mode takes precedence over log-level
  setLogLevel('debug');
  logger.debug('Debug mode enabled via --debug flag');
} else if (options.logLevel) {
  setLogLevel(options.logLevel);
  logger.debug(`Log level set to ${options.logLevel} via --log-level option`);
}

// Log startup information
logger.debug({ 
  pid: process.pid, 
}, 'Buildkite CLI started'); 