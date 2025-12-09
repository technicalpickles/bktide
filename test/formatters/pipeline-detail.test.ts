import { describe, it, expect, beforeEach } from 'vitest';
import { PlainPipelineDetailFormatter } from '../../src/formatters/pipeline-detail/PlainFormatter.js';
import { JsonPipelineDetailFormatter } from '../../src/formatters/pipeline-detail/JsonFormatter.js';
import { PipelineDetailData } from '../../src/formatters/pipeline-detail/Formatter.js';

// Note: Unit tests for formatStatus, formatRelativeDate, and truncate are in
// test/utils/formatUtils.test.ts since these are now shared utilities.

describe('Pipeline Detail Formatters', () => {
  describe('PlainPipelineDetailFormatter', () => {
    let formatter: PlainPipelineDetailFormatter;

    beforeEach(() => {
      formatter = new PlainPipelineDetailFormatter({});
    });

    describe('format()', () => {
      it('should format complete pipeline data with builds', () => {
        const data: PipelineDetailData = {
          org: 'test-org',
          pipeline: {
            name: 'My Pipeline',
            slug: 'my-pipeline',
            description: 'A test pipeline',
            defaultBranch: 'main',
            url: 'https://buildkite.com/org/my-pipeline',
            repository: {
              url: 'https://github.com/org/repo',
            },
          },
          recentBuilds: [
            {
              number: 123,
              state: 'PASSED',
              branch: 'main',
              message: 'Fix the bug',
              startedAt: new Date().toISOString(),
            },
            {
              number: 122,
              state: 'FAILED',
              branch: 'feature/new-thing',
              message: 'Add new feature',
              startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            },
          ],
        };

        const output = formatter.format(data);

        expect(output).toContain('Pipeline: My Pipeline');
        expect(output).toContain('Description: A test pipeline');
        expect(output).toContain('Default Branch: main');
        expect(output).toContain('Repository: https://github.com/org/repo');
        expect(output).toContain('Recent Builds');
        expect(output).toContain('#123');
        expect(output).toContain('#122');
        expect(output).toContain('Fix the bug');
        expect(output).toContain('Add new feature');
        expect(output).toContain('View a build: bktide test-org/my-pipeline/<number>');
      });

      it('should handle empty builds array', () => {
        const data: PipelineDetailData = {
          org: 'test-org',
          pipeline: {
            name: 'Empty Pipeline',
            slug: 'empty-pipeline',
            url: 'https://buildkite.com/org/empty-pipeline',
          },
          recentBuilds: [],
        };

        const output = formatter.format(data);

        expect(output).toContain('Pipeline: Empty Pipeline');
        expect(output).toContain('No recent builds found');
        expect(output).not.toContain('Recent Builds');
      });

      it('should handle missing optional fields', () => {
        const data: PipelineDetailData = {
          org: 'test-org',
          pipeline: {
            name: 'Minimal Pipeline',
            slug: 'minimal-pipeline',
            url: 'https://buildkite.com/org/minimal-pipeline',
          },
          recentBuilds: [
            {
              number: 1,
              state: 'RUNNING',
              branch: 'main',
              message: 'Initial commit',
            },
          ],
        };

        const output = formatter.format(data);

        expect(output).toContain('Pipeline: Minimal Pipeline');
        expect(output).not.toContain('Description:');
        expect(output).not.toContain('Default Branch:');
        expect(output).not.toContain('Repository:');
        expect(output).toContain('#1');
      });

      it('should truncate long commit messages', () => {
        const data: PipelineDetailData = {
          org: 'test-org',
          pipeline: {
            name: 'Pipeline',
            slug: 'pipeline',
            url: 'https://buildkite.com/org/pipeline',
          },
          recentBuilds: [
            {
              number: 1,
              state: 'PASSED',
              branch: 'main',
              message: 'This is a very long commit message that should be truncated because it exceeds the maximum allowed length for display in the table',
              startedAt: new Date().toISOString(),
            },
          ],
        };

        const output = formatter.format(data);

        // The truncate method should have been applied (50 char limit)
        expect(output).toContain('...');
      });

      it('should show dash for builds without startedAt', () => {
        const data: PipelineDetailData = {
          org: 'test-org',
          pipeline: {
            name: 'Pipeline',
            slug: 'pipeline',
            url: 'https://buildkite.com/org/pipeline',
          },
          recentBuilds: [
            {
              number: 1,
              state: 'SCHEDULED',
              branch: 'main',
              message: 'Scheduled build',
              // No startedAt
            },
          ],
        };

        const output = formatter.format(data);

        // The table should show '-' for the Started column
        expect(output).toContain('-');
      });
    });
  });

  describe('JsonPipelineDetailFormatter', () => {
    let formatter: JsonPipelineDetailFormatter;

    beforeEach(() => {
      formatter = new JsonPipelineDetailFormatter({});
    });

    it('should return valid JSON', () => {
      const data: PipelineDetailData = {
        org: 'test-org',
        pipeline: {
          name: 'My Pipeline',
          slug: 'my-pipeline',
          url: 'https://buildkite.com/org/my-pipeline',
        },
        recentBuilds: [
          {
            number: 123,
            state: 'PASSED',
            branch: 'main',
            message: 'Fix the bug',
          },
        ],
      };

      const output = formatter.format(data);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual(data);
    });

    it('should contain all expected fields', () => {
      const data: PipelineDetailData = {
        org: 'test-org',
        pipeline: {
          name: 'Test Pipeline',
          slug: 'test-pipeline',
          description: 'A test pipeline',
          defaultBranch: 'main',
          url: 'https://buildkite.com/org/test-pipeline',
          repository: {
            url: 'https://github.com/org/repo',
          },
        },
        recentBuilds: [
          {
            number: 100,
            state: 'FAILED',
            branch: 'feature',
            message: 'Add feature',
            startedAt: '2024-01-01T10:00:00Z',
            finishedAt: '2024-01-01T10:30:00Z',
          },
        ],
      };

      const output = formatter.format(data);
      const parsed = JSON.parse(output);

      expect(parsed.pipeline.name).toBe('Test Pipeline');
      expect(parsed.pipeline.slug).toBe('test-pipeline');
      expect(parsed.pipeline.description).toBe('A test pipeline');
      expect(parsed.pipeline.defaultBranch).toBe('main');
      expect(parsed.pipeline.url).toBe('https://buildkite.com/org/test-pipeline');
      expect(parsed.pipeline.repository.url).toBe('https://github.com/org/repo');
      expect(parsed.recentBuilds).toHaveLength(1);
      expect(parsed.recentBuilds[0].number).toBe(100);
      expect(parsed.recentBuilds[0].state).toBe('FAILED');
      expect(parsed.recentBuilds[0].branch).toBe('feature');
      expect(parsed.recentBuilds[0].message).toBe('Add feature');
      expect(parsed.recentBuilds[0].startedAt).toBe('2024-01-01T10:00:00Z');
      expect(parsed.recentBuilds[0].finishedAt).toBe('2024-01-01T10:30:00Z');
    });

    it('should handle empty builds array in JSON', () => {
      const data: PipelineDetailData = {
        org: 'test-org',
        pipeline: {
          name: 'Empty',
          slug: 'empty',
          url: 'https://buildkite.com/org/empty',
        },
        recentBuilds: [],
      };

      const output = formatter.format(data);
      const parsed = JSON.parse(output);

      expect(parsed.recentBuilds).toEqual([]);
    });
  });
});
