import { BaseCommandHandler, BaseCommandOptions } from './BaseCommandHandler.js';
import { GET_ORGANIZATIONS, GET_PIPELINES } from '../graphql/queries.js';

export interface OrganizationOptions extends BaseCommandOptions {
  token?: string;
  debug?: boolean;
}

export interface PipelineOptions extends OrganizationOptions {
  org?: string;
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
      
      // If organization is not specified, we need to fetch organizations first
      let orgs: string[] = [];
      if (!options.org) {
        // Try to fetch the user's organizations
        try {
          orgs = await this.client.getViewerOrganizationSlugs();
        } catch (error) {
          console.error('Error fetching organizations:', error);
          throw new Error('Failed to determine your organizations. Please specify an organization with --org');
        }
      } else {
        orgs = [options.org];
      }
      
      // Initialize results array
      let allPipelines: any[] = [];
      
      // Fetch pipelines for each organization
      for (const org of orgs) {
        try {
          const variables = {
            organizationSlug: org,
            first: parseInt(options.count, 10)
          };
          
          const data = await this.client.query(GET_PIPELINES, variables);
          
          if (data?.organization?.pipelines?.edges) {
            // Add org information to each pipeline for display
            const pipelines = data.organization.pipelines.edges.map((edge: any) => ({
              ...edge.node,
              organization: org
            }));
            
            allPipelines = allPipelines.concat(pipelines);
          }
          
          if (options.debug) {
            console.log(`Debug: Fetched ${data?.organization?.pipelines?.edges?.length || 0} pipelines from org ${org}`);
          }
        } catch (error) {
          if (options.debug) {
            console.error(`Error fetching pipelines for org ${org}:`, error);
          }
          // Continue to the next organization
        }
      }
      
      // Limit to the requested number of pipelines
      allPipelines = allPipelines.slice(0, parseInt(options.count, 10));
      
      if (allPipelines.length === 0) {
        console.log('No pipelines found.');
        if (!options.org) {
          console.log('Try specifying an organization with --org to narrow your search.');
        }
        return;
      }
      
      if (orgs.length === 1) {
        console.log(`Pipelines for ${orgs[0]}:`);
      } else {
        console.log('Pipelines across your organizations:');
      }
      
      allPipelines.forEach((pipeline: any) => {
        if (orgs.length > 1) {
          console.log(`- [${pipeline.organization}] ${pipeline.name} (${pipeline.slug})`);
        } else {
          console.log(`- ${pipeline.name} (${pipeline.slug})`);
        }
      });
      
      if (!options.org && orgs.length > 1) {
        console.log(`\nSearched across ${orgs.length} organizations. Use --org to filter to a specific organization.`);
      }
    } catch (error: any) {
      console.error('Error fetching pipelines:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }
} 