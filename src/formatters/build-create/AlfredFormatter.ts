import { BaseBuildCreateFormatter, BuildCreateFormatterOptions } from './Formatter.js';
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';

export class AlfredFormatter extends BaseBuildCreateFormatter {
  name = 'alfred';

  formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string {
    const verb = options.verb === 'created' ? 'Created' : 'Rebuilt';
    return JSON.stringify({
      items: [
        {
          uid: `build-${build.number}`,
          title: `${verb} build #${build.number}`,
          subtitle: build.web_url,
          arg: build.web_url,
        },
      ],
    });
  }
}
