import { BaseCommandHandler } from './BaseCommandHandler.js';
import { GET_VIEWER } from '../graphql/queries.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';

// Add a custom console.debug that respects the debug flag
const createDebugLogger = (isDebugEnabled: boolean) => {
  return (...args: any[]) => {
    if (isDebugEnabled) {
      console.log('[DEBUG]', ...args);
    }
  };
};

export interface ViewerBuildsOptions {
  token?: string;
  count?: string;
  page?: string;
  org?: string;
  pipeline?: string;
  branch?: string;
  state?: string;
  debug?: boolean;
}

export class ViewerBuildsCommandHandler extends BaseCommandHandler {
  private restClient: BuildkiteRestClient;

  constructor(token: string) {
    super(token);
    this.restClient = new BuildkiteRestClient(token);
  }

  async execute(options: ViewerBuildsOptions): Promise<void> {
    // Declare originalDebug outside the try block so it's accessible in catch
    const originalDebug = console.debug;
    
    try {
      // Override console.debug to respect the debug flag
      console.debug = createDebugLogger(!!options.debug);
      
      const executeStartTime = process.hrtime.bigint();
      if (options.debug) {
        console.log('[DEBUG] Starting ViewerBuildsCommandHandler execution');
      }
      
      // First, get the current user's information using GraphQL
      const viewerData = await this.client.query(GET_VIEWER);
      
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
      
      // Attempt to find builds across all user organizations or the specified one
      let allBuilds: any[] = [];
      
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
            // console.log(`Debug: First build sample:`, builds.length > 0 ? JSON.stringify(builds[0], null, 2) : 'No builds');
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
      
      if (allBuilds.length === 0) {
        console.log(`No builds found for ${userName} (${userEmail || userId}).`);
        if (!options.org) {
          console.log('Try specifying an organization with --org to narrow your search.');
        }
        return;
      }
      
      console.log(`Recent builds for ${userName} (${userEmail || userId}):`);
      console.log('==============================================');
      
      allBuilds.forEach((build: any) => {
        try {
          console.log(`${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}`);
          console.log(`State: ${build.state || 'Unknown'}`);
          console.log(`Branch: ${build.branch || 'Unknown'}`);
          console.log(`Message: ${build.message || 'No message'}`);
          console.log(`Created: ${build.created_at ? new Date(build.created_at).toLocaleString() : 'Unknown'}`);
          console.log(`URL: ${build.web_url || 'No URL'}`);
          console.log('------------------');
        } catch (error) {
          console.error('Error displaying build:', error);
          if (options.debug) {
            console.error('Build data:', JSON.stringify(build, null, 2));
          }
          console.log('------------------');
        }
      });
      
      console.log(`Showing ${allBuilds.length} builds. Use --count and --page options to see more.`);
      
      if (!options.org && orgs.length > 1) {
        console.log(`Searched across ${orgs.length} organizations. Use --org to filter to a specific organization.`);
      }
      
      if (options.debug) {
        const executeDuration = Number(process.hrtime.bigint() - executeStartTime) / 1000000;
        console.log(`[DEBUG] ViewerBuildsCommandHandler execution completed in ${executeDuration.toFixed(2)}ms`);
      }
      
      // Restore original console.debug
      console.debug = originalDebug;
    } catch (error: any) {
      // Restore original console.debug in case of error
      console.debug = originalDebug;
      
      console.error('Error fetching builds:');
      this.handleError(error, options.debug);
      
      // Show additional debug info
      if (options.debug) {
        console.error('ViewerBuildsCommandHandler Error Details:', error);
      }
      
      process.exit(1);
    }
  }
} 