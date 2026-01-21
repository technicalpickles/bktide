import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildkiteReference } from '../utils/parseBuildkiteReference.js';
import { PlainPipelineDetailFormatter, JsonPipelineDetailFormatter, AlfredPipelineDetailFormatter } from '../formatters/pipeline-detail/index.js';
import type { PipelineDetailData } from '../formatters/pipeline-detail/Formatter.js';
import { formatError } from '../ui/theme.js';
import { Progress } from '../ui/progress.js';

export interface ShowPipelineOptions extends BaseCommandOptions {
  reference: string;
  count?: number;
}

export class ShowPipeline extends BaseCommand {
  static requiresToken = true;

  async execute(options: ShowPipelineOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting ShowPipeline command execution', options);
    }

    if (!options.reference) {
      logger.error('Pipeline reference is required');
      return 1;
    }

    const format = options.format || 'plain';
    const spinner = Progress.spinner('Fetching pipeline details...', { format });

    try {
      // Initialize token first
      this.token = await BaseCommand.getToken(options);

      // Parse the reference to extract org/pipeline
      const ref = parseBuildkiteReference(options.reference);

      // Validate it's a pipeline reference
      if (ref.type !== 'pipeline') {
        spinner.stop();
        logger.error('Invalid pipeline reference. Expected format: org/pipeline or URL');
        return 1;
      }

      // Fetch pipeline details
      const pipeline = await this.client.getPipeline(ref.org, ref.pipeline);
      spinner.stop();

      if (!pipeline) {
        logger.error(`Pipeline not found: ${ref.org}/${ref.pipeline}`);
        return 1;
      }

      // Fetch recent builds using pipeline-specific endpoint
      const count = options.count || 20;
      const builds = await this.restClient.getPipelineBuilds(ref.org, ref.pipeline, {
        per_page: String(count),
      });

      // Prepare data for formatter
      const data: PipelineDetailData = {
        org: ref.org,
        pipeline: {
          name: pipeline.name,
          slug: pipeline.slug,
          description: pipeline.description,
          defaultBranch: pipeline.defaultBranch,
          url: pipeline.url,
          repository: pipeline.repository,
        },
        recentBuilds: (builds || []).map((build: any) => ({
          number: build.number,
          state: build.state,
          branch: build.branch,
          message: build.message,
          startedAt: build.started_at,
          finishedAt: build.finished_at,
        })),
      };

      // Format and display
      let formatter;

      if (format === 'alfred') {
        formatter = new AlfredPipelineDetailFormatter({});
      } else if (format === 'json') {
        formatter = new JsonPipelineDetailFormatter({});
      } else {
        formatter = new PlainPipelineDetailFormatter({});
      }

      const output = formatter.format(data);
      logger.console(output);

      return 0;
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        const errorOutput = formatError(error.message, {
          suggestions: ['Check the reference format', 'Verify you have access to this resource'],
        });
        logger.console(errorOutput);
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
  }
}
