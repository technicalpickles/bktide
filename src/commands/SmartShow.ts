import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { parseBuildkiteReference, BuildkiteReference } from '../utils/parseBuildkiteReference.js';
import { logger } from '../services/logger.js';
import { ShowBuild } from './ShowBuild.js';
import { ShowPipeline } from './ShowPipeline.js';
import { ShowLogs } from './ShowLogs.js';
import { formatError } from '../ui/theme.js';

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

  private async showPipeline(
    ref: Extract<BuildkiteReference, { type: 'pipeline' }>,
    options: SmartShowOptions
  ): Promise<number> {
    const pipelineCommand = new ShowPipeline();
    return await pipelineCommand.execute({
      ...options,
      reference: `${ref.org}/${ref.pipeline}`,
      count: 20,  // Default for smart references
    });
  }

  private async showBuild(
    ref: Extract<BuildkiteReference, { type: 'build' }>,
    options: SmartShowOptions
  ): Promise<number> {
    // Route to ShowBuild with enhanced defaults (--jobs --failed)
    const buildCommand = new ShowBuild(options);
    
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
    options: SmartShowOptions
  ): Promise<number> {
    const logsCommand = new ShowLogs();
    return await logsCommand.execute({
      ...options,
      buildRef: `${ref.org}/${ref.pipeline}/${ref.buildNumber}`,
      stepId: ref.stepId,
    });
  }
}
