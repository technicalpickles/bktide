import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { BuildPoller } from '../services/BuildPoller.js';

export interface RebuildBuildOptions extends BaseCommandOptions {
  buildArg?: string;
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class RebuildBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: RebuildBuildOptions): Promise<number> {
    try {
      await this.ensureInitialized();

      if (!options.buildArg) {
        logger.error('Build reference is required.');
        return 1;
      }

      const ref = parseBuildRef(options.buildArg);
      const build = await this.restClient.rebuildBuild(ref.org, ref.pipeline, ref.number);

      const formatter = FormatterFactory.getFormatter(FormatterType.BUILD_CREATE, options.format || 'plain') as any;
      logger.console(formatter.formatBuild(build, { verb: 'rebuilt' }));

      if (options.watch) {
        const pollerOpts = {
          ...(options.timeout ? { timeout: options.timeout * 60 * 1000 } : {}),
          ...(options.pollInterval ? { initialInterval: options.pollInterval * 1000 } : {}),
        };
        const poller = new BuildPoller(this.restClient, {
          onJobStateChange: () => {},
          onBuildComplete: () => {},
          onError: (err, willRetry) => { if (!willRetry) logger.error(err.message); },
          onTimeout: () => logger.error('Timed out waiting for build to complete.'),
        }, pollerOpts);

        try {
          const watched = await poller.watch({ org: ref.org, pipeline: ref.pipeline, buildNumber: build.number });
          return watched.state?.toLowerCase() === 'passed' ? 0 : 1;
        } catch (err) {
          logger.error(`Watch failed: ${err instanceof Error ? err.message : err}`);
          logger.error(`The build was created and is still running: ${build.web_url}`);
          return 1;
        }
      }

      return 0;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
}
