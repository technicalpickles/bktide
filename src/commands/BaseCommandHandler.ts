import { BuildkiteClient } from '../services/BuildkiteClient.js';

export class BaseCommandHandler {
  protected client: BuildkiteClient;
  
  constructor(token: string) {
    this.client = new BuildkiteClient(token);
  }
  
  // Helper to get token from env or command line
  static getToken(options: { token?: string }): string {
    if (options.token) {
      return options.token;
    }
    
    const envToken = process.env.BK_TOKEN;
    if (!envToken) {
      throw new Error('No token provided. Please set BK_TOKEN environment variable or use --token option');
    }
    
    return envToken;
  }

  // Common error handling logic
  protected handleError(error: any, debug = false): void {
    console.error('\n❌ Error:');
    
    if (error.response?.errors) {
      // Handle GraphQL specific errors
      console.error('GraphQL Errors:');
      error.response.errors.forEach((err: any, i: number) => {
        console.error(`  ${i+1}. ${err.message}`);
        if (err.path) console.error(`     Path: ${err.path.join('.')}`);
      });
    } else if (error.request) {
      // Handle network errors
      console.error(`Network Error: ${error.message}`);
    } else {
      // Handle other errors
      console.error(`Error: ${error.message || 'Unknown error'}`);
    }
    
    // Show additional debug info if requested
    if (debug) {
      console.error('\nDebug Information:');
      if (error.stack) console.error('\nStack Trace:', error.stack);
    } else {
      console.error('\nTip: Use --debug flag for more information');
    }
  }
} 