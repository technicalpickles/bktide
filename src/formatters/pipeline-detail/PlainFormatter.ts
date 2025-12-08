import { PipelineDetailFormatter, PipelineDetailData } from './Formatter.js';
import { FormatterOptions } from '../BaseFormatter.js';
import { SEMANTIC_COLORS } from '../../ui/theme.js';
import { renderTable } from '../../ui/table.js';

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
    if (recentBuilds.length > 0) {
      lines.push(SEMANTIC_COLORS.subheading('Recent Builds'));
      lines.push('');

      const tableRows: string[][] = [
        ['Build', 'Status', 'Branch', 'Message', 'Started'],
        ...recentBuilds.map(build => [
          SEMANTIC_COLORS.label(`#${build.number}`),
          this.formatStatus(build.state),
          build.branch,
          this.truncate(build.message, 50),
          build.startedAt ? this.formatDate(build.startedAt) : '-',
        ])
      ];

      const table = renderTable(tableRows);
      lines.push(table);
    } else {
      lines.push(SEMANTIC_COLORS.dim('No recent builds found'));
    }

    return lines.join('\n');
  }

  private formatStatus(state: string): string {
    const stateUpper = state.toUpperCase();
    
    switch (stateUpper) {
      case 'PASSED':
        return SEMANTIC_COLORS.success('✓ passed');
      case 'FAILED':
        return SEMANTIC_COLORS.error('✖ failed');
      case 'RUNNING':
        return SEMANTIC_COLORS.info('↻ running');
      case 'BLOCKED':
        return SEMANTIC_COLORS.warning('⚠ blocked');
      case 'CANCELED':
      case 'CANCELLED':
        return SEMANTIC_COLORS.dim('− canceled');
      case 'SKIPPED':
        return SEMANTIC_COLORS.dim('− skipped');
      default:
        return SEMANTIC_COLORS.dim(`− ${state.toLowerCase()}`);
    }
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  private truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length - 3) + '...';
  }
}
