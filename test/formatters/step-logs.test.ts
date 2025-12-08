import { describe, it, expect, beforeEach } from 'vitest';
import { PlainStepLogsFormatter } from '../../src/formatters/step-logs/PlainFormatter.js';
import { JsonStepLogsFormatter } from '../../src/formatters/step-logs/JsonFormatter.js';
import { StepLogsData } from '../../src/formatters/step-logs/Formatter.js';

describe('Step Logs Formatters', () => {
  describe('PlainStepLogsFormatter', () => {
    let formatter: PlainStepLogsFormatter;

    beforeEach(() => {
      formatter = new PlainStepLogsFormatter({});
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

      it('should return "unknown" for null state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus(null);
        expect(result).toContain('unknown');
      });

      it('should return "unknown" for undefined state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus(undefined);
        expect(result).toContain('unknown');
      });

      it('should return "unknown" for empty string state', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('');
        expect(result).toContain('unknown');
      });

      it('should handle lowercase input states', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('passed');
        expect(result).toContain('passed');
        expect(result).toContain('✓');
      });

      it('should return unknown state as lowercase', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatStatus('SCHEDULED');
        expect(result).toBe('scheduled');
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
    });

    describe('formatDuration()', () => {
      it('should format seconds only', () => {
        const start = '2024-01-01T10:00:00Z';
        const end = '2024-01-01T10:00:45Z'; // 45 seconds later
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDuration(start, end);
        expect(result).toBe('45s');
      });

      it('should format minutes and seconds', () => {
        const start = '2024-01-01T10:00:00Z';
        const end = '2024-01-01T10:05:30Z'; // 5 minutes 30 seconds later
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDuration(start, end);
        expect(result).toBe('5m 30s');
      });

      it('should format exactly 1 minute', () => {
        const start = '2024-01-01T10:00:00Z';
        const end = '2024-01-01T10:01:00Z'; // 1 minute later
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDuration(start, end);
        expect(result).toBe('1m 0s');
      });

      it('should format many minutes with seconds', () => {
        const start = '2024-01-01T10:00:00Z';
        const end = '2024-01-01T10:25:15Z'; // 25 minutes 15 seconds later
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDuration(start, end);
        expect(result).toBe('25m 15s');
      });

      it('should handle zero duration', () => {
        const time = '2024-01-01T10:00:00Z';
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatDuration(time, time);
        expect(result).toBe('0s');
      });
    });

    describe('formatSize()', () => {
      it('should format bytes', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(500);
        expect(result).toBe('500 B');
      });

      it('should format kilobytes', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(5000);
        expect(result).toBe('4.9 KB');
      });

      it('should format megabytes', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(5000000);
        expect(result).toBe('4.8 MB');
      });

      it('should handle exactly 1 KB', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(1024);
        expect(result).toBe('1.0 KB');
      });

      it('should handle exactly 1 MB', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(1024 * 1024);
        expect(result).toBe('1.0 MB');
      });

      it('should handle zero bytes', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(0);
        expect(result).toBe('0 B');
      });

      it('should stay in bytes below 1 KB', () => {
        // @ts-ignore - accessing private method for testing
        const result = formatter.formatSize(1023);
        expect(result).toBe('1023 B');
      });
    });

    describe('format()', () => {
      it('should format full output with build, step, and logs data', () => {
        const data: StepLogsData = {
          build: {
            org: 'my-org',
            pipeline: 'my-pipeline',
            number: 123,
            state: 'PASSED',
            startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
            finishedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 min ago
            url: 'https://buildkite.com/my-org/my-pipeline/builds/123',
          },
          step: {
            id: 'step-123',
            label: ':rspec: Run Tests',
            state: 'PASSED',
            exitStatus: 0,
            startedAt: '2024-01-01T10:00:00Z',
            finishedAt: '2024-01-01T10:05:30Z',
          },
          logs: {
            content: 'Running tests...\nAll tests passed!',
            size: 5000,
            totalLines: 100,
            displayedLines: 50,
            startLine: 50,
          },
        };

        const output = formatter.format(data);

        expect(output).toContain('Build: my-org/my-pipeline #123');
        expect(output).toContain('passed');
        expect(output).toContain('Step: :rspec: Run Tests');
        expect(output).toContain('Job ID: step-123');
        expect(output).toContain('Exit Status: 0');
        expect(output).toContain('Running tests...');
        expect(output).toContain('All tests passed!');
        expect(output).toContain('Logs (last 50 lines of 100)');
      });

      it('should show tips when logs are truncated', () => {
        const data: StepLogsData = {
          build: {
            org: 'org',
            pipeline: 'pipeline',
            number: 1,
            state: 'PASSED',
            url: 'https://buildkite.com/org/pipeline/builds/1',
          },
          step: {
            id: 'step-1',
            state: 'PASSED',
          },
          logs: {
            content: 'Log content',
            size: 1024 * 1024, // 1 MB
            totalLines: 1000,
            displayedLines: 100,
            startLine: 900,
          },
        };

        const output = formatter.format(data);

        expect(output).toContain('Log is 1.0 MB');
        expect(output).toContain('Showing last 100 lines');
        expect(output).toContain('--full');
        expect(output).toContain('--save');
      });

      it('should not show tips when all logs are displayed', () => {
        const data: StepLogsData = {
          build: {
            org: 'org',
            pipeline: 'pipeline',
            number: 1,
            state: 'PASSED',
            url: 'https://buildkite.com/org/pipeline/builds/1',
          },
          step: {
            id: 'step-1',
            state: 'PASSED',
          },
          logs: {
            content: 'Short log',
            size: 100,
            totalLines: 10,
            displayedLines: 10, // All displayed
            startLine: 0,
          },
        };

        const output = formatter.format(data);

        expect(output).not.toContain('--full');
        expect(output).not.toContain('--save');
      });

      it('should handle unnamed steps', () => {
        const data: StepLogsData = {
          build: {
            org: 'org',
            pipeline: 'pipeline',
            number: 1,
            state: 'RUNNING',
            url: 'https://buildkite.com/org/pipeline/builds/1',
          },
          step: {
            id: 'step-1',
            state: 'RUNNING',
            // No label
          },
          logs: {
            content: 'Log content',
            size: 100,
            totalLines: 10,
            displayedLines: 10,
            startLine: 0,
          },
        };

        const output = formatter.format(data);

        expect(output).toContain('Step: Unnamed Step');
      });

      it('should handle missing optional build fields', () => {
        const data: StepLogsData = {
          build: {
            org: 'org',
            pipeline: 'pipeline',
            number: 1,
            state: 'SCHEDULED',
            url: 'https://buildkite.com/org/pipeline/builds/1',
            // No startedAt or finishedAt
          },
          step: {
            id: 'step-1',
            state: 'SCHEDULED',
            // No exitStatus
          },
          logs: {
            content: '',
            size: 0,
            totalLines: 0,
            displayedLines: 0,
            startLine: 0,
          },
        };

        const output = formatter.format(data);

        expect(output).toContain('Build: org/pipeline #1');
        expect(output).not.toContain('Started:');
        expect(output).not.toContain('Duration:');
        expect(output).not.toContain('Exit Status:');
      });

      it('should show duration when both startedAt and finishedAt are present', () => {
        const data: StepLogsData = {
          build: {
            org: 'org',
            pipeline: 'pipeline',
            number: 1,
            state: 'PASSED',
            startedAt: '2024-01-01T10:00:00Z',
            finishedAt: '2024-01-01T10:05:30Z',
            url: 'https://buildkite.com/org/pipeline/builds/1',
          },
          step: {
            id: 'step-1',
            state: 'PASSED',
          },
          logs: {
            content: 'Done',
            size: 4,
            totalLines: 1,
            displayedLines: 1,
            startLine: 0,
          },
        };

        const output = formatter.format(data);

        expect(output).toContain('Duration: 5m 30s');
      });
    });
  });

  describe('JsonStepLogsFormatter', () => {
    let formatter: JsonStepLogsFormatter;

    beforeEach(() => {
      formatter = new JsonStepLogsFormatter({});
    });

    it('should return valid JSON', () => {
      const data: StepLogsData = {
        build: {
          org: 'my-org',
          pipeline: 'my-pipeline',
          number: 123,
          state: 'PASSED',
          url: 'https://buildkite.com/my-org/my-pipeline/builds/123',
        },
        step: {
          id: 'step-123',
          label: 'Run Tests',
          state: 'PASSED',
        },
        logs: {
          content: 'Log content here',
          size: 1000,
          totalLines: 50,
          displayedLines: 50,
          startLine: 0,
        },
      };

      const output = formatter.format(data);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual(data);
    });

    it('should contain all expected fields', () => {
      const data: StepLogsData = {
        build: {
          org: 'org',
          pipeline: 'pipeline',
          number: 100,
          state: 'FAILED',
          startedAt: '2024-01-01T10:00:00Z',
          finishedAt: '2024-01-01T10:30:00Z',
          url: 'https://buildkite.com/org/pipeline/builds/100',
        },
        step: {
          id: 'step-abc',
          label: 'My Step',
          state: 'FAILED',
          exitStatus: 1,
          startedAt: '2024-01-01T10:00:00Z',
          finishedAt: '2024-01-01T10:30:00Z',
        },
        logs: {
          content: 'Error: Test failed',
          size: 2048,
          totalLines: 200,
          displayedLines: 100,
          startLine: 100,
        },
      };

      const output = formatter.format(data);
      const parsed = JSON.parse(output);

      // Build fields
      expect(parsed.build.org).toBe('org');
      expect(parsed.build.pipeline).toBe('pipeline');
      expect(parsed.build.number).toBe(100);
      expect(parsed.build.state).toBe('FAILED');
      expect(parsed.build.startedAt).toBe('2024-01-01T10:00:00Z');
      expect(parsed.build.finishedAt).toBe('2024-01-01T10:30:00Z');
      expect(parsed.build.url).toBe('https://buildkite.com/org/pipeline/builds/100');

      // Step fields
      expect(parsed.step.id).toBe('step-abc');
      expect(parsed.step.label).toBe('My Step');
      expect(parsed.step.state).toBe('FAILED');
      expect(parsed.step.exitStatus).toBe(1);
      expect(parsed.step.startedAt).toBe('2024-01-01T10:00:00Z');
      expect(parsed.step.finishedAt).toBe('2024-01-01T10:30:00Z');

      // Logs fields
      expect(parsed.logs.content).toBe('Error: Test failed');
      expect(parsed.logs.size).toBe(2048);
      expect(parsed.logs.totalLines).toBe(200);
      expect(parsed.logs.displayedLines).toBe(100);
      expect(parsed.logs.startLine).toBe(100);
    });

    it('should handle minimal data', () => {
      const data: StepLogsData = {
        build: {
          org: 'org',
          pipeline: 'pipeline',
          number: 1,
          state: 'SCHEDULED',
          url: 'https://buildkite.com/org/pipeline/builds/1',
        },
        step: {
          id: 'step-1',
          state: 'SCHEDULED',
        },
        logs: {
          content: '',
          size: 0,
          totalLines: 0,
          displayedLines: 0,
          startLine: 0,
        },
      };

      const output = formatter.format(data);
      const parsed = JSON.parse(output);

      expect(parsed.build).toBeDefined();
      expect(parsed.step).toBeDefined();
      expect(parsed.logs).toBeDefined();
    });
  });
});
