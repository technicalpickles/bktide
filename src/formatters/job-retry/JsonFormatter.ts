import { JobRetryFormatter, JobRetryFormatterOptions, JobRetryResult } from './Formatter.js';

export class JsonFormatter implements JobRetryFormatter {
  name = 'json';

  formatRetries(results: JobRetryResult[], options: JobRetryFormatterOptions = {}): string {
    return JSON.stringify({
      dry_run: options.dryRun ?? false,
      results: results.map(r => ({
        job: r.job,
        retried: r.retried ?? null,
        error: r.error ?? null,
      })),
    }, null, 2);
  }
}
