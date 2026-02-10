import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { Progress } from '../ui/progress.js';
import { BuildPoller, BuildRef, JobStateChange } from '../services/BuildPoller.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';
import { getStateIcon, SEMANTIC_COLORS } from '../ui/theme.js';

export interface ShowBuildOptions extends BaseCommandOptions {
  jobs?: boolean;
  failed?: boolean;
  annotations?: boolean;
  annotationsFull?: boolean;
  full?: boolean;
  summary?: boolean;
  allJobs?: boolean;
  buildArg?: string;
  // New watch options
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class ShowBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: ShowBuildOptions): Promise<number> {
    // Handle watch mode
    if (options.watch) {
      return this.executeWatchMode(options);
    }

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
    const needsAllJobs = options.jobs || options.failed || options.full;
    const needsAnnotations = options.annotations || options.annotationsFull || options.full;
    
    if (options.debug) {
      logger.debug('Fetching build data', {
        buildSlug,
        needsAllJobs,
        needsAnnotations,
        full: options.full
      });
    }
    
    // Use the new pagination-aware method when we need all jobs
    if (needsAllJobs) {
      // Show progress when fetching many jobs (only in plain format)
      const progressCallback = options.format === 'plain' || !options.format
        ? (fetched: number, total?: number) => {
            const totalStr = total ? `/${total}` : '';
            process.stderr.write(`\rFetching jobs: ${fetched}${totalStr}...`);
          }
        : undefined;
      
      const buildData = await this.client.getBuildSummaryWithAllJobs(buildSlug, {
        fetchAllJobs: true,
        onProgress: progressCallback
      });

      // Clear the progress line
      if (progressCallback) {
        process.stderr.write('\r\x1b[K'); // Clear the line
      }

      if (!buildData?.build) {
        throw new Error(`Build not found: ${buildSlug}`);
      }

      // If we need full details (like command text), fetch that separately
      if (options.full) {
        // For now, getBuildFull still provides more detailed fields
        // In the future, we could enhance the pagination query to include these
        return await this.client.getBuildFull(buildSlug);
      }
      
      return buildData;
    } else {
      // Just get the summary with first 100 jobs
      const buildData = await this.client.getBuildSummary(buildSlug);
      if (!buildData?.build) {
        throw new Error(`Build not found: ${buildSlug}`);
      }
      return buildData;
    }
  }

  private displayWatchHeader(buildNumber: number, timeoutMinutes: number): void {
    logger.console(`Watching build #${buildNumber} (timeout: ${timeoutMinutes}m)`);
    logger.console(SEMANTIC_COLORS.muted('Press Ctrl+C to stop\n'));
  }

  private displayJobEvent(change: JobStateChange): void {
    const time = change.timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const icon = getStateIcon(change.job.state);
    const name = change.job.name || change.job.label || 'unknown';
    const action = change.previousState === null ? 'started' : change.job.state;

    logger.console(`${time}  ${icon} ${name} ${action}`);
  }

  private displayFinalSummary(build: any): void {
    const icon = getStateIcon(build.state);
    const jobCount = build.jobs?.length || 0;
    logger.console(`\n${icon} Build #${build.number} ${build.state} (${jobCount} jobs)`);
  }

  private async executeWatchMode(options: ShowBuildOptions): Promise<number> {
    if (!options.buildArg) {
      logger.error('Build reference is required');
      return 1;
    }

    await this.ensureInitialized();

    const buildRef = parseBuildRef(options.buildArg);
    const ref: BuildRef = {
      org: buildRef.org,
      pipeline: buildRef.pipeline,
      buildNumber: buildRef.number,
    };

    const timeoutMinutes = parseInt(String(options.timeout || '30'), 10);
    const pollIntervalSeconds = parseInt(String(options.pollInterval || '5'), 10);

    // Get token for polling
    const token = await BaseCommand.getToken(options);
    if (!token) {
      logger.error('API token required for watch mode');
      return 1;
    }

    // Create non-caching client for polling
    const pollClient = new BuildkiteRestClient(
      token,
      { caching: false, debug: options.debug }
    );

    this.displayWatchHeader(buildRef.number, timeoutMinutes);

    const poller = new BuildPoller(pollClient, {
      onJobStateChange: (change) => this.displayJobEvent(change),
      onBuildComplete: (build) => this.displayFinalSummary(build),
      onError: (err, willRetry) => {
        if (willRetry) {
          logger.console(SEMANTIC_COLORS.warning(`⚠ ${err.message}, retrying...`));
        } else {
          logger.console(SEMANTIC_COLORS.error(`✗ ${err.message}`));
        }
      },
      onTimeout: () => {
        logger.console(SEMANTIC_COLORS.warning(`⏱ Timeout reached (${timeoutMinutes}m). Build still running.`));
      },
    }, {
      initialInterval: pollIntervalSeconds * 1000,
      timeout: timeoutMinutes * 60 * 1000,
    });

    const build = await poller.watch(ref);

    return build.state?.toLowerCase() === 'passed' ? 0 : 1;
  }
}
