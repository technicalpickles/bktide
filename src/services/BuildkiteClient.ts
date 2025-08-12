import { GraphQLClient } from 'graphql-request';
import { CacheManager } from './CacheManager.js';
// Import the queries - we'll use them for both string queries and typed SDK
import { 
  GET_VIEWER, 
  GET_ORGANIZATIONS, 
  GET_PIPELINES, 
  GET_BUILDS, 
  GET_VIEWER_BUILDS,
  GET_BUILD_ANNOTATIONS
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

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: number;
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
  private rateLimitInfo: RateLimitInfo | null = null;
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
      if (this.debug) {
        logger.debug('BuildkiteClient constructor - creating CacheManager');
      }
      this.cacheManager = new CacheManager(options?.cacheTTLs, this.debug);
      // Initialize cache and set token hash (async, but we don't wait)
      this.initCache();
    } else {
      if (this.debug) {
        logger.debug('BuildkiteClient constructor - caching disabled');
      }
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
              if (this.debug) {
        logger.debug('query() - cacheManager exists, checking cache');
      }
        const cachedResult = await this.cacheManager.get<T>(query, variables);
        
        if (cachedResult) {
          if (this.debug) {
            logger.debug(`✅ Served from cache: ${operationName}`);
          }
          return cachedResult;
        }
      }
      
      const response = await this.client.request<T>(query, variables);
      
      // Update rate limit info from headers
      const headers = (this.client as any).headers as Headers;
      this.rateLimitInfo = {
        remaining: parseInt(headers.get('RateLimit-Remaining') || '0'),
        limit: parseInt(headers.get('RateLimit-Limit') || '0'),
        reset: parseInt(headers.get('RateLimit-Reset') || '0'),
      };

      if (this.debug) {
        logger.debug('Rate limit info:', this.rateLimitInfo);
      }

      // Store result in cache if caching is enabled
      if (this.cacheManager) {
        await this.cacheManager.set(query, response, variables);
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        logger.debug(`✅ GraphQL query completed: ${operationName} (${duration.toFixed(2)}ms)`);
      }
      
      return response;
    } catch (error: unknown) {
      const isAuthError = this.isAuthenticationError(error as any);
      if (isAuthError && this.debug) {
        logger.debug('Authentication error detected, not caching result');
      }
      
      if (this.debug) {
        logger.error('Error in GraphQL query:', error);
        

        
        // Log raw error information
        logger.debug('Raw error object:', { 
          error, 
          type: typeof error, 
          constructor: error?.constructor?.name,
          keys: error && typeof error === 'object' ? Object.keys(error) : undefined
        });
        
        // Log more detailed error information
        if (error instanceof Error && 'response' in error) {
          const response = (error as any).response;
          logger.debug('GraphQL error details:', {
            status: response?.status,
            statusText: response?.statusText,
            errors: response?.errors,
            data: response?.data,
            headers: response?.headers ? Object.fromEntries(response.headers.entries()) : undefined
          });
        }
        
        // Also log the error message and stack trace
        if (error instanceof Error) {
          logger.debug('Error message:', { message: error.message });
          logger.debug('Error stack:', { stack: error.stack });
          logger.debug('Error constructor:', { constructor: error.constructor.name });
        } else {
          logger.debug('Non-Error object:', { error, type: typeof error });
        }
      }
      throw error;
    }
  }

  /**
   * Check if an error is an authentication error
   */
  private isAuthenticationError(error: any): boolean {
    // Check for common authentication error patterns
    if (error.response?.errors) {
      const errors = error.response.errors;
      return errors.some((err: any) => 
        err.message?.includes('unauthorized') || 
        err.message?.includes('authentication') || 
        err.message?.includes('permission') ||
        err.message?.includes('invalid token')
      );
    }
    
    // Check for HTTP status codes that indicate auth issues
    if (error.response?.status) {
      const status = error.response.status;
      return status === 401 || status === 403;
    }
    
    // Check error message directly
    if (error.message) {
      return error.message.includes('unauthorized') || 
             error.message.includes('authentication') || 
             error.message.includes('permission') ||
             error.message.includes('invalid token');
    }
    
    return false;
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
      
      // Get the organizations using our query
      if (this.debug) {
        logger.debug('About to call this.query with GET_ORGANIZATIONS');
      }
      const data = await this.query<GetOrganizationsQuery>(GET_ORGANIZATIONS.toString());
      if (this.debug) {
        logger.debug('Successfully got data from this.query');
      }
      
      if (this.debug) {
        logger.debug('Raw GraphQL response for organizations:', {
          hasData: !!data,
          hasViewer: !!data?.viewer,
          hasOrganizations: !!data?.viewer?.organizations,
          hasEdges: !!data?.viewer?.organizations?.edges,
          edgesLength: data?.viewer?.organizations?.edges?.length || 0
        });
      }
      
      // Use our helper method to process the response
      const organizations = this.processOrganizationsResponse(data);
      
      if (this.debug) {
        logger.debug('Processed organizations:', {
          count: organizations.length,
          organizations: organizations.map(org => ({ id: org.id, name: org.name, slug: org.slug }))
        });
      }
      
      if (organizations.length === 0) {
        if (this.debug) {
          logger.debug('No organizations found in response', { data });
        }
        return []
      }
      
      // Map to just the slugs
      const slugs = organizations.map(org => org.slug);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      if (this.debug) {
        logger.debug(`✅ Found ${slugs.length} organizations (${duration.toFixed(2)}ms)`);
      }
      
      return slugs;
    } catch (error) {
      if (this.debug) {
        logger.debug('GraphQL query failed', {
          error: error instanceof Error ? error.message : String(error),
          details: error instanceof Error ? error : undefined
        });
        
        // Log more detailed error information
        if (error instanceof Error && 'response' in error) {
          const response = (error as any).response;
          logger.debug('GraphQL error response:', {
            status: response?.status,
            statusText: response?.statusText,
            errors: response?.errors,
            data: response?.data
          });
        }
        
        // Log detailed error information
        logger.debug('Error in getViewerOrganizationSlugs:', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorType: error?.constructor?.name,
          hasResponse: error instanceof Error && 'response' in error,
          response: error instanceof Error && 'response' in error ? (error as any).response : undefined
        });
      }
      throw new Error('Failed to determine your organizations', { cause: error });
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
   * Get organizations for the current viewer
   * @returns An array of organization objects with id, name, and slug
   */
  public async getOrganizations(): Promise<Array<{ id: string; name: string; slug: string; }>> {
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
        return this.processOrganizationsResponse(cachedResult);
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

    return this.processOrganizationsResponse(result);
  }

  /**
   * Process the raw GraphQL organizations response into a clean array
   * @param data The raw GraphQL response
   * @returns A processed array of organization objects
   * @private
   */
  private processOrganizationsResponse(data: GetOrganizationsQuery): Array<{ id: string; name: string; slug: string; }> {
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

  /**
   * Get the current rate limit information
   * @returns Current rate limit information or null if not available
   */
  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * Get annotations for a build with type safety
   * @param buildSlug The build slug (e.g., "org/pipeline/number")
   * @returns The build annotations data
   */
  public async getBuildAnnotations(buildSlug: string): Promise<any> {
    const variables = {
      buildSlug,
    };

    if (this.debug) {
      logger.debug(`🕒 Starting GraphQL query: GetBuildAnnotations for ${buildSlug}`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<any>(GET_BUILD_ANNOTATIONS.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          logger.debug(`✅ Served from cache: GetBuildAnnotations`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.client.request<any>(GET_BUILD_ANNOTATIONS.toString(), variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_BUILD_ANNOTATIONS.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`✅ GraphQL query completed: GetBuildAnnotations (${duration.toFixed(2)}ms)`);
    }

    return result;
  }
}