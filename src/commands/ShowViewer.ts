import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getViewerFormatter } from '../formatters/index.js';
import { ViewerData } from '../types/index.js';

export interface ViewerOptions extends BaseCommandOptions {
}

export class ShowViewer extends BaseCommand {
  constructor(token: string, options?: Partial<ViewerOptions>) {
    super(token, options);
  }
  
  async execute(options: ViewerOptions): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();
      
      const data = await this.client.getViewer();
      
      // Check if we have the expected data structure
      if (!data?.viewer) {
        throw new Error('Invalid response format: missing viewer data');
      }
      
      // Get the formatter based on the format option
      const format = options.format || 'plain';
      const formatter = getViewerFormatter(format);
      const output = formatter.formatViewer(data as unknown as ViewerData, { debug: options.debug });
      
      // Print the output
      console.log(output);
    } catch (error: any) {
      console.error('Error fetching user information:');
      this.handleError(error, options.debug);
      
      // Show additional debug info specific to this command
      if (options.debug) {
        console.error('Error details:', error);
      }
      
      process.exit(1);
    }
  }
} 