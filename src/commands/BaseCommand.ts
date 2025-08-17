import { BuildkiteClient } from '../services/BuildkiteClient.js';
import { BuildkiteRestClient, BuildkiteRestClientOptions } from '../services/BuildkiteRestClient.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { CredentialManager } from '../services/CredentialManager.js';

export interface BaseCommandOptions {
  cacheTTL?: number;
  clearCache?: boolean;
  debug?: boolean;
  filter?: string;
  format?: string;
  noCache?: boolean;
  quiet?: boolean;
  tips?: boolean;
  token?: string;
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

export abstract class BaseCommand {
  protected token: string | undefined;
  protected requiresToken: boolean = true;
  private _client: BuildkiteClient | undefined;
  private _restClient: BuildkiteRestClient | undefined;
  private _restClientOptions: BuildkiteRestClientOptions | undefined;
  
  protected options: Partial<BaseCommandOptions>;
  protected initialized: boolean = false;
  protected static credentialManager = new CredentialManager();

  constructor(options?: Partial<BaseCommandOptions>) {
    this.options = options || {};
    this.token = this.options.token;
    
    if (this.options.debug) {
      // Include token length (not the actual token) for debugging auth issues
      // Debug mode is already handled here by logger.debug use
      logger.debug('BaseCommandHandler options:', {
        ...options,
        token: this.token ? `${this.token.substring(0, 4)}...${this.token.substring(this.token.length - 4)} (${this.token.length} chars)` : 'Not provided'
      });
    }
  }

  get client(): BuildkiteClient {
    if (this._client) {
      return this._client;
    } else {
      if (this.token) {
        this._client = new BuildkiteClient(this.token, this.options);
        return this._client;
      } else {
        throw new Error('No token provided');
      }
    }
  }

  get restClient(): BuildkiteRestClient {
    if (this._restClient) {
      return this._restClient;
    } else {
      if (this.token) {
        this._restClient = new BuildkiteRestClient(this.token, this.options);
        return this._restClient;
      } else {
        throw new Error('No token provided');
      }
    }
  }

  get restClientOptions(): BuildkiteRestClientOptions {
    if (this._restClientOptions) {
      return this._restClientOptions;
    } else {
      // Configure REST client with the same caching options
        const restClientOptions: BuildkiteRestClientOptions = {
          debug: this.options?.debug,
          caching: !this.options?.noCache,
        };
        
        // If a specific cache TTL is provided, apply it to REST client
        if (this.options?.cacheTTL) {
          restClientOptions.cacheTTLs = {
            default: this.options.cacheTTL,
            builds: this.options.cacheTTL,
          };
      }
      return restClientOptions;
    }
  }

  static get requiresToken(): boolean {
    return true;
  }
  
  protected async ensureInitialized(): Promise<void> {
    // No additional initialization needed
    return Promise.resolve();
  }

  protected handleError(error: any, debug: boolean = false): void {
    // Only log the error message and stack trace
    if (error instanceof Error) {
      logger.error(error, 'Error occurred');
      
      // If it's a GraphQL error or API error, show more details
      const apiError = error as ApiError;
      if (apiError.response?.errors) {
        apiError.response.errors.forEach((gqlError, index) => {
          logger.error({ path: gqlError.path }, `GraphQL Error ${index + 1}: ${gqlError.message}`);
        });
      }
      
      // Show request details if available and in debug mode
      if (debug && apiError.request) {
        logger.debug({ 
          url: apiError.request.url,
          method: apiError.request.method 
        }, 'Request Details');
      }
    } else if (typeof error === 'object') {
      logger.error({ error }, 'Unknown error occurred');
    } else {
      logger.error({ error }, 'Unknown error occurred');
    }
    
    if (debug) {
      logger.debug({ 
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: `${process.platform} (${process.arch})`
      }, 'Debug Information');
    }
  }

  // Static helper to get token from options, keyring, or environment
  static async getToken(options: any): Promise<string | undefined> {
    // First check if token is provided directly in options
    if (options.token) {
      return options.token;
    }
    
    // Prefer environment variables first under Alfred or if explicitly provided
    const envToken = process.env.BUILDKITE_API_TOKEN || process.env.BK_TOKEN;
    if (envToken) {
      return envToken;
    }
    
    // Next try to get token from keyring (outside Alfred this will lazy-load)
    try {
      const storedToken = await this.credentialManager.getToken();
      if (storedToken) {
        logger.debug('Using token from system keychain');
        return storedToken;
      }
    } catch (error) {
      logger.debug('Error retrieving token from keychain', error);
    }
    
    if (options.requiresToken) {
      throw new Error('API token required. Set via --token, BUILDKITE_API_TOKEN/BK_TOKEN env vars, or store it using --save-token.');
    } else {
      return
    }
  }

  /**
   * Get the appropriate formatter based on command-specific type and format option
   * @param type The formatter type ('pipeline', 'build', 'viewer')
   * @param options Command options that may include a format
   * @returns The appropriate formatter
   */
  protected getFormatter(type: FormatterType, options: BaseCommandOptions) {
    // Format precedence: command line option > constructor option > default
    const format = options.format || this.options.format || 'plain';
    if (options.debug) {
      logger.debug(`Using ${format} formatter for ${type}`);
    }
    return FormatterFactory.getFormatter(type, format);
  }

  /**
   * Execute the command with the given options
   * @param options Command options
   * @returns A promise that resolves to an exit code (0 for success, non-zero for errors)
   */
  abstract execute(options: BaseCommandOptions): Promise<number>;
}