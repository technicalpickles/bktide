import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { JobRetryFormatter, JobRetryResult } from '../formatters/job-retry/index.js';
import { logger } from '../services/logger.js';
import { BuildPoller } from '../services/BuildPoller.js';
import { BuildkiteJobResponse } from '../services/BuildkiteRestClient.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { isRoleDenied, reportWriteError } from '../utils/writeError.js';
import { pollerOptions } from './RetryJob.js';

export interface RetryFailedJobsOptions extends BaseCommandOptions {
  buildArg?: string;
  dryRun?: boolean;
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

/** States the retry endpoint accepts. */
const RETRYABLE_STATES = ['failed', 'timed_out'];

/**
 * Jobs worth retrying: command jobs that failed or timed out, are not soft
 * failures, and have not already been retried (only the latest attempt can be).
 */
export function selectRetryableJobs(jobs: BuildkiteJobResponse[]): BuildkiteJobResponse[] {
  return jobs.filter(job =>
    job.type === 'script'
    && RETRYABLE_STATES.includes(String(job.state).toLowerCase())
    && !job.soft_failed
    && !job.retried,
  );
}

export class RetryFailedJobs extends BaseCommand {
  static requiresToken = true;

  async execute(options: RetryFailedJobsOptions): Promise<number> {
    let action = 'retry jobs';
    try {
      await this.ensureInitialized();

      const ref = parseBuildRef(options.buildArg ?? '');
      action = `retry jobs in ${ref.org}/${ref.pipeline}`;
      const buildLabel = `${ref.org}/${ref.pipeline}#${ref.number}`;

      // Read the current job states, not a cached snapshot from before a retry
      await this.restClient.invalidateCache('builds');
      const build = await this.restClient.getBuild(ref.org, ref.pipeline, ref.number);
      const jobs = selectRetryableJobs(build.jobs ?? []);

      const formatter = FormatterFactory.getFormatter(FormatterType.JOB_RETRY, options.format || 'plain') as unknown as JobRetryFormatter;

      if (options.dryRun || jobs.length === 0) {
        logger.console(formatter.formatRetries(jobs.map(job => ({ job })), { dryRun: options.dryRun, buildLabel }));
        return 0;
      }

      const results: JobRetryResult[] = [];
      for (const job of jobs) {
        try {
          results.push({ job, retried: await this.restClient.retryJob(ref.org, job.id) });
        } catch (error) {
          // A role that forbids one retry forbids them all; stop and explain
          if (isRoleDenied(error) && results.length === 0) throw error;
          results.push({ job, error: error instanceof Error ? error.message.replace(/^API request failed:\s*/, '') : String(error) });
        }
      }

      logger.console(formatter.formatRetries(results, { buildLabel }));
      const allRetried = results.every(r => r.retried);

      if (!options.watch) return allRetried ? 0 : 1;

      await this.restClient.invalidateCache('builds');
      const poller = new BuildPoller(this.restClient, {
        onJobStateChange: () => {},
        onBuildComplete: () => {},
        onError: (err, willRetry) => { if (!willRetry) logger.error(err.message); },
        onTimeout: () => logger.error('Timed out waiting for build to complete.'),
      }, pollerOptions(options));

      try {
        const watched = await poller.watch({ org: ref.org, pipeline: ref.pipeline, buildNumber: ref.number });
        return allRetried && watched.state?.toLowerCase() === 'passed' ? 0 : 1;
      } catch (err) {
        logger.error(`Watch failed: ${err instanceof Error ? err.message : err}`);
        logger.error(`The jobs were retried and are still running: ${build.web_url}`);
        return 1;
      }
    } catch (error) {
      reportWriteError(error, action);
      return 1;
    }
  }
}
