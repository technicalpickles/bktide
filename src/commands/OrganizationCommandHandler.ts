import { BaseCommandHandler, BaseCommandOptions } from './BaseCommandHandler.js';
import { GET_ORGANIZATIONS, GET_PIPELINES } from '../graphql/queries.js';

export interface OrganizationOptions extends BaseCommandOptions {
  token?: string;
  debug?: boolean;
}

export interface PipelineOptions extends OrganizationOptions {
  org: string;
  count: string;
}

export class OrganizationCommandHandler extends BaseCommandHandler {
  constructor(token: string, options?: Partial<OrganizationOptions>) {
    super(token, options);
  }
  
  async listOrganizations(options: OrganizationOptions): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();
      
      const data = await this.client.query(GET_ORGANIZATIONS);
      
      console.log('Your organizations:');
      data.organizations.edges.forEach((edge: any) => {
        console.log(`- ${edge.node.name} (${edge.node.slug})`);
      });
    } catch (error: any) {
      console.error('Error fetching organizations:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }

  async listPipelines(options: PipelineOptions): Promise<void> {
    try {
      // Ensure initialization is complete
      await this.ensureInitialized();
      
      const variables = {
        organizationSlug: options.org,
        first: parseInt(options.count, 10)
      };
      
      const data = await this.client.query(GET_PIPELINES, variables);
      
      console.log(`Pipelines for ${options.org}:`);
      data.organization.pipelines.edges.forEach((edge: any) => {
        console.log(`- ${edge.node.name} (${edge.node.slug})`);
      });
    } catch (error: any) {
      console.error('Error fetching pipelines:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }
} 