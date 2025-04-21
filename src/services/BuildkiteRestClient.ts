import fetch from 'node-fetch';
import { CacheManager } from './CacheManager.js';
import { createHash } from 'crypto';
import { logger } from './logger.js';

export interface BuildkiteRestClientOptions {
  baseUrl?: string;
  caching?: boolean;
  cacheTTLs?: Partial<{
    builds: number;
    default: number;
  }>;
  debug?: boolean;
}

/**
 * BuildkiteRestClient provides methods to interact with the Buildkite REST API
 */
export class BuildkiteRestClient {
  private token: string;
  private baseUrl: string = 'https://api.buildkite.com/v2';
  private cacheManager: CacheManager | null = null;
  private debug: boolean = false;

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
      this.cacheManager = new CacheManager(options?.cacheTTLs);
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

    // Check cache first
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<T>(cacheKey);
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: REST ${endpoint}`);
        }
        return cachedResult;
      }
    }

    try {
      const startTime = process.hrtime.bigint();
      if (this.debug) {
        logger.debug(`🕒 Starting REST API request: GET ${endpoint}`);
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json() as T;
      
      // Store in cache
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, result, cacheType as any);
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        logger.debug(`✅ REST API request completed: GET ${endpoint} (${duration.toFixed(2)}ms)`);
      }
      
      return result;
    } catch (error) {
      logger.error('REST API request error:', error);
      throw error;
    }
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
      logger.debug(`🕒 Fetching builds for organization: ${org}`);
    }
    
    const builds = await this.get<any[]>(endpoint, params as Record<string, string>);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ Retrieved ${builds.length} builds for ${org} (${duration.toFixed(2)}ms)`);
    }
    
    return builds;
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