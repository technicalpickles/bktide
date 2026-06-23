import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShowBuild } from '../../src/commands/ShowBuild.js';
import { logger } from '../../src/services/logger.js';

describe('ShowBuild Command', () => {
  let command: ShowBuild;

  beforeEach(() => {
    command = new ShowBuild();
    // Mock logger to capture output
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  describe('error handling', () => {
    it('handles null build response gracefully', async () => {
      // Mock the client to return null for build
      // This simulates when getBuildSummary returns { build: null }
      const mockClient = {
        getBuildSummary: vi.fn().mockResolvedValue({ build: null }),
        getBuildSummaryWithAllJobs: vi.fn().mockResolvedValue({ build: null }),
      };

      // Override the private _client property
      command['_client'] = mockClient as any;
      // Set token so it doesn't throw
      command['token'] = 'test-token';
      // Mark as initialized
      command['initialized'] = true;

      const result = await command.execute({
        buildArg: 'gesso/fake/999',
        token: 'test-token',
      });

      expect(result).toBe(1);
      // Should output error through formatter, not throw JS error
      expect(logger.console).toHaveBeenCalled();
      // Error message should be user-friendly, not a JS error
      const errorCall = (logger.console as any).mock.calls[0][0];
      expect(errorCall).toContain('Build not found');
    });
  });
});
