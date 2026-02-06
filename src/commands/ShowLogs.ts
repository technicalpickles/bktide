import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';
import { logger } from '../services/logger.js';
import { parseBuildkiteReference } from '../utils/parseBuildkiteReference.js';
import { PlainStepLogsFormatter, JsonStepLogsFormatter, AlfredStepLogsFormatter } from '../formatters/step-logs/index.js';
import type { StepLogsData } from '../formatters/step-logs/Formatter.js';
import { SEMANTIC_COLORS, formatError } from '../ui/theme.js';
import { Progress } from '../ui/progress.js';
import * as fs from 'fs/promises';

// Terminal states where job is complete
export const TERMINAL_JOB_STATES = ['passed', 'failed', 'canceled', 'timed_out', 'skipped', 'broken'];

// Error categorization for retry logic
export type ErrorCategory = 'rate_limited' | 'not_found' | 'permission_denied' | 'network_error' | 'unknown';

export interface PollError {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}

export function categorizePollError(error: Error): PollError {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return { category: 'rate_limited', message: error.message, retryable: true };
  }
  if (message.includes('not found') || message.includes('404')) {
    return { category: 'not_found', message: error.message, retryable: false };
  }
  if (message.includes('permission') || message.includes('403') || message.includes('401')) {
    return { category: 'permission_denied', message: error.message, retryable: false };
  }
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return { category: 'network_error', message: error.message, retryable: true };
  }
  return { category: 'unknown', message: error.message, retryable: true };
}

export interface ShowLogsOptions extends BaseCommandOptions {
  buildRef: string;
  stepId?: string;
  full?: boolean;
  lines?: number;
  save?: string;
  follow?: boolean;
  pollInterval?: number;
}

export class ShowLogs extends BaseCommand {
  static requiresToken = true;

  async execute(options: ShowLogsOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting ShowLogs command execution', options);
    }

    if (!options.buildRef) {
      logger.error('Build reference is required');
      return 1;
    }

    const format = options.format || 'plain';
    const spinner = Progress.spinner('Fetching step logs...', { format });

    try {
      // Initialize token first
      this.token = await BaseCommand.getToken(options);

      // Parse the reference to extract org/pipeline/build and possibly stepId
      const ref = parseBuildkiteReference(options.buildRef);

      // Determine stepId - could come from argument, URL query param, or reference
      let stepId = options.stepId;
      if (!stepId && ref.type === 'build-with-step') {
        stepId = ref.stepId;
      }

      if (!stepId) {
        spinner.stop();
        logger.error('Step ID is required. Provide it as an argument or include ?sid= in the URL');
        return 1;
      }

      // Validate reference type
      if (ref.type !== 'build' && ref.type !== 'build-with-step') {
        spinner.stop();
        logger.error('Invalid build reference. Expected format: org/pipeline/build or URL with build');
        return 1;
      }

      // Use REST API to get build with jobs (step.id field needed for matching)
      const build = await this.restClient.getBuild(ref.org, ref.pipeline, ref.buildNumber);
      const jobs = build.jobs || [];

      if (!jobs || jobs.length === 0) {
        spinner.stop();
        logger.error(`Build not found: ${ref.org}/${ref.pipeline}/${ref.buildNumber}`);
        return 1;
      }

      // Find job by step ID (sid from URL) - step.id is different from job.id
      if (options.debug) {
        logger.debug(`Found ${jobs.length} jobs in build`);
        logger.debug(`Looking for step ID: ${stepId}`);
        // Log first few jobs for debugging
        jobs.slice(0, 3).forEach((j: any) => {
          logger.debug(`  Job: id=${j.id}, step.id=${j.step?.id}, name=${j.name}`);
        });
      }
      const job = jobs.find((j: any) => j.step?.id === stepId);

      if (!job) {
        spinner.stop();
        logger.error(`Step not found in build #${ref.buildNumber}: ${stepId}`);
        return 1;
      }

      // If follow mode and job not complete, enter polling loop
      if (options.follow && !this.isJobComplete(job)) {
        spinner.stop();
        return await this.followLogs(ref, job, options);
      }

      // Use job.id (job UUID) for log fetching, not stepId
      const logData = await this.restClient.getJobLog(ref.org, ref.pipeline, ref.buildNumber, job.id);
      spinner.stop();

      // Parse log content
      const logLines = logData.content.split('\n');
      const totalLines = logLines.length;

      // Determine how many lines to display
      const linesToShow = options.full ? totalLines : (options.lines || 50);
      const startLine = Math.max(0, totalLines - linesToShow);
      const displayedLines = logLines.slice(startLine);

      // Save to file if requested
      if (options.save) {
        await fs.writeFile(options.save, logData.content);
        logger.console(SEMANTIC_COLORS.success(`✓ Log saved to ${options.save} (${this.formatSize(logData.size)}, ${totalLines} lines)`));
      }

      // Prepare data for formatter using REST API fields from build object
      const data: StepLogsData = {
        build: {
          org: ref.org,
          pipeline: ref.pipeline,
          number: ref.buildNumber,
          state: build.state || 'unknown',
          startedAt: build.started_at,
          finishedAt: build.finished_at,
          url: build.web_url,
        },
        step: {
          id: job.id,
          label: job.name,
          state: job.state,
          exitStatus: job.exit_status,
          startedAt: job.started_at,
          finishedAt: job.finished_at,
        },
        logs: {
          content: displayedLines.join('\n'),
          size: logData.size,
          totalLines,
          displayedLines: displayedLines.length,
          startLine,
        },
      };

      // Format and display (unless only saving)
      if (!options.save || options.format) {
        let formatter;

        if (format === 'alfred') {
          formatter = new AlfredStepLogsFormatter({ full: options.full, lines: options.lines });
        } else if (format === 'json') {
          formatter = new JsonStepLogsFormatter({ full: options.full, lines: options.lines });
        } else {
          formatter = new PlainStepLogsFormatter({ full: options.full, lines: options.lines });
        }

        const output = formatter.format(data);
        logger.console(output);
      }

      return 0;
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          const errorOutput = formatError('Permission denied', {
            suggestions: [
              'Your API token needs \'read_build_logs\' scope to view logs',
              'Update your token at: https://buildkite.com/user/api-access-tokens',
            ],
          });
          logger.console(errorOutput);
        } else {
          const errorOutput = formatError(error.message, {
            suggestions: ['Check the reference format', 'Verify you have access to this resource'],
          });
          logger.console(errorOutput);
        }
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
  }

  private isJobComplete(job: any): boolean {
    const state = (job.state || '').toLowerCase();
    return TERMINAL_JOB_STATES.includes(state) || job.finished_at !== null;
  }

  private async sleep(ms: number): Promise<void> {
    // Add ±10% jitter to prevent thundering herd
    const jitter = ms * 0.1 * (Math.random() * 2 - 1);
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
  }

  private async followLogs(
    ref: { org: string; pipeline: string; buildNumber: number },
    initialJob: any,
    options: ShowLogsOptions
  ): Promise<number> {
    const pollInterval = (options.pollInterval || 3) * 1000;
    let previousSize = 0;
    let currentInterval = pollInterval;
    let consecutiveErrors = 0;
    const maxErrors = 3;

    // Create a non-caching REST client for polling (we need fresh data each time)
    const pollClient = new BuildkiteRestClient(this.token!, { caching: false, debug: options.debug });

    // Set up signal handler for Ctrl+C
    let interrupted = false;
    const signalHandler = () => {
      interrupted = true;
      process.stderr.write('\n');
      logger.console(SEMANTIC_COLORS.muted('Interrupted. Showing final state...'));
    };
    process.on('SIGINT', signalHandler);

    try {
      // Show initial logs
      const initialLogs = await pollClient.getJobLog(
        ref.org, ref.pipeline, ref.buildNumber, initialJob.id
      );

      // Display header
      logger.console(SEMANTIC_COLORS.muted(`Following logs for: ${initialJob.name || initialJob.id}`));
      logger.console(SEMANTIC_COLORS.muted('Press Ctrl+C to stop\n'));

      // Show initial content
      if (initialLogs.content) {
        const lines = initialLogs.content.split('\n');
        const linesToShow = options.lines || 50;
        const startLine = Math.max(0, lines.length - linesToShow);
        logger.console(lines.slice(startLine).join('\n'));
      }
      previousSize = initialLogs.size;

      // Polling loop
      while (!interrupted) {
        await this.sleep(currentInterval);

        try {
          // Re-fetch build to check job state
          const build = await pollClient.getBuild(ref.org, ref.pipeline, ref.buildNumber);
          const job = build.jobs?.find((j: any) => j.id === initialJob.id);

          if (!job) {
            logger.error('Job no longer exists in build');
            return 1;
          }

          // Fetch logs
          const logData = await pollClient.getJobLog(
            ref.org, ref.pipeline, ref.buildNumber, job.id
          );

          // Reset error counter on success
          consecutiveErrors = 0;
          currentInterval = pollInterval;

          // Display new content if any
          if (logData.size > previousSize) {
            const newContent = logData.content.slice(previousSize);
            if (newContent.trim()) {
              process.stdout.write(newContent);
            }
            previousSize = logData.size;
          }

          // Check if job is complete
          if (this.isJobComplete(job)) {
            logger.console(SEMANTIC_COLORS.muted(`\n\nJob ${job.state}: exit code ${job.exit_status ?? 'unknown'}`));
            return job.exit_status === 0 ? 0 : 1;
          }
        } catch (error) {
          consecutiveErrors++;
          const pollError = categorizePollError(error as Error);

          if (!pollError.retryable || consecutiveErrors >= maxErrors) {
            logger.error(`Failed to fetch logs: ${pollError.message}`);
            return 1;
          }

          // Exponential backoff
          currentInterval = Math.min(currentInterval * 2, 30000);
          logger.console(SEMANTIC_COLORS.warning(`Retrying in ${currentInterval / 1000}s...`));
        }
      }

      // Interrupted - show final state
      return 0;
    } finally {
      process.removeListener('SIGINT', signalHandler);
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
