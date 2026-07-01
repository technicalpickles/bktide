import { BaseBuildCreateFormatter, BuildCreateFormatterOptions } from './Formatter.js';
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';

export class JsonFormatter extends BaseBuildCreateFormatter {
  name = 'json';

  formatBuild(build: BuildkiteBuildResponse, _options: BuildCreateFormatterOptions): string {
    return JSON.stringify(build, null, 2);
  }
}
