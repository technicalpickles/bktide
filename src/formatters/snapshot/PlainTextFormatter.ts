// src/formatters/snapshot/PlainTextFormatter.ts
import path from 'path';
import { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions } from './Formatter.js';
import { SEMANTIC_COLORS, getStateIcon, BUILD_STATUS_THEME } from '../../ui/theme.js';
import { formatBuildDuration, pathWithTilde, getFirstFailedStepDir } from '../../utils/formatUtils.js';
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
      lines.push(SEMANTIC_COLORS.warning(`  Warning: ${fetchErrorCount} step(s) had errors fetching logs`));
    }

    // Navigation tips (actionable commands)
    if (options?.tips !== false) {
      lines.push('');
      lines.push(...this.formatNavigationTips(data));
    }

    return lines.join('\n');
  }

  private formatNavigationTips(data: SnapshotData): string[] {
    const { build, outputDir, scriptJobs, stepResults, fetchAll, annotationResult } = data;
    const lines: string[] = [];
    const dim = SEMANTIC_COLORS.dim;

    const buildState = build.state?.toLowerCase();
    const isFailed = buildState === 'failed' || buildState === 'failing';

    // Use tilde paths for readability
    const basePath = pathWithTilde(outputDir);
    const manifestPath = path.join(basePath, 'manifest.json');
    const stepsPath = path.join(basePath, 'steps');
    const annotationsPath = path.join(basePath, 'annotations.json');

    lines.push(dim('Next steps:'));

    if (isFailed) {
      // Tips for failed builds
      lines.push(
        dim(`  → List failures:    jq -r '.steps[] | select(.state == "failed") | "\\(.id): \\(.label)"' ${manifestPath}`)
      );

      // Add annotation tip if annotations exist
      if (annotationResult?.count && annotationResult.count > 0) {
        lines.push(dim(`  → View annotations: jq -r '.annotations[] | {context, style}' ${annotationsPath}`));
      }

      lines.push(dim(`  → Get exit codes:   jq -r '.steps[] | "\\(.id): exit \\(.exit_status)"' ${manifestPath}`));

      // If we captured steps, show how to view first failed log
      if (stepResults.length > 0) {
        const firstFailedDir = getFirstFailedStepDir(scriptJobs);
        if (firstFailedDir) {
          lines.push(dim(`  → View a log:       cat ${path.join(stepsPath, firstFailedDir, 'log.txt')}`));
        }
      }

      lines.push(dim(`  → Search errors:    grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`));

      // Show --all tip if steps were skipped
      if (!fetchAll && scriptJobs.length > stepResults.length) {
        const skippedCount = scriptJobs.length - stepResults.length;
        lines.push(dim(`  → Use --all to include all ${skippedCount} passing steps`));
      }
    } else {
      // Tips for passed builds
      lines.push(dim(`  → List all steps:   jq -r '.steps[] | "\\(.id): \\(.label) (\\(.state))"' ${manifestPath}`));
      lines.push(dim(`  → Browse logs:      ls ${stepsPath}/`));

      if (stepResults.length > 0) {
        lines.push(dim(`  → View a log:       cat ${stepsPath}/01-*/log.txt`));
      }

      // Show --all tip if steps were skipped
      if (!fetchAll && scriptJobs.length > stepResults.length) {
        const skippedCount = scriptJobs.length - stepResults.length;
        lines.push(dim(`  → Use --all to include all ${skippedCount} passing steps`));
      }
    }

    lines.push(dim(`  → Use --no-tips to hide these hints`));
    lines.push(dim(`  manifest.json has full build metadata and step index`));

    return lines;
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

    return `         ${author} • ${SEMANTIC_COLORS.identifier(branch)} • ${SEMANTIC_COLORS.dim(commit)} • ${SEMANTIC_COLORS.dim(created)}`;
  }
}
