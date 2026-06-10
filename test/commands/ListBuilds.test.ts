import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListBuilds } from '../../src/commands/ListBuilds.js';
import { logger } from '../../src/services/logger.js';

describe('ListBuilds Command', () => {
  let command: ListBuilds;
  let stderrOutput: string[];

  beforeEach(() => {
    command = new ListBuilds();
    stderrOutput = [];
    // Mock logger to capture output
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    // Capture stderr writes
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput.push(chunk.toString());
      return true;
    });
  });

  describe('validation', () => {
    it('rejects invalid state values with helpful message', async () => {
      // Set token so it doesn't throw "no token" error
      command['token'] = 'test-token';

      const result = await command.execute({
        state: 'badstate',
        org: 'gesso',
        token: 'test-token',
      });

      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('Invalid state');
      expect(output).toContain('running');
    });

    it('rejects an unparseable --created-from with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: 'not-a-date',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('Invalid date');
      expect(output).toContain('--created-from');
    });

    it('rejects a date range without a pipeline with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        createdFrom: '2025-10-20',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('--pipeline');
    });
  });
});
