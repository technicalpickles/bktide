import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';

describe('BuildkiteClient - Job Pagination', () => {
  let client: BuildkiteClient;
  
  beforeEach(() => {
    client = new BuildkiteClient('test-token', { 
      debug: false, 
      caching: false 
    });
  });

  describe('fetchRemainingJobs', () => {
    it('should return initial jobs when no more pages', async () => {
      const initialJobs = [
        { node: { id: '1', label: 'Job 1' } },
        { node: { id: '2', label: 'Job 2' } },
      ];
      const pageInfo = { hasNextPage: false, endCursor: null };
      
      const result = await client.fetchRemainingJobs(
        'org/pipeline/123',
        initialJobs,
        pageInfo
      );
      
      expect(result.jobs).toEqual(initialJobs);
      expect(result.totalCount).toBe(2);
    });

    it('should fetch all pages when multiple pages exist', async () => {
      const initialJobs = Array(100).fill(null).map((_, i) => ({
        node: { id: `job-${i}`, label: `Job ${i}` }
      }));
      
      const pageInfo = { 
        hasNextPage: true, 
        endCursor: 'cursor-page-1' 
      };
      
      // Mock the query method to return additional pages
      const queryMock = vi.spyOn(client, 'query');
      
      // Page 2
      queryMock.mockResolvedValueOnce({
        build: {
          jobs: {
            edges: Array(100).fill(null).map((_, i) => ({
              node: { id: `job-${100 + i}`, label: `Job ${100 + i}` }
            })),
            pageInfo: { hasNextPage: true, endCursor: 'cursor-page-2' },
            count: 250
          }
        }
      });
      
      // Page 3 (final)
      queryMock.mockResolvedValueOnce({
        build: {
          jobs: {
            edges: Array(50).fill(null).map((_, i) => ({
              node: { id: `job-${200 + i}`, label: `Job ${200 + i}` }
            })),
            pageInfo: { hasNextPage: false, endCursor: null },
            count: 250
          }
        }
      });
      
      const result = await client.fetchRemainingJobs(
        'org/pipeline/123',
        initialJobs,
        pageInfo
      );
      
      expect(result.jobs).toHaveLength(250);
      expect(result.totalCount).toBe(250);
      expect(queryMock).toHaveBeenCalledTimes(2); // Two additional pages
      
      // Verify the cursors were used correctly
      expect(queryMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          slug: 'org/pipeline/123',
          first: 100,
          after: 'cursor-page-1'
        })
      );
      
      expect(queryMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          slug: 'org/pipeline/123',
          first: 100,
          after: 'cursor-page-2'
        })
      );
    });

    it('should call progress callback with correct counts', async () => {
      const initialJobs = Array(100).fill(null).map((_, i) => ({
        node: { id: `job-${i}` }
      }));
      
      const pageInfo = { 
        hasNextPage: true, 
        endCursor: 'cursor-1' 
      };
      
      const progressMock = vi.fn();
      
      // Mock query to return one more page
      vi.spyOn(client, 'query').mockResolvedValueOnce({
        build: {
          jobs: {
            edges: Array(50).fill(null).map((_, i) => ({
              node: { id: `job-${100 + i}` }
            })),
            pageInfo: { hasNextPage: false, endCursor: null },
            count: 150
          }
        }
      });
      
      await client.fetchRemainingJobs(
        'org/pipeline/123',
        initialJobs,
        pageInfo,
        { onProgress: progressMock }
      );
      
      // Should be called once for the additional page
      expect(progressMock).toHaveBeenCalledWith(150, 150);
    });

    it('should handle empty pages gracefully', async () => {
      const initialJobs = [{ node: { id: '1' } }];
      const pageInfo = { hasNextPage: true, endCursor: 'cursor' };
      
      // Mock query to return empty page
      vi.spyOn(client, 'query').mockResolvedValueOnce({
        build: {
          jobs: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            count: 1
          }
        }
      });
      
      const result = await client.fetchRemainingJobs(
        'org/pipeline/123',
        initialJobs,
        pageInfo
      );
      
      expect(result.jobs).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it('should stop when cursor is null even if hasNextPage is true', async () => {
      const initialJobs = [{ node: { id: '1' } }];
      const pageInfo = { hasNextPage: true, endCursor: null };
      
      const queryMock = vi.spyOn(client, 'query');
      
      const result = await client.fetchRemainingJobs(
        'org/pipeline/123',
        initialJobs,
        pageInfo
      );
      
      // Should not attempt to fetch with null cursor
      expect(queryMock).not.toHaveBeenCalled();
      expect(result.jobs).toEqual(initialJobs);
    });
  });

  describe('getBuildSummaryWithAllJobs', () => {
    it('should return initial data when fetchAllJobs is false', async () => {
      const mockBuildData = {
        build: {
          id: 'build-1',
          jobs: {
            edges: Array(100).fill({ node: { id: '1' } }),
            pageInfo: { hasNextPage: true, endCursor: 'cursor' },
            count: 200
          }
        }
      };
      
      vi.spyOn(client, 'getBuildSummary').mockResolvedValueOnce(mockBuildData);
      const fetchSpy = vi.spyOn(client, 'fetchRemainingJobs');
      
      const result = await client.getBuildSummaryWithAllJobs(
        'org/pipeline/123',
        { fetchAllJobs: false }
      );
      
      expect(result).toEqual(mockBuildData);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return initial data when no more pages exist', async () => {
      const mockBuildData = {
        build: {
          id: 'build-1',
          jobs: {
            edges: Array(50).fill({ node: { id: '1' } }),
            pageInfo: { hasNextPage: false, endCursor: null },
            count: 50
          }
        }
      };
      
      vi.spyOn(client, 'getBuildSummary').mockResolvedValueOnce(mockBuildData);
      const fetchSpy = vi.spyOn(client, 'fetchRemainingJobs');
      
      const result = await client.getBuildSummaryWithAllJobs(
        'org/pipeline/123',
        { fetchAllJobs: true }
      );
      
      expect(result).toEqual(mockBuildData);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should fetch all jobs and merge correctly', async () => {
      const initialJobs = Array(100).fill(null).map((_, i) => ({
        node: { id: `job-${i}` }
      }));
      
      const mockBuildData = {
        build: {
          id: 'build-1',
          state: 'FAILED',
          jobs: {
            edges: initialJobs,
            pageInfo: { hasNextPage: true, endCursor: 'cursor' },
            count: 250
          }
        }
      };
      
      const allJobs = [
        ...initialJobs,
        ...Array(150).fill(null).map((_, i) => ({
          node: { id: `job-${100 + i}` }
        }))
      ];
      
      vi.spyOn(client, 'getBuildSummary').mockResolvedValueOnce(mockBuildData);
      vi.spyOn(client, 'fetchRemainingJobs').mockResolvedValueOnce({
        jobs: allJobs,
        totalCount: 250
      });
      
      const result = await client.getBuildSummaryWithAllJobs(
        'org/pipeline/123',
        { fetchAllJobs: true }
      );
      
      expect(result.build.jobs.edges).toHaveLength(250);
      expect(result.build.jobs.pageInfo.hasNextPage).toBe(false);
      expect(result.build.jobs.pageInfo.endCursor).toBe(null);
      expect(result.build.jobs.count).toBe(250);
    });

    it('should pass progress callback through', async () => {
      const mockBuildData = {
        build: {
          id: 'build-1',
          jobs: {
            edges: [{ node: { id: '1' } }],
            pageInfo: { hasNextPage: true, endCursor: 'cursor' },
            count: 100
          }
        }
      };
      
      const progressMock = vi.fn();
      
      vi.spyOn(client, 'getBuildSummary').mockResolvedValueOnce(mockBuildData);
      const fetchSpy = vi.spyOn(client, 'fetchRemainingJobs').mockResolvedValueOnce({
        jobs: Array(100).fill({ node: { id: '1' } }),
        totalCount: 100
      });
      
      await client.getBuildSummaryWithAllJobs(
        'org/pipeline/123',
        { 
          fetchAllJobs: true,
          onProgress: progressMock
        }
      );
      
      expect(fetchSpy).toHaveBeenCalledWith(
        'org/pipeline/123',
        mockBuildData.build.jobs.edges,
        mockBuildData.build.jobs.pageInfo,
        { onProgress: progressMock }
      );
    });
  });

  describe('Real-world scenario: Build #1290672', () => {
    it('should correctly paginate 608 jobs across 7 pages', async () => {
      // First 100 jobs (all BROKEN)
      const first100 = Array(100).fill(null).map((_, i) => ({
        node: { 
          id: `jest-${i}`,
          state: 'BROKEN',
          passed: false,
          label: ':jest: Jest'
        }
      }));
      
      const mockBuildData = {
        build: {
          id: 'build-1290672',
          state: 'FAILED',
          jobs: {
            edges: first100,
            pageInfo: { hasNextPage: true, endCursor: 'page-1-cursor' },
            count: 608
          }
        }
      };
      
      vi.spyOn(client, 'getBuildSummary').mockResolvedValueOnce(mockBuildData);
      
      // Mock fetchRemainingJobs to return all 608 jobs
      const allJobs = [
        ...first100,
        // Add the rest including the 2 actual failures
        ...Array(416).fill(null).map((_, i) => ({
          node: { 
            id: `passed-${i}`,
            state: 'FINISHED',
            passed: true
          }
        })),
        { node: { id: 'failed-1', state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
        { node: { id: 'failed-2', state: 'FINISHED', passed: false, label: ':tapioca: Tapioca DSL Verify' } },
        ...Array(65).fill(null).map((_, i) => ({
          node: { 
            id: `broken-other-${i}`,
            state: 'BROKEN',
            passed: false
          }
        })),
        ...Array(22).fill(null).map((_, i) => ({
          node: { 
            id: `skipped-${i}`,
            state: 'SKIPPED'
          }
        })),
        ...Array(3).fill(null).map((_, i) => ({
          node: { 
            id: `unknown-${i}`,
            state: 'UNKNOWN'
          }
        }))
      ];
      
      vi.spyOn(client, 'fetchRemainingJobs').mockResolvedValueOnce({
        jobs: allJobs,
        totalCount: 608
      });
      
      const result = await client.getBuildSummaryWithAllJobs(
        'gusto/zenpayroll/1290672',
        { fetchAllJobs: true }
      );
      
      expect(result.build.jobs.edges).toHaveLength(608);
      
      // Verify the failed jobs are in the complete set
      const failedJobs = result.build.jobs.edges.filter(
        (j: any) => j.node.state === 'FINISHED' && j.node.passed === false
      );
      expect(failedJobs).toHaveLength(2);
      expect(failedJobs[0].node.label).toBe(':rspec: RSpec');
      expect(failedJobs[1].node.label).toBe(':tapioca: Tapioca DSL Verify');
      
      // Verify BROKEN jobs are not counted as failed
      const brokenJobs = result.build.jobs.edges.filter(
        (j: any) => j.node.state === 'BROKEN'
      );
      expect(brokenJobs).toHaveLength(165); // 100 Jest + 65 others
    });
  });
});
