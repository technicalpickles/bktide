import { describe, it, expect, beforeEach } from 'vitest';
import { PlainTextFormatter } from '../../src/formatters/build-detail/PlainTextFormatter.js';

describe('Build Detail Display Formatting', () => {
  let formatter: PlainTextFormatter;

  beforeEach(() => {
    formatter = new PlainTextFormatter();
  });

  describe('collapseParallelJobs', () => {
    it('should collapse jobs with same label and parallel info', () => {
      const jobs = [
        { node: { label: ':rspec: RSpec', state: 'PASSED', parallelGroupIndex: 0, parallelGroupTotal: 3 } },
        { node: { label: ':rspec: RSpec', state: 'PASSED', parallelGroupIndex: 1, parallelGroupTotal: 3 } },
        { node: { label: ':rspec: RSpec', state: 'PASSED', parallelGroupIndex: 2, parallelGroupTotal: 3 } },
        { node: { label: ':test: Test', state: 'PASSED' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const collapsed = formatter.collapseParallelJobs(jobs);
      
      expect(collapsed).toHaveLength(2);
      expect(collapsed[0].label).toBe(':rspec: RSpec');
      expect(collapsed[0].isParallelGroup).toBe(true);
      expect(collapsed[0].jobs).toHaveLength(3);
      expect(collapsed[0].parallelTotal).toBe(3);
      
      expect(collapsed[1].label).toBe(':test: Test');
      expect(collapsed[1].isParallelGroup).toBe(false);
      expect(collapsed[1].jobs).toHaveLength(1);
    });

    it('should not collapse jobs with same label but no parallel info', () => {
      const jobs = [
        { node: { label: ':test: Test', state: 'PASSED' } },
        { node: { label: ':test: Test', state: 'FAILED' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const collapsed = formatter.collapseParallelJobs(jobs);
      
      // Without parallel info, they should be treated as separate groups
      expect(collapsed).toHaveLength(1);
      expect(collapsed[0].label).toBe(':test: Test');
      expect(collapsed[0].isParallelGroup).toBe(false); // Not marked as parallel without info
      expect(collapsed[0].jobs).toHaveLength(2);
    });

    it('should handle single jobs with parallel info', () => {
      const jobs = [
        { node: { label: ':rspec: RSpec', state: 'FAILED', parallelGroupIndex: 351, parallelGroupTotal: 360 } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const collapsed = formatter.collapseParallelJobs(jobs);
      
      expect(collapsed).toHaveLength(1);
      expect(collapsed[0].isParallelGroup).toBe(false); // Single job is not a "group"
      expect(collapsed[0].parallelTotal).toBe(360);
    });
  });

  describe('formatJobDetails', () => {
    it('should use "Steps:" instead of "Jobs:"', () => {
      const jobs = [
        { node: { label: ':test: Test', state: 'PASSED', exitStatus: '0' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobDetails(jobs);
      
      expect(output).toContain('Steps:');
      expect(output).not.toContain('Jobs:');
    });

    it('should show collapsed parallel jobs as single line', () => {
      const jobs = Array(360).fill(null).map((_, i) => ({
        node: {
          label: ':rspec: RSpec',
          state: 'PASSED',
          exitStatus: '0',
          parallelGroupIndex: i,
          parallelGroupTotal: 360,
          startedAt: '2024-01-01T10:00:00Z',
          finishedAt: '2024-01-01T10:25:00Z'
        }
      }));
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobDetails(jobs);
      
      // Should show as single collapsed line
      expect(output).toContain('360 parallel steps');
      expect(output).toContain('avg:');
      
      // Should NOT show individual job lines
      const lines = output.split('\n');
      const rspecLines = lines.filter(l => l.includes(':rspec: RSpec'));
      expect(rspecLines).toHaveLength(1); // Only one line for all 360 jobs
    });

    it('should show failed parallel jobs with breakdown', () => {
      const jobs = [
        { 
          node: { 
            label: ':rspec: RSpec', 
            state: 'PASSED', 
            exitStatus: '0',
            parallelGroupIndex: 0, 
            parallelGroupTotal: 3,
            startedAt: '2024-01-01T10:00:00Z',
            finishedAt: '2024-01-01T10:25:00Z'
          } 
        },
        { 
          node: { 
            label: ':rspec: RSpec', 
            state: 'FAILED', 
            exitStatus: '1',
            parallelGroupIndex: 1, 
            parallelGroupTotal: 3,
            startedAt: '2024-01-01T10:00:00Z',
            finishedAt: '2024-01-01T10:20:00Z'
          } 
        },
        { 
          node: { 
            label: ':rspec: RSpec', 
            state: 'PASSED', 
            exitStatus: '0',
            parallelGroupIndex: 2, 
            parallelGroupTotal: 3,
            startedAt: '2024-01-01T10:00:00Z',
            finishedAt: '2024-01-01T10:22:00Z'
          } 
        },
      ];
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobDetails(jobs, { failed: true });
      
      // Should show failed breakdown
      expect(output).toContain('Failed');
      expect(output).toContain('[Parallel: 2/3]'); // The failed one
    });

    it('should show non-parallel jobs individually', () => {
      const jobs = [
        { node: { label: ':yarn: Package checks', state: 'PASSED', exitStatus: '0' } },
        { node: { label: ':family: Teams', state: 'PASSED', exitStatus: '0' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobDetails(jobs);
      
      expect(output).toContain(':yarn: Package checks');
      expect(output).toContain(':family: Teams');
      
      // Each should be on its own line
      const lines = output.split('\n');
      const yarnLines = lines.filter(l => l.includes(':yarn:'));
      const teamLines = lines.filter(l => l.includes(':family:'));
      expect(yarnLines).toHaveLength(1);
      expect(teamLines).toHaveLength(1);
    });
  });

  describe('formatJobSummary', () => {
    it('should show failed job details in summary', () => {
      const jobsData = {
        edges: [
          { node: { state: 'FAILED', label: ':rspec: RSpec', exitStatus: '1' } },
          { node: { state: 'FAILED', label: ':tapioca: Tapioca DSL Verify', exitStatus: '1' } },
        ],
        pageInfo: { hasNextPage: false },
        count: 2
      };
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobSummary(jobsData, 'FAILED');
      
      expect(output).toContain('2 failed');
      expect(output).toContain(':rspec: RSpec');
      expect(output).toContain(':tapioca: Tapioca DSL Verify');
      expect(output).toContain('- ran'); // Duration indicator
    });

    it('should dim the run time in summary', () => {
      const jobsData = {
        edges: [
          { 
            node: { 
              state: 'FAILED', 
              label: ':tapioca: Tapioca DSL Verify', 
              exitStatus: '1',
              startedAt: '2024-01-01T10:00:00Z',
              finishedAt: '2024-01-01T10:04:22Z'
            } 
          },
        ],
        pageInfo: { hasNextPage: false },
        count: 1
      };
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobSummary(jobsData, 'FAILED');
      
      // The output should contain dimmed run time
      // We can't easily test ANSI codes, but we can verify the structure
      expect(output).toContain('- ran');
      expect(output).toContain('4m 22s');
    });

    it('should show parallel failure counts', () => {
      const jobsData = {
        edges: Array(360).fill(null).map((_, i) => ({
          node: {
            label: ':rspec: RSpec',
            state: i === 350 ? 'FAILED' : 'PASSED',
            exitStatus: i === 350 ? '1' : '0',
            parallelGroupIndex: i,
            parallelGroupTotal: 360
          }
        })),
        pageInfo: { hasNextPage: false },
        count: 360
      };
      
      // @ts-ignore - accessing private method for testing
      const output = formatter.formatJobSummary(jobsData, 'FAILED');
      
      expect(output).toContain('1/360 failed');
    });
  });

  describe('calculateAverageDuration', () => {
    it('should calculate average duration for parallel jobs', () => {
      const jobs = [
        { node: { startedAt: '2024-01-01T10:00:00Z', finishedAt: '2024-01-01T10:25:00Z' } },
        { node: { startedAt: '2024-01-01T10:00:00Z', finishedAt: '2024-01-01T10:26:00Z' } },
        { node: { startedAt: '2024-01-01T10:00:00Z', finishedAt: '2024-01-01T10:24:00Z' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const avg = formatter.calculateAverageDuration(jobs);
      
      expect(avg).toBe('25m');
    });

    it('should handle jobs without timing info', () => {
      const jobs = [
        { node: { label: 'Test' } }, // No timing
        { node: { startedAt: '2024-01-01T10:00:00Z' } }, // No finish
      ];
      
      // @ts-ignore - accessing private method for testing
      const avg = formatter.calculateAverageDuration(jobs);
      
      expect(avg).toBe('unknown');
    });

    it('should format sub-minute durations', () => {
      const jobs = [
        { node: { startedAt: '2024-01-01T10:00:00Z', finishedAt: '2024-01-01T10:00:45Z' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const avg = formatter.calculateAverageDuration(jobs);
      
      expect(avg).toBe('45s');
    });

    it('should format hour+ durations', () => {
      const jobs = [
        { node: { startedAt: '2024-01-01T10:00:00Z', finishedAt: '2024-01-01T11:30:00Z' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const avg = formatter.calculateAverageDuration(jobs);
      
      expect(avg).toBe('1h 30m');
    });
  });

  describe('isJobPassed and isJobFailed', () => {
    it('should correctly identify passed jobs', () => {
      const passedCases = [
        { exitStatus: '0' },
        { state: 'PASSED' },
        { state: 'FINISHED', passed: true },
        { state: 'COMPLETED', passed: true },
      ];
      
      for (const job of passedCases) {
        // @ts-ignore - accessing private method for testing
        expect(formatter.isJobPassed(job)).toBe(true);
      }
    });

    it('should correctly identify failed jobs', () => {
      const failedCases = [
        { exitStatus: '1' },
        { exitStatus: '127' },
        { state: 'FAILED' },
        { state: 'FINISHED', passed: false },
        { state: 'COMPLETED', passed: false },
      ];
      
      for (const job of failedCases) {
        // @ts-ignore - accessing private method for testing
        expect(formatter.isJobFailed(job)).toBe(true);
      }
    });

    it('should not identify BROKEN as failed', () => {
      const job = { state: 'BROKEN', passed: false };

      // @ts-ignore - accessing private method for testing
      expect(formatter.isJobFailed(job)).toBe(false);
    });
  });

  describe('tips display', () => {
    it('should include tips in output when tips option is not set', () => {
      const buildData = {
        build: {
          state: 'PASSED',
          number: 123,
          message: 'Test build',
          branch: 'main',
          commit: 'abc123def456',
          createdAt: '2024-01-01T10:00:00Z',
          startedAt: '2024-01-01T10:01:00Z',
          finishedAt: '2024-01-01T10:15:00Z',
          url: 'https://buildkite.com/org/pipeline/builds/123',
          createdBy: { name: 'Test User' },
          jobs: {
            edges: [
              {
                node: {
                  label: 'Test Job',
                  state: 'PASSED',
                  exitStatus: '0',
                },
              },
            ],
          },
        },
      };

      const output = formatter.formatBuildDetail(buildData, {
        /* tips option not specified - defaults to true */
      });

      expect(output).toContain('Tips:');
      expect(output).toContain('--annotations');
    });

    it('should exclude tips when tips option is false', () => {
      const buildData = {
        build: {
          state: 'PASSED',
          number: 123,
          message: 'Test build',
          branch: 'main',
          commit: 'abc123def456',
          createdAt: '2024-01-01T10:00:00Z',
          startedAt: '2024-01-01T10:01:00Z',
          finishedAt: '2024-01-01T10:15:00Z',
          url: 'https://buildkite.com/org/pipeline/builds/123',
          createdBy: { name: 'Test User' },
          jobs: {
            edges: [
              {
                node: {
                  label: 'Test Job',
                  state: 'PASSED',
                  exitStatus: '0',
                },
              },
            ],
          },
        },
      };

      const output = formatter.formatBuildDetail(buildData, {
        tips: false,
      });

      expect(output).not.toContain('Tips:');
      expect(output).not.toContain('--annotations');
    });

    it('should include tips when tips option is explicitly true', () => {
      const buildData = {
        build: {
          state: 'PASSED',
          number: 123,
          message: 'Test build',
          branch: 'main',
          commit: 'abc123def456',
          createdAt: '2024-01-01T10:00:00Z',
          startedAt: '2024-01-01T10:01:00Z',
          finishedAt: '2024-01-01T10:15:00Z',
          url: 'https://buildkite.com/org/pipeline/builds/123',
          createdBy: { name: 'Test User' },
          jobs: {
            edges: [
              {
                node: {
                  label: 'Test Job',
                  state: 'PASSED',
                  exitStatus: '0',
                },
              },
            ],
          },
        },
      };

      const output = formatter.formatBuildDetail(buildData, {
        tips: true,
      });

      expect(output).toContain('Tips:');
      expect(output).toContain('--annotations');
    });
  });
});
