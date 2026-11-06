import { JobRetryFormatter, JobRetryFormatterOptions, JobRetryResult, jobLabel } from './Formatter.js';

export class AlfredFormatter implements JobRetryFormatter {
  name = 'alfred';

  formatRetries(results: JobRetryResult[], options: JobRetryFormatterOptions = {}): string {
    if (results.length === 0) {
      return JSON.stringify({ items: [{ title: 'No failed jobs to retry', subtitle: options.buildLabel ?? '', valid: false }] });
    }
    return JSON.stringify({
      items: results.map(r => {
        const label = jobLabel(r.job);
        const url = r.retried?.web_url ?? r.job.web_url ?? '';
        const title = options.dryRun
          ? `Would retry ${label}`
          : r.retried ? `Retried ${label}` : `Failed to retry ${label}`;
        return {
          uid: `job-${r.retried?.id ?? r.job.id}`,
          title,
          subtitle: r.error ?? url,
          arg: url,
        };
      }),
    });
  }
}
