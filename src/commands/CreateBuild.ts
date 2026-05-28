import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { parseEnvEntries } from '../utils/envParser.js';
import { CreateBuildPayload } from '../services/BuildkiteRestClient.js';

export interface CreateBuildOptions extends BaseCommandOptions {
  pipelineRef?: string;       // "org/pipeline" or undefined for auto-detect
  commit?: string;
  branch?: string;
  message?: string;
  env?: string[];
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class CreateBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: CreateBuildOptions): Promise<number> {
    try {
      await this.ensureInitialized();

      // Resolve org/pipeline. Auto-detection comes in Task 9.
      if (!options.pipelineRef) {
        logger.error('Pipeline reference is required. Pass "<org>/<pipeline>".');
        return 1;
      }
      const [org, pipeline] = options.pipelineRef.split('/');
      if (!org || !pipeline) {
        logger.error(`Invalid pipeline reference "${options.pipelineRef}". Use "<org>/<pipeline>".`);
        return 1;
      }

      if (!options.commit || !options.branch) {
        logger.error('--commit and --branch are required.');
        return 1;
      }

      let env: Record<string, string> | undefined;
      if (options.env && options.env.length > 0) {
        try {
          env = parseEnvEntries(options.env);
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
          return 1;
        }
      }

      const payload: CreateBuildPayload = {
        commit: options.commit,
        branch: options.branch,
        ...(options.message ? { message: options.message } : {}),
        ...(env ? { env } : {}),
      };

      const build = await this.restClient.createBuild(org, pipeline, payload);

      const formatter = FormatterFactory.getFormatter(FormatterType.BUILD_CREATE, options.format || 'plain') as any;
      logger.console(formatter.formatBuild(build, { verb: 'created' }));

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(message);
      return 1;
    }
  }
}
