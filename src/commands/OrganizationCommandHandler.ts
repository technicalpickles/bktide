import { BaseCommandHandler, BaseCommandOptions } from './BaseCommandHandler.js';
import { GET_ORGANIZATIONS, GET_PIPELINES } from '../graphql/queries.js';

export interface OrganizationOptions extends BaseCommandOptions {
  token?: string;
  debug?: boolean;
}

export interface PipelineOptions extends OrganizationOptions {
  org?: string;
  count: string;
  all?: boolean;
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
          // Set batch size - if --all is specified, use 100 as the batch size
          const batchSize = options.all ? 100 : parseInt(options.count, 10);
          let hasNextPage = true;
          let cursor: string | null = null;
          
          while (hasNextPage && (options.all || allPipelines.length < parseInt(options.count, 10))) {
            const variables: any = {
              organizationSlug: org,
              first: batchSize
            };
            
            if (cursor) {
              variables.after = cursor;
            }
            
            const data = await this.client.query(GET_PIPELINES, variables);
            
            if (data?.organization?.pipelines?.edges) {
              // Add org information to each pipeline for display
              const pipelines = data.organization.pipelines.edges.map((edge: any) => ({
                ...edge.node,
                organization: org
              }));
              
              allPipelines = allPipelines.concat(pipelines);
            }
            
            // Check if we need to fetch more pages
            hasNextPage = data?.organization?.pipelines?.pageInfo?.hasNextPage || false;
            cursor = data?.organization?.pipelines?.pageInfo?.endCursor || null;
            
            if (options.debug) {
              console.log(`Debug: Fetched batch of ${data?.organization?.pipelines?.edges?.length || 0} pipelines from org ${org}`);
              if (hasNextPage) {
                console.log(`Debug: More pages available, cursor: ${cursor}`);
              }
            }
            
            // If we're not fetching all, stop after getting enough
            if (!options.all && allPipelines.length >= parseInt(options.count, 10)) {
              break;
            }
          }
        } catch (error) {
          if (options.debug) {
            console.error(`Error fetching pipelines for org ${org}:`, error);
          }
          // Continue to the next organization
        }
      }
      
      // Limit to the requested number of pipelines if not fetching all
      if (!options.all) {
        allPipelines = allPipelines.slice(0, parseInt(options.count, 10));
      }
      
      if (allPipelines.length === 0) {
        console.log('No pipelines found.');
        if (!options.org) {
          console.log('Try specifying an organization with --org to narrow your search.');
        }
        return;
      }
      
      if (orgs.length === 1) {
        console.log(`Pipelines for ${orgs[0]} (${allPipelines.length} total):`);
      } else {
        console.log(`Pipelines across your organizations (${allPipelines.length} total):`);
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