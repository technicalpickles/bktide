import { BuildkiteClient, BuildkiteClientOptions } from '../services/BuildkiteClient.js';

export interface BaseCommandOptions {
  token?: string;
  debug?: boolean;
  noCache?: boolean;
  cacheTTL?: number;
  clearCache?: boolean;
}

export class BaseCommandHandler {
  protected client: BuildkiteClient;
  private initPromise: Promise<void> | null = null;
  
  constructor(token: string, options?: Partial<BaseCommandOptions>) {
    const clientOptions: BuildkiteClientOptions = {
      caching: !options?.noCache,
      debug: options?.debug,
    };
    
    // If a specific cache TTL is provided, apply it to all cache types
    if (options?.cacheTTL) {
      clientOptions.cacheTTLs = {
        default: options.cacheTTL,
        viewer: options.cacheTTL,
        organizations: options.cacheTTL,
        pipelines: options.cacheTTL,
        builds: options.cacheTTL,
      };
    }
    
    this.client = new BuildkiteClient(token, clientOptions);
    
    // Initialize async with cache clearing if requested
    this.initPromise = this.initialize(options);
  }
  
  /**
   * Initialize handler with async operations
   */
  private async initialize(options?: Partial<BaseCommandOptions>): Promise<void> {
    // If clearCache option is provided, clear the cache at startup
    if (options?.clearCache) {
      await this.clearCache();
    }
  }
  
  /**
   * Ensure initialization is complete before executing commands
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }
  
  /**
   * Clear all cache entries
   */
  protected async clearCache(): Promise<void> {
    await this.client.clearCache();
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