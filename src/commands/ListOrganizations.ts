import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { FormatterType, OrganizationFormatter } from '../formatters/index.js';

export interface OrganizationOptions extends BaseCommandOptions {
}

export class ListOrganizations extends BaseCommand {
  constructor(options?: Partial<OrganizationOptions>) {
    super(options);
  }
  
  public async execute(options: OrganizationOptions = {}): Promise<number> {      
    try {
      const organizations = await this.client.getOrganizations();
      
      if (options.debug) {
        logger.debug(`Fetched ${organizations.length} organizations`);
      }
      
      // Get the appropriate formatter
      const formatter = this.getFormatter(FormatterType.ORGANIZATION, options) as OrganizationFormatter;
      
      // Format and output the organizations
      const output = formatter.formatOrganizations(organizations, { debug: options.debug });
      logger.console(output);
      
      return 0; // Success
    } catch (error) {
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
} 