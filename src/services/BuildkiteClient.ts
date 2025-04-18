import { GraphQLClient } from 'graphql-request';
import { CacheManager } from './CacheManager.js';

export interface BuildkiteClientOptions {
  debug?: boolean;
  baseUrl?: string;
  caching?: boolean;
  cacheTTLs?: Partial<{
    viewer: number;
    organizations: number;
    pipelines: number;
    builds: number;
    default: number;
  }>;
}

/**
 * BuildkiteClient provides methods to interact with the Buildkite GraphQL API
 */
export class BuildkiteClient {
  private client: GraphQLClient;
  private token: string;
  private baseUrl: string = 'https://graphql.buildkite.com/v1';
  private cacheManager: CacheManager | null = null;
  private debug: boolean = false;
  /**
   * Create a new BuildkiteClient
   * @param token Your Buildkite API token
   * @param options Configuration options
   */
  constructor(token: string, options?: BuildkiteClientOptions, debug?: boolean) {
    this.token = token;
    this.debug = debug || options?.debug || false;
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }

    this.client = new GraphQLClient(this.baseUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

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
   * Execute a GraphQL query
   * @param query The GraphQL query
   * @param variables Variables for the query
   * @returns The query response
   */
  public async query<T = any, V extends Record<string, any> = Record<string, any>>(
    query: string,
    variables?: V
  ): Promise<T> {
    try {
      const startTime = process.hrtime.bigint();
      const operationName = query.match(/query\s+(\w+)?/)?.[1] || 'UnnamedQuery';
      if (this.debug) {
        console.debug(`🕒 Starting GraphQL query: ${operationName}`);
      }
      
      // Check if result is in cache
      if (this.cacheManager) {
        const cachedResult = await this.cacheManager.get<T>(query, variables);
        
        if (cachedResult) {
          if (this.debug) {
            console.debug(`✅ Served from cache: ${operationName}`);
          }
          return cachedResult;
        }
      }
      
      const result = await this.client.request<T>(query, variables);
      
      // Store result in cache if caching is enabled
      if (this.cacheManager) {
        await this.cacheManager.set(query, result, variables);
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        console.debug(`✅ GraphQL query completed: ${operationName} (${duration.toFixed(2)}ms)`);
      }
      
      return result;
    } catch (error) {
      console.error('GraphQL query error:', error);
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation
   * @param mutation The GraphQL mutation
   * @param variables Variables for the mutation
   * @returns The mutation response
   */
  public async mutate<T = any, V extends Record<string, any> = Record<string, any>>(
    mutation: string,
    variables?: V
  ): Promise<T> {
    try {
      const startTime = process.hrtime.bigint();
      const operationName = mutation.match(/mutation\s+(\w+)?/)?.[1] || 'UnnamedMutation';
      if (this.debug) {
        console.debug(`🕒 Starting GraphQL mutation: ${operationName}`);
      }
      
      const result = await this.client.request<T>(mutation, variables);
      
      // Invalidate relevant caches after mutations
      if (this.cacheManager) {
        // Determine what cache types to invalidate based on mutation name/content
        if (mutation.includes('Pipeline')) {
          await this.cacheManager.invalidateType('pipelines');
        } else if (mutation.includes('Build')) {
          await this.cacheManager.invalidateType('builds');
        }
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      console.debug(`✅ GraphQL mutation completed: ${operationName} (${duration.toFixed(2)}ms)`);
      
      return result;
    } catch (error) {
      console.error('GraphQL mutation error:', error);
      throw error;
    }
  }

  /**
   * Get the organization slugs for the current viewer
   * @returns An array of organization slugs the current user belongs to
   */
  public async getViewerOrganizationSlugs(): Promise<string[]> {
    try {
      const startTime = process.hrtime.bigint();
      if (this.debug) {
        console.debug(`🕒 Starting GraphQL query: getViewerOrganizationSlugs`);
      }
      
      const query = `
        query ViewerOrganizations {
          viewer {
            organizations(first: 100) {
              edges {
                node {
                  id
                  name
                  slug
                }
              }
            }
          }
        }
      `;

      const data = await this.query(query);
      
      if (!data?.viewer?.organizations?.edges) {
        throw new Error('Failed to fetch organizations from the API');
      }
      
      const orgs = data.viewer.organizations.edges.map((edge: any) => edge.node.slug);
      
      if (orgs.length === 0) {
        throw new Error('No organizations found for the current user');
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        console.debug(`✅ Found ${orgs.length} organizations (${duration.toFixed(2)}ms)`);
      }
      
      return orgs;
    } catch (error) {
      console.error('Error fetching viewer organizations:', error);
      throw new Error('Failed to determine your organizations');
    }
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