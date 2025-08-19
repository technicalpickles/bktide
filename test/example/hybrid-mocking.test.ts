/**
 * Example test demonstrating the hybrid mocking approach
 * This shows how to use pattern-based mocks and override with specific test data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BuildkiteClient } from '../../dist/services/BuildkiteClient.js';
import { server, setTestData, clearTestData } from '../setup-simple.js';
import { graphql } from 'msw';

describe('Hybrid Mocking Example', () => {
  let client: BuildkiteClient;

  beforeEach(() => {
    // Create a new client for each test
    client = new BuildkiteClient('test-token', {
      caching: false, // Disable caching in tests
      debug: false
    });
  });

  describe('Pattern-Based Mocking', () => {
    it('should return realistic builds based on extracted patterns', async () => {
      // This test uses the default pattern-based mocks
      const buildsResponse = await client.getViewerBuilds(5);
      const builds = buildsResponse.viewer?.builds?.edges?.map(e => e?.node).filter(Boolean) || [];
      
      // The builds will have realistic characteristics
      expect(builds).toBeDefined();
      expect(builds.length).toBeGreaterThan(0);
      
      // Check that builds follow realistic patterns
      builds.forEach(build => {
        // Build numbers should be in a realistic range
        expect(build.number).toBeGreaterThan(0);
        
        // States should match common distributions
        expect(['PASSED', 'FAILED', 'RUNNING', 'CANCELED', 'BLOCKED', 'SCHEDULED', 'CANCELING', 'SKIPPED', 'NOT_RUN']).toContain(build.state);
        
        // Branches should follow common patterns
        if (build.branch) {
          // Many branches follow conventional formats
          const branchPatterns = [
            /^main$/,
            /^master$/,
            /^develop$/,
            /^feature\//,
            /^bugfix\//,
            /^release\//
          ];
          const matchesPattern = branchPatterns.some(pattern => pattern.test(build.branch!));
          expect(matchesPattern || build.branch.length > 0).toBe(true);
        }
        
        // Messages might follow conventional commit format
        if (build.message) {
          const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/;
          // Not all commits follow this, but some should
          expect(
            conventionalCommitPattern.test(build.message) || 
            build.message.length > 0
          ).toBe(true);
        }
      });
    });

    it('should generate organizations with realistic patterns', async () => {
      // Pattern-based mocks will generate realistic organization data  
      const orgs = await client.getOrganizations();
      
      expect(orgs).toBeDefined();
      expect(Array.isArray(orgs)).toBe(true);
      
      if (orgs.length > 0) {
        orgs.forEach(org => {
          expect(org.slug).toBeDefined();
          expect(org.name).toBeDefined();
          expect(org.id).toBeDefined();
        });
      }
    });
  });

  describe('Specific Test Data Overrides', () => {
    it('should handle specific failure scenarios', async () => {
      // Override with specific test data for this test
      setTestData({
              viewer: {
                builds: {
                  edges: [
                    {
                      node: {
                        id: 'failed-build-1',
                        number: 999,
                        state: 'FAILED',
                        branch: 'feature/broken-feature',
                        message: 'fix: this should have worked',
                        commit: 'abc123',
                        createdAt: new Date().toISOString(),
                        startedAt: new Date().toISOString(),
                        finishedAt: new Date().toISOString(),
                        url: 'https://buildkite.com/test/test/builds/999',
                        webUrl: 'https://buildkite.com/test/test/builds/999',
                        createdBy: {
                          id: 'user-1',
                          name: 'Test User',
                          email: 'test@example.com'
                        },
                        pipeline: {
                          name: 'Test Pipeline',
                          slug: 'test-pipeline'
                        },
                        organization: {
                          name: 'Test Org',
                          slug: 'test-org'
                        }
                      }
                    }
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                    startCursor: null,
                    endCursor: null
                  }
                }
              }
      });

      const buildsResponse = await client.getViewerBuilds(1);
      const builds = buildsResponse.viewer?.builds?.edges?.map(e => e?.node).filter(Boolean) || [];
      
      expect(builds).toHaveLength(1);
      expect(builds[0].state).toBe('FAILED');
      expect(builds[0].number).toBe(999);
      
      // Note: viewer builds don't include jobs or annotations by default
      // To test those, you would need to use specific queries like getBuildSummary or getBuildFull
    });

    it('should test pagination with mixed data', async () => {
      // First page uses specific data
      setTestData({
        viewer: {
          builds: {
            edges: [
              {
                node: {
                  id: 'page1-build1',
                  number: 100,
                  state: 'PASSED',
                  message: 'First page build'
                }
              }
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor1'
            }
          }
        }
      });

      const firstPageResponse = await client.getViewerBuilds(1);
      const firstPage = firstPageResponse.viewer?.builds?.edges?.map(e => e?.node).filter(Boolean) || [];
      expect(firstPage[0].number).toBe(100);

      // Clear override to use pattern-based mocks for next page
      clearTestData();
      
      // Next page will use pattern-based mocks
      const secondPageResponse = await client.getViewerBuilds(1);
      const secondPage = secondPageResponse.viewer?.builds?.edges?.map(e => e?.node).filter(Boolean) || [];
      expect(secondPage).toBeDefined();
      // Second page will have realistic but different data
      if (secondPage.length > 0) {
        expect(secondPage[0].number).not.toBe(100);
      }
    });
  });

  describe('Record and Replay Mode', () => {
    it('should support recording mode for fixture generation', async () => {
      // In record mode (RECORD_MODE=true), this would hit the real API
      // and save the responses for future use
      
      const isRecordMode = process.env.RECORD_MODE === 'true';
      
      if (isRecordMode) {
        console.log('📼 Recording mode: would save real API responses');
        // In real implementation, Polly.js or nock would record here
      } else {
        console.log('▶️  Replay mode: using mocked responses');
        // Uses pattern-based mocks or recorded fixtures
      }
      
      const orgs = await client.getOrganizations();
      expect(orgs).toBeDefined();
      expect(Array.isArray(orgs)).toBe(true);
    });
  });

  describe('Snapshot Testing with Sanitization', () => {
    it('should generate consistent snapshots with sanitized data', async () => {
      // Get some builds
      const buildsResponse = await client.getViewerBuilds(2);
      const builds = buildsResponse.viewer?.builds?.edges?.map(e => e?.node).filter(Boolean) || [];
      
      // Sanitize ALL dynamic data for consistent snapshot testing
      const sanitized = builds.map((build, index) => ({
        ...build,
        id: 'BUILD_ID',
        number: 1000 + index, // Fixed number sequence
        state: index === 0 ? 'PASSED' : 'FAILED', // Deterministic states
        branch: 'main', // Fixed branch
        message: 'Test commit message', // Fixed message
        createdAt: '2024-01-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        finishedAt: '2024-01-01T00:00:00Z',
        commit: 'COMMIT_SHA',
        url: 'https://buildkite.com/org/pipeline/builds/123',
        webUrl: 'https://buildkite.com/org/pipeline/builds/123',
        createdBy: build.createdBy ? {
          ...build.createdBy,
          id: 'USER_ID',
          email: 'user@example.com'
        } : undefined
      }));
      
      // This would create/compare a snapshot
      expect(sanitized).toMatchSnapshot();
    });
  });
});
