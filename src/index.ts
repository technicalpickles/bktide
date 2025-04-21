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
import { displayCLIError, setErrorFormat } from './utils/cli-error-handler.js';
import { logger, setLogLevel } from './services/logger.js';
import { CredentialManager } from './services/CredentialManager.js';

// Set a global error handler for uncaught exceptions
const uncaughtExceptionHandler = (err: Error) => {
  // Remove any existing handlers to avoid duplicates
  const handlers = process.listeners('uncaughtException');
  handlers.forEach(listener => {
    if (listener !== uncaughtExceptionHandler) {
      process.removeListener('uncaughtException', listener);
    }
  });
  
  displayCLIError(
    err, 
    process.argv.includes('--debug')
  );
};
process.on('uncaughtException', uncaughtExceptionHandler);

// Set a global error handler for unhandled promise rejections
const unhandledRejectionHandler = (reason: unknown) => {
  // Remove any existing handlers to avoid duplicates
  const handlers = process.listeners('unhandledRejection');
  handlers.forEach(listener => {
    if (listener !== unhandledRejectionHandler) {
      process.removeListener('unhandledRejection', listener);
    }
  });
  
  displayCLIError(
    reason, 
    process.argv.includes('--debug')
  );
};
process.on('unhandledRejection', unhandledRejectionHandler);

// Initialize error handling after our handlers are registered
initializeErrorHandling();

const program = new Command();

// Define a generic interface for the command classes that includes the execute method
interface CommandWithExecute {
  execute(options: any): Promise<void>;
}

// Extend the Command type to include our custom properties
interface ExtendedCommand extends Command {
  mergedOptions?: any;
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
      const options = this.mergedOptions || this.opts();
      const cacheOptions = { enabled: options.cache !== false, ttl: options.cacheTtl, clear: options.clearCache };
      
      // This now returns a Promise
      const token = await BaseCommand.getToken(options);
      
      const handler = new CommandClass(token, {
        ...cacheOptions,
        token: token,
        debug: options.debug,
        format: options.format,
        saveToken: options.saveToken
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
      // No need to pass format - will use global format set in preAction hook
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
  .option('--save-token', 'Save the token to system keychain for future use')
  .option('-f, --format <format>', 'Output format for results and errors (plain, json, alfred)', 'plain');

// Add hooks for handling options
program
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Cast to our extended command type
    const cmd = actionCommand as unknown as ExtendedCommand;
    
    // Merge global options with command-specific options
    const globalOpts = program.opts();
    const commandOpts = cmd.opts();
    const mergedOptions = { ...globalOpts, ...commandOpts };
    
    // Set the global error format from the command line options
    if (mergedOptions.format) {
      setErrorFormat(mergedOptions.format);
    }
    
    if (mergedOptions.cacheTtl && (isNaN(mergedOptions.cacheTtl) || mergedOptions.cacheTtl <= 0)) {
      logger.error('cache-ttl must be a positive number');
      process.exit(1);
    }
    
    if (mergedOptions.cache === false && mergedOptions.cacheTtl) {
      logger.warn('--no-cache and --cache-ttl used together. Cache will be disabled regardless of TTL setting.');
    }
    
    // Validate count options
    if (mergedOptions.count && (isNaN(parseInt(mergedOptions.count)) || parseInt(mergedOptions.count) <= 0)) {
      logger.error('count must be a positive number');
      process.exit(1);
    }

    cmd.mergedOptions = mergedOptions;

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

// Add token management commands
program
  .command('token')
  .description('Manage API tokens')
  .addCommand(
    new Command('store')
      .description('Store a token in the system keychain')
      .argument('<token>', 'Buildkite API token to store')
      .action(async (token: string) => {
        try {
          const credentialManager = new CredentialManager();
          const success = await credentialManager.saveToken(token);
          if (success) {
            logger.info('Token successfully stored in system keychain');
          } else {
            logger.error('Failed to store token');
          }
        } catch (error) {
          displayCLIError(error, program.opts().debug);
        }
      })
  )
  .addCommand(
    new Command('delete')
      .description('Delete the stored token from system keychain')
      .action(async () => {
        try {
          const credentialManager = new CredentialManager();
          
          if (await credentialManager.hasToken()) {
            const success = await credentialManager.deleteToken();
            if (success) {
              logger.info('Token successfully deleted from system keychain');
            } else {
              logger.error('Failed to delete token');
            }
          } else {
            logger.info('No token found in system keychain');
          }
        } catch (error) {
          displayCLIError(error, program.opts().debug);
        }
      })
  )
  .addCommand(
    new Command('check')
      .description('Check if a token is stored in the system keychain')
      .action(async () => {
        try {
          const credentialManager = new CredentialManager();
          const hasToken = await credentialManager.hasToken();
          if (hasToken) {
            logger.info('Token found in system keychain');
          } else {
            logger.info('No token found in system keychain');
          }
        } catch (error) {
          displayCLIError(error, program.opts().debug);
        }
      })
  );

program
  .command('boom')
  .description('Test error handling with different formats')
  .option('--type <type>', 'Type of error to throw (basic, api, object)', 'basic')
  .action((options) => {
    switch (options.type) {
      case 'api':
        // Simulate an API error
        const apiError = new Error('API request failed');
        (apiError as any).response = {
          errors: [
            { message: 'Invalid token', path: ['viewer'], locations: [{ line: 1, column: 10 }] },
            { message: 'Permission denied', path: ['viewer', 'organizations'] }
          ]
        };
        (apiError as any).request = {
          url: 'https://graphql.buildkite.com/v1',
          method: 'POST'
        };
        throw apiError;
        
      case 'object':
        // Throw a non-Error object
        throw {
          message: 'This is not an Error instance',
          code: 'CUSTOM_ERROR',
          timestamp: new Date().toISOString()
        };
        
      case 'basic':
      default:
        // Simple error
        throw new Error('Boom! This is a test error');
    }
  });

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

logger.debug({ 
  pid: process.pid, 
}, 'Buildkite CLI started'); 