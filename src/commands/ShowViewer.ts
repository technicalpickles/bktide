import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getViewerFormatter } from '../formatters/index.js';
import { ViewerData } from '../types/index.js';
import { logger } from '../services/logger.js';
import { Reporter } from '../ui/reporter.js';
import { createSpinner } from '../ui/spinner.js';

export interface ViewerOptions extends BaseCommandOptions {
}

export class ShowViewer extends BaseCommand {
  constructor(options?: Partial<ViewerOptions>) {
    super(options);
  }
  
  async execute(options: ViewerOptions): Promise<number> {
    await this.ensureInitialized();
  
    try {
      const format = options.format || 'plain';
      const reporter = new Reporter(format, options.quiet, options.tips);
      const spinner = createSpinner(format);
      spinner.start('Fetching viewer…');
      const data = await this.client.getViewer();
      spinner.stop();
      
      if (!data?.viewer) {
        throw new Error('Invalid response format: missing viewer data');
      }
      
      const formatter = getViewerFormatter(options.format || 'plain');
      const output = formatter.formatViewer(data as unknown as ViewerData, { debug: options.debug });
      
      logger.console(output);
      reporter.success('Viewer info loaded');
      return 0; // Success
    } catch (error) {
      const spinner = createSpinner(options.format || 'plain');
      spinner.stop();
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
} 