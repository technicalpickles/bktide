import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { parseBuildkiteReference, BuildkiteReference } from '../utils/parseBuildkiteReference.js';
import { logger } from '../services/logger.js';

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
    _options: SmartShowOptions
  ): Promise<number> {
    // TODO: Implement pipeline view
    logger.info(`Pipeline view not yet implemented: ${ref.org}/${ref.pipeline}`);
    return 1;
  }

  private async showBuild(
    ref: Extract<BuildkiteReference, { type: 'build' }>,
    _options: SmartShowOptions
  ): Promise<number> {
    // TODO: Implement build view (route to ShowBuild with --jobs --failed)
    logger.info(`Build view not yet implemented: ${ref.org}/${ref.pipeline}/${ref.buildNumber}`);
    return 1;
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
