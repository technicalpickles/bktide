import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { getArtifactFormatter } from '../formatters/artifacts/index.js';
import { formatError } from '../ui/theme.js';
import { Progress } from '../ui/progress.js';

export interface ArtifactsListOptions extends BaseCommandOptions {
  buildRef: string;
}

export class ArtifactsList extends BaseCommand {
  static requiresToken = true;

  async execute(options: ArtifactsListOptions): Promise<number> {
    const format = options.format || 'plain';
    const spinner = Progress.spinner('Fetching artifacts...', { format });

    try {
      this.token = await BaseCommand.getToken(options);

      const ref = parseBuildRef(options.buildRef);
      const artifacts = await this.restClient.listBuildArtifacts(ref.org, ref.pipeline, ref.number);

      spinner.stop();

      const formatter = getArtifactFormatter(format);
      logger.console(formatter.formatArtifacts(artifacts));

      return 0;
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        const errorOutput = formatError(error.message, {
          suggestions: [
            'Check the build reference format (org/pipeline/number or URL)',
            'Verify you have read_artifacts scope on your API token',
          ],
        });
        logger.console(errorOutput);
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
  }
}
