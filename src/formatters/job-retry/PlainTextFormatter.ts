import { JobRetryFormatter, JobRetryFormatterOptions, JobRetryResult, jobLabel } from './Formatter.js';
import { SEMANTIC_COLORS } from '../../ui/theme.js';

export class PlainTextFormatter implements JobRetryFormatter {
  name = 'plain';

  formatRetries(results: JobRetryResult[], options: JobRetryFormatterOptions = {}): string {
    if (results.length === 0) {
      return `No failed jobs to retry${options.buildLabel ? ` in ${options.buildLabel}` : ''}`;
    }

    const lines: string[] = [];
    if (options.dryRun) {
      lines.push(`Would retry ${results.length} job${results.length === 1 ? '' : 's'}:`);
    }

    for (const result of results) {
      const label = jobLabel(result.job);
      if (options.dryRun) {
        lines.push(`  ${label} ${SEMANTIC_COLORS.muted(`(${result.job.state})`)}`);
        if (result.job.web_url) lines.push(`    ${SEMANTIC_COLORS.muted(result.job.web_url)}`);
      } else if (result.retried) {
        lines.push(`Retried ${label}`);
        if (result.retried.web_url) lines.push(SEMANTIC_COLORS.muted(result.retried.web_url));
      } else {
        lines.push(SEMANTIC_COLORS.error(`Failed to retry ${label}: ${result.error ?? 'unknown error'}`));
      }
    }
    return lines.join('\n');
  }
}
