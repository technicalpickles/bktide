import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { Progress } from '../ui/progress.js';

export interface ShowBuildOptions extends BaseCommandOptions {
  jobs?: boolean;
  failed?: boolean;
  annotations?: boolean;
  annotationsFull?: boolean;
  full?: boolean;
  summary?: boolean;
  allJobs?: boolean;
  buildArg?: string;
}

export class ShowBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: ShowBuildOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting ShowBuild command execution', options);
    }
    
    if (!options.buildArg) {
      logger.error('Build reference is required');
      return 1;
    }
    
    // Adjust options based on implications
    const adjustedOptions = { ...options };
    if (options.failed) {
      adjustedOptions.jobs = true; // --failed implies --jobs
    }
    if (options.annotationsFull) {
      adjustedOptions.annotations = true; // --annotations-full implies --annotations
    }
    if (options.allJobs) {
      adjustedOptions.jobs = true; // --all-jobs implies --jobs
    }
    if (options.full) {
      // --full shows everything
      adjustedOptions.jobs = true;
      adjustedOptions.annotations = true;
      adjustedOptions.allJobs = true; // --full shows all jobs
    }
    
    // Initialize spinner early
    const format = options.format || 'plain';
    const spinner = Progress.spinner('Fetching build details…', { format });
    
    try {
      // Ensure the command is initialized
      await this.ensureInitialized();
      
      // Parse build reference
      const buildRef = parseBuildRef(options.buildArg);
      if (options.debug) {
        logger.debug('Parsed build reference:', buildRef);
      }
      
      // Construct build slug for GraphQL
      const buildSlug = `${buildRef.org}/${buildRef.pipeline}/${buildRef.number}`;
      
      // Fetch build data based on what's needed
      const buildData = await this.fetchBuildData(buildSlug, adjustedOptions);
      spinner.stop();
      
      // Get the appropriate formatter
      const formatter = FormatterFactory.getFormatter(
        FormatterType.BUILD_DETAIL,
        options.format || 'plain'
      ) as any;
      
      // Format and output the results
      const output = formatter.formatBuildDetail(buildData, adjustedOptions);
      
      logger.console(output);
      
      return 0;
    } catch (error) {
      spinner.stop();
      logger.error('Failed to fetch build:', error);
      
      // Handle the error with the formatter
      const formatter = FormatterFactory.getFormatter(
        FormatterType.BUILD_DETAIL,
        options.format || 'plain'
      ) as any;
      
      const errorOutput = formatter.formatBuildDetail(null, {
        ...adjustedOptions,
        hasError: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        errorType: 'api',
      });
      
      logger.console(errorOutput);
      return 1;
    }
  }
  
  private async fetchBuildData(buildSlug: string, options: ShowBuildOptions): Promise<any> {
    // Determine what data we need to fetch based on options
    const needsJobs = options.jobs || options.failed || options.full;
    const needsAnnotations = options.annotations || options.annotationsFull || options.full;
    
    if (options.debug) {
      logger.debug('Fetching build data', {
        buildSlug,
        needsJobs,
        needsAnnotations,
        full: options.full
      });
    }
    
    // Fetch the appropriate level of detail
    if (options.full || needsJobs) {
      return await this.client.getBuildFull(buildSlug);
    } else {
      return await this.client.getBuildSummary(buildSlug);
    }
  }
}
