import { BaseCommandHandler } from './BaseCommandHandler.js';

export interface BuildOptions {
  token?: string;
  debug?: boolean;
  pipeline?: string;
  branch?: string;
  commit?: string;
  message?: string;
}

export class BuildCommandHandler extends BaseCommandHandler {
  async triggerBuild(options: BuildOptions): Promise<void> {
    try {
      // Currently just logging, but would implement the actual API call
      console.log('Triggering build with options:', options);
      
      // Implementation would go here
      // TODO: Implement build triggering logic using the Buildkite API
      
    } catch (error: any) {
      console.error('Error triggering build:');
      this.handleError(error, options.debug);
      process.exit(1);
    }
  }
} 