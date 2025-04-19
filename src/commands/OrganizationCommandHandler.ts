import { BaseCommandHandler, BaseCommandOptions } from './BaseCommandHandler.js';
import { GET_ORGANIZATIONS } from '../graphql/queries.js';
import { OrganizationsQueryResponse, Organization, GraphQLEdge } from '../types/index.js';

export interface OrganizationOptions extends BaseCommandOptions {
  token?: string;
  debug?: boolean;
}

export class OrganizationCommandHandler extends BaseCommandHandler {
  constructor(token: string, options?: Partial<OrganizationOptions>) {
    super(token, options);
  }
  
  async listOrganizations(options: OrganizationOptions): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();
      
      const data = await this.client.query<OrganizationsQueryResponse>(GET_ORGANIZATIONS);
      
      console.log('Your organizations:');
      data.viewer.organizations.edges.forEach((edge: GraphQLEdge<Organization>) => {
        console.log(`- ${edge.node.name} (${edge.node.slug})`);
      });
    } catch (error: any) {
      console.error('Error fetching organizations:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }
} 