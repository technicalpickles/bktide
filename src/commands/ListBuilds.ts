import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getBuildFormatter } from '../formatters/index.js';
import Fuse from 'fuse.js';
import { Build } from '../types/index.js';
import { logger } from '../services/logger.js';

export interface ViewerBuildsOptions extends BaseCommandOptions {
  count?: string;
  page?: string;
  org?: string;
  pipeline?: string;
  branch?: string;
  state?: string;
}

export class ListBuilds extends BaseCommand {
  constructor(options?: Partial<ViewerBuildsOptions>) {
    super(options);
  }

  async execute(options: ViewerBuildsOptions): Promise<number> {
    await this.ensureInitialized();
    
    const executeStartTime = process.hrtime.bigint();
    if (options.debug) {
      logger.debug('Starting ViewerBuildsCommandHandler execution');
    }
    
    try {
      // First, get the current user's information using GraphQL
      const viewerData = await this.client.getViewer();
      
      if (!viewerData?.viewer?.user?.uuid) {
        throw new Error('Failed to get current user UUID information');
      }
      
      const userId = viewerData.viewer.user.uuid;
      const userName = viewerData.viewer.user.name || 'Current user';
      const userEmail = viewerData.viewer.user.email;
      
      // Use the REST API to get builds by the current user
      const perPage = options.count || '10';
      const page = options.page || '1';
      
      // If organization is not specified, we need to fetch organizations first
      let orgs: string[] = [];
      if (!options.org) {
        // Try to fetch the user's organizations
        try {
          orgs = await this.client.getViewerOrganizationSlugs();
        } catch (error) {
          logger.error('Error fetching organizations:', error);
          throw new Error('Failed to determine your organizations. Please specify an organization with --org');
        }
      } else {
        orgs = [options.org];
      }
      
      // Initialize results array
      let allBuilds: Build[] = [];
      let errors: string[] = [];
      
      for (const org of orgs) {
        try {
          // First check if the user has access to this organization
          const hasAccess = await this.restClient.hasOrganizationAccess(org);
          if (!hasAccess) {
            errors.push(`You don't have access to organization ${org}`);
            continue;
          }
          
          const builds = await this.restClient.getBuilds(org, {
            creator: userId,
            pipeline: options.pipeline,
            branch: options.branch,
            state: options.state,
            per_page: perPage,
            page: page
          });
          
          if (options.debug) {
            logger.debug(`Debug: Received ${builds.length} builds from org ${org}`);
          }
          
          allBuilds = allBuilds.concat(builds);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Error fetching builds for org ${org}: ${errorMessage}`);
          
          if (options.debug) {
            logger.error(`Error fetching builds for org ${org}:`, error);
          }
        }
      }
      
      // If we have no builds and there were errors, provide a helpful message
      if (allBuilds.length === 0 && errors.length > 0) {
        if (options.org) {
          // If org was specified, show the specific error
          throw new Error(`No builds found for ${userName} (${userEmail}) in organization ${options.org}. ${errors[0]}`);
        } else {
          // If no org was specified, suggest using --org
          throw new Error(`No builds found for ${userName} (${userEmail}). Try specifying an organization with --org to narrow your search.`);
        }
      }
      
      // Limit to the requested number of builds
      allBuilds = allBuilds.slice(0, parseInt(perPage, 10));
      
      // Apply fuzzy filter if specified
      if (options.filter) {
        if (options.debug) {
          logger.debug(`Debug: Applying fuzzy filter '${options.filter}' to ${allBuilds.length} builds`);
        }
        
        // Configure Fuse for fuzzy searching
        const fuse = new Fuse(allBuilds, {
          keys: ['pipeline.name', 'branch', 'message', 'creator.name', 'state'],
          threshold: 0.4,
          includeScore: true,
          shouldSort: true
        });
        
        // Perform the fuzzy search
        const searchResults = fuse.search(options.filter);
        allBuilds = searchResults.map(result => result.item);
        
        if (options.debug) {
          logger.debug(`Debug: Filtered to ${allBuilds.length} builds matching '${options.filter}'`);
        }
      }
      
      const format = options.format || 'plain';
      const formatter = getBuildFormatter(format);
      const formatterOptions = { 
        debug: options.debug, 
        organizationsCount: orgs.length, 
        orgSpecified: !!options.org,
        userName,
        userEmail,
        userId
      };
      
      // Special case handling for empty results with Alfred and JSON formatters
      if (allBuilds.length === 0 && format === 'alfred') {
        logger.console(JSON.stringify({ items: [] }));
        return 0;
      } else if (allBuilds.length === 0 && format === 'json') {
        logger.console(JSON.stringify([]));
        return 0;
      }
      
      const output = formatter.formatBuilds(allBuilds, formatterOptions);
      logger.console(output);
      
      if (options.debug) {
        const executeDuration = Number(process.hrtime.bigint() - executeStartTime) / 1000000;
        logger.debug(` ViewerBuildsCommandHandler execution completed in ${executeDuration.toFixed(2)}ms`);
      }
      
      return 0; // Success
    } catch (error) {
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
}