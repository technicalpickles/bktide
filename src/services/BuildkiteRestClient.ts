import fetch from 'node-fetch';

/**
 * BuildkiteRestClient provides methods to interact with the Buildkite REST API
 */
export class BuildkiteRestClient {
  private token: string;
  private baseUrl: string = 'https://api.buildkite.com/v2';

  /**
   * Create a new BuildkiteRestClient
   * @param token Your Buildkite API token
   * @param options Configuration options
   */
  constructor(token: string, options?: { baseUrl?: string }) {
    this.token = token;
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }
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

    try {
      const startTime = process.hrtime.bigint();
      console.debug(`🕒 Starting REST API request: GET ${endpoint}`);
      
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
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      console.debug(`✅ REST API request completed: GET ${endpoint} (${duration.toFixed(2)}ms)`);
      
      return result;
    } catch (error) {
      console.error('REST API request error:', error);
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
    console.debug(`🕒 Fetching builds for organization: ${org}`);
    
    const builds = await this.get<any[]>(endpoint, params);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    console.debug(`✅ Retrieved ${builds.length} builds for ${org} (${duration.toFixed(2)}ms)`);
    
    return builds;
  }
} 