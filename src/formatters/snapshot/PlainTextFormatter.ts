import { formatDistanceToNow } from 'date-fns';
import { BaseSnapshotFormatter, SnapshotFormatterInput, computeSnapshotPaths } from './Formatter.js';
import { getStateIcon, SEMANTIC_COLORS, BUILD_STATUS_THEME } from '../../ui/theme.js';
import { calculateJobStats } from '../../utils/jobStats.js';
import { getFirstFailedStepDir } from '../../utils/stepUtils.js';
import { pathWithTilde } from '../../utils/formatUtils.js';
import path from 'path';

/**
 * Duration from an ISO start time to either an ISO end time or now (for
 * still-running builds). Distinct from `formatUtils.formatDuration`, which
 * requires both endpoints and doesn't roll over into hours.
 */
function formatBuildDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format path for display: relative `./tmp/...` when under the default
 * snapshot location, tilde path otherwise (custom `--output-dir`).
 */
function pathForDisplay(absolutePath: string): string {
  const cwd = process.cwd();
  const defaultBase = path.join(cwd, 'tmp', 'bktide', 'snapshots');

  if (absolutePath.startsWith(defaultBase)) {
    return './' + path.relative(cwd, absolutePath);
  }

  return pathWithTilde(absolutePath);
}

export class PlainTextFormatter extends BaseSnapshotFormatter {
  name = 'plain';

  format(input: SnapshotFormatterInput): string {
    const lines: string[] = [];
    const basePath = pathForDisplay(input.outputDir);

    if (input.alreadyUpToDate) {
      lines.push(`Snapshot already up to date: ${basePath}`);
    } else {
      lines.push(...this.formatBuildSummary(input.build, input.scriptJobs));
      lines.push(`Snapshot saved to ${basePath}`);
      lines.push(...this.formatSaveSummary(input));
    }

    if (input.showTips) {
      lines.push(...this.formatNavigationTips(input, basePath));
    }

    return lines.join('\n');
  }

  private formatBuildSummary(build: any, scriptJobs: any[]): string[] {
    const lines: string[] = [];
    const state = build.state || 'unknown';
    const icon = getStateIcon(state);
    const theme = BUILD_STATUS_THEME[state.toUpperCase() as keyof typeof BUILD_STATUS_THEME];
    const coloredIcon = theme ? theme.color(icon) : icon;
    const message = build.message?.split('\n')[0] || 'No message';
    const duration = formatBuildDuration(build.startedAt, build.finishedAt);
    const durationStr = duration ? ` ${SEMANTIC_COLORS.dim(duration)}` : '';

    const coloredState = theme ? theme.color(state.toUpperCase()) : state.toUpperCase();
    lines.push(`${coloredIcon} ${coloredState} ${message} ${SEMANTIC_COLORS.dim(`#${build.number}`)}${durationStr}`);

    const author = build.createdBy?.name || build.createdBy?.email || 'Unknown';
    const branch = build.branch || 'unknown';
    const commit = build.commit?.substring(0, 7) || 'unknown';
    const created = build.createdAt ? formatDistanceToNow(new Date(build.createdAt), { addSuffix: true }) : '';
    lines.push(`         ${author} • ${SEMANTIC_COLORS.identifier(branch)} • ${commit} • ${SEMANTIC_COLORS.dim(created)}`);

    const stats = calculateJobStats(scriptJobs);
    const other = stats.total - stats.passed - stats.failed - stats.softFailed - stats.running;

    let statsStr = `${scriptJobs.length} steps:`;
    const parts: string[] = [];
    if (stats.passed > 0) parts.push(SEMANTIC_COLORS.success(`${stats.passed} passed`));
    if (stats.failed > 0) parts.push(SEMANTIC_COLORS.error(`${stats.failed} failed`));
    if (stats.softFailed > 0) parts.push(SEMANTIC_COLORS.warning(`▲ ${stats.softFailed} soft failure${stats.softFailed > 1 ? 's' : ''}`));
    if (stats.running > 0) parts.push(SEMANTIC_COLORS.info(`${stats.running} running`));
    if (other > 0) parts.push(SEMANTIC_COLORS.muted(`${other} other`));
    statsStr += ' ' + parts.join(', ');

    lines.push(' ');
    lines.push(statsStr);
    lines.push(' ');

    return lines;
  }

  private formatSaveSummary(input: SnapshotFormatterInput): string[] {
    const lines: string[] = [];
    const { capturedCount, skippedCount, fetchErrorCount, annotationResult, artifactResult } = input;

    if (capturedCount > 0) {
      lines.push(`  ${capturedCount} step(s) captured`);
    } else if (skippedCount > 0) {
      lines.push(`  No failed steps to capture (build metadata saved)`);
    } else {
      lines.push(`  No steps to capture (build metadata saved)`);
    }

    if (annotationResult.count > 0) {
      lines.push(`  ${annotationResult.count} annotation(s) captured`);
    } else if (annotationResult.fetchStatus === 'none') {
      if (input.debug) {
        lines.push(`  No annotations present`);
      }
    } else if (annotationResult.fetchStatus === 'failed') {
      lines.push(`  Warning: Failed to fetch annotations`);
    }

    if (fetchErrorCount > 0) {
      lines.push(`  Warning: ${fetchErrorCount} step(s) had errors fetching logs`);
    }

    if (artifactResult?.fetchStatus === 'success' && artifactResult.count > 0) {
      const filterNote = artifactResult.filter ? ` (filter: ${artifactResult.filter})` : '';
      lines.push(`  ${artifactResult.count} artifact(s) downloaded${filterNote}`);
    } else if (artifactResult?.fetchStatus === 'failed') {
      lines.push(`  Warning: Failed to fetch artifacts${artifactResult.error ? ': ' + artifactResult.error : ''}`);
    }

    return lines;
  }

  private formatNavigationTips(input: SnapshotFormatterInput, basePath: string): string[] {
    const lines: string[] = [];
    const { build, scriptJobs, capturedCount, annotationResult, skippedCount } = input;
    const buildState = build.state?.toLowerCase();
    const isFailed = buildState === 'failed' || buildState === 'failing';

    const paths = computeSnapshotPaths(basePath, false);
    const manifestPath = paths.manifest;
    const stepsPath = paths.steps;
    const annotationsPath = paths.annotations;

    lines.push(' ');
    lines.push('Next steps:');

    if (isFailed) {
      lines.push(`  → List failures:   jq -r '.steps[] | select(.state == "failed") | "\\(.id): \\(.label)"' ${manifestPath}`);

      if (annotationResult.count > 0) {
        lines.push(`  → View annotations: jq -r '.annotations[] | {context, style}' ${annotationsPath}`);
      }

      lines.push(`  → Get exit codes:  jq -r '.steps[] | "\\(.id): exit \\(.exit_status)"' ${manifestPath}`);

      if (capturedCount > 0) {
        const firstFailedDir = getFirstFailedStepDir(scriptJobs);
        if (firstFailedDir) {
          lines.push(`  → View a log:      cat ${stepsPath}/${firstFailedDir}/log.txt`);
        }
      }

      lines.push(`  → Search errors:   grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`);

      if (skippedCount > 0) {
        lines.push(`  → Use --all to include all ${skippedCount} passing steps`);
      }
    } else {
      lines.push(`  → List all steps:  jq -r '.steps[] | "\\(.id): \\(.label) (\\(.state))"' ${manifestPath}`);
      lines.push(`  → Browse logs:     ls ${stepsPath}/`);

      if (capturedCount > 0) {
        lines.push(`  → View a log:      cat ${stepsPath}/01-*/log.txt`);
      }

      if (skippedCount > 0) {
        lines.push(`  → Use --all to include all ${skippedCount} passing steps`);
      }
    }

    lines.push(`  → Use --no-tips to hide these hints`);
    lines.push(' ');
    lines.push(SEMANTIC_COLORS.dim(`  → manifest.json has full build metadata and step index`));

    return lines;
  }
}
