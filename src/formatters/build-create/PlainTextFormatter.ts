import { BaseBuildCreateFormatter, BuildCreateFormatterOptions } from './Formatter.js';
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';
import { SEMANTIC_COLORS } from '../../ui/theme.js';

export class PlainTextFormatter extends BaseBuildCreateFormatter {
  name = 'plain';

  formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string {
    const lines: string[] = [];
    lines.push(`${options.verb === 'created' ? 'Created' : 'Rebuilt'} build #${build.number}`);
    lines.push(SEMANTIC_COLORS.muted(build.web_url));
    return lines.join('\n');
  }
}
