import { GraphQLClient } from 'graphql-request';
import { CacheManager } from './CacheManager.js';
import { BuildkiteClientOptions } from './BuildkiteClient.js';
import { 
  GET_VIEWER, 
  GET_ORGANIZATIONS, 
  GET_PIPELINES, 
  GET_BUILDS, 
  GET_VIEWER_BUILDS 
} from '../graphql/queries.js';
// These imports will be available after running GraphQL codegen
import { 
  GetViewerQuery, 
  GetOrganizationsQuery, 
  GetPipelinesQuery,
  GetPipelinesQueryVariables,
  GetBuildsQuery,
  GetBuildsQueryVariables,
  GetViewerBuildsQuery,
  GetViewerBuildsQueryVariables,
  getSdk
} from '../graphql/generated/index.js';

/**
 * EnhancedBuildkiteClient provides strongly-typed methods to interact with the Buildkite GraphQL API
 */
export class EnhancedBuildkiteClient {
  private client: GraphQLClient;
  private typedSdk: ReturnType<typeof getSdk>;
  private token: string;
  private baseUrl: string = 'https://graphql.buildkite.com/v1';
  private cacheManager: CacheManager | null = null;
  private debug: boolean = false;

  /**
   * Create a new EnhancedBuildkiteClient
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

    // Initialize the typed SDK
    this.typedSdk = getSdk(this.client);

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
   * Get the current viewer information
   * @returns The viewer data
   */
  public async getViewer(): Promise<GetViewerQuery> {
    if (this.debug) {
      console.debug(`🕒 Starting GraphQL query: GetViewer`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetViewerQuery>(GET_VIEWER.toString(), {});
      if (cachedResult) {
        if (this.debug) {
          console.debug(`✅ Served from cache: GetViewer`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.typedSdk.GetViewer();

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_VIEWER.toString(), result, {});
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      console.debug(`✅ GraphQL query completed: GetViewer (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get the organizations for the current viewer
   * @returns The organizations data
   */
  public async getOrganizations(): Promise<GetOrganizationsQuery> {
    if (this.debug) {
      console.debug(`🕒 Starting GraphQL query: GetOrganizations`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetOrganizationsQuery>(GET_ORGANIZATIONS.toString(), {});
      if (cachedResult) {
        if (this.debug) {
          console.debug(`✅ Served from cache: GetOrganizations`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.typedSdk.GetOrganizations();

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_ORGANIZATIONS.toString(), result, {});
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      console.debug(`✅ GraphQL query completed: GetOrganizations (${duration.toFixed(2)}ms)`);
    }

    return result;
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
      
      const data = await this.getOrganizations();
      
      if (!data?.viewer?.organizations?.edges) {
        throw new Error('Failed to fetch organizations from the API');
      }
      
      const orgs = data.viewer.organizations.edges.map((edge) => edge.node.slug);
      
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
   * Get pipelines for an organization
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
      console.debug(`🕒 Starting GraphQL query: GetPipelines for ${organizationSlug}`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetPipelinesQuery>(GET_PIPELINES.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          console.debug(`✅ Served from cache: GetPipelines`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.typedSdk.GetPipelines(variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_PIPELINES.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      console.debug(`✅ GraphQL query completed: GetPipelines (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get builds for a pipeline
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
      console.debug(`🕒 Starting GraphQL query: GetBuilds for ${pipelineSlug} in ${organizationSlug}`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetBuildsQuery>(GET_BUILDS.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          console.debug(`✅ Served from cache: GetBuilds`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.typedSdk.GetBuilds(variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_BUILDS.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      console.debug(`✅ GraphQL query completed: GetBuilds (${duration.toFixed(2)}ms)`);
    }

    return result;
  }

  /**
   * Get builds for the current viewer
   * @param first Number of builds to retrieve
   * @returns The viewer builds data
   */
  public async getViewerBuilds(first: number): Promise<GetViewerBuildsQuery> {
    const variables: GetViewerBuildsQueryVariables = {
      first,
    };

    if (this.debug) {
      console.debug(`🕒 Starting GraphQL query: GetViewerBuilds`);
    }

    // Check if result is in cache
    if (this.cacheManager) {
      const cachedResult = await this.cacheManager.get<GetViewerBuildsQuery>(GET_VIEWER_BUILDS.toString(), variables);
      if (cachedResult) {
        if (this.debug) {
          console.debug(`✅ Served from cache: GetViewerBuilds`);
        }
        return cachedResult;
      }
    }

    const startTime = process.hrtime.bigint();
    const result = await this.typedSdk.GetViewerBuilds(variables);

    // Store result in cache if caching is enabled
    if (this.cacheManager) {
      await this.cacheManager.set(GET_VIEWER_BUILDS.toString(), result, variables);
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      console.debug(`✅ GraphQL query completed: GetViewerBuilds (${duration.toFixed(2)}ms)`);
    }

    return result;
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