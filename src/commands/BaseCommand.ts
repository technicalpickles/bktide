import { BuildkiteClient } from '../services/BuildkiteClient.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { timeIt } from '../services/logger.js';
import { logger } from '../services/logger.js';

export interface BaseCommandOptions {
  cacheTTL?: number;
  clearCache?: boolean;
  debug?: boolean;
  filter?: string;
  format?: string;
  noCache?: boolean;
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
  protected token: string;
  protected client: BuildkiteClient;
  protected options: Partial<BaseCommandOptions>;
  protected initialized: boolean = false;

  constructor(token: string, options?: Partial<BaseCommandOptions>) {
    this.token = token;
    this.options = options || {};
    if (options?.debug) {
      // Include token length (not the actual token) for debugging auth issues
      // Debug mode is already handled here by logger.debug use
      logger.debug('BaseCommandHandler options:', {
        ...options,
        token: token ? `${token.substring(0, 4)}...${token.substring(token.length - 4)} (${token.length} chars)` : 'Not provided'
      });
    }
    this.client = new BuildkiteClient(token, options);
    this.initialized = true; // Client is initialized in constructor
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

  // Static helper to get token from options or environment
  static getToken(options: any): string {
    const token = options.token || process.env.BK_TOKEN;
    if (!token) {
      throw new Error('API token required. Set via --token or BK_TOKEN environment variable.');
    }
    return token;
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