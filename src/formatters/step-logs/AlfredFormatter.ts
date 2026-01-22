import { StepLogsFormatter, StepLogsData, StepLogsFormatterOptions } from './Formatter.js';

interface AlfredItem {
  uid?: string;
  title: string;
  subtitle?: string;
  arg?: string;
  icon?: { path: string };
  valid?: boolean;
}

interface AlfredOutput {
  items: AlfredItem[];
}

export class AlfredStepLogsFormatter extends StepLogsFormatter {
  name = 'alfred';

  constructor(options: StepLogsFormatterOptions) {
    super(options);
  }

  format(data: StepLogsData): string {
    const items: AlfredItem[] = [];
    const { build, step, logs } = data;

    // Build info item
    items.push({
      uid: `build-${build.org}-${build.pipeline}-${build.number}`,
      title: `Build #${build.number}`,
      subtitle: `${build.state} | ${build.org}/${build.pipeline}`,
      arg: build.url,
      icon: { path: this.getStateIcon(build.state) },
      valid: true,
    });

    // Step info item
    const stepLabel = step.label || `Step ${step.id}`;
    const exitInfo = step.exitStatus !== undefined ? ` (exit ${step.exitStatus})` : '';
    items.push({
      uid: `step-${step.id}`,
      title: stepLabel,
      subtitle: `${step.state}${exitInfo}`,
      arg: build.url,
      icon: { path: this.getStateIcon(step.state) },
      valid: true,
    });

    // Log summary item
    items.push({
      uid: `logs-${step.id}`,
      title: 'Log Output',
      subtitle: `${logs.displayedLines} of ${logs.totalLines} lines | ${this.formatSize(logs.size)}`,
      arg: build.url,
      icon: { path: 'icons/buildkite.png' },
      valid: true,
    });

    const output: AlfredOutput = { items };
    return JSON.stringify(output, null, 2);
  }

  private getStateIcon(state: string): string {
    const stateUpper = state.toUpperCase();
    switch (stateUpper) {
      case 'PASSED':
        return 'icons/passed.png';
      case 'FAILED':
        return 'icons/failed.png';
      case 'RUNNING':
        return 'icons/running.png';
      case 'BLOCKED':
        return 'icons/blocked.png';
      case 'CANCELED':
      case 'CANCELLED':
        return 'icons/unknown.png';
      case 'SCHEDULED':
        return 'icons/scheduled.png';
      case 'SKIPPED':
        return 'icons/skipped.png';
      default:
        return 'icons/unknown.png';
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
