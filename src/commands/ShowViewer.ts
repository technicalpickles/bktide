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
    await this.ensureInitialized();
  
    const data = await this.client.getViewer();
    
    if (!data?.viewer) {
      throw new Error('Invalid response format: missing viewer data');
    }
    
    const formatter = getViewerFormatter(options.format || 'plain');
    const output = formatter.formatViewer(data as unknown as ViewerData, { debug: options.debug });
    
    console.log(output);
  }
} 