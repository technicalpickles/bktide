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

// Define a generic interface for the command classes that includes the execute method
interface CommandWithExecute {
  execute(options: any): Promise<void>;
}

// Extend the Command type to include our custom properties
interface ExtendedCommand extends Command {
  mergedOptions?: any;
  cacheOptions?: {
    enabled: boolean;
    ttl?: number;
    clear?: boolean;
  };
  pipelineOptions?: {
    organization?: string;
    count?: number;
    filter?: string;
  };
  buildOptions?: {
    organization?: string;
    pipeline?: string;
    branch?: string;
    state?: string;
    count: number;
    page: number;
    filter?: string;
  };
}

// Handler for executing commands with proper option handling
const createCommandHandler = (CommandClass: new (token: string, options?: any) => BaseCommand & CommandWithExecute) => {
  return async function(this: ExtendedCommand) {
    try {
      // Access custom properties added in preAction hook
      const options = this.mergedOptions || this.opts();
      const cacheOptions = this.cacheOptions || { enabled: options.cache !== false, ttl: options.cacheTtl, clear: options.clearCache };
      const token = BaseCommand.getToken(options);
      
      const handler = new CommandClass(token, {
        noCache: !cacheOptions.enabled,
        cacheTTL: cacheOptions.ttl,
        clearCache: cacheOptions.clear,
        debug: options.debug,
        format: options.format
      });
      
      // Pass command-specific options if available
      const commandName = this.name();
      if (commandName === 'pipelines' && this.pipelineOptions) {
        logger.debug('Using pipeline options:', this.pipelineOptions);
      }
      else if (commandName === 'builds' && this.buildOptions) {
        logger.debug('Using build options:', this.buildOptions);
      }
      
      await handler.execute(options);
    } catch (error) {
      const debug = this.mergedOptions?.debug || this.opts().debug || false;
      displayCLIError(error, debug);
    }
  };
};

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
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)', process.env.BK_TOKEN)
  .option('-f, --format <format>', 'Output format (plain, json, alfred)', 'plain');

// Add hooks for handling options
program
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Cast to our extended command type
    const cmd = actionCommand as unknown as ExtendedCommand;
    
    // Merge global options with command-specific options
    const globalOpts = program.opts();
    const commandOpts = cmd.opts();
    const mergedOptions = { ...globalOpts, ...commandOpts };
    
    // Validate cache options
    if (mergedOptions.cacheTtl && (isNaN(mergedOptions.cacheTtl) || mergedOptions.cacheTtl <= 0)) {
      logger.error('Error: cache-ttl must be a positive number');
      process.exit(1);
    }
    
    if (mergedOptions.cache === false && mergedOptions.cacheTtl) {
      logger.warn('⚠️ WARNING: --no-cache and --cache-ttl used together. Cache will be disabled regardless of TTL setting.');
    }
    
    // Validate count options
    if (mergedOptions.count && (isNaN(parseInt(mergedOptions.count)) || parseInt(mergedOptions.count) <= 0)) {
      logger.error('Error: count must be a positive number');
      process.exit(1);
    }
    
    // Process cache options and store them in a structured way
    const cacheOptions = {
      enabled: mergedOptions.cache !== false,
      ttl: mergedOptions.cacheTtl,
      clear: mergedOptions.clearCache
    };
    
    // Adding custom properties to the command object
    cmd.mergedOptions = mergedOptions;
    cmd.cacheOptions = cacheOptions;
    
    // Handle command-specific options
    const commandName = cmd.name();
    
    if (commandName === 'pipelines') {
      // Create pipeline-specific options structure
      cmd.pipelineOptions = {
        organization: mergedOptions.org,
        count: mergedOptions.count ? parseInt(mergedOptions.count) : undefined,
        filter: mergedOptions.filter
      };
      
      if (mergedOptions.debug) {
        logger.debug('Pipeline options:', cmd.pipelineOptions);
      }
    }
    else if (commandName === 'builds') {
      // Create builds-specific options structure
      cmd.buildOptions = {
        organization: mergedOptions.org,
        pipeline: mergedOptions.pipeline,
        branch: mergedOptions.branch,
        state: mergedOptions.state,
        count: mergedOptions.count ? parseInt(mergedOptions.count) : 10,
        page: mergedOptions.page ? parseInt(mergedOptions.page) : 1,
        filter: mergedOptions.filter
      };
      
      if (mergedOptions.debug) {
        logger.debug('Build options:', cmd.buildOptions);
      }
    }
    
    if (mergedOptions.debug) {
      logger.debug(`Executing command: ${commandName}`);
      logger.debug('Options:', mergedOptions);
      logger.debug('Cache options:', cacheOptions);
    }
  })
  .hook('postAction', (_thisCommand, actionCommand) => {
    // Cast to our extended command type
    const cmd = actionCommand as unknown as ExtendedCommand;
    
    // Accessing the custom property
    const options = cmd.mergedOptions || {};
    if (options.debug) {
      logger.debug(`Command ${cmd.name()} completed`);
    }
  });

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