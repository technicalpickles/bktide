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
  const builds: any[] = [];
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
    const pipelines: any[] = [];
    
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

  // GraphQL handler for GetPipeline (single pipeline)
  graphql.query('GetPipeline', ({ variables }) => {
    const testOverride = (globalThis as any).__testOverride;
    if (testOverride) {
      return HttpResponse.json({ data: testOverride });
    }
    
    // Default mock response for a single pipeline
    return HttpResponse.json({
      data: {
        organization: {
          pipelines: {
            edges: [
              {
                node: {
                  uuid: 'pipeline-uuid-1',
                  id: 'pipeline-id-1',
                  name: 'Test Pipeline',
                  slug: variables.pipelineSlug || 'test-pipeline',
                  description: 'A test pipeline',
                  url: `https://buildkite.com/${variables.organizationSlug}/${variables.pipelineSlug}`,
                  defaultBranch: 'main',
                  repository: {
                    url: 'https://github.com/test/repo',
                  },
                },
              },
            ],
          },
        },
      },
    });
  }),

  // GraphQL handler for GetBuildSummary
  graphql.query('GetBuildSummary', ({ variables }) => {
    const testOverride = (globalThis as any).__testOverride_build;
    if (testOverride) {
      return HttpResponse.json({ data: testOverride });
    }
    
    // Default mock response for a build
    return HttpResponse.json({
      data: {
        build: {
          id: 'build-id-1',
          number: 123,
          state: 'PASSED',
          branch: 'main',
          message: 'Test build',
          commit: 'abc123',
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          canceledAt: null,
          url: 'https://api.buildkite.com/v2/builds/123',
          blockedState: null,
          createdBy: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
          pipeline: {
            id: 'pipeline-1',
            name: 'Test Pipeline',
            slug: 'test-pipeline',
          },
          organization: {
            id: 'org-1',
            name: 'Test Org',
            slug: 'test-org',
          },
          jobs: {
            edges: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
            count: 0,
          },
          annotations: {
            edges: [],
          },
        },
      },
    });
  }),

  // REST handler for pipeline builds
  http.get('https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds', ({ params }) => {
    const testOverride = (globalThis as any).__testOverride_rest_builds;
    if (testOverride) {
      return HttpResponse.json(testOverride);
    }
    
    // Default mock builds
    return HttpResponse.json([
      {
        id: 'build-1',
        number: 100,
        state: 'passed',
        branch: 'main',
        message: 'Test build 1',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        web_url: `https://buildkite.com/${params.org}/${params.pipeline}/builds/100`,
      },
      {
        id: 'build-2',
        number: 99,
        state: 'failed',
        branch: 'feature/test',
        message: 'Test build 2',
        started_at: new Date(Date.now() - 60000).toISOString(),
        finished_at: new Date(Date.now() - 30000).toISOString(),
        web_url: `https://buildkite.com/${params.org}/${params.pipeline}/builds/99`,
      },
    ]);
  }),

  // REST handler for single build details
  http.get('https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds/:buildNumber', ({ params }) => {
    const testOverride = (globalThis as any).__testOverride_rest_build;
    if (testOverride) {
      return HttpResponse.json(testOverride);
    }
    
    // Default mock build with jobs
    return HttpResponse.json({
      id: 'build-uuid',
      number: Number(params.buildNumber),
      state: 'passed',
      branch: 'main',
      message: 'Test build',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      web_url: `https://buildkite.com/${params.org}/${params.pipeline}/builds/${params.buildNumber}`,
      jobs: [
        {
          id: 'job-uuid-1',
          step: {
            id: 'step-id-1',
            key: 'test-step',
          },
          name: 'Test Job',
          state: 'passed',
          exit_status: 0,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // REST handler for job logs
  http.get('https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds/:buildNumber/jobs/:jobId/log', ({ params }) => {
    const testOverride = (globalThis as any).__testOverride_rest_logs;
    if (testOverride) {
      return HttpResponse.json(testOverride);
    }
    
    // Default mock log
    return HttpResponse.json({
      content: 'Line 1\nLine 2\nLine 3\nTest log output\nLine 5',
      size: 50,
      url: `https://api.buildkite.com/v2/organizations/${params.org}/pipelines/${params.pipeline}/builds/${params.buildNumber}/jobs/${params.jobId}/log`,
    });
  }),

  // Catch-all REST handler
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
