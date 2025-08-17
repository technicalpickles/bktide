import { BaseCommand } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { Annotation } from '../types/index.js';
import { Reporter } from '../ui/reporter.js';
import { Progress } from '../ui/progress.js';

export class ListAnnotations extends BaseCommand {
  static requiresToken = true;

  async execute(options: any): Promise<number> {
    if (options.debug) {
      logger.debug('Starting ListAnnotations command execution');
    }
    
    
    if (!options.buildArg) {
      logger.error('Build reference is required');
      return 1;
    }
    
    // Initialize reporter and spinner early
    const format = options.format || 'plain';
    const reporter = new Reporter(format, options.quiet, options.tips);
    const spinner = Progress.spinner('Fetching annotations…', { format });
    
    try {
      // Ensure the command is initialized
      await this.ensureInitialized();
      
      const buildRef = parseBuildRef(options.buildArg);
      if (options.debug) {
        logger.debug('Parsed build reference:', buildRef);
      }
      
      // Fetch annotations from the GraphQL API
      const buildSlug = `${buildRef.org}/${buildRef.pipeline}/${buildRef.number}`;
      const result = await this.client.getBuildAnnotations(buildSlug);
      spinner.stop();
      
      // Extract annotations from the GraphQL response
      let annotations: Annotation[] = result.build?.annotations?.edges?.map((edge: any) => edge.node) || [];
      
      // Filter by context if specified
      if (options.context) {
        const contextFilter = options.context.toLowerCase();
        annotations = annotations.filter(annotation => 
          annotation.context.toLowerCase() === contextFilter
        );
        
        if (options.debug) {
          logger.debug(`Filtered annotations by context '${options.context}': ${annotations.length} found`);
        }
      }
      
      // Get the appropriate formatter
      const formatter = FormatterFactory.getFormatter(
        FormatterType.ANNOTATION,
        options.format || 'plain'
      ) as any; // Cast to any since FormatterFactory returns BaseFormatter
      
      // Format and output the results
      const output = formatter.formatAnnotations(annotations, {
        debug: options.debug,
        contextFilter: options.context
      });
      
      logger.console(output);
      reporter.success('Annotations retrieved');
      
      return 0;
    } catch (error) {
      spinner.stop();
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
      
      logger.console(errorOutput);
      return 1;
    }
  }
}
