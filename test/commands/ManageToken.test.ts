import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManageToken } from '../../src/commands/ManageToken.js';

describe('ManageToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLAUDECODE;
    delete process.env.BUILDKITE_API_TOKEN;
    delete process.env.BK_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('agent environment', () => {
    it('should not prompt when CLAUDECODE is set and no --token provided', async () => {
      process.env.CLAUDECODE = '1';

      const command = new ManageToken();
      const exitCode = await command.execute({ store: true });

      // Should fail (can't store interactively from agent)
      expect(exitCode).toBe(1);
    });

    it('should show store guidance when CLAUDECODE is set', async () => {
      process.env.CLAUDECODE = '1';

      // Capture logger.console output
      const { logger } = await import('../../src/services/logger.js');
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});

      const command = new ManageToken();
      await command.execute({ store: true });

      // Should have printed guidance mentioning terminal and keychain
      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('their terminal');
      expect(output).toContain('keychain');
      expect(output).toContain('bktide token --store');

      consoleSpy.mockRestore();
    });

    it('should bypass agent check when --token is provided', async () => {
      process.env.CLAUDECODE = '1';

      // With --token flag, it should attempt validation (not show agent guidance)
      // The token is fake so validation will fail, but the point is it
      // didn't short-circuit with agent guidance
      const { logger } = await import('../../src/services/logger.js');
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});

      const command = new ManageToken({ token: 'bkua_fake_token_for_testing' });
      await command.execute({ store: true, token: 'bkua_fake_token_for_testing' });

      const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      // Should NOT contain agent guidance
      expect(output).not.toContain('their terminal');
      expect(output).not.toContain('## Token Setup Required');

      consoleSpy.mockRestore();
    });
  });
});
