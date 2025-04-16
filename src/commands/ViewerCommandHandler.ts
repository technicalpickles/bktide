import { BaseCommandHandler } from './BaseCommandHandler.js';
import { GET_VIEWER } from '../graphql/queries.js';

export interface ViewerOptions {
  token?: string;
  debug?: boolean;
}

export class ViewerCommandHandler extends BaseCommandHandler {
  async execute(options: ViewerOptions): Promise<void> {
    try {
      const data = await this.client.query(GET_VIEWER);
      
      // Check if we have the expected data structure
      if (!data?.viewer) {
        throw new Error('Invalid response format: missing viewer data');
      }
      
      console.log('Logged in as:');
      console.log(`- ID: ${data.viewer.id}`);
      
      // Safely display user data if available
      if (data.viewer.user) {
        console.log(`- User ID: ${data.viewer.user.id || 'N/A'}`);
        console.log(`- Name: ${data.viewer.user.name || 'N/A'}`);
        console.log(`- Email: ${data.viewer.user.email || 'N/A'}`);
      }
    } catch (error: any) {
      console.error('Error fetching user information:');
      this.handleError(error, options.debug);
      
      // Show additional debug info specific to this command
      if (options.debug) {
        console.error('Query:', GET_VIEWER);
      }
      
      process.exit(1);
    }
  }
} 