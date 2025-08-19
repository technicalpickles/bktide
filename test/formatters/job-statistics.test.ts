import { describe, it, expect, beforeEach } from 'vitest';
import { PlainTextFormatter } from '../../src/formatters/build-detail/PlainTextFormatter.js';

describe('Job Statistics and State Handling', () => {
  let formatter: PlainTextFormatter;
  
  beforeEach(() => {
    formatter = new PlainTextFormatter();
  });

  describe('getJobStats', () => {
    it('should count BROKEN jobs as skipped, not failed', () => {
      const jobs = [
        { node: { state: 'BROKEN', passed: false, exitStatus: null } },
        { node: { state: 'BROKEN', passed: false, exitStatus: null } },
        { node: { state: 'BROKEN', passed: false, exitStatus: null } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const stats = formatter.getJobStats(jobs);
      
      expect(stats.skipped).toBe(3);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(3);
    });

    it('should count FINISHED jobs with passed=false as failed', () => {
      const jobs = [
        { node: { state: 'FINISHED', passed: false, exitStatus: null } },
        { node: { state: 'FINISHED', passed: true, exitStatus: null } },
        { node: { state: 'FINISHED', passed: false, exitStatus: null } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const stats = formatter.getJobStats(jobs);
      
      expect(stats.failed).toBe(2);
      expect(stats.passed).toBe(1);
      expect(stats.total).toBe(3);
    });

    it('should handle mixed job states correctly', () => {
      const jobs = [
        // 100 BROKEN Jest jobs (skipped)
        ...Array(100).fill({ node: { state: 'BROKEN', passed: false } }),
        // 416 FINISHED passed jobs
        ...Array(416).fill({ node: { state: 'FINISHED', passed: true } }),
        // 2 FINISHED failed jobs (the actual failures)
        { node: { state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
        { node: { state: 'FINISHED', passed: false, label: ':tapioca: Tapioca DSL Verify' } },
        // 65 other BROKEN jobs
        ...Array(65).fill({ node: { state: 'BROKEN', passed: false } }),
        // 22 SKIPPED jobs
        ...Array(22).fill({ node: { state: 'SKIPPED' } }),
        // 3 UNKNOWN jobs
        ...Array(3).fill({ node: { state: 'UNKNOWN' } }),
      ];
      
      // @ts-ignore - accessing private method for testing
      const stats = formatter.getJobStats(jobs);
      
      expect(stats.total).toBe(608);
      expect(stats.failed).toBe(2);
      expect(stats.passed).toBe(416);
      expect(stats.skipped).toBe(187); // 100 + 65 BROKEN + 22 SKIPPED
    });

    it('should use exitStatus when available', () => {
      const jobs = [
        { node: { state: 'FINISHED', exitStatus: '0' } },
        { node: { state: 'FINISHED', exitStatus: '1' } },
        { node: { state: 'FINISHED', exitStatus: '127' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const stats = formatter.getJobStats(jobs);
      
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(2);
    });
  });

  describe('getFailedJobs', () => {
    it('should NOT include BROKEN jobs as failed', () => {
      const jobs = [
        { node: { state: 'BROKEN', passed: false, label: ':jest: Jest' } },
        { node: { state: 'BROKEN', passed: false, label: ':jest: Jest' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const failedJobs = formatter.getFailedJobs(jobs);
      
      expect(failedJobs).toHaveLength(0);
    });

    it('should include FINISHED jobs with passed=false as failed', () => {
      const jobs = [
        { node: { state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
        { node: { state: 'FINISHED', passed: true, label: ':jest: Jest' } },
        { node: { state: 'FINISHED', passed: false, label: ':tapioca: Tapioca DSL Verify' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const failedJobs = formatter.getFailedJobs(jobs);
      
      expect(failedJobs).toHaveLength(2);
      expect(failedJobs[0].node.label).toBe(':rspec: RSpec');
      expect(failedJobs[1].node.label).toBe(':tapioca: Tapioca DSL Verify');
    });

    it('should NOT include SKIPPED jobs as failed', () => {
      const jobs = [
        { node: { state: 'SKIPPED', label: 'Skipped job' } },
        { node: { state: 'SKIPPED', passed: false, label: 'Another skipped' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const failedJobs = formatter.getFailedJobs(jobs);
      
      expect(failedJobs).toHaveLength(0);
    });

    it('should use exitStatus when available', () => {
      const jobs = [
        { node: { state: 'FINISHED', exitStatus: '0', label: 'Success' } },
        { node: { state: 'FINISHED', exitStatus: '1', label: 'Failed' } },
        { node: { state: 'FINISHED', exitStatus: null, passed: false, label: 'Also Failed' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const failedJobs = formatter.getFailedJobs(jobs);
      
      expect(failedJobs).toHaveLength(2);
      expect(failedJobs[0].node.label).toBe('Failed');
      expect(failedJobs[1].node.label).toBe('Also Failed');
    });
  });

  describe('formatJobSummary', () => {
    it('should show correct counts when data is truncated', () => {
      const jobsData = {
        edges: Array(100).fill({ node: { state: 'BROKEN', passed: false } }),
        pageInfo: { hasNextPage: true, endCursor: 'cursor' },
        count: 608
      };
      
      // @ts-ignore - accessing private method for testing
      const summary = formatter.formatJobSummary(jobsData, 'FAILED');
      
      expect(summary).toContain('Showing 100 of 608 steps');
      expect(summary).toContain('100 skipped');
      expect(summary).not.toContain('100 failed');
      expect(summary).toContain('Showing first 100 jobs only');
    });

    it('should not show truncation warning when all jobs are present', () => {
      const jobsData = {
        edges: [
          { node: { state: 'FINISHED', passed: true } },
          { node: { state: 'FINISHED', passed: false } },
          { node: { state: 'BROKEN', passed: false } },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
        count: 3
      };
      
      // @ts-ignore - accessing private method for testing
      const summary = formatter.formatJobSummary(jobsData, 'FAILED');
      
      expect(summary).toContain('3 steps');
      expect(summary).not.toContain('Showing');
      expect(summary).not.toContain('first 100 jobs only');
      expect(summary).toContain('1 failed');
      expect(summary).toContain('1 passed');
      expect(summary).toContain('1 skipped');
    });

    it('should not show BROKEN jobs in failed job list for failed builds', () => {
      const jobsData = {
        edges: [
          { node: { state: 'BROKEN', passed: false, label: ':jest: Jest' } },
          { node: { state: 'BROKEN', passed: false, label: ':jest: Jest' } },
          { node: { state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
        count: 3
      };
      
      // @ts-ignore - accessing private method for testing
      const summary = formatter.formatJobSummary(jobsData, 'FAILED');
      
      // Should show the actual failed job
      expect(summary).toContain(':rspec: RSpec');
      // Should NOT show the BROKEN jobs as failed
      expect(summary).not.toMatch(/✗ :jest: Jest.*failed/);
    });
  });

  describe('groupJobsByState', () => {
    it('should put BROKEN jobs in Skipped group, not Failed', () => {
      const jobs = [
        { node: { state: 'BROKEN', passed: false, label: ':jest: Jest' } },
        { node: { state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
        { node: { state: 'FINISHED', passed: true, label: ':test: Test' } },
        { node: { state: 'SKIPPED', label: ':skip: Skipped' } },
      ];
      
      // @ts-ignore - accessing private method for testing
      const grouped = formatter.groupJobsByState(jobs);
      
      expect(grouped['Failed']).toHaveLength(1);
      expect(grouped['Failed'][0].node.label).toBe(':rspec: RSpec');
      
      expect(grouped['Skipped']).toHaveLength(2);
      expect(grouped['Skipped'][0].node.label).toBe(':jest: Jest');
      expect(grouped['Skipped'][1].node.label).toBe(':skip: Skipped');
      
      expect(grouped['Passed']).toHaveLength(1);
      expect(grouped['Passed'][0].node.label).toBe(':test: Test');
    });

    it('should not show BROKEN jobs in Failed section when using --failed flag', () => {
      const jobs = [
        { node: { state: 'BROKEN', passed: false, label: ':jest: Jest' } },
        { node: { state: 'BROKEN', passed: false, label: ':jest: Jest 2' } },
        { node: { state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
      ];
      
      // When --failed flag is used, getFailedJobs filters out BROKEN
      // @ts-ignore - accessing private method for testing
      const failedJobs = formatter.getFailedJobs(jobs);
      
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].node.label).toBe(':rspec: RSpec');
      
      // Then groupJobsByState only sees the actual failed jobs
      // @ts-ignore - accessing private method for testing
      const grouped = formatter.groupJobsByState(failedJobs);
      
      expect(grouped['Failed']).toHaveLength(1);
      expect(grouped['Skipped']).toHaveLength(0); // BROKEN jobs filtered out
    });
  });

  describe('Real-world scenario: Build #1290672', () => {
    it('should handle first 100 jobs being all BROKEN correctly', () => {
      // Simulate the actual case where first 100 are all BROKEN Jest jobs
      const first100Jobs = Array(100).fill({ 
        node: { 
          state: 'BROKEN', 
          passed: false, 
          label: ':jest: Jest',
          parallelGroupIndex: 1,
          parallelGroupTotal: 120
        } 
      });
      
      const jobsData = {
        edges: first100Jobs,
        pageInfo: { hasNextPage: true, endCursor: 'cursor' },
        count: 608
      };
      
      // @ts-ignore - accessing private method for testing
      const summary = formatter.formatJobSummary(jobsData, 'FAILED');
      
      // Should show as skipped, not failed
      expect(summary).toContain('100 skipped');
      expect(summary).not.toContain('100 failed');
      
      // Should show truncation warning
      expect(summary).toContain('Showing 100 of 608 steps');
      expect(summary).toContain('Use --jobs to fetch all job data');
      
      // Should NOT show Jest as a failed job
      expect(summary).not.toMatch(/✗ :jest: Jest.*\d+.*failed/);
    });

    it('should show correct stats with all 608 jobs fetched', () => {
      const allJobs = [
        // 165 BROKEN jobs (including 120 Jest)
        ...Array(165).fill({ node: { state: 'BROKEN', passed: false } }),
        // 416 passed FINISHED jobs
        ...Array(416).fill({ node: { state: 'FINISHED', passed: true } }),
        // 2 failed FINISHED jobs (the actual failures)
        { node: { state: 'FINISHED', passed: false, label: ':rspec: RSpec' } },
        { node: { state: 'FINISHED', passed: false, label: ':tapioca: Tapioca DSL Verify' } },
        // 22 SKIPPED jobs
        ...Array(22).fill({ node: { state: 'SKIPPED' } }),
        // 3 UNKNOWN jobs
        ...Array(3).fill({ node: { state: 'UNKNOWN' } }),
      ];
      
      const jobsData = {
        edges: allJobs,
        pageInfo: { hasNextPage: false, endCursor: null },
        count: 608
      };
      
      // @ts-ignore - accessing private method for testing
      const summary = formatter.formatJobSummary(jobsData, 'FAILED');
      
      expect(summary).toContain('608 steps');
      expect(summary).toContain('2 failed');
      expect(summary).toContain('416 passed');
      expect(summary).toContain('187 skipped'); // 165 BROKEN + 22 SKIPPED
      
      // Should show the actual failed jobs
      expect(summary).toContain(':rspec: RSpec');
      expect(summary).toContain(':tapioca: Tapioca DSL Verify');
    });
  });
});
