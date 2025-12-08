import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { parseBuildkiteReference, BuildkiteReference } from '../utils/parseBuildkiteReference.js';
import { logger } from '../services/logger.js';
import { ShowBuild } from './ShowBuild.js';
import { PlainPipelineDetailFormatter, JsonPipelineDetailFormatter } from '../formatters/pipeline-detail/index.js';
import type { PipelineDetailData } from '../formatters/pipeline-detail/Formatter.js';

export interface SmartShowOptions extends BaseCommandOptions {
  reference: string;
  // Log display options
  full?: boolean;
  lines?: number;
  save?: string;
}

export class SmartShow extends BaseCommand {
  static requiresToken = true;

  async execute(options: SmartShowOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting SmartShow command execution', options);
    }

    if (!options.reference) {
      logger.error('Reference is required');
      return 1;
    }

    try {
      // Parse the reference
      const ref = parseBuildkiteReference(options.reference);
      
      if (options.debug) {
        logger.debug('Parsed reference:', ref);
      }

      // Route based on reference type
      switch (ref.type) {
        case 'pipeline':
          return await this.showPipeline(ref, options);
        case 'build':
          return await this.showBuild(ref, options);
        case 'build-with-step':
          return await this.showBuildWithStep(ref, options);
        default:
          logger.error('Unknown reference type');
          return 1;
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
  }

  private async showPipeline(
    ref: Extract<BuildkiteReference, { type: 'pipeline' }>,
    options: SmartShowOptions
  ): Promise<number> {
    try {
      // Initialize token first
      this.token = await BaseCommand.getToken(options);
      
      // Fetch pipeline details
      const pipeline = await this.client.getPipeline(ref.org, ref.pipeline);
      
      if (!pipeline) {
        logger.error(`Pipeline not found: ${ref.org}/${ref.pipeline}`);
        return 1;
      }

      // Fetch recent builds
      const builds = await this.restClient.getBuilds(ref.org, {
        pipeline: ref.pipeline,
        per_page: '20',
      });

      // Prepare data for formatter
      const data: PipelineDetailData = {
        pipeline: {
          name: pipeline.name,
          slug: pipeline.slug,
          description: pipeline.description,
          defaultBranch: pipeline.defaultBranch,
          url: pipeline.url,
          repository: pipeline.repository,
        },
        recentBuilds: builds.map((build: any) => ({
          number: build.number,
          state: build.state,
          branch: build.branch,
          message: build.message,
          startedAt: build.started_at,
          finishedAt: build.finished_at,
        })),
      };

      // Format and display
      const format = options.format || 'plain';
      let formatter;
      
      if (format === 'json' || format === 'alfred') {
        formatter = new JsonPipelineDetailFormatter({});
      } else {
        formatter = new PlainPipelineDetailFormatter({});
      }

      const output = formatter.format(data);
      console.log(output);

      return 0;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to fetch pipeline: ${error.message}`);
      }
      return 1;
    }
  }

  private async showBuild(
    ref: Extract<BuildkiteReference, { type: 'build' }>,
    options: SmartShowOptions
  ): Promise<number> {
    // Route to ShowBuild with enhanced defaults (--jobs --failed)
    const buildCommand = new ShowBuild();
    
    const buildOptions = {
      ...options,
      buildArg: `${ref.org}/${ref.pipeline}/${ref.buildNumber}`,
      jobs: true,
      failed: true,
    };

    return await buildCommand.execute(buildOptions);
  }

  private async showBuildWithStep(
    ref: Extract<BuildkiteReference, { type: 'build-with-step' }>,
    _options: SmartShowOptions
  ): Promise<number> {
    // TODO: Implement step logs view
    logger.info(`Step logs view not yet implemented: ${ref.org}/${ref.pipeline}/${ref.buildNumber} (step: ${ref.stepId})`);
    return 1;
  }
}
