import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getPipelineFormatter } from '../formatters/index.js';
import Fuse from 'fuse.js';
import { Pipeline } from '../types/index.js';
import { logger } from '../services/logger.js';
export interface PipelineOptions extends BaseCommandOptions {
  org?: string;
  count?: string;
}

export class ListPipelines extends BaseCommand {
  readonly BATCH_SIZE = 500;
  
  constructor(options?: Partial<PipelineOptions>) {
    super(options);
  }
  
  async execute(options: PipelineOptions): Promise<number> {
    await this.ensureInitialized();
    
    try {
      // Need to get organization info if not provided
      const org = options.org;
      if (!org) {
        try {
          const orgs = await this.client.getViewerOrganizationSlugs();
          await this.listPipelines(orgs, options);
        } catch (error) {
          logger.error(error as any, 'Failed to determine your organizations');
          throw new Error('Failed to determine your organizations', { cause: error });
        }
      } else {
        await this.listPipelines([org], options);
      }
      
      return 0; // Success
    } catch (error) {
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
  
  private async listPipelines(organizations: string[], options: PipelineOptions): Promise<void> {
    let allPipelines: Pipeline[] = [];
    
    for (const org of organizations) {
      try {
        const batchSize = this.BATCH_SIZE;
        let hasNextPage = true;
        let cursor: string | null = null;
        const limitResults = options.count !== undefined;
        const resultLimit = limitResults ? parseInt(options.count as string, 10) : Infinity;
        
        while (hasNextPage && allPipelines.length < resultLimit) {
          if (options.debug) {
            logger.debug(`Fetching batch of pipelines from org ${org}, cursor: ${cursor || 'initial'}`);
          }
          
          const data = await this.client.getPipelines(org, batchSize, cursor || undefined);
          
          if (data?.organization?.pipelines?.edges) {
            // Add org information to each pipeline for display
            const pipelines = data.organization.pipelines.edges
              .filter(edge => edge !== null && edge.node !== null)
              .map(edge => {
                const node = edge!.node!;
                return {
                  uuid: node.uuid || '',
                  id: node.id || '',
                  name: node.name || '',
                  slug: node.slug || '',
                  description: node.description,
                  url: node.url || '',
                  repository: node.repository,
                  organization: org
                } as Pipeline;
              });
            
            allPipelines = allPipelines.concat(pipelines);
          }
          
          // Check if we need to fetch more pages
          hasNextPage = data?.organization?.pipelines?.pageInfo?.hasNextPage || false;
          cursor = data?.organization?.pipelines?.pageInfo?.endCursor || null;
          
          if (options.debug) {
            logger.debug(`Fetched batch of ${data?.organization?.pipelines?.edges?.length || 0} pipelines from org ${org}`);
            if (hasNextPage) {
              logger.debug(`More pages available, cursor: ${cursor}`);
            }
          }
          
          // If we're limiting results, stop after getting enough
          if (limitResults && allPipelines.length >= resultLimit) {
            break;
          }
        }
      } catch (error) {
        throw new Error(`Error fetching pipelines for organization ${org}`, { cause: error });
      }
    }
    
    // Apply limit if specified
    if (options.count) {
      const limit = parseInt(options.count, 10);
      allPipelines = allPipelines.slice(0, limit);
    }
    
    if (options.filter && allPipelines.length > 0) {
      if (options.debug) {
        logger.debug(`Applying fuzzy filter '${options.filter}' to ${allPipelines.length} pipelines`);
      }
      
      const fuse = new Fuse(allPipelines, {
        keys: ['name', 'slug', 'description'],
        threshold: 0.4,
        includeScore: true,
        shouldSort: true
      });
      
      const searchResults = fuse.search(options.filter);
      allPipelines = searchResults.map(result => result.item);
      
      if (options.debug) {
        logger.debug(`Filtered to ${allPipelines.length} pipelines matching '${options.filter}'`);
      }
    }
    
    const format = options.format || 'plain';
    const formatter = getPipelineFormatter(format);
    const output = formatter.formatPipelines(allPipelines, organizations);
    
    logger.console(output);
  }
} 