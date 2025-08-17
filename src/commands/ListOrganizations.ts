import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { FormatterType, OrganizationFormatter } from '../formatters/index.js';
import { Reporter } from '../ui/reporter.js';
import { Progress } from '../ui/progress.js';

export interface OrganizationOptions extends BaseCommandOptions {
}

export class ListOrganizations extends BaseCommand {
  constructor(options?: Partial<OrganizationOptions>) {
    super(options);
  }
  
  public async execute(options: OrganizationOptions = {}): Promise<number> {      
    const format = options.format || 'plain';
    const reporter = new Reporter(format, options.quiet, options.tips);
    const spinner = Progress.spinner('Fetching organizations…', { format });
    
    try {
      const organizations = await this.client.getOrganizations();
      spinner.stop();
      
      if (options.debug) {
        logger.debug(`Fetched ${organizations.length} organizations`);
      }
      
      // Get the appropriate formatter
      const formatter = this.getFormatter(FormatterType.ORGANIZATION, options) as OrganizationFormatter;
      
      // Format and output the organizations
      const output = formatter.formatOrganizations(organizations, { debug: options.debug });
      logger.console(output);
      reporter.success('Organizations retrieved');
      
      return 0; // Success
    } catch (error) {
      spinner.stop();
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
} 