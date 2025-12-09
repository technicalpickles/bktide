import { StepLogsFormatter, StepLogsData, StepLogsFormatterOptions } from './Formatter.js';
import { SEMANTIC_COLORS } from '../../ui/theme.js';
import { formatStatus, formatRelativeDate, formatDuration, formatSize } from '../../utils/formatUtils.js';

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
    lines.push(SEMANTIC_COLORS.dim(`Status: ${formatStatus(build.state)}`));
    
    if (build.startedAt) {
      lines.push(SEMANTIC_COLORS.dim(`Started: ${formatRelativeDate(build.startedAt)}`));
    }
    
    if (build.finishedAt && build.startedAt) {
      const duration = formatDuration(build.startedAt, build.finishedAt);
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
      const sizeFormatted = formatSize(logs.size);
      lines.push(SEMANTIC_COLORS.tip(`→ Log is ${sizeFormatted}. Showing last ${logs.displayedLines} lines.`));
      lines.push(SEMANTIC_COLORS.tip(`→ Run with --full to see all ${logs.totalLines} lines`));
      lines.push(SEMANTIC_COLORS.tip(`→ Run with --save <path> to save to file`));
    }

    return lines.join('\n');
  }
}
