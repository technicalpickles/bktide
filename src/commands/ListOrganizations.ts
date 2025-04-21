import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { FormatterType } from '../formatters/index.js';

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
      
      if (edges.length === 0) {
        logger.info('No organizations found.');
        return;
      }
      
      logger.info('Your organizations:');
      
      // Use formatter if available, otherwise simple text output
      if (this.options.format) {
        const formatter = this.getFormatter(FormatterType.VIEWER, options);
        // Filter out null edges and map to non-null nodes
        const nodes = edges
          .filter((edge): edge is NonNullable<typeof edge> => edge !== null)
          .map(edge => edge.node)
          .filter((node): node is NonNullable<typeof node> => node !== null);
          
        const output = formatter.format(nodes, 
          (orgs) => orgs.map(org => `${org.name} (${org.slug})`).join('\n'), 
          { debug: options.debug }
        );
        console.log(output);
      } else {
        // Simple text output directly
        edges.forEach(edge => {
          if (edge && edge.node) {
            console.log(`- ${edge.node.name} (${edge.node.slug})`);
          }
        });
      }
      
    } catch (error) {
      throw error;
    }
  }
} 