import { BaseCommandHandler } from './BaseCommandHandler.js';
import { GET_VIEWER_BUILDS } from '../graphql/queries.js';

export interface ViewerBuildsOptions {
  token?: string;
  count?: string;
  debug?: boolean;
}

export class ViewerBuildsCommandHandler extends BaseCommandHandler {
  async execute(options: ViewerBuildsOptions): Promise<void> {
    try {
      const count = parseInt(options.count || '10', 10);
      
      const data = await this.client.query(GET_VIEWER_BUILDS, {
        first: count
      });
      
      // Check if we have the expected data structure
      if (!data?.viewer?.builds?.edges) {
        throw new Error('Invalid response format: missing viewer builds data');
      }
      
      const builds = data.viewer.builds.edges.map((edge: any) => edge.node);
      
      if (builds.length === 0) {
        console.log('No builds found for the current user.');
        return;
      }
      
      console.log('Your recent builds:');
      console.log('==================');
      
      builds.forEach((build: any) => {
        console.log(`${build.organization.slug}/${build.pipeline.slug} #${build.number}`);
        console.log(`State: ${build.state}`);
        console.log(`Branch: ${build.branch}`);
        console.log(`Message: ${build.message || 'No message'}`);
        console.log(`Created: ${new Date(build.createdAt).toLocaleString()}`);
        console.log(`URL: ${build.url}`);
        console.log('------------------');
      });
      
      if (data.viewer.builds.pageInfo.hasNextPage) {
        console.log(`Showing ${builds.length} of more results. Use --count option to see more.`);
      }
    } catch (error: any) {
      console.error('Error fetching builds:');
      this.handleError(error, options.debug);
      
      // Show additional debug info specific to this command
      if (options.debug) {
        console.error('Query:', GET_VIEWER_BUILDS);
      }
      
      process.exit(1);
    }
  }
} 