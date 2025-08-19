/**
 * Simplified test setup for Vitest
 * Uses direct mock data generation without GraphQL schema execution
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { graphql, http, HttpResponse } from 'msw';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load extracted patterns if available
let patterns: any = null;
try {
  const patternsPath = resolve(__dirname, '../test/fixtures/data-patterns.json');
  const data = await fs.readFile(patternsPath, 'utf-8');
  patterns = JSON.parse(data);
  console.log('✓ Loaded data patterns for realistic mocking');
} catch {
  console.log('⚠️  Using default mock patterns');
}

// Helper to generate mock builds
function generateMockBuilds(count: number) {
  const builds = [];
  for (let i = 0; i < count; i++) {
    const states = patterns?.builds?.states?.values || [
      { value: 'PASSED', frequency: 0.7 },
      { value: 'FAILED', frequency: 0.2 },
      { value: 'RUNNING', frequency: 0.1 }
    ];
    
    const state = selectByDistribution(states);
    
    builds.push({
      id: `build-${i + 1}`,
      number: 1000 + i,
      state,
      branch: generateBranch(),
      message: generateCommitMessage(),
      url: `https://buildkite.com/test/test/builds/${1000 + i}`,
      createdAt: new Date().toISOString(),
      pipeline: {
        name: 'Test Pipeline',
        slug: 'test-pipeline'
      },
      organization: {
        name: 'Test Org',
        slug: 'test-org'
      }
    });
  }
  return builds;
}

function generateBranch() {
  if (patterns?.builds?.branches?.formats) {
    const formats = patterns.builds.branches.formats;
    const random = Math.random();
    
    if (random < formats.feature) {
      return `feature/test-feature-${Math.floor(Math.random() * 100)}`;
    } else if (random < formats.feature + formats.bugfix) {
      return `bugfix/fix-issue-${Math.floor(Math.random() * 100)}`;
    } else if (random < formats.feature + formats.bugfix + formats.main) {
      return 'main';
    }
  }
  
  return Math.random() < 0.5 ? 'main' : `feature/test-${Math.floor(Math.random() * 100)}`;
}

function generateCommitMessage() {
  const conventionalCommit = Math.random() < (patterns?.builds?.messagePatterns?.conventionalCommits || 0.3);
  
  if (conventionalCommit) {
    const types = ['feat', 'fix', 'docs', 'test', 'chore'];
    const type = types[Math.floor(Math.random() * types.length)];
    return `${type}: test commit message`;
  }
  
  return `Test commit ${Math.floor(Math.random() * 1000)}`;
}

function selectByDistribution(distribution: Array<{ value: any; frequency: number }>) {
  const random = Math.random();
  let cumulative = 0;
  
  for (const item of distribution) {
    cumulative += item.frequency;
    if (random <= cumulative) {
      return item.value;
    }
  }
  
  return distribution[0]?.value;
}

// Setup MSW server
export const server = setupServer(
  // GraphQL handler for GetViewerBuilds
  graphql.query('GetViewerBuilds', ({ variables }) => {
    const testOverride = (globalThis as any).__testOverride;
    if (testOverride) {
      return HttpResponse.json({ data: testOverride });
    }
    
    const count = variables.first || 10;
    const builds = generateMockBuilds(count);
    
    return HttpResponse.json({
      data: {
        viewer: {
          builds: {
            edges: builds.map(build => ({ node: build })),
            pageInfo: {
              hasNextPage: false,
              endCursor: null
            }
          }
        }
      }
    });
  }),

  // GraphQL handler for GetOrganizations
  graphql.query('GetOrganizations', () => {
    const testOverride = (globalThis as any).__testOverride;
    if (testOverride) {
      return HttpResponse.json({ data: testOverride });
    }
    
    return HttpResponse.json({
      data: {
        viewer: {
          organizations: {
            edges: [
              {
                node: {
                  id: 'org-1',
                  name: 'Test Organization',
                  slug: 'test-org'
                }
              }
            ]
          }
        }
      }
    });
  }),

  // GraphQL handler for GetPipelines
  graphql.query('GetPipelines', ({ variables }) => {
    const testOverride = (globalThis as any).__testOverride;
    if (testOverride) {
      return HttpResponse.json({ data: testOverride });
    }
    
    const count = variables.first || 10;
    const pipelines = [];
    
    for (let i = 0; i < count; i++) {
      pipelines.push({
        id: `pipeline-${i + 1}`,
        name: `Pipeline ${i + 1}`,
        slug: `pipeline-${i + 1}`,
        defaultBranch: 'main',
        description: `Test pipeline ${i + 1}`
      });
    }
    
    return HttpResponse.json({
      data: {
        organization: {
          pipelines: {
            edges: pipelines.map(p => ({ node: p })),
            pageInfo: {
              hasNextPage: false,
              endCursor: null
            }
          }
        }
      }
    });
  }),

  // REST handlers
  http.get('https://api.buildkite.com/*', () => {
    return HttpResponse.json([]);
  })
);

// Start server before all tests
beforeAll(() => {
  server.listen({ 
    onUnhandledRequest: 'bypass'
  });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
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
