import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getViewerFormatter } from '../formatters/index.js';
import { ViewerData } from '../types/index.js';
import { logger } from '../services/logger.js';

import { Progress } from '../ui/progress.js';

export interface ViewerOptions extends BaseCommandOptions {
}

export class ShowViewer extends BaseCommand {
  constructor(options?: Partial<ViewerOptions>) {
    super(options);
  }
  
  async execute(options: ViewerOptions): Promise<number> {
    await this.ensureInitialized();
  
    const format = options.format || 'plain';
    const spinner = Progress.spinner('Fetching viewer…', { format });
    
    try {
      const data = await this.client.getViewer();
      spinner.stop();
      
      if (!data?.viewer) {
        throw new Error('Invalid response format: missing viewer data');
      }
      
      const formatter = getViewerFormatter(format);
      const output = formatter.formatViewer(data as unknown as ViewerData, { debug: options.debug });
      
      logger.console(output);
      // Success is implicit - data display confirms retrieval
      return 0; // Success
    } catch (error) {
      spinner.stop();
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
} 