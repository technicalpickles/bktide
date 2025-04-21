import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { FormatterType, OrganizationFormatter } from '../formatters/index.js';

export interface OrganizationOptions extends BaseCommandOptions {
}

export class ListOrganizations extends BaseCommand {
  constructor(token: string, options?: Partial<OrganizationOptions>) {
    super(token, options);
  }
  
  public async execute(options: OrganizationOptions = {}): Promise<void> {
    try {
      if (options.debug) {
        logger.debug('Fetching organizations...');
      }
      
      // Use the new method that handles filtering null values
      const organizations = await this.client.getOrganizationsArray();
      
      if (options.debug) {
        logger.debug(`Fetched ${organizations.length} organizations`);
      }
      
      // Get the appropriate formatter
      const formatter = this.getFormatter(FormatterType.ORGANIZATION, options) as OrganizationFormatter;
      
      // Format and output the organizations
      const output = formatter.formatOrganizations(organizations, { debug: options.debug });
      logger.console(output);
      
    } catch (error) {
      throw error;
    }
  }
} 