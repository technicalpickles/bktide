import nodePersist from 'node-persist';
import { createHash } from 'crypto';
import { logger } from './logger.js';
import { XDGPaths } from '../utils/xdgPaths.js';

/**
 * CacheManager for handling persistent caching with node-persist
 */
export class CacheManager {
  private initialized = false;
  private tokenHash: string = '';
  private debug: boolean = false;
  
  // Default TTLs in milliseconds
  private static DEFAULT_TTLs = {
    viewer: 3600 * 1000, // 1 hour for viewer data
    organizations: 3600 * 1000, // 1 hour for organization data
    pipelines: 60 * 1000, // 1 minute for pipelines
    builds: 30 * 1000, // 30 seconds for builds
    default: 30 * 1000, // default 30 seconds
  };

  constructor(private ttls: Partial<typeof CacheManager.DEFAULT_TTLs> = {}, debug: boolean = false) {
    // Merge provided TTLs with defaults
    this.ttls = { ...CacheManager.DEFAULT_TTLs, ...ttls };
    this.debug = debug;
  }

  /**
   * Initialize the storage
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    
    if (this.debug) {
      logger.debug('CacheManager.init - starting initialization');
      logger.debug('CacheManager.init - nodePersist:', { type: typeof nodePersist });
    }
    
    const storageDir = XDGPaths.getAppCacheDir('bktide');
    
    if (this.debug) {
      logger.debug('CacheManager.init - storageDir:', { storageDir });
    }
    
    await nodePersist.init({
      dir: storageDir,
      stringify: JSON.stringify,
      parse: JSON.parse,
      encoding: 'utf8',
      logging: false,
      ttl: this.ttls.default // Default TTL
    });
    
    this.initialized = true;
    
    if (this.debug) {
      logger.debug('CacheManager.init - initialization complete');
    }
  }

  /**
   * Set the token hash to invalidate caches when token changes
   */
  public async setTokenHash(token: string): Promise<void> {
    await this.init();
    const hash = this.hashString(token);
    
    if (this.tokenHash !== hash) {
      // Get current stored token hash
      const storedHash = await nodePersist.getItem('token_hash');
      
      // If token changed, clear viewer-related caches
      if (storedHash !== hash) {
        await this.invalidateType('viewer');
        await nodePersist.setItem('token_hash', hash);
      }
      
      this.tokenHash = hash;
    }
  }

  /**
   * Generate a cache key for a GraphQL query
   */
  private generateCacheKey(query: string, variables?: Record<string, any>): string {
    // Extract operation name from query for better key readability
    const operationName = query.match(/query\s+(\w+)?/)?.[1] || 'UnnamedQuery';
    const varsString = variables ? JSON.stringify(variables) : '';
    return `${operationName}:${this.hashString(varsString)}`;
  }

  /**
   * Hash a string using SHA256
   */
  private hashString(str: string): string {
    return createHash('sha256').update(str).digest('hex');
  }

  /**
   * Get cache type from query string
   */
  private getCacheTypeFromQuery(query: string): string {
    if (query.includes('viewer') && !query.includes('builds')) {
      return 'viewer';
    } else if (query.includes('organizations')) {
      return 'organizations';
    } else if (query.includes('pipelines')) {
      return 'pipelines';
    } else if (query.includes('builds')) {
      return 'builds';
    }
    return 'default';
  }

  /**
   * Get a value from cache
   */
  public async get<T>(query: string, variables?: Record<string, any>): Promise<T | null> {
    await this.init();
    // Check if this is a direct key (used by REST client) or GraphQL query
    const key = query.startsWith('REST:') ? query : this.generateCacheKey(query, variables);
    
    try {
      // Add debug logging to see what's happening
      if (this.debug) {
        logger.debug('CacheManager.get - nodePersist:', { type: typeof nodePersist });
        logger.debug('CacheManager.get - key:', { key });
      }
      
      const entry = await nodePersist.getItem(key);
      
      if (!entry) return null;
      
      // Check if manually expired
      if (Date.now() > entry.expiresAt) {
        await nodePersist.removeItem(key);
        return null;
      }
      
      return entry.value as T;
    } catch (error) {
      if (this.debug) {
        logger.debug('CacheManager.get error:', { error });
      }
      logger.debug(`Cache miss or error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param query The GraphQL query or REST cache key
   * @param value The value to cache
   * @param variables Variables for GraphQL query or cache type for REST
   * @param skipCacheIfAuthError Whether to skip caching if this is an authentication error
   */
  public async set<T>(
    query: string, 
    value: T, 
    variables?: Record<string, any> | keyof typeof CacheManager.DEFAULT_TTLs,
    skipCacheIfAuthError: boolean = false
  ): Promise<void> {
    await this.init();
    
    let key: string;
    let cacheType: string;
    
    // Handle different usage patterns between GraphQL and REST clients
    if (query.startsWith('REST:')) {
      // REST client usage - variables is actually the cache type
      key = query;
      cacheType = (variables as string) || 'default';
    } else {
      // GraphQL client usage
      key = this.generateCacheKey(query, variables as Record<string, any>);
      cacheType = this.getCacheTypeFromQuery(query);
    }
    
    // Skip caching if this is an authentication error and skipCacheIfAuthError is true
    if (skipCacheIfAuthError && this.isAuthenticationError(value)) {
      if (this.debug) {
        logger.debug(`Skipping cache for authentication error: ${key}`);
      }
      return;
    }
    
    const ttl = this.ttls[cacheType as keyof typeof CacheManager.DEFAULT_TTLs] || CacheManager.DEFAULT_TTLs.default;
    
    await nodePersist.setItem(key, {
      value,
      expiresAt: Date.now() + ttl,
      type: cacheType,
      createdAt: Date.now()
    });
  }

  /**
   * Check if a result contains authentication error information
   */
  private isAuthenticationError(value: any): boolean {
    if (!value) return false;
    
    // Check for common authentication error patterns in GraphQL responses
    if (value.errors) {
      return value.errors.some((err: any) => 
        err.message?.includes('unauthorized') || 
        err.message?.includes('authentication') || 
        err.message?.includes('permission') ||
        err.message?.includes('invalid token')
      );
    }
    
    // Check for REST API error responses
    if (value.message) {
      const message = value.message.toLowerCase();
      return message.includes('unauthorized') || 
             message.includes('authentication') || 
             message.includes('permission') ||
             message.includes('invalid token');
    }
    
    return false;
  }

  /**
   * Invalidate all cache entries of a specific type
   */
  public async invalidateType(type: string): Promise<void> {
    await this.init();
    const keys = await nodePersist.keys();
    
    for (const key of keys) {
      try {
        const entry = await nodePersist.getItem(key);
        if (entry && entry.type === type) {
          await nodePersist.removeItem(key);
        }
      } catch (error) {
        // Continue to next item if there's an error
      }
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    await this.init();
    await nodePersist.clear();
  }
} 