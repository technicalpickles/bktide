import fetch from 'node-fetch';
import { CacheManager } from './CacheManager.js';
import { createHash } from 'crypto';
import { logger } from './logger.js';
import { getProgressIcon } from '../ui/theme.js';

export interface BuildkiteRestClientOptions {
  baseUrl?: string;
  caching?: boolean;
  cacheTTLs?: Partial<{
    builds: number;
    default: number;
  }>;
  debug?: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: number;
}

/**
 * BuildkiteRestClient provides methods to interact with the Buildkite REST API
 */
export class BuildkiteRestClient {
  private token: string;
  private baseUrl: string = 'https://api.buildkite.com/v2';
  private cacheManager: CacheManager | null = null;
  private debug: boolean = false;
  private rateLimitInfo: RateLimitInfo | null = null;

  /**
   * Create a new BuildkiteRestClient
   * @param token Your Buildkite API token
   * @param options Configuration options
   */
  constructor(token: string, options?: BuildkiteRestClientOptions) {
    this.token = token;
    this.debug = options?.debug || false;
    
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }
    
    // Initialize cache if caching is enabled
    if (options?.caching !== false) {
      this.cacheManager = new CacheManager(options?.cacheTTLs, this.debug);
      // Initialize cache and set token hash (async, but we don't wait)
      this.initCache();
    }
  }
  
  /**
   * Initialize cache asynchronously
   */
  private async initCache(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.init();
      await this.cacheManager.setTokenHash(this.token);
    }
  }
  
  /**
   * Generate a cache key for a REST endpoint
   */
  private generateCacheKey(endpoint: string, params?: Record<string, string>): string {
    const paramsString = params ? JSON.stringify(params) : '';
    return `REST:${endpoint}:${this.hashString(paramsString)}`;
  }
  
  /**
   * Hash a string using SHA256
   */
  private hashString(str: string): string {
    return createHash('sha256').update(str).digest('hex');
  }

  /**
   * Get cache type from endpoint
   */
  private getCacheTypeFromEndpoint(endpoint: string): string {
    if (endpoint.includes('/builds')) {
      return 'builds';
    }
    return 'default';
  }

  /**
   * Make a GET request to the Buildkite REST API
   * @param endpoint The API endpoint
   * @param params Query parameters
   * @returns The API response
   */
  private async get<T = any>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(endpoint, params);
    const cacheType = this.getCacheTypeFromEndpoint(endpoint);
    
    // Check cache first if enabled
    if (this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey, cacheType as any);
      if (cached) {
        if (this.debug) {
          logger.debug(`${getProgressIcon('SUCCESS_LOG')} Served from cache: REST ${endpoint}`);
        }
        return cached as T;
      }
    }

    const startTime = process.hrtime.bigint();
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Starting REST API request: GET ${endpoint}`);
      logger.debug(`${getProgressIcon('STARTING')} Request URL: ${url.toString()}`);
      if (params) {
        logger.debug(`${getProgressIcon('STARTING')} Request params: ${JSON.stringify(params)}`);
      }
    }
    
    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      // Update rate limit info from headers
      this.rateLimitInfo = {
        remaining: parseInt(response.headers.get('RateLimit-Remaining') || '0'),
        limit: parseInt(response.headers.get('RateLimit-Limit') || '0'),
        reset: parseInt(response.headers.get('RateLimit-Reset') || '0'),
      };

      if (this.debug) {
        logger.debug('Rate limit info:', this.rateLimitInfo);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API request failed with status ${response.status}: ${errorText}`;
        
        // Try to parse the error as JSON for more details
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = `API request failed: ${errorJson.message}`;
          }
          if (errorJson.errors && Array.isArray(errorJson.errors)) {
            errorMessage += `\nErrors: ${errorJson.errors.map((e: any) => e.message).join(', ')}`;
          }
        } catch (e) {
          // If parsing fails, use the original error text
        }
        
        // Check if this is an authentication error
        const isAuthError = this.isAuthenticationError(response.status, errorMessage);
        if (isAuthError && this.debug) {
          logger.debug('Authentication error detected, not caching result');
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json() as T;
      
      // Cache the response if caching is enabled
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, data, cacheType as any);
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        logger.debug(`${getProgressIcon('SUCCESS_LOG')} REST API request completed: GET ${endpoint} (${duration.toFixed(2)}ms)`);
      }
      
      return data;
    } catch (error: unknown) {
      if (this.debug) {
        logger.error('Error in get request:', error);
      }
      throw error;
    }
  }

  /**
   * Check if an error is an authentication error
   */
  private isAuthenticationError(status: number, message: string): boolean {
    // Check for HTTP status codes that indicate auth issues
    if (status === 401 || status === 403) {
      return true;
    }
    
    // Check error message for auth-related keywords
    const lowerMessage = message.toLowerCase();
    return lowerMessage.includes('unauthorized') || 
           lowerMessage.includes('authentication') || 
           lowerMessage.includes('permission') ||
           lowerMessage.includes('invalid token');
  }

  /**
   * Get the current rate limit information
   * @returns Current rate limit information or null if not available
   */
  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * Get builds from an organization filtered by specific parameters
   * @param org Organization slug
   * @param params Query parameters
   * @returns List of builds
   */
  public async getBuilds(org: string, params?: {
    creator?: string; // Creator's user ID, email or API access token
    pipeline?: string;
    branch?: string;
    commit?: string;
    state?: string;
    per_page?: string;
    page?: string;
  }): Promise<any[]> {
    const endpoint = `/organizations/${org}/builds`;
    const startTime = process.hrtime.bigint();
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Fetching builds for organization: ${org}`);
    }
    
    const builds = await this.get<any[]>(endpoint, params as Record<string, string>);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`${getProgressIcon('SUCCESS_LOG')} Retrieved ${builds.length} builds for ${org} (${duration.toFixed(2)}ms)`);
    }
    
    return builds;
  }



  public async hasBuildAccess(org: string): Promise<boolean> {
    try {
      await this.getBuilds(org, { per_page: '1' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Check if the current user has access to an organization
   * @param org Organization slug
   * @returns True if the user has access, false otherwise
   */
  public async hasOrganizationAccess(org: string): Promise<boolean> {
    try {
      const endpoint = `/organizations/${org}`;
      await this.get(endpoint);
      return true;
    } catch (error) {
      if (this.debug) {
        logger.debug(`User does not have access to organization: ${org}`);
      }
      return false;
    }
  }
  
  /**
   * Get logs for a specific job
   * @param org Organization slug
   * @param pipeline Pipeline slug
   * @param buildNumber Build number
   * @param jobId Job ID (UUID)
   * @returns Job log data
   */
  public async getJobLog(
    org: string,
    pipeline: string,
    buildNumber: number,
    jobId: string
  ): Promise<any> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/jobs/${jobId}/log`;
    const startTime = process.hrtime.bigint();
    
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Fetching logs for job: ${jobId}`);
    }
    
    // Note: Use default cache type for log data
    const cacheKey = this.generateCacheKey(endpoint);
    
    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey, 'default' as any);
      if (cached) {
        if (this.debug) {
          logger.debug(`${getProgressIcon('SUCCESS_LOG')} Served logs from cache for job: ${jobId}`);
        }
        return cached;
      }
    }
    
    const log = await this.get<any>(endpoint);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    if (this.debug) {
      logger.debug(`${getProgressIcon('SUCCESS_LOG')} Retrieved logs for job ${jobId} (${duration.toFixed(2)}ms)`);
    }
    
    return log;
  }

  /**
   * Clear all cache entries
   */
  public async clearCache(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.clear();
    }
  }

  /**
   * Invalidate a specific cache type
   */
  public async invalidateCache(type: string): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.invalidateType(type);
    }
  }
} 