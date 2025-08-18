import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getPipelineFormatter } from '../formatters/index.js';
import { PipelineFormatterOptions } from '../formatters/pipelines/Formatter.js';
import Fuse from 'fuse.js';
import { Pipeline } from '../types/index.js';
import { logger } from '../services/logger.js';

import { Progress } from '../ui/progress.js';
export interface PipelineOptions extends BaseCommandOptions {
  org?: string;
  count?: string;
  filter?: string;
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
      
      // Success is implicit - data display confirms retrieval
      return 0; // Success
    } catch (error) {
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
  
  private async listPipelines(organizations: string[], options: PipelineOptions): Promise<void> {
    let allPipelines: Pipeline[] = [];
    let totalBeforeFilter = 0;
    
    // Use progress bar for multiple orgs, spinner for single org
    const format = options.format || 'plain';
    const useProgressBar = organizations.length > 1 && format === 'plain';
    const orgProgress = useProgressBar ? Progress.bar({
      total: organizations.length,
      label: 'Processing organizations',
      format: format
    }) : null;
    
    for (let orgIndex = 0; orgIndex < organizations.length; orgIndex++) {
      const org = organizations[orgIndex];
      
      // Use different progress indicators based on context
      let spinner = null;
      const pageProgress = useProgressBar ? Progress.spinner(
        `Loading pipelines from ${org}...`,
        { format }
      ) : null;
      
      if (!useProgressBar) {
        // For single org, use spinner (existing behavior)
        spinner = Progress.spinner(`Fetching pipelines from ${org}…`, { format });
      }
      
      try {
        const batchSize = this.BATCH_SIZE;
        let hasNextPage = true;
        let cursor: string | null = null;
        const limitResults = options.count !== undefined;
        const resultLimit = limitResults ? parseInt(options.count as string, 10) : Infinity;
        
        // Update org progress if using progress bar
        if (orgProgress) {
          orgProgress.update(orgIndex, `Organization: ${org}`);
        }
        
        let pageCount = 0;
        let orgPipelineCount = 0;
        
        while (hasNextPage && allPipelines.length < resultLimit) {
          pageCount++;
          
          if (pageProgress) {
            pageProgress.update(pageCount, `Loading ${org} (page ${pageCount})...`);
          }
          
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
            
            orgPipelineCount += pipelines.length;
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
        
        // Stop the appropriate progress indicator
        if (pageProgress) {
          pageProgress.stop();
          if (options.debug) {
            logger.debug(`Loaded ${orgPipelineCount} pipelines from ${org} in ${pageCount} pages`);
          }
        } else if (spinner) {
          spinner.stop();
        }
      } catch (error) {
        // Clean up any active progress indicators  
        if (spinner) {
          spinner.stop();
        }
        if (pageProgress) {
          pageProgress.stop();
        }
        throw new Error(`Error fetching pipelines for organization ${org}`, { cause: error });
      }
    }
    
    // Complete the org progress bar if used
    if (orgProgress) {
      orgProgress.complete(`Loaded ${allPipelines.length} pipelines from ${organizations.length} organizations`);
    }
    
    // Track if results will be truncated
    const truncated = options.count ? allPipelines.length > parseInt(options.count, 10) : false;
    
    // Apply limit if specified
    if (options.count) {
      const limit = parseInt(options.count, 10);
      allPipelines = allPipelines.slice(0, limit);
    }
    
    // Track total before filter for context
    totalBeforeFilter = allPipelines.length;
    
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
    
    // Prepare formatter options with context
    const formatterOptions: PipelineFormatterOptions = {
      debug: options.debug,
      filterActive: !!options.filter,
      filterText: options.filter,
      truncated: truncated,
      totalBeforeFilter: totalBeforeFilter,
      organizationsCount: organizations.length,
      orgSpecified: !!options.org
    };
    
    const formatter = getPipelineFormatter(format);
    const output = formatter.formatPipelines(allPipelines, organizations, formatterOptions);
    
    logger.console(output);
  }
} 