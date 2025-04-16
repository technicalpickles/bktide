import { BaseCommandHandler } from './BaseCommandHandler.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';

export interface UserBuildsOptions {
  token?: string;
  org: string;
  user: string;
  count?: string;
  page?: string;
  pipeline?: string;
  branch?: string;
  state?: string;
  debug?: boolean;
}

export class UserBuildsCommandHandler extends BaseCommandHandler {
  private restClient: BuildkiteRestClient;

  constructor(token: string) {
    super(token);
    this.restClient = new BuildkiteRestClient(token);
  }

  async execute(options: UserBuildsOptions): Promise<void> {
    try {
      // Parse options
      const perPage = options.count || '10';
      const page = options.page || '1';
      
      // Call the REST API to get builds by user
      const builds = await this.restClient.getBuilds(options.org, {
        creator: options.user,
        pipeline: options.pipeline,
        branch: options.branch,
        state: options.state,
        per_page: perPage,
        page: page
      });
      
      if (builds.length === 0) {
        console.log(`No builds found for user "${options.user}" in organization "${options.org}".`);
        return;
      }
      
      console.log(`Builds for user "${options.user}" in "${options.org}":"`);
      console.log('==========================================');
      
      builds.forEach((build: any) => {
        console.log(`Pipeline: ${build.pipeline.slug} #${build.number}`);
        console.log(`State: ${build.state}`);
        console.log(`Branch: ${build.branch}`);
        console.log(`Message: ${build.message || 'No message'}`);
        console.log(`Created: ${new Date(build.created_at).toLocaleString()}`);
        console.log(`URL: ${build.web_url}`);
        console.log('------------------');
      });
      
      console.log(`Page ${page} with ${builds.length} results. Use --page and --count options to navigate.`);
    } catch (error: any) {
      console.error('Error fetching builds by user:');
      this.handleError(error, options.debug);
      
      // Show additional debug info
      if (options.debug) {
        console.error('UserBuildsCommandHandler Error Details:', error);
      }
      
      process.exit(1);
    }
  }
} 