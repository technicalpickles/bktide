// src/formatters/snapshot/PlainTextFormatter.ts
import { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions } from './Formatter.js';
import { SEMANTIC_COLORS, getStateIcon, BUILD_STATUS_THEME, formatTips, TipStyle } from '../../ui/theme.js';
import { formatBuildDuration } from '../../utils/formatUtils.js';
import { calculateJobStats, formatJobStatsSummary } from '../../utils/jobStats.js';
import { formatDistanceToNow } from 'date-fns';

export class PlainTextFormatter implements SnapshotFormatter {
  name = 'plain';

  formatSnapshot(data: SnapshotData, options?: SnapshotFormatterOptions): string {
    const lines: string[] = [];
    const { build, outputDir, scriptJobs, stepResults, fetchAll } = data;

    // Build summary header
    lines.push(this.formatBuildHeader(build));
    lines.push(this.formatBuildDetails(build));
    lines.push('');

    // Job stats
    const stats = calculateJobStats(scriptJobs);
    lines.push(formatJobStatsSummary(stats));
    lines.push('');

    // Snapshot info
    lines.push(`Snapshot saved to ${outputDir}`);

    if (stepResults.length > 0) {
      lines.push(`  ${stepResults.length} step(s) captured`);
    } else if (!fetchAll) {
      lines.push(`  No failed steps to capture (build metadata saved)`);
    } else {
      lines.push(`  No steps to capture (build metadata saved)`);
    }

    // Warning for fetch errors
    const fetchErrorCount = stepResults.filter(s => s.status === 'failed').length;
    if (fetchErrorCount > 0) {
      lines.push(`  Warning: ${fetchErrorCount} step(s) had errors fetching logs`);
    }

    // Tips
    if (options?.tips !== false) {
      const tips: string[] = [];

      // Tip about --all if we filtered
      if (!fetchAll && scriptJobs.length > stepResults.length) {
        const skippedCount = scriptJobs.length - stepResults.length;
        tips.push(`${skippedCount} passing step(s) skipped. Use --all to capture all logs.`);
      }

      if (tips.length > 0) {
        lines.push('');
        lines.push(formatTips(tips, TipStyle.INDIVIDUAL, false));
      }
    }

    return lines.join('\n');
  }

  private formatBuildHeader(build: any): string {
    const state = build.state || 'unknown';
    const icon = getStateIcon(state);
    const theme = BUILD_STATUS_THEME[state.toUpperCase() as keyof typeof BUILD_STATUS_THEME];
    const coloredIcon = theme ? theme.color(icon) : icon;
    const coloredState = theme ? theme.color(state.toUpperCase()) : state.toUpperCase();
    const message = build.message?.split('\n')[0] || 'No message';
    const duration = formatBuildDuration(build);
    const durationStr = duration ? ` ${SEMANTIC_COLORS.dim(duration)}` : '';

    return `${coloredIcon} ${coloredState} ${message} ${SEMANTIC_COLORS.dim(`#${build.number}`)}${durationStr}`;
  }

  private formatBuildDetails(build: any): string {
    const author = build.createdBy?.name || build.createdBy?.email || 'Unknown';
    const branch = build.branch || 'unknown';
    const commit = build.commit?.substring(0, 7) || 'unknown';
    const created = build.createdAt
      ? formatDistanceToNow(new Date(build.createdAt), { addSuffix: true })
      : '';

    return `         ${author} • ${SEMANTIC_COLORS.identifier(branch)} • ${commit} • ${SEMANTIC_COLORS.dim(created)}`;
  }
}
