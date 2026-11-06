import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { JobRetryFormatter } from '../formatters/job-retry/index.js';
import { jobLabel } from '../formatters/job-retry/Formatter.js';
import { logger } from '../services/logger.js';
import { BuildPoller } from '../services/BuildPoller.js';
import { BuildkiteJobResponse, BuildkiteRestClient } from '../services/BuildkiteRestClient.js';
import { parseJobRef } from '../utils/parseJobRef.js';
import { reportWriteError } from '../utils/writeError.js';
import { TERMINAL_JOB_STATES } from './ShowLogs.js';

export interface RetryJobOptions extends BaseCommandOptions {
  jobArg?: string;
  org?: string;
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export interface WatchOptions {
  timeout?: number;       // minutes
  pollInterval?: number;  // seconds
}

export function pollerOptions(options: WatchOptions) {
  return {
    ...(options.timeout ? { timeout: options.timeout * 60 * 1000 } : {}),
    ...(options.pollInterval ? { initialInterval: options.pollInterval * 1000 } : {}),
  };
}

/**
 * Poll the job's build until the given job reaches a terminal state.
 * Returns the final job, or null if the watch ended first (timeout, Ctrl-C, errors).
 */
export async function watchJob(
  restClient: BuildkiteRestClient,
  build: { org: string; pipeline: string; buildNumber: number },
  jobId: string,
  options: WatchOptions,
): Promise<BuildkiteJobResponse | null> {
  // The build was fetched or cached before the retry; drop it so the first
  // poll sees the build running again rather than its old terminal state.
  await restClient.invalidateCache('builds');

  let finished: BuildkiteJobResponse | null = null;
  const poller: BuildPoller = new BuildPoller(restClient, {
    onJobStateChange: ({ job }) => {
      if (job.id === jobId && TERMINAL_JOB_STATES.includes(String(job.state).toLowerCase())) {
        finished = job;
        poller.stop();
      }
    },
    onBuildComplete: () => {},
    onError: (err, willRetry) => { if (!willRetry) logger.error(err.message); },
    onTimeout: () => logger.error('Timed out waiting for job to finish.'),
  }, pollerOptions(options));

  const finalBuild = await poller.watch(build);
  if (finished) return finished;

  const job = (finalBuild?.jobs ?? []).find((j: any) => j.id === jobId);
  return job && TERMINAL_JOB_STATES.includes(String(job.state).toLowerCase()) ? job : null;
}

export class RetryJob extends BaseCommand {
  static requiresToken = true;

  async execute(options: RetryJobOptions): Promise<number> {
    let org: string | undefined;
    try {
      await this.ensureInitialized();

      const ref = parseJobRef(options.jobArg ?? '');
      if (ref.org && options.org && ref.org !== options.org) {
        logger.warn(`Ignoring --org ${options.org}; the job reference names org ${ref.org}.`);
      }

      org = ref.org ?? options.org ?? await this.resolveSingleOrg();
      if (!org) return 1;

      const retried = await this.restClient.retryJob(org, ref.jobId);

      const formatter = FormatterFactory.getFormatter(FormatterType.JOB_RETRY, options.format || 'plain') as unknown as JobRetryFormatter;
      logger.console(formatter.formatRetries([{
        job: { id: ref.jobId, name: retried.name, label: retried.label, type: retried.type },
        retried,
      }]));

      if (!options.watch) return 0;

      const build = ref.pipeline && ref.buildNumber
        ? { org, pipeline: ref.pipeline, buildNumber: ref.buildNumber }
        : buildFromJobUrl(org, retried);
      if (!build) {
        logger.error(`Cannot watch: Buildkite did not return the new job's build URL. Watch it with: bktide build <org>/<pipeline>/<number> --watch`);
        return 1;
      }

      try {
        const finished = await watchJob(this.restClient, build, retried.id, options);
        if (!finished) {
          logger.error(`Stopped watching before the job finished: ${retried.web_url ?? retried.id}`);
          return 1;
        }
        if ((options.format || 'plain') === 'plain') {
          logger.console(`${jobLabel(finished)} ${finished.state}`);
        }
        return String(finished.state).toLowerCase() === 'passed' ? 0 : 1;
      } catch (err) {
        logger.error(`Watch failed: ${err instanceof Error ? err.message : err}`);
        if (retried.web_url) logger.error(`The job was retried and is still running: ${retried.web_url}`);
        return 1;
      }
    } catch (error) {
      reportWriteError(error, `retry jobs${org ? ` in ${org}` : ''}`);
      return 1;
    }
  }

  private async resolveSingleOrg(): Promise<string | undefined> {
    const orgSlugs = await this.client.getViewerOrganizationSlugs();
    if (orgSlugs.length === 1) return orgSlugs[0];
    if (orgSlugs.length === 0) {
      logger.error('No organizations found. Check your API token permissions.');
    } else {
      logger.error(`Multiple organizations found: ${orgSlugs.join(', ')}. Use --org, or pass the job URL.`);
    }
    return undefined;
  }
}

function buildFromJobUrl(org: string, job: BuildkiteJobResponse) {
  const match = (job.build_url ?? job.web_url ?? '').match(/buildkite\.com\/[^/]+\/([^/]+)\/builds\/(\d+)/);
  return match ? { org, pipeline: match[1], buildNumber: parseInt(match[2], 10) } : null;
}
