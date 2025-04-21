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
      const data = await this.client.getOrganizations();
      
      if (options.debug) {
        logger.debug('API Response:', JSON.stringify(data, null, 2));
      }
      
      if (!data?.viewer?.organizations?.edges) {
        logger.error('No organizations data returned from API.');
        
        if (options.debug) {
          logger.debug('Received data structure:', Object.keys(data || {}).join(', '));
        }
        return;
      }
      
      const edges = data.viewer.organizations.edges;
      
      // Filter out null edges and map to non-null nodes
      const organizations = edges
        .filter((edge): edge is NonNullable<typeof edge> => edge !== null)
        .map(edge => edge.node)
        .filter((node): node is NonNullable<typeof node> => node !== null);
      
      // Get the appropriate formatter
      const formatter = this.getFormatter(FormatterType.ORGANIZATION, options) as OrganizationFormatter;
      
      // Format and output the organizations
      const output = formatter.formatOrganizations(organizations, { debug: options.debug });
      console.log(output);
      
    } catch (error) {
      throw error;
    }
  }
} 