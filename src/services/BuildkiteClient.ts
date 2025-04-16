import { GraphQLClient } from 'graphql-request';

/**
 * BuildkiteClient provides methods to interact with the Buildkite GraphQL API
 */
export class BuildkiteClient {
  private client: GraphQLClient;
  private token: string;
  private baseUrl: string = 'https://graphql.buildkite.com/v1';

  /**
   * Create a new BuildkiteClient
   * @param token Your Buildkite API token
   * @param options Configuration options
   */
  constructor(token: string, options?: { baseUrl?: string }) {
    this.token = token;
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }

    this.client = new GraphQLClient(this.baseUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
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
      console.debug(`🕒 Starting GraphQL query: ${operationName}`);
      
      const result = await this.client.request<T>(query, variables);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      console.debug(`✅ GraphQL query completed: ${operationName} (${duration.toFixed(2)}ms)`);
      
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
      console.debug(`🕒 Starting GraphQL mutation: ${operationName}`);
      
      const result = await this.client.request<T>(mutation, variables);
      
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
      console.debug(`🕒 Starting GraphQL query: getViewerOrganizationSlugs`);
      
      const query = `
        query {
          viewer {
            organizations {
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
      console.debug(`✅ Found ${orgs.length} organizations (${duration.toFixed(2)}ms)`);
      
      return orgs;
    } catch (error) {
      console.error('Error fetching viewer organizations:', error);
      throw new Error('Failed to determine your organizations');
    }
  }
} 