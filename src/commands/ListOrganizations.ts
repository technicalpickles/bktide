import { BaseCommandHandler, BaseCommandOptions } from './BaseCommandHandler.js';
import { GET_ORGANIZATIONS } from '../graphql/queries.js';
import { OrganizationsQueryResponse, Organization, GraphQLEdge } from '../types/index.js';

export interface OrganizationOptions extends BaseCommandOptions {
}

export class ListOrganizations extends BaseCommandHandler {
  constructor(token: string, options?: Partial<OrganizationOptions>) {
    super(token, options);
  }
  
  async listOrganizations(options: OrganizationOptions): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();
      
      const data = await this.client.query<OrganizationsQueryResponse>(GET_ORGANIZATIONS);
      
      // Debug output if debug option is enabled
      if (options.debug) {
        console.debug('API Response:', JSON.stringify(data, null, 2));
      }
      
      console.log('Your organizations:');
      
      // Safely check if data and required properties exist
      if (data?.viewer?.organizations?.edges && Array.isArray(data.viewer.organizations.edges)) {
        if (data.viewer.organizations.edges.length === 0) {
          console.log('No organizations found.');
          return;
        }
        
        data.viewer.organizations.edges.forEach((edge: GraphQLEdge<Organization>) => {
          console.log(`- ${edge.node.name} (${edge.node.slug})`);
        });
      } else {
        console.log('No organizations data returned from API.');
        if (options.debug) {
          console.debug('Received data structure:', Object.keys(data || {}).join(', '));
        }
      }
    } catch (error: any) {
      console.error('Error fetching organizations:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }
} 