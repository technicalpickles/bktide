import { BaseCommandHandler, BaseCommandOptions } from './BaseCommandHandler.js';
import { GET_PIPELINES } from '../graphql/queries.js';
import { getPipelineFormatter } from '../formatters/index.js';
import Fuse from 'fuse.js';
import { Pipeline, PipelineQueryResponse } from '../types/index.js';

export interface PipelineOptions extends BaseCommandOptions {
  org?: string;
  count?: string;
  format?: string;  // Format option: plain, json, or alfred
  filter?: string;  // Filter option for pipeline names
}

export class PipelineCommandHandler extends BaseCommandHandler {
  constructor(token: string, options?: Partial<PipelineOptions>) {
    super(token, options);
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
      let allPipelines: Pipeline[] = [];
      
      // Fetch pipelines for each organization
      for (const org of orgs) {
        try {
          const batchSize = 500;
          let hasNextPage = true;
          let cursor: string | null = null;
          const limitResults = options.count !== undefined;
          const resultLimit = limitResults ? parseInt(options.count as string, 10) : Infinity;
          
          while (hasNextPage && allPipelines.length < resultLimit) {
            const variables: { 
              organizationSlug: string;
              first: number;
              after?: string;
            } = {
              organizationSlug: org,
              first: batchSize
            };
            
            if (cursor) {
              variables.after = cursor;
            }
            
            const data = await this.client.query<PipelineQueryResponse>(GET_PIPELINES, variables);
            
            if (data?.organization?.pipelines?.edges) {
              // Add org information to each pipeline for display
              const pipelines: Pipeline[] = data.organization.pipelines.edges.map((edge) => ({
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
            
            // If we're limiting results, stop after getting enough
            if (limitResults && allPipelines.length >= resultLimit) {
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
      
      // Limit to the requested number of pipelines if specified
      if (options.count !== undefined) {
        allPipelines = allPipelines.slice(0, parseInt(options.count as string, 10));
      }
      
      // Filter pipelines by name if filter is specified
      if (options.filter) {
        if (options.debug) {
          console.log(`Debug: Applying fuzzy filter '${options.filter}' to ${allPipelines.length} pipelines`);
        }
        
        // Configure Fuse for fuzzy searching
        const fuse = new Fuse(allPipelines, {
          keys: ['name', 'slug'],
          threshold: 0.4, // Lower threshold = more strict matching
          includeScore: true,
          shouldSort: true
        });
        
        // Perform the fuzzy search
        const searchResults = fuse.search(options.filter);
        allPipelines = searchResults.map(result => result.item);
        
        if (options.debug) {
          console.log(`Debug: Filtered to ${allPipelines.length} pipelines matching '${options.filter}'`);
        }
      }
      
      try {
        // Get the appropriate formatter
        // Format precedence: command line option > constructor option > default
        const format = options.format || this.options.format || 'plain';
        if (options.debug) {
          console.log(`Debug: Using ${format} formatter`);
        }
        const formatter = getPipelineFormatter(format);
        
        // Format and output the results
        const output = formatter.formatPipelines(allPipelines, orgs, { debug: options.debug });
        console.log(output);
      } catch (formatterError) {
        console.error('Error formatting output:', formatterError);
        if (options.debug) {
          console.error('Error details:', formatterError);
        }
        // Fallback to simple output if formatter fails
        if (allPipelines.length === 0) {
          console.log('No pipelines found.');
        } else {
          console.log(`Found ${allPipelines.length} pipelines.`);
        }
      }
    } catch (error: any) {
      console.error('Error fetching pipelines:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }
} 