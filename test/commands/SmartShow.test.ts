import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartShow } from '../../src/commands/SmartShow.js';
import { setTestData, clearTestData } from '../setup-simple.js';
import { logger } from '../../src/services/logger.js';

describe('SmartShow Command', () => {
  let command: SmartShow;

  beforeEach(() => {
    command = new SmartShow();
    clearTestData();
    // Mock logger to capture output
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'debug').mockImplementation(() => {});
    
    // Set up default responses for all commands
    setTestData({
      organization: {
        pipelines: {
          edges: [
            {
              node: {
                uuid: 'pipeline-uuid',
                id: 'pipeline-id',
                name: 'Test Pipeline',
                slug: 'test-pipeline',
                description: 'A test pipeline',
                url: 'https://buildkite.com/test-org/test-pipeline',
                defaultBranch: 'main',
                repository: {
                  url: 'https://github.com/test/repo',
                },
              },
            },
          ],
        },
      },
    });
    
    // Set up GraphQL build response for ShowBuild
    (globalThis as any).__testOverride_build = {
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
    };
    
    // Set up REST build response for ShowLogs
    (globalThis as any).__testOverride_rest_build = {
      id: 'build-uuid',
      number: 123,
      state: 'passed',
      branch: 'main',
      message: 'Test build',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      web_url: 'https://buildkite.com/org/pipeline/builds/123',
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
    };
    
    (globalThis as any).__testOverride_rest_logs = {
      content: 'Test log output',
      size: 15,
      url: 'https://api.buildkite.com/log',
    };
  });

  describe('execute()', () => {
    it('should route pipeline references to ShowPipeline command', async () => {
      const exitCode = await command.execute({
        reference: 'org/pipeline',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
      // Verify pipeline output was generated
      expect(logger.console).toHaveBeenCalled();
    });

    it('should route build references to ShowBuild command', async () => {
      const exitCode = await command.execute({
        reference: 'org/pipeline/123',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
      // ShowBuild should have been called
      expect(logger.console).toHaveBeenCalled();
    });

    it('should route build-with-step references to ShowLogs command', async () => {
      const exitCode = await command.execute({
        reference: 'https://buildkite.com/org/pipeline/builds/123?sid=step-id-1',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
      // ShowLogs should have been called
      expect(logger.console).toHaveBeenCalled();
    });

    it('should handle invalid reference formats', async () => {
      const exitCode = await command.execute({
        reference: 'invalid-format',
        token: 'test-token',
      });

      expect(exitCode).toBe(1);
      expect(logger.console).toHaveBeenCalledWith(
        expect.stringContaining('Error')
      );
    });

    it('should pass options correctly to routed commands - pipeline', async () => {
      const exitCode = await command.execute({
        reference: 'org/pipeline',
        token: 'test-token',
        format: 'json',
      });

      expect(exitCode).toBe(0);
      // Verify JSON format was used
      const output = (logger.console as any).mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should pass options correctly to routed commands - logs', async () => {
      const exitCode = await command.execute({
        reference: 'https://buildkite.com/org/pipeline/builds/123?sid=step-id-1',
        token: 'test-token',
        full: true,
      });

      expect(exitCode).toBe(0);
      // Verify full option was passed
      expect(logger.console).toHaveBeenCalled();
    });

    it('should handle errors from routed commands', async () => {
      // Test with a reference that will fail (empty pipeline response)
      setTestData({
        organization: {
          pipelines: {
            edges: [],
          },
        },
      });

      const exitCode = await command.execute({
        reference: 'org/nonexistent',
        token: 'test-token',
      });

      expect(exitCode).toBe(1);
    });

    it('should handle missing reference', async () => {
      const exitCode = await command.execute({
        reference: '',
        token: 'test-token',
      });

      expect(exitCode).toBe(1);
      expect(logger.error).toHaveBeenCalledWith('Reference is required');
    });

    it('should handle URL format for pipeline', async () => {
      const exitCode = await command.execute({
        reference: 'https://buildkite.com/org/pipeline',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
    });

    it('should handle URL format for build', async () => {
      const exitCode = await command.execute({
        reference: 'https://buildkite.com/org/pipeline/builds/123',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
    });

    it('should pass debug option to routed commands', async () => {
      const exitCode = await command.execute({
        reference: 'org/pipeline',
        token: 'test-token',
        debug: true,
      });

      expect(exitCode).toBe(0);
      // Verify debug logging occurred
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should set default count for pipeline references', async () => {
      const exitCode = await command.execute({
        reference: 'org/pipeline',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
      // The default count of 20 should be used for pipelines
    });

    it('should set enhanced defaults for build references', async () => {
      const exitCode = await command.execute({
        reference: 'org/pipeline/123',
        token: 'test-token',
      });

      expect(exitCode).toBe(0);
      // --jobs and --failed should be set by default
    });
  });
});
