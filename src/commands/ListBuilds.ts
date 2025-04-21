import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { BuildkiteRestClient, BuildkiteRestClientOptions } from '../services/BuildkiteRestClient.js';
import { getBuildFormatter } from '../formatters/index.js';
import Fuse from 'fuse.js';
import { Build } from '../types/index.js';

// Add a custom console.debug that respects the debug flag
const createDebugLogger = (isDebugEnabled: boolean) => {
  return (...args: any[]) => {
    if (isDebugEnabled) {
      console.log('[DEBUG]', ...args);
    }
  };
};

export interface ViewerBuildsOptions extends BaseCommandOptions {
  count?: string;
  page?: string;
  org?: string;
  pipeline?: string;
  branch?: string;
  state?: string;
}

export class ListBuilds extends BaseCommand {
  private restClient: BuildkiteRestClient;

  constructor(token: string, options?: Partial<ViewerBuildsOptions>) {
    super(token, options);
    
    // Configure REST client with the same caching options
    const restClientOptions: BuildkiteRestClientOptions = {
      debug: options?.debug,
      caching: !options?.noCache,
    };
    
    // If a specific cache TTL is provided, apply it to REST client
    if (options?.cacheTTL) {
      restClientOptions.cacheTTLs = {
        default: options.cacheTTL,
        builds: options.cacheTTL,
      };
    }
    
    this.restClient = new BuildkiteRestClient(token, restClientOptions);
  }

  async execute(options: ViewerBuildsOptions): Promise<void> {
    // Declare originalDebug outside the try block so it's accessible in catch
    const originalDebug = console.debug;
  
    // Override console.debug to respect the debug flag
    console.debug = createDebugLogger(!!options.debug);
    
    // Ensure initialization is complete
    await this.ensureInitialized();
    
    const executeStartTime = process.hrtime.bigint();
    if (options.debug) {
      console.log('[DEBUG] Starting ViewerBuildsCommandHandler execution');
    }
    
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
        console.error('Error fetching organizations:', error);
        throw new Error('Failed to determine your organizations. Please specify an organization with --org');
      }
    } else {
      orgs = [options.org];
    }
    
    // Initialize results array
    let allBuilds: Build[] = [];
    
    for (const org of orgs) {
      try {
        const builds = await this.restClient.getBuilds(org, {
          creator: userId,
          pipeline: options.pipeline,
          branch: options.branch,
          state: options.state,
          per_page: perPage,
          page: page
        });
        
        if (options.debug) {
          console.log(`Debug: Received ${builds.length} builds from org ${org}`);
        }
        
        allBuilds = allBuilds.concat(builds);
      } catch (error) {
        if (options.debug) {
          console.error(`Error fetching builds for org ${org}:`, error);
        }
        // Continue to the next organization
      }
    }
    
    // Limit to the requested number of builds
    allBuilds = allBuilds.slice(0, parseInt(perPage, 10));
    
    // Apply fuzzy filter if specified
    if (options.filter) {
      if (options.debug) {
        console.log(`Debug: Applying fuzzy filter '${options.filter}' to ${allBuilds.length} builds`);
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
        console.log(`Debug: Filtered to ${allBuilds.length} builds matching '${options.filter}'`);
      }
    }
    
    if (allBuilds.length === 0) {
      // Determine the format type based on options
      const format = options.format || 'plain';
      
      if (format === 'alfred') {
        // Return empty Alfred JSON format
        console.log(JSON.stringify({ items: [] }));
        return;
      } else if (format === 'json') {
        console.log(JSON.stringify([]));
        return;
      }
      console.log(`No builds found for ${userName} (${userEmail || userId}).`);
      if (!options.org) {
        console.log('Try specifying an organization with --org to narrow your search.');
      }
      return;
    }
    
    const format = options.format || 'plain';
    const formatter = getBuildFormatter(format);
    const formatterOptions = { 
      debug: options.debug, 
      organizationsCount: orgs.length, 
      orgSpecified: !!options.org 
    };
    const output = formatter.formatBuilds(allBuilds, formatterOptions);
    console.log(output);
    
    if (options.debug) {
      const executeDuration = Number(process.hrtime.bigint() - executeStartTime) / 1000000;
      console.log(`[DEBUG] ViewerBuildsCommandHandler execution completed in ${executeDuration.toFixed(2)}ms`);
    }
    
    console.debug = originalDebug;
  }
}