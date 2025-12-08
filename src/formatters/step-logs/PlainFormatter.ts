import { StepLogsFormatter, StepLogsData, StepLogsFormatterOptions } from './Formatter.js';
import { SEMANTIC_COLORS } from '../../ui/theme.js';

export class PlainStepLogsFormatter extends StepLogsFormatter {
  name = 'plain';

  constructor(options: StepLogsFormatterOptions) {
    super(options);
  }

  format(data: StepLogsData): string {
    const { build, step, logs } = data;
    const lines: string[] = [];

    // Build context header
    lines.push(SEMANTIC_COLORS.heading(`Build: ${build.org}/${build.pipeline} #${build.number}`));
    lines.push(SEMANTIC_COLORS.dim(`Status: ${this.formatStatus(build.state)}`));
    
    if (build.startedAt) {
      lines.push(SEMANTIC_COLORS.dim(`Started: ${this.formatDate(build.startedAt)}`));
    }
    
    if (build.finishedAt && build.startedAt) {
      const duration = this.formatDuration(build.startedAt, build.finishedAt);
      lines.push(SEMANTIC_COLORS.dim(`Duration: ${duration}`));
    }
    
    lines.push('');

    // Step information
    lines.push(SEMANTIC_COLORS.subheading(`Step: ${step.label || 'Unnamed Step'}`));
    lines.push(SEMANTIC_COLORS.dim(`Job ID: ${step.id}`));
    lines.push(SEMANTIC_COLORS.dim(`State: ${step.state}`));
    
    if (step.exitStatus !== undefined) {
      lines.push(SEMANTIC_COLORS.dim(`Exit Status: ${step.exitStatus}`));
    }
    
    lines.push('');

    // Logs
    lines.push(SEMANTIC_COLORS.subheading(`Logs (last ${logs.displayedLines} lines of ${logs.totalLines}):`));
    lines.push(SEMANTIC_COLORS.dim('─'.repeat(60)));
    lines.push(logs.content);
    lines.push(SEMANTIC_COLORS.dim('─'.repeat(60)));
    lines.push('');

    // Tips
    if (logs.displayedLines < logs.totalLines) {
      const sizeFormatted = this.formatSize(logs.size);
      lines.push(SEMANTIC_COLORS.tip(`→ Log is ${sizeFormatted}. Showing last ${logs.displayedLines} lines.`));
      lines.push(SEMANTIC_COLORS.tip(`→ Run with --full to see all ${logs.totalLines} lines`));
      lines.push(SEMANTIC_COLORS.tip(`→ Run with --save <path> to save to file`));
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
      default:
        return state.toLowerCase();
    }
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  private formatDuration(startStr: string, endStr: string): string {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diff = end.getTime() - start.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
