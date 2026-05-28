import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateBuild } from '../../src/commands/CreateBuild.js';
import { logger } from '../../src/services/logger.js';
import * as gitContext from '../../src/utils/gitContext.js';
import * as buildPollerModule from '../../src/services/BuildPoller.js';

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

describe('CreateBuild — git auto-detect', () => {
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

  it('uses git context when commit/branch/message omitted', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'feature/foo',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });
    vi.spyOn(gitContext, 'getHeadCommit').mockReturnValue('abc123');
    vi.spyOn(gitContext, 'getHeadCommitMessage').mockReturnValue('Fix it');

    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 1, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/1',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.createBuild).toHaveBeenCalledWith('gusto', 'zp', {
      commit: 'abc123',
      branch: 'feature/foo',
      message: 'Fix it',
    });
  });

  it('auto-detects pipeline when ref is omitted and single match', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'main',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });
    vi.spyOn(gitContext, 'getHeadCommit').mockReturnValue('abc');
    vi.spyOn(gitContext, 'getHeadCommitMessage').mockReturnValue('msg');

    const mockGql = {
      getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['gusto']),
      getPipelinesForRepo: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'ZP', slug: 'zp', repository: { url: 'git@github.com:gusto/zp.git' } },
      ]),
    };
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 1, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/1',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._client = mockGql;
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({ token: 'test-token' });

    expect(exit).toBe(0);
    expect(mockRest.createBuild).toHaveBeenCalledWith('gusto', 'zp', expect.any(Object));
  });

  it('bails with the candidate list when multiple pipelines match', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'main',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });

    const mockGql = {
      getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['gusto']),
      getPipelinesForRepo: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Main', slug: 'main', repository: { url: 'x' } },
        { id: 'p2', name: 'Nightly', slug: 'nightly', repository: { url: 'x' } },
      ]),
    };
    const mockRest = { createBuild: vi.fn() };
    (command as any)._client = mockGql;
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const errorSpy = vi.spyOn(logger, 'error');

    const exit = await command.execute({ token: 'test-token' });

    expect(exit).toBe(1);
    expect(mockRest.createBuild).not.toHaveBeenCalled();
    const errorOutput = errorSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(errorOutput).toContain('gusto/main');
    expect(errorOutput).toContain('gusto/nightly');
  });

  it('bails when no pipelines match the repo', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'main',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });

    const mockGql = {
      getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['gusto']),
      getPipelinesForRepo: vi.fn().mockResolvedValue([]),
    };
    (command as any)._client = mockGql;
    (command as any)._restClient = { createBuild: vi.fn() };
    (command as any).initialized = true;

    const exit = await command.execute({ token: 'test-token' });
    expect(exit).toBe(1);
  });
});

describe('CreateBuild — --watch', () => {
  let command: CreateBuild;
  beforeEach(() => {
    command = new CreateBuild({ token: 'test-token' });
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('hands the new build off to BuildPoller when --watch is set', async () => {
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

    const watchMock = vi.fn().mockResolvedValue({ state: 'passed' });
    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(() => ({
      watch: watchMock,
    } as any));

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      commit: 'abc', branch: 'main',
      watch: true,
      token: 'test-token',
    });

    expect(watchMock).toHaveBeenCalledWith({ org: 'gusto', pipeline: 'zp', buildNumber: 4567 });
    expect(exit).toBe(0);
  });

  it('returns 1 when the watched build does not pass', async () => {
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 1, state: 'scheduled',
        web_url: 'https://buildkite.com/o/p/builds/1',
        pipeline: { slug: 'p' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(() => ({
      watch: vi.fn().mockResolvedValue({ state: 'failed' }),
    } as any));

    const exit = await command.execute({
      pipelineRef: 'o/p',
      commit: 'abc', branch: 'main',
      watch: true,
      token: 'test-token',
    });

    expect(exit).toBe(1);
  });
});
