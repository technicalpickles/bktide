import { BuildkiteClient } from '../services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { timeIt } from '../services/logger.js';
import { logger } from '../services/logger.js';
import { CredentialManager } from '../services/CredentialManager.js';

export interface BaseCommandOptions {
  cacheTTL?: number;
  clearCache?: boolean;
  debug?: boolean;
  filter?: string;
  format?: string;
  noCache?: boolean;
  token?: string;
  saveToken?: boolean;
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
    
    // If saveToken option is specified, save the token to the keyring
    if (options?.saveToken && this.token) {
      this.saveToken(this.token).catch(err => {
        logger.error('Failed to save token to keyring', err);
      });
    }

    // this.initialized = true; // Client is initialized in constructor
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


  static get requiresToken(): boolean {
    return true;
  }

  // Save the token to the keyring
  protected async saveToken(token: string): Promise<boolean> {
    return BaseCommand.credentialManager.saveToken(token);
  }

  protected async ensureInitialized(): Promise<void> {
    // No additional initialization needed
    return Promise.resolve();
  }

  protected handleError(error: any, debug: boolean = false): void {
    logger.error('🔥 Error Details:');
    
    if (error instanceof Error) {
      logger.error(`Message: ${error.message}`);
      
      // Always print the stack trace for proper debugging
      if (error.stack) {
        logger.error('Stack Trace:');
        logger.error(error.stack);
      }
      
      // If it's a GraphQL error or API error, show more details
      const apiError = error as ApiError;
      if (apiError.response?.errors) {
        logger.error('GraphQL Errors:');
        apiError.response.errors.forEach((gqlError, index) => {
          logger.error(`  Error ${index + 1}: ${gqlError.message}`);
          if (gqlError.path) logger.error(`  Path: ${gqlError.path.join('.')}`);
          if (gqlError.locations) logger.error(`  Locations: ${JSON.stringify(gqlError.locations)}`);
        });
      }
      
      // Show request details if available and in debug mode
      if (debug && apiError.request) {
        logger.error('Request Details:');
        logger.error(`  URL: ${apiError.request.url || 'N/A'}`);
        logger.error(`  Method: ${apiError.request.method || 'N/A'}`);
      }
    } else if (typeof error === 'object') {
      logger.error(JSON.stringify(error, null, 2));
    } else {
      logger.error('An unknown error occurred:', error);
    }
    
    if (debug) {
      logger.debug('\nDebug Information:');
      logger.debug(`⏰ Timestamp: ${new Date().toISOString()}`);
      logger.debug(`🔧 Node Version: ${process.version}`);
      logger.debug(`💻 Platform: ${process.platform} (${process.arch})`);
    }
  }

  // Static helper to get token from options, keyring, or environment
  static async getToken(options: any): Promise<string | undefined> {
    // First check if token is provided directly in options
    if (options.token) {
      if (options.saveToken) {
        await this.credentialManager.saveToken(options.token);
        logger.info('Token saved to system keychain');
      }
      return options.token;
    }
    
    // Next try to get token from keyring
    try {
      const storedToken = await this.credentialManager.getToken();
      if (storedToken) {
        logger.debug('Using token from system keychain');
        return storedToken;
      }
    } catch (error) {
      logger.debug('Error retrieving token from keychain', error);
    }
    
    // Finally fall back to environment variable
    const envToken = process.env.BK_TOKEN;
    if (envToken) {
      if (options.saveToken) {
        await this.credentialManager.saveToken(envToken);
        logger.info('Environment token saved to system keychain');
      }
      return envToken;
    }
    
    if (options.requiresToken) {
      throw new Error('API token required. Set via --token, BK_TOKEN environment variable, or store it using --save-token.');
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
}

export async function executeWithTiming<T>(
  commandName: string, 
  fn: () => Promise<T>
): Promise<T> {
  return await timeIt(`Command ${commandName}`, fn, 'info');
} 