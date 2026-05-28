import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RebuildBuild } from '../../src/commands/RebuildBuild.js';
import { logger } from '../../src/services/logger.js';
import * as buildPollerModule from '../../src/services/BuildPoller.js';

describe('RebuildBuild', () => {
  let command: RebuildBuild;

  beforeEach(() => {
    command = new RebuildBuild({ token: 'test-token' });
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('parses org/pipeline/number and rebuilds', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockResolvedValue({
        number: 4568, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4568',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      buildArg: 'gusto/zp/4567',
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.rebuildBuild).toHaveBeenCalledWith('gusto', 'zp', 4567);
  });

  it('parses a full Buildkite URL', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockResolvedValue({
        number: 4568, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4568',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      buildArg: 'https://buildkite.com/gusto/zp/builds/4567',
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.rebuildBuild).toHaveBeenCalledWith('gusto', 'zp', 4567);
  });

  it('returns 1 on API error', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockRejectedValue(new Error('Build not found')),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      buildArg: 'o/p/999',
      token: 'test-token',
    });

    expect(exit).toBe(1);
  });

  it('hands off to BuildPoller with --watch', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockResolvedValue({
        number: 4568, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4568',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const watchMock = vi.fn().mockResolvedValue({ state: 'passed' });
    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(() => ({
      watch: watchMock,
    } as any));

    const exit = await command.execute({
      buildArg: 'gusto/zp/4567',
      watch: true,
      token: 'test-token',
    });

    expect(watchMock).toHaveBeenCalledWith({ org: 'gusto', pipeline: 'zp', buildNumber: 4568 });
    expect(exit).toBe(0);
  });
});
