/**
 * Global test setup for Vitest
 * This file configures the test environment with pattern-based mocks
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { graphql, http, HttpResponse } from 'msw';
import { PatternMockGenerator } from '../dist/test-helpers/PatternMockGenerator.js';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { graphql as graphqlExecutor } from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load GraphQL schema
let typeDefs: string;
try {
  // First try to load compiled schema if available
  const schemaPath = resolve(__dirname, '../src/graphql/schema.graphql');
  typeDefs = await fs.readFile(schemaPath, 'utf-8');
} catch {
  // Fallback to a minimal schema for testing
  typeDefs = `
    type Query {
      viewer: Viewer
      build(slug: ID!): Build
      organization(slug: String!): Organization
      pipeline(slug: ID!): Pipeline
    }
    
    type Viewer {
      id: ID!
      user: User
      organizations: OrganizationConnection!
      builds(first: Int, after: String): BuildConnection!
    }
    
    type User {
      id: ID!
      uuid: String!
      name: String!
      email: String!
    }
    
    type Organization {
      id: ID!
      slug: String!
      name: String!
      pipelines(first: Int, after: String): PipelineConnection
      members: OrganizationMemberConnection
    }
    
    type Pipeline {
      id: ID!
      slug: String!
      name: String!
      description: String
      defaultBranch: String
      repository: Repository
      builds(first: Int, after: String): BuildConnection
    }
    
    type Build {
      id: ID!
      number: Int!
      state: String!
      branch: String
      message: String
      commit: String
      createdAt: String
      startedAt: String
      finishedAt: String
      url: String!
      webUrl: String!
      createdBy: User
      jobs(first: Int, after: String): JobConnection
      annotations(first: Int, after: String): AnnotationConnection
      pipeline: Pipeline
      organization: Organization
    }
    
    type Repository {
      url: String!
      provider: RepositoryProvider
    }
    
    type RepositoryProvider {
      name: String!
    }
    
    interface JobInterface {
      id: ID!
      uuid: String!
      label: String
      state: String!
    }
    
    type JobTypeCommand implements JobInterface {
      id: ID!
      uuid: String!
      label: String
      state: String!
      exitStatus: Int
      passed: Boolean
      retriedAutomatically: Boolean
      retriedManually: Boolean
    }
    
    type JobTypeWait implements JobInterface {
      id: ID!
      uuid: String!
      label: String
      state: String!
    }
    
    type JobTypeTrigger implements JobInterface {
      id: ID!
      uuid: String!
      label: String
      state: String!
    }
    
    type Annotation {
      id: ID!
      context: String!
      style: String!
      bodyHtml: String!
      createdAt: String!
      updatedAt: String!
    }
    
    # Connection types
    type OrganizationConnection {
      edges: [OrganizationEdge!]!
      pageInfo: PageInfo!
    }
    
    type OrganizationEdge {
      node: Organization!
    }
    
    type PipelineConnection {
      edges: [PipelineEdge!]!
      pageInfo: PageInfo!
    }
    
    type PipelineEdge {
      node: Pipeline!
    }
    
    type BuildConnection {
      edges: [BuildEdge!]!
      pageInfo: PageInfo!
    }
    
    type BuildEdge {
      node: Build!
    }
    
    type JobConnection {
      edges: [JobEdge!]!
      pageInfo: PageInfo!
    }
    
    type JobEdge {
      node: JobInterface!
    }
    
    type AnnotationConnection {
      edges: [AnnotationEdge!]!
      pageInfo: PageInfo!
    }
    
    type AnnotationEdge {
      node: Annotation!
    }
    
    type OrganizationMemberConnection {
      edges: [OrganizationMemberEdge!]!
      pageInfo: PageInfo!
    }
    
    type OrganizationMemberEdge {
      node: OrganizationMember!
    }
    
    type OrganizationMember {
      id: ID!
      user: User!
    }
    
    type PageInfo {
      hasNextPage: Boolean!
      hasPreviousPage: Boolean!
      startCursor: String
      endCursor: String
    }
  `;
}

// Initialize pattern-based mock generator
const mockGenerator = new PatternMockGenerator();

// Try to load patterns, but don't fail if they don't exist
try {
  await mockGenerator.loadPatterns();
  console.log('✓ Loaded data patterns for realistic mocking');
} catch {
  console.log('⚠️  Using default mock patterns (run npm run test:extract-patterns to generate real patterns)');
}

// Generate mocks
const mocks = mockGenerator.generateMocks();

// Create mocked schema
const schema = makeExecutableSchema({ typeDefs });
const mockedSchema = addMocksToSchema({ 
  schema,
  mocks,
  preserveResolvers: false 
});

// Setup MSW server
export const server = setupServer(
  // GraphQL handler
  graphql.operation(async ({ query, variables, operationName }) => {
    // Check for test overrides
    const testOverride = (globalThis as any).__testOverride;
    if (testOverride) {
      return HttpResponse.json({
        data: testOverride
      });
    }

    // Use pattern-based mocks by default
    try {
      const result = await graphqlExecutor({
        schema: mockedSchema,
        source: query,
        variableValues: variables,
        operationName
      });
      
      return HttpResponse.json({
        data: result.data,
        errors: result.errors
      });
    } catch (error) {
      console.error('Mock execution error:', error);
      return HttpResponse.json({
        errors: [{
          message: 'Mock execution failed',
          extensions: { code: 'MOCK_ERROR' }
        }]
      }, { status: 500 });
    }
  }),

  // REST handlers for non-GraphQL endpoints
  http.get('https://api.buildkite.com/*', () => {
    // Mock REST responses if needed
    return HttpResponse.json([]);
  })
);

// Start server before all tests
beforeAll(() => {
  server.listen({ 
    onUnhandledRequest: 'bypass' // Allow unhandled requests in tests
  });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  // Clear any test overrides
  delete (globalThis as any).__testOverride;
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Export utilities for tests
export function setTestData(data: any) {
  (globalThis as any).__testOverride = data;
}

export function clearTestData() {
  delete (globalThis as any).__testOverride;
}