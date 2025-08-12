import { BaseCommand } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';

export class ListAnnotations extends BaseCommand {
  static requiresToken = true;

  async execute(options: any): Promise<number> {
    logger.info('ListAnnotations command executed');
    
    if (!options.buildArg) {
      logger.error('Build reference is required');
      return 1;
    }
    
    try {
      // Ensure the command is initialized
      await this.ensureInitialized();
      
      const buildRef = parseBuildRef(options.buildArg);
      logger.info('Parsed build reference:', buildRef);
      
      // Fetch annotations from the REST API
      const annotations = await this.restClient.getBuildAnnotations(
        buildRef.org,
        buildRef.pipeline,
        buildRef.number
      );
      
      // Get the appropriate formatter
      const formatter = FormatterFactory.getFormatter(
        FormatterType.ANNOTATION,
        options.format || 'plain'
      ) as any; // Cast to any since FormatterFactory returns BaseFormatter
      
      // Format and output the results
      const output = formatter.formatAnnotations(annotations, {
        debug: options.debug
      });
      
      console.log(output);
      
      return 0;
    } catch (error) {
      logger.error('Failed to fetch annotations:', error);
      
      // Handle the error with the formatter
      const formatter = FormatterFactory.getFormatter(
        FormatterType.ANNOTATION,
        options.format || 'plain'
      ) as any; // Cast to any since FormatterFactory returns BaseFormatter
      
      const errorOutput = formatter.formatAnnotations([], {
        hasError: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        errorType: 'api',
        debug: options.debug
      });
      
      console.log(errorOutput);
      return 1;
    }
  }
}
