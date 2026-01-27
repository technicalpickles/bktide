#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  BaseCommand,
  ShowViewer,
  ListOrganizations,
  ListBuilds,
  ListPipelines,
  ManageToken,
  ListAnnotations,
  GenerateCompletions,
  ShowBuild,
  Snapshot,
  ShowPipeline,
  ShowLogs,
  SmartShow
} from './commands/index.js';
import { initializeErrorHandling } from './utils/errorUtils.js';
import { displayCLIError, setErrorFormat } from './utils/cli-error-handler.js';
import { logger, setLogLevel } from './services/logger.js';
import { WidthAwareHelp } from './ui/help.js';

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
program.allowUnknownOption();

// Define a generic interface for the command classes that includes the execute method
interface CommandWithExecute {
  execute(options: any): Promise<number>;
}

// Define a type for the constructor that includes static properties
type CommandConstructor = {
  new (options?: any): BaseCommand & CommandWithExecute;
  requiresToken: boolean;
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
const createCommandHandler = (CommandClass: CommandConstructor) => {
  return async function(this: ExtendedCommand) {
    try {
      const options = this.mergedOptions || this.opts();
      const cacheOptions = { enabled: options.cache !== false, ttl: options.cacheTtl, clear: options.clearCache };

      if (CommandClass.requiresToken) {
        const token = await BaseCommand.getToken(options);
        options.token = token;
      }
      
      const handler = new CommandClass({
        ...cacheOptions,
        token: options.token,
        debug: options.debug,
        format: options.format,
        quiet: options.quiet,
        tips: options.tips,
      });
      
      // Pass command-specific options if available
      const commandName = this.name();
      if (commandName === 'pipelines' && this.pipelineOptions) {
        logger.debug('Using pipeline options:', this.pipelineOptions);
      }
      else if (commandName === 'builds' && this.buildOptions) {
        logger.debug('Using build options:', this.buildOptions);
      }
      
      const exitCode = await handler.execute(options);
      // Set process.exitCode to propagate the exit code
      process.exitCode = exitCode;
    } catch (error) {
      const debug = this.mergedOptions?.debug || this.opts().debug || false;
      // No need to pass format - will use global format set in preAction hook
      displayCLIError(error, debug);
      process.exitCode = 1; // Set error exit code
    }
  };
};

function resolveAppVersion(): string {
  // Prefer environment-provided version (set in CI before publish)
  if (process.env.BKTIDE_VERSION && process.env.BKTIDE_VERSION.trim().length > 0) {
    return process.env.BKTIDE_VERSION.trim();
  }

  try {
    // Attempt to read package.json near compiled dist/index.js
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidatePaths = [
      path.resolve(__dirname, '..', 'package.json'), // when running from dist/
      path.resolve(__dirname, '..', '..', 'package.json'), // fallback
    ];
    for (const pkgPath of candidatePaths) {
      if (fs.existsSync(pkgPath)) {
        const raw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw) as { version?: string };
        if (pkg.version) return pkg.version;
      }
    }
  } catch {
    // ignore
  }

  // Last resort
  return '0.0.0';
}

// Create custom help instance
const customHelp = new WidthAwareHelp();

program
  .name('bktide')
  .description('Buildkite CLI tool')
  .version(resolveAppVersion())
  .configureHelp(customHelp)
  .showSuggestionAfterError()
  .option('--log-level <level>', 'Set logging level (trace, debug, info, warn, error, fatal)', 'info')
  .option('-d, --debug', 'Show debug information for errors')
  .option('--no-cache', 'Disable caching of API responses')
  .option('--cache-ttl <milliseconds>', 'Set cache time-to-live in milliseconds', parseInt)
  .option('--clear-cache', 'Clear all cached data before executing command')
  .option('-t, --token <token>', 'Buildkite API token (set BUILDKITE_API_TOKEN or BK_TOKEN env var)', process.env.BUILDKITE_API_TOKEN || process.env.BK_TOKEN)
  .option('--save-token', 'Save the token to system keychain for future use')
  .option('-f, --format <format>', 'Output format for results and errors (plain, json, alfred)', 'plain')
  .option('--color <mode>', 'Color output: auto|always|never', 'auto')
  .option('-q, --quiet', 'Suppress non-error output (plain format only)')
  .option('--tips', 'Show helpful tips and suggestions')
  .option('--no-tips', 'Hide helpful tips and suggestions')
  .option('--ascii', 'Use ASCII symbols instead of Unicode')
  .option('--full', 'Show all log lines (for step logs)')
  .option('--lines <n>', 'Show last N lines (default: 50)', '50')
  .option('--save <path>', 'Save logs to file');

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

    // Apply color mode
    if (mergedOptions.color) {
      const mode = String(mergedOptions.color).toLowerCase();
      // Respect NO_COLOR when mode is never; clear when always
      if (mode === 'never') {
        process.env.NO_COLOR = '1';
      } else if (mode === 'always') {
        // Explicitly enable color by unsetting NO_COLOR; downstream code should still TTY-check
        if (process.env.NO_COLOR) {
          delete process.env.NO_COLOR;
        }
        process.env.BKTIDE_COLOR_MODE = 'always';
      } else {
        // auto
        process.env.BKTIDE_COLOR_MODE = 'auto';
      }
    }
    
    if (mergedOptions.cacheTtl && (isNaN(mergedOptions.cacheTtl) || mergedOptions.cacheTtl <= 0)) {
      logger.error('cache-ttl must be a positive number');
      process.exitCode = 1;
      return;
    }
    
    if (mergedOptions.cache === false && mergedOptions.cacheTtl) {
      logger.warn('--no-cache and --cache-ttl used together. Cache will be disabled regardless of TTL setting.');
    }
    
    // Validate count options
    if (mergedOptions.count && (isNaN(parseInt(mergedOptions.count)) || parseInt(mergedOptions.count) <= 0)) {
      logger.error('count must be a positive number');
      process.exitCode = 1;
      return;
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
    else if (commandName === 'annotations') {
      // Attach the build argument to options
      cmd.mergedOptions.buildArg = cmd.args?.[0];
      
      if (mergedOptions.debug) {
        logger.debug('Annotations build arg:', cmd.mergedOptions.buildArg);
        logger.debug('Annotations context filter:', mergedOptions.context);
      }
    }
    else if (commandName === 'build') {
      // Attach the build argument to options
      cmd.mergedOptions.buildArg = cmd.args?.[0];

      if (mergedOptions.debug) {
        logger.debug('Build arg:', cmd.mergedOptions.buildArg);
        logger.debug('Build options:', mergedOptions);
      }
    }
    else if (commandName === 'snapshot') {
      // Attach the build-ref argument to options
      cmd.mergedOptions.buildRef = cmd.args?.[0];

      if (mergedOptions.debug) {
        logger.debug('Snapshot build-ref:', cmd.mergedOptions.buildRef);
        logger.debug('Snapshot options:', mergedOptions);
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

// Add token management command
program
  .command('token')
  .description('Manage API tokens')
  .option('--check', 'Check if a token is stored in the system keychain')
  .option('--store', 'Store a token in the system keychain')
  .option('--reset', 'Delete the stored token from system keychain')
  .action(createCommandHandler(ManageToken));

// Add annotations command
program
  .command('annotations')
  .description('Show annotations for a build')
  .argument('<build>', 'Build reference (org/pipeline/number or @https://buildkite.com/org/pipeline/builds/number)')
  .option('--context <context>', 'Filter annotations by context (e.g., rspec, build-resources)')
  .action(createCommandHandler(ListAnnotations));

// Add build command
program
  .command('build')
  .description('Show details for a specific build')
  .argument('<build>', 'Build reference (org/pipeline/number or @https://buildkite.com/org/pipeline/builds/number)')
  .option('--jobs', 'Show job summary and details')
  .option('--failed', 'Show only failed job details (implies --jobs)')
  .option('--all-jobs', 'Show all jobs without grouping limit')
  .option('--annotations', 'Show annotation details with context')
  .option('--annotations-full', 'Show complete annotation content')
  .option('--full', 'Show all available information')
  .option('--summary', 'Single-line summary only (for scripts)')
  .action(createCommandHandler(ShowBuild));

// Add snapshot command
program
  .command('snapshot')
  .description('Fetch and save build data locally for offline analysis')
  .argument('<build-ref>', 'Build reference (org/pipeline/number or https://buildkite.com/org/pipeline/builds/number)')
  .option('--output-dir <path>', 'Output directory for snapshot')
  .option('--json', 'Output manifest JSON to stdout')
  .option('--failed', 'Only fetch failed steps (default behavior)')
  .option('--all', 'Fetch all steps, not just failed ones')
  .option('--force', 'Force full re-fetch, bypassing change detection')
  .action(createCommandHandler(Snapshot));

// Add pipeline command
program
  .command('pipeline')
  .description('Show pipeline details and recent builds')
  .argument('<reference>', 'Pipeline reference (org/pipeline or URL)')
  .option('-n, --count <n>', 'Number of recent builds to show', '20')
  .action(async function(this: ExtendedCommand, reference: string) {
    try {
      const options = this.mergedOptions || this.opts();
      const token = await BaseCommand.getToken(options);

      const handler = new ShowPipeline({
        token,
        debug: options.debug,
        format: options.format,
        quiet: options.quiet,
        tips: options.tips,
      });

      const exitCode = await handler.execute({
        ...options,
        reference,
        count: options.count ? parseInt(options.count) : 20,
      });

      process.exitCode = exitCode;
    } catch (error) {
      const debug = this.mergedOptions?.debug || this.opts().debug || false;
      displayCLIError(error, debug);
      process.exitCode = 1;
    }
  });

// Add logs command
program
  .command('logs')
  .description('Show logs for a build step')
  .argument('<build-ref>', 'Build reference (org/pipeline/build or URL)')
  .argument('[step-id]', 'Step/job ID (or include in URL with ?sid=)')
  .option('--full', 'Show all log lines')
  .option('--lines <n>', 'Show last N lines', '50')
  .option('--save <path>', 'Save logs to file')
  .action(async function(this: ExtendedCommand, buildRef: string, stepId?: string) {
    try {
      const options = this.mergedOptions || this.opts();
      const token = await BaseCommand.getToken(options);

      const handler = new ShowLogs({
        token,
        debug: options.debug,
        format: options.format,
        quiet: options.quiet,
        tips: options.tips,
      });

      const exitCode = await handler.execute({
        ...options,
        buildRef,
        stepId,
        full: options.full,
        lines: options.lines ? parseInt(options.lines) : 50,
        save: options.save,
      });

      process.exitCode = exitCode;
    } catch (error) {
      const debug = this.mergedOptions?.debug || this.opts().debug || false;
      displayCLIError(error, debug);
      process.exitCode = 1;
    }
  });

// Add completions command
program
  .command('completions [shell]')
  .description('Generate shell completions')
  .action(async (shell) => {
    const handler = new GenerateCompletions();
    const exitCode = await handler.execute({ shell, quiet: program.opts().quiet, debug: program.opts().debug });
    process.exitCode = exitCode;
  });

program
  .command('boom')
  .description('Test error handling')
  .option('--type <type>', 'Type of error to throw (basic, api, object)', 'basic')
  .option('--format <format>', 'Output format (plain, json, alfred)', 'plain')
  .action((options) => {
    switch (options.type) {
      case 'api':
        const apiError = new Error('API request failed');
        (apiError as any).response = {
          errors: [
            { message: 'Invalid token', path: ['viewer'] }
          ]
        };
        throw apiError;
        
      case 'object':
        throw {
          message: 'This is not an Error instance',
          code: 'CUSTOM_ERROR'
        };
        
      case 'basic':
      default:
        throw new Error('Boom! This is a test error');
    }
  });

// Apply log level from command line options before parsing
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

// Handle unknown commands by trying to parse as Buildkite references
program.on('command:*', (operands) => {
  const potentialReference = operands[0];
  
  (async () => {
    try {
      const { parseBuildkiteReference } = await import('./utils/parseBuildkiteReference.js');
      
      // Try to parse as Buildkite reference (will throw if invalid)
      parseBuildkiteReference(potentialReference);
      
      // If parsing succeeds, route to SmartShow
      const token = await BaseCommand.getToken(options);
      const smartShowCommand = new SmartShow();
      
      const smartShowOptions = {
        reference: potentialReference,
        token,
        format: options.format,
        debug: options.debug,
        full: options.full,
        lines: options.lines ? parseInt(options.lines) : undefined,
        save: options.save,
        cache: options.cache !== false,
        cacheTtl: options.cacheTtl,
        clearCache: options.clearCache,
        quiet: options.quiet,
        tips: options.tips,
      };
      
      const exitCode = await smartShowCommand.execute(smartShowOptions);
      process.exit(exitCode);
    } catch (parseError) {
      // If parsing fails, show unknown command error
      logger.error(`Unknown command: ${potentialReference}`);
      logger.error(`Run 'bktide --help' for usage information`);
      process.exit(1);
    }
  })();
});

// Parse command line arguments
program.parse(); 