import { BuildkiteJobResponse } from '../../services/BuildkiteRestClient.js';

export interface JobRetryResult {
  /** The job that was (or would be) retried. Only `id` is guaranteed. */
  job: Partial<BuildkiteJobResponse> & { id: string };
  /** The new job Buildkite created; absent on failure or dry run. */
  retried?: BuildkiteJobResponse;
  /** Buildkite's error message when the retry failed. */
  error?: string;
}

export interface JobRetryFormatterOptions {
  /** List what would be retried without retrying. */
  dryRun?: boolean;
  /** Build the jobs belong to, for the "nothing to retry" message. */
  buildLabel?: string;
}

export interface JobRetryFormatter {
  formatRetries(results: JobRetryResult[], options?: JobRetryFormatterOptions): string;
}

export function jobLabel(job: Partial<BuildkiteJobResponse> & { id: string }): string {
  return job.name || job.label || job.id;
}
