import { describe, it, expect, beforeEach } from 'vitest';
import { PlainPipelineDetailFormatter } from '../../src/formatters/pipeline-detail/PlainFormatter.js';
import { JsonPipelineDetailFormatter } from '../../src/formatters/pipeline-detail/JsonFormatter.js';
import { PipelineDetailData } from '../../src/formatters/pipeline-detail/Formatter.js';

describe('Pipeline Detail Formatters', () => {
  describe('PlainPipelineDetailFormatter', () => {
    let formatter: PlainPipelineDetailFormatter;

    beforeEach(() => {
      formatter = new PlainPipelineDetailFormatter({});
    });

    describe('truncate()', () => {
      it('should return string unchanged if shorter than limit', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.truncate('short string', 50);
        expect(result).toBe('short string');
      });

      it('should truncate string and add ellipsis if longer than limit', () => {
        const longString = 'This is a very long string that should be truncated because it exceeds the limit';
        // @ts-ignore - accessing private method for testing
        const result = formatter.truncate(longString, 20);
        expect(result).toBe('This is a very lo...');
        expect(result.length).toBe(20);
      });

      it('should replace newlines with spaces', () => {
        const stringWithNewlines = 'First line\nSecond line\n\nThird line';
        // @ts-ignore - accessing private method for testing
        const result = formatter.truncate(stringWithNewlines, 100);
        expect(result).toBe('First line Second line Third line');
        expect(result).not.toContain('\n');
      });

      it('should handle empty strings', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.truncate('', 50);
        expect(result).toBe('');
      });

      it('should handle string with only newlines', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.truncate('\n\n\n', 50);
        expect(result).toBe('');
      });

      it('should handle string at exact limit length', () => {
        const exactString = 'exactly20charlong!!';
        expect(exactString.length).toBe(19);
        // @ts-ignore - accessing private method for testing
        const result = formatter.truncate(exactString, 19);
        expect(result).toBe(exactString);
      });
    });

    describe('formatStatus()', () => {
      it('should format PASSED state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('PASSED');
        expect(result).toContain('passed');
        expect(result).toContain('✓');
      });

      it('should format FAILED state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('FAILED');
        expect(result).toContain('failed');
        expect(result).toContain('✖');
      });

      it('should format RUNNING state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('RUNNING');
        expect(result).toContain('running');
        expect(result).toContain('↻');
      });

      it('should format BLOCKED state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('BLOCKED');
        expect(result).toContain('blocked');
        expect(result).toContain('⚠');
      });

      it('should format CANCELED state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('CANCELED');
        expect(result).toContain('canceled');
        expect(result).toContain('−');
      });

      it('should format CANCELLED state (British spelling)', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('CANCELLED');
        expect(result).toContain('canceled');
        expect(result).toContain('−');
      });

      it('should format SKIPPED state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('SKIPPED');
        expect(result).toContain('skipped');
        expect(result).toContain('−');
      });

      it('should format unknown state as lowercase', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('SCHEDULED');
        expect(result).toContain('scheduled');
        expect(result).toContain('−');
      });

      it('should handle lowercase input states', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('passed');
        expect(result).toContain('passed');
        expect(result).toContain('✓');
      });
    });

    describe('formatDate()', () => {
      it('should format recent date as "just now"', () => {
        const recentDate = new Date();
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(recentDate.toISOString());
        expect(result).toBe('just now');
      });

      it('should format date minutes ago', () => {
        const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(date.toISOString());
        expect(result).toBe('5m ago');
      });

      it('should format date hours ago', () => {
        const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(date.toISOString());
        expect(result).toBe('3h ago');
      });

      it('should format date days ago', () => {
        const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(date.toISOString());
        expect(result).toBe('2d ago');
      });

      it('should handle 1 minute ago', () => {
        const date = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(date.toISOString());
        expect(result).toBe('1m ago');
      });

      it('should handle 1 hour ago', () => {
        const date = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(date.toISOString());
        expect(result).toBe('1h ago');
      });

      it('should handle 1 day ago', () => {
        const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDate(date.toISOString());
        expect(result).toBe('1d ago');
      });
    });

    describe('format()', () => {
      it('should format complete pipeline data with builds', () => {
        const data: PipelineDetailData = {
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
        expect(output).toContain('View a build: bktide my-pipeline/<number>');
      });

      it('should handle empty builds array', () => {
        const data: PipelineDetailData = {
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
