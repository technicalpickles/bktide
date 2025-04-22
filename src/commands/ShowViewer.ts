import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getViewerFormatter } from '../formatters/index.js';
import { ViewerData } from '../types/index.js';
import { logger } from '../services/logger.js';

export interface ViewerOptions extends BaseCommandOptions {
}

export class ShowViewer extends BaseCommand {
  constructor(options?: Partial<ViewerOptions>) {
    super(options);
  }
  
  async execute(options: ViewerOptions): Promise<number> {
    await this.ensureInitialized();
  
    try {
      const data = await this.client.getViewer();
      
      if (!data?.viewer) {
        throw new Error('Invalid response format: missing viewer data');
      }
      
      const formatter = getViewerFormatter(options.format || 'plain');
      const output = formatter.formatViewer(data as unknown as ViewerData, { debug: options.debug });
      
      logger.console(output);
      return 0; // Success
    } catch (error) {
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
} 