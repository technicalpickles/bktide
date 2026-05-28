import fetch from 'node-fetch';
import { mkdir as mkdirFs, writeFile as writeFileFs } from 'fs/promises';
import { dirname } from 'path';
import { CacheManager } from './CacheManager.js';
import { createHash } from 'crypto';
import { logger } from './logger.js';
import { getProgressIcon } from '../ui/theme.js';
import { JobLog, BuildkiteArtifact, AccessTokenInfo } from '../types/buildkite.js';

export interface CreateBuildPayload {
  commit: string;
  branch: string;
  message?: string;
  env?: Record<string, string>;
}

export interface BuildkiteBuildResponse {
  number: number;
  state: string;
  web_url: string;
  pipeline: { slug: string };
}

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
      this.initCache().catch((err) => {
        logger.debug('Cache initialization failed, continuing without cache:', err);
        this.cacheManager = null;
      });
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
   * Send a request to the Buildkite REST API. Used by write methods.
   * Skips cache entirely. Updates rate-limit info on success and surfaces
   * Buildkite's error payload verbatim on failure.
   */
  private async _request<T = any>(
    method: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = process.hrtime.bigint();

    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Starting REST API request: ${method} ${endpoint}`);
      logger.debug(`${getProgressIcon('STARTING')} Request URL: ${url}`);
      if (body !== undefined) {
        logger.debug(`${getProgressIcon('STARTING')} Request body: ${JSON.stringify(body)}`);
      }
    }

    const init: any = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    // Rate limit headers are present on writes too
    this.rateLimitInfo = {
      remaining: parseInt(response.headers.get('RateLimit-Remaining') || '0'),
      limit: parseInt(response.headers.get('RateLimit-Limit') || '0'),
      reset: parseInt(response.headers.get('RateLimit-Reset') || '0'),
    };

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed with status ${response.status}: ${errorText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `API request failed: ${errorJson.message}`;
        }
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          errorMessage += `\nErrors: ${errorJson.errors.map((e: any) => e.message).join(', ')}`;
        }
      } catch {
        // body is not JSON, leave errorMessage as-is
      }

      const isAuthError = this.isAuthenticationError(response.status, errorMessage);
      if (isAuthError && this.debug) {
        logger.debug('Authentication error detected on write request');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json() as T;

    if (this.debug) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      logger.debug(`${getProgressIcon('SUCCESS_LOG')} REST API request completed: ${method} ${endpoint} (${duration.toFixed(2)}ms)`);
    }

    return data;
  }

  /**
   * POST to the Buildkite REST API. Caching is bypassed; writes always hit the network.
   */
  public async post<T = any>(endpoint: string, body: unknown): Promise<T> {
    return this._request<T>('POST', endpoint, body);
  }

  /**
   * PUT to the Buildkite REST API. Body is optional (e.g. rebuild has no body).
   */
  public async put<T = any>(endpoint: string, body?: unknown): Promise<T> {
    return this._request<T>('PUT', endpoint, body);
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
   * Fetch the current token's UUID and scope list.
   * Uses /v2/access-token, which any valid Buildkite API token can call.
   */
  public async getAccessToken(): Promise<AccessTokenInfo> {
    return this.get<AccessTokenInfo>('/access-token');
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

  /**
   * Create a new build in the given pipeline.
   * Hits POST /v2/organizations/{org}/pipelines/{pipeline}/builds.
   */
  public async createBuild(
    org: string,
    pipeline: string,
    payload: CreateBuildPayload,
  ): Promise<BuildkiteBuildResponse> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds`;
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Creating build in ${org}/${pipeline}`);
    }
    return this.post<BuildkiteBuildResponse>(endpoint, payload);
  }

  /**
   * Rebuild an existing build with the same parameters. Returns the new build.
   */
  public async rebuildBuild(
    org: string,
    pipeline: string,
    buildNumber: number,
  ): Promise<BuildkiteBuildResponse> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/rebuild`;
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Rebuilding ${org}/${pipeline}/${buildNumber}`);
    }
    return this.put<BuildkiteBuildResponse>(endpoint);
  }

  /**
   * Get builds for a specific pipeline
   * @param org Organization slug
   * @param pipeline Pipeline slug
   * @param params Query parameters
   * @returns List of builds for the pipeline
   */
  public async getPipelineBuilds(
    org: string,
    pipeline: string,
    params?: {
      branch?: string;
      state?: string;
      per_page?: string;
      page?: string;
    }
  ): Promise<any[]> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds`;
    const startTime = process.hrtime.bigint();
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Fetching builds for pipeline: ${org}/${pipeline}`);
    }
    
    const builds = await this.get<any[]>(endpoint, params as Record<string, string>);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    if (this.debug) {
      logger.debug(`${getProgressIcon('SUCCESS_LOG')} Retrieved ${builds.length} builds for ${org}/${pipeline} (${duration.toFixed(2)}ms)`);
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
  ): Promise<JobLog> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/jobs/${jobId}/log`;
    const startTime = process.hrtime.bigint();
    
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Fetching logs for job: ${jobId}`);
    }
    
    // Note: Use default cache type for log data
    const cacheKey = this.generateCacheKey(endpoint);
    
    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get<JobLog>(cacheKey, 'default' as any);
      if (cached) {
        if (this.debug) {
          logger.debug(`${getProgressIcon('SUCCESS_LOG')} Served logs from cache for job: ${jobId}`);
        }
        return cached;
      }
    }
    
    const log = await this.get<JobLog>(endpoint);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;
    if (this.debug) {
      logger.debug(`${getProgressIcon('SUCCESS_LOG')} Retrieved logs for job ${jobId} (${duration.toFixed(2)}ms)`);
    }
    
    return log;
  }

  /**
   * Get annotations for a build
   * @param org Organization slug
   * @param pipeline Pipeline slug
   * @param buildNumber Build number
   * @returns Array of annotations
   */
  public async getBuildAnnotations(
    org: string,
    pipeline: string,
    buildNumber: number
  ): Promise<any[]> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/annotations`;

    if (this.debug) {
      logger.debug(`Fetching annotations for ${org}/${pipeline}/${buildNumber}`);
    }

    return this.get<any[]>(endpoint);
  }

  /**
   * Get jobs for a specific build
   */
  public async getBuildJobs(
    org: string,
    pipeline: string,
    buildNumber: number
  ): Promise<any[]> {
    const build = await this.getBuild(org, pipeline, buildNumber);
    return build.jobs || [];
  }

  /**
   * Get a specific build with all its data including jobs
   * @param org Organization slug
   * @param pipeline Pipeline slug
   * @param buildNumber Build number
   * @returns Full build object including jobs array
   */
  public async getBuild(
    org: string,
    pipeline: string,
    buildNumber: number
  ): Promise<any> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}`;
    return this.get<any>(endpoint);
  }

  /**
   * List all artifacts for a build (build-scoped, includes artifacts from all jobs)
   */
  public async listBuildArtifacts(
    org: string,
    pipeline: string,
    buildNumber: number | string
  ): Promise<BuildkiteArtifact[]> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/artifacts`;
    if (this.debug) {
      logger.debug(`Fetching artifacts for ${org}/${pipeline}/${buildNumber}`);
    }
    return this.get<BuildkiteArtifact[]>(endpoint);
  }

  /**
   * Download an artifact to a local file path using the two-step presigned URL flow.
   * Calls artifact.download_url to get a presigned URL (via 302 + JSON body),
   * then fetches that URL and writes the binary to disk.
   */
  public async downloadArtifact(
    artifact: BuildkiteArtifact,
    destPath: string
  ): Promise<{ path: string; size: number }> {
    const apiRes = await fetch(artifact.download_url, {
      headers: { 'Authorization': `Bearer ${this.token}` },
      redirect: 'manual',
    });

    if (!apiRes.ok && apiRes.status !== 302) {
      const text = await apiRes.text().catch(() => '');
      throw new Error(`Failed to get artifact download URL (${apiRes.status})${text ? ': ' + text : ''}`);
    }

    let presignedUrl: string | null = null;
    try {
      const json = await apiRes.json() as { url?: string };
      presignedUrl = json.url ?? null;
    } catch {
      // JSON body absent or unparseable — fall through to Location header
    }
    if (!presignedUrl) {
      presignedUrl = apiRes.headers.get('location');
    }
    if (!presignedUrl) {
      throw new Error(`Could not determine download URL for artifact ${artifact.id}`);
    }

    const fileRes = await fetch(presignedUrl);
    if (!fileRes.ok) {
      throw new Error(`Artifact download failed (${fileRes.status}): presigned URL request failed`);
    }

    const buffer = await fileRes.arrayBuffer();
    await mkdirFs(dirname(destPath), { recursive: true });
    await writeFileFs(destPath, Buffer.from(buffer));

    return { path: destPath, size: buffer.byteLength };
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