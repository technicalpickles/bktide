import { BuildkiteClient } from '../services/BuildkiteClient.js';

export interface BaseCommandOptions {
  debug?: boolean;
  format?: string;
  noCache?: boolean;
  cacheTTL?: number;
  clearCache?: boolean;
}

// Extended Error interface for API and GraphQL errors
interface ApiError extends Error {
  response?: {
    errors?: Array<{
      message: string;
      path?: string[];
      locations?: Array<{line: number; column: number}>;
    }>;
  };
  request?: {
    url?: string;
    method?: string;
  };
}

export abstract class BaseCommandHandler {
  protected token: string;
  protected client: BuildkiteClient;
  protected options: Partial<BaseCommandOptions>;
  protected initialized: boolean = false;

  constructor(token: string, options?: Partial<BaseCommandOptions>) {
    this.token = token;
    this.options = options || {};
    if (options?.debug) {
      console.log('Debug: BaseCommandHandler options:', JSON.stringify(options));
    }
    this.client = new BuildkiteClient(token);
    this.initialized = true; // Client is initialized in constructor
  }

  protected async ensureInitialized(): Promise<void> {
    // No additional initialization needed
    return Promise.resolve();
  }

  protected handleError(error: any, debug: boolean = false): void {
    console.error('\x1b[31m%s\x1b[0m', '🔥 Error Details:');
    
    if (error instanceof Error) {
      console.error('\x1b[31m%s\x1b[0m', `Message: ${error.message}`);
      
      // Always print the stack trace for proper debugging
      if (error.stack) {
        console.error('\x1b[33m%s\x1b[0m', 'Stack Trace:');
        console.error('\x1b[33m%s\x1b[0m', error.stack);
      }
      
      // If it's a GraphQL error or API error, show more details
      const apiError = error as ApiError;
      if (apiError.response?.errors) {
        console.error('\x1b[33m%s\x1b[0m', 'GraphQL Errors:');
        apiError.response.errors.forEach((gqlError, index) => {
          console.error(`  Error ${index + 1}: ${gqlError.message}`);
          if (gqlError.path) console.error(`  Path: ${gqlError.path.join('.')}`);
          if (gqlError.locations) console.error(`  Locations: ${JSON.stringify(gqlError.locations)}`);
          console.error('');
        });
      }
      
      // Show request details if available and in debug mode
      if (debug && apiError.request) {
        console.error('\x1b[36m%s\x1b[0m', 'Request Details:');
        console.error(`  URL: ${apiError.request.url || 'N/A'}`);
        console.error(`  Method: ${apiError.request.method || 'N/A'}`);
      }
    } else if (typeof error === 'object') {
      console.error('\x1b[31m%s\x1b[0m', JSON.stringify(error, null, 2));
    } else {
      console.error('\x1b[31m%s\x1b[0m', 'An unknown error occurred:', error);
    }
    
    if (debug) {
      console.error('\x1b[36m%s\x1b[0m', '\nDebug Information:');
      console.error('\x1b[36m%s\x1b[0m', `⏰ Timestamp: ${new Date().toISOString()}`);
      console.error('\x1b[36m%s\x1b[0m', `🔧 Node Version: ${process.version}`);
      console.error('\x1b[36m%s\x1b[0m', `💻 Platform: ${process.platform} (${process.arch})`);
    }
  }

  // Static helper to get token from options or environment
  static getToken(options: any): string {
    const token = options.token || process.env.BK_TOKEN;
    if (!token) {
      throw new Error('API token required. Set via --token or BK_TOKEN environment variable.');
    }
    return token;
  }
} 