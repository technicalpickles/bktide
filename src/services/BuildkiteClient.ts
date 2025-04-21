import { GraphQLClient } from 'graphql-request';
import { CacheManager } from './CacheManager.js';
import { ViewerOrganizationsData, GraphQLEdge, Organization } from '../types/index.js';
// Import the queries - we'll use them for both string queries and typed SDK
import { 
  GET_VIEWER, 
  GET_ORGANIZATIONS, 
  GET_PIPELINES, 
  GET_BUILDS, 
  GET_VIEWER_BUILDS 
} from '../graphql/queries.js';
// Import generated types
import { 
  GetViewerQuery, 
  GetOrganizationsQuery, 
  GetPipelinesQuery, 
  GetPipelinesQueryVariables,
  GetBuildsQuery,
  GetBuildsQueryVariables,
  GetViewerBuildsQuery,
  GetViewerBuildsQueryVariables,
} from '../graphql/generated/sdk.js';
import { logger } from './logger.js';

// Note: We're now using the automatically generated types from GraphQL Codegen

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
    
    if (this.debug) {
      logger.debug('Initializing BuildkiteClient with options:', {
        baseUrl: options?.baseUrl || this.baseUrl,
        caching: options?.caching !== false,
        debug: this.debug,
        tokenLength: token ? token.length : 0
      });
    }
    
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
  public async query<T = unknown, V extends Record<string, any> = Record<string, any>>(
    query: string,
    variables?: V
  ): Promise<T> {
    try {
      const startTime = process.hrtime.bigint();
      const operationName = query.match(/query\s+(\w+)?/)?.[1] || 'UnnamedQuery';
      if (this.debug) {
        logger.debug(`🕒 Starting GraphQL query: ${operationName}`);
      }
      
      // Check if result is in cache
      if (this.cacheManager) {
        const cachedResult = await this.cacheManager.get<T>(query, variables);
        
        if (cachedResult) {
          if (this.debug) {
            logger.debug(`✅ Served from cache: ${operationName}`);
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
        logger.debug(`✅ GraphQL query completed: ${operationName} (${duration.toFixed(2)}ms)`);
      }
      
      return result;
    } catch (error) {
      logger.error('GraphQL query error:', error);
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation
   * @param mutation The GraphQL mutation
   * @param variables Variables for the mutation
   * @returns The mutation response
   */
  public async mutate<T = unknown, V extends Record<string, any> = Record<string, any>>(
    mutation: string,
    variables?: V
  ): Promise<T> {
    try {
      const startTime = process.hrtime.bigint();
      const operationName = mutation.match(/mutation\s+(\w+)?/)?.[1] || 'UnnamedMutation';
      if (this.debug) {
        logger.debug(`🕒 Starting GraphQL mutation: ${operationName}`);
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
      logger.debug(`✅ GraphQL mutation completed: ${operationName} (${duration.toFixed(2)}ms)`);
      
      return result;
    } catch (error) {
      logger.error('GraphQL mutation error:', error);
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
        logger.debug(`🕒 Starting GraphQL query: getViewerOrganizationSlugs`);
      }
      
      const data = await this.query<ViewerOrganizationsData>(GET_ORGANIZATIONS.toString());
      
      if (!data?.viewer?.organizations?.edges) {
        throw new Error('Failed to fetch organizations from the API');
      }
      
      const orgs = data.viewer.organizations.edges.map((edge: GraphQLEdge<Organization>) => edge.node.slug);
      
      if (orgs.length === 0) {
        throw new Error('No organizations found for the current user');
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        logger.debug(`✅ Found ${orgs.length} organizations (${duration.toFixed(2)}ms)`);
      }
      
      return orgs;
    } catch (error) {
      logger.error('Error fetching viewer organizations:', error);
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

  /**
   * Get the current viewer information with type safety
   * @returns The viewer data
   */
  public async getViewer(): Promise<GetViewerQuery> {
    if (this.debug) {
      logger.debug(`🕒 Starting GraphQL query: GetViewer`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetViewerQuery>(GET_VIEWER.toString(), {});
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: GetViewer`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.client.request<GetViewerQuery>(GET_VIEWER.toString());

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_VIEWER.toString(), result, {});
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ GraphQL query completed: GetViewer (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get organizations for the current viewer with type safety
   * @returns The organizations data
   */
  public async getOrganizations(): Promise<GetOrganizationsQuery> {
    if (this.debug) {
      logger.debug(`🕒 Starting GraphQL query: GetOrganizations`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetOrganizationsQuery>(GET_ORGANIZATIONS.toString(), {});
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: GetOrganizations`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.client.request<GetOrganizationsQuery>(GET_ORGANIZATIONS.toString());

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_ORGANIZATIONS.toString(), result, {});
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ GraphQL query completed: GetOrganizations (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get a processed array of organizations for the current viewer with null values filtered out
   * @returns An array of non-null Organization objects
   */
  public async getOrganizationsArray(): Promise<Array<{ id: string; name: string; slug: string; }>> {
    const data = await this.getOrganizations();
    
    if (!data?.viewer?.organizations?.edges) {
      return [];
    }
    
    const edges = data.viewer.organizations.edges;
    
    // Filter out null edges and map to non-null nodes
    const organizations = edges
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null)
      .map(edge => edge.node)
      .filter((node): node is NonNullable<typeof node> => node !== null);
      
    return organizations;
  }

  /**
   * Get pipelines for an organization with type safety
   * @param organizationSlug The organization slug
   * @param first Number of pipelines to retrieve
   * @param after Cursor for pagination
   * @returns The pipelines data
   */
  public async getPipelines(
    organizationSlug: string, 
    first?: number, 
    after?: string
  ): Promise<GetPipelinesQuery> {
    const variables: GetPipelinesQueryVariables = {
      organizationSlug,
      first,
      after,
    };

    if (this.debug) {
      logger.debug(`🕒 Starting GraphQL query: GetPipelines for ${organizationSlug}`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetPipelinesQuery>(GET_PIPELINES.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: GetPipelines`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.client.request<GetPipelinesQuery>(GET_PIPELINES.toString(), variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_PIPELINES.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ GraphQL query completed: GetPipelines (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get builds for a pipeline with type safety
   * @param pipelineSlug The pipeline slug
   * @param organizationSlug The organization slug
   * @param first Number of builds to retrieve
   * @returns The builds data
   */
  public async getBuilds(
    pipelineSlug: string,
    organizationSlug: string,
    first?: number
  ): Promise<GetBuildsQuery> {
    const variables: GetBuildsQueryVariables = {
      pipelineSlug,
      organizationSlug,
      first,
    };

    if (this.debug) {
      logger.debug(`🕒 Starting GraphQL query: GetBuilds for ${pipelineSlug} in ${organizationSlug}`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetBuildsQuery>(GET_BUILDS.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: GetBuilds`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.client.request<GetBuildsQuery>(GET_BUILDS.toString(), variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_BUILDS.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ GraphQL query completed: GetBuilds (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get builds for the current viewer with type safety
   * @param first Number of builds to retrieve
   * @returns The viewer builds data
   */
  public async getViewerBuilds(first: number): Promise<GetViewerBuildsQuery> {
    const variables: GetViewerBuildsQueryVariables = {
      first,
    };

    if (this.debug) {
      logger.debug(`🕒 Starting GraphQL query: GetViewerBuilds`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetViewerBuildsQuery>(GET_VIEWER_BUILDS.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: GetViewerBuilds`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.client.request<GetViewerBuildsQuery>(GET_VIEWER_BUILDS.toString(), variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_VIEWER_BUILDS.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ GraphQL query completed: GetViewerBuilds (${duration.toFixed(2)}ms)`);
    }

    return result;
  }
} 