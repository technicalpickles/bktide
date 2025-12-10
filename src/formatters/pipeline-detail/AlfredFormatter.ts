import { PipelineDetailFormatter, PipelineDetailData } from './Formatter.js';
import { FormatterOptions } from '../BaseFormatter.js';

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

export class AlfredPipelineDetailFormatter extends PipelineDetailFormatter {
  name = 'alfred';

  constructor(options: FormatterOptions) {
    super(options);
  }

  format(data: PipelineDetailData): string {
    const items: AlfredItem[] = [];
    const { pipeline, recentBuilds } = data;

    // Pipeline header item
    items.push({
      uid: `pipeline-${pipeline.slug}`,
      title: pipeline.name,
      subtitle: pipeline.description || `Pipeline: ${pipeline.slug}`,
      arg: pipeline.url,
      icon: { path: 'icons/buildkite.png' },
      valid: true,
    });

    // Recent builds as items
    for (const build of recentBuilds) {
      const stateIcon = this.getStateIcon(build.state);
      items.push({
        uid: `build-${pipeline.slug}-${build.number}`,
        title: `#${build.number} - ${build.message}`,
        subtitle: `${build.state} | ${build.branch}`,
        arg: `${pipeline.url}/builds/${build.number}`,
        icon: { path: stateIcon },
        valid: true,
      });
    }

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
}
