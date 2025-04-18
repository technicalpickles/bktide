import storage from 'node-persist';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';

/**
 * CacheManager for handling persistent caching with node-persist
 */
export class CacheManager {
  private initialized = false;
  private tokenHash: string = '';
  
  // Default TTLs in milliseconds
  private static DEFAULT_TTLs = {
    viewer: 3600 * 1000, // 1 hour for viewer data
    organizations: 3600 * 1000, // 1 hour for organization data
    pipelines: 60 * 1000, // 1 minute for pipelines
    builds: 30 * 1000, // 30 seconds for builds
    default: 30 * 1000, // default 30 seconds
  };

  constructor(private ttls: Partial<typeof CacheManager.DEFAULT_TTLs> = {}) {
    // Merge provided TTLs with defaults
    this.ttls = { ...CacheManager.DEFAULT_TTLs, ...ttls };
  }

  /**
   * Initialize the storage
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    
    const storageDir = path.join(os.homedir(), '.alfred-buildkite', 'cache');
    
    await storage.init({
      dir: storageDir,
      stringify: JSON.stringify,
      parse: JSON.parse,
      encoding: 'utf8',
      logging: false,
      ttl: this.ttls.default // Default TTL
    });
    
    this.initialized = true;
  }

  /**
   * Set the token hash to invalidate caches when token changes
   */
  public async setTokenHash(token: string): Promise<void> {
    await this.init();
    const hash = this.hashString(token);
    
    if (this.tokenHash !== hash) {
      // Get current stored token hash
      const storedHash = await storage.getItem('token_hash');
      
      // If token changed, clear viewer-related caches
      if (storedHash !== hash) {
        await this.invalidateType('viewer');
        await storage.setItem('token_hash', hash);
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
      const entry = await storage.getItem(key);
      
      if (!entry) return null;
      
      // Check if manually expired
      if (Date.now() > entry.expiresAt) {
        await storage.removeItem(key);
        return null;
      }
      
      return entry.value as T;
    } catch (error) {
      console.debug(`Cache miss or error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param query The GraphQL query or REST cache key
   * @param value The value to cache
   * @param variables Variables for GraphQL query or cache type for REST
   */
  public async set<T>(
    query: string, 
    value: T, 
    variables?: Record<string, any> | keyof typeof CacheManager.DEFAULT_TTLs
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
    
    const ttl = this.ttls[cacheType as keyof typeof CacheManager.DEFAULT_TTLs] || CacheManager.DEFAULT_TTLs.default;
    
    await storage.setItem(key, {
      value,
      expiresAt: Date.now() + ttl,
      type: cacheType,
      createdAt: Date.now()
    });
  }

  /**
   * Invalidate all cache entries of a specific type
   */
  public async invalidateType(type: string): Promise<void> {
    await this.init();
    const keys = await storage.keys();
    
    for (const key of keys) {
      try {
        const entry = await storage.getItem(key);
        if (entry && entry.type === type) {
          await storage.removeItem(key);
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
    await storage.clear();
  }
} 