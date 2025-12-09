import { PipelineDetailFormatter, PipelineDetailData } from './Formatter.js';
import { FormatterOptions } from '../BaseFormatter.js';
import { SEMANTIC_COLORS, formatTips, TipStyle } from '../../ui/theme.js';
import { renderTable } from '../../ui/table.js';
import { formatStatus, formatRelativeDate, truncate } from '../../utils/formatUtils.js';

export class PlainPipelineDetailFormatter extends PipelineDetailFormatter {
  name = 'plain';

  constructor(options: FormatterOptions) {
    super(options);
  }

  format(data: PipelineDetailData): string {
    const { pipeline, recentBuilds } = data;
    const lines: string[] = [];

    // Pipeline header
    lines.push(SEMANTIC_COLORS.heading(`Pipeline: ${pipeline.name}`));
    
    if (pipeline.description) {
      lines.push(SEMANTIC_COLORS.dim(`Description: ${pipeline.description}`));
    }
    
    if (pipeline.defaultBranch) {
      lines.push(SEMANTIC_COLORS.dim(`Default Branch: ${pipeline.defaultBranch}`));
    }
    
    if (pipeline.repository?.url) {
      lines.push(SEMANTIC_COLORS.dim(`Repository: ${pipeline.repository.url}`));
    }
    
    lines.push('');

    // Recent builds
    if (recentBuilds && recentBuilds.length > 0) {
      lines.push(SEMANTIC_COLORS.subheading('Recent Builds'));
      lines.push('');

      const tableRows: string[][] = [
        ['Build', 'Status', 'Branch', 'Message', 'Started'],
        ...recentBuilds.map(build => [
          SEMANTIC_COLORS.label(`#${build.number}`),
          formatStatus(build.state),
          build.branch,
          truncate(build.message, 50),
          build.startedAt ? formatRelativeDate(build.startedAt) : '-',
        ])
      ];

      const table = renderTable(tableRows, { preserveWidths: true });
      lines.push(table);
      // Add tips
      lines.push('');
      const tips = formatTips([
        `View a build: bktide ${pipeline.slug}/<number>`,
        'Use --format json for machine-readable output',
      ], TipStyle.GROUPED);
      lines.push(tips);
    } else {
      lines.push(SEMANTIC_COLORS.dim('No recent builds found'));
    }

    return lines.join('\n');
  }
}
