import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateBuild } from '../../src/commands/CreateBuild.js';
import { logger } from '../../src/services/logger.js';

describe('CreateBuild — explicit pipeline', () => {
  let command: CreateBuild;
  let consoleOutput: string[];

  beforeEach(() => {
    command = new CreateBuild({ token: 'test-token' });
    consoleOutput = [];
    vi.spyOn(logger, 'console').mockImplementation((msg: string) => {
      consoleOutput.push(msg);
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('calls createBuild with provided flags and prints the result', async () => {
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 4567,
        state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4567',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: ['DEBUG=1', 'NODE_ENV=production'],
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.createBuild).toHaveBeenCalledWith('gusto', 'zp', {
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: { DEBUG: '1', NODE_ENV: 'production' },
    });
    expect(consoleOutput.join('\n')).toContain('#4567');
  });

  it('returns 1 when --env is malformed', async () => {
    const mockRest = { createBuild: vi.fn() };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      commit: 'abc',
      branch: 'main',
      env: ['BAD_ENTRY'],
      token: 'test-token',
    });

    expect(exit).toBe(1);
    expect(mockRest.createBuild).not.toHaveBeenCalled();
  });
});
