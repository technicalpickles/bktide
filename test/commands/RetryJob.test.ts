import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryJob } from '../../src/commands/RetryJob.js';
import { ApiError } from '../../src/errors/ApiError.js';
import { logger } from '../../src/services/logger.js';
import * as buildPollerModule from '../../src/services/BuildPoller.js';

const OLD = '0190046e-e199-453b-a302-a21a4d649d31';
const NEW = '0190046e-ffff-453b-a302-a21a4d649d31';
const retried = {
  id: NEW, type: 'script', name: 'lint', state: 'scheduled',
  build_url: 'https://buildkite.com/acme/infra/builds/4242',
  web_url: `https://buildkite.com/acme/infra/builds/4242#${NEW}`,
};

describe('RetryJob', () => {
  let command: RetryJob;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    command = new RetryJob({ token: 'test-token' });
    consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    (command as any).initialized = true;
  });

  function mockRest(overrides: Record<string, unknown> = {}) {
    const rest = {
      retryJob: vi.fn().mockResolvedValue(retried),
      invalidateCache: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    (command as any)._restClient = rest;
    return rest;
  }

  it('retries the job named in a build URL fragment', async () => {
    const rest = mockRest();
    const exit = await command.execute({ jobArg: `https://buildkite.com/acme/infra/builds/4242#${OLD}`, token: 't' });
    expect(exit).toBe(0);
    expect(rest.retryJob).toHaveBeenCalledWith('acme', OLD);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('Retried lint');
  });

  it('uses --org for a bare UUID', async () => {
    const rest = mockRest();
    const exit = await command.execute({ jobArg: OLD, org: 'acme', token: 't' });
    expect(exit).toBe(0);
    expect(rest.retryJob).toHaveBeenCalledWith('acme', OLD);
  });

  it('uses the only org when a bare UUID has no --org', async () => {
    const rest = mockRest();
    (command as any)._client = { getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['acme']) };
    expect(await command.execute({ jobArg: OLD, token: 't' })).toBe(0);
    expect(rest.retryJob).toHaveBeenCalledWith('acme', OLD);
  });

  it('refuses to guess between multiple orgs', async () => {
    const rest = mockRest();
    (command as any)._client = { getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['a', 'b']) };
    expect(await command.execute({ jobArg: OLD, token: 't' })).toBe(1);
    expect(rest.retryJob).not.toHaveBeenCalled();
  });

  it('reports a 403 role denial as a permission problem', async () => {
    mockRest({ retryJob: vi.fn().mockRejectedValue(new ApiError('API request failed: You need the required access level', 403)) });
    const exit = await command.execute({ jobArg: `acme/infra/4242#${OLD}`, token: 't' });
    expect(exit).toBe(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('your Buildkite role does not allow you to retry jobs in acme');
  });

  it('with --watch, follows the new job and exits by its state', async () => {
    const rest = mockRest();
    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(((_client: any, callbacks: any) => ({
      stop: vi.fn(),
      watch: vi.fn().mockImplementation(async () => {
        callbacks.onJobStateChange({ job: { ...retried, state: 'running' }, previousState: null, timestamp: new Date() });
        callbacks.onJobStateChange({ job: { ...retried, state: 'passed' }, previousState: 'running', timestamp: new Date() });
        return { state: 'passed', jobs: [] };
      }),
    })) as any);

    const exit = await command.execute({ jobArg: OLD, org: 'acme', watch: true, token: 't' });
    expect(rest.invalidateCache).toHaveBeenCalledWith('builds');
    expect(buildPollerModule.BuildPoller).toHaveBeenCalled();
    expect(exit).toBe(0);
  });

  it('with --watch, exits 1 when the new job fails', async () => {
    mockRest();
    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation((() => ({
      stop: vi.fn(),
      watch: vi.fn().mockResolvedValue({ state: 'failed', jobs: [{ ...retried, state: 'failed' }] }),
    })) as any);

    expect(await command.execute({ jobArg: `acme/infra/4242#${OLD}`, watch: true, token: 't' })).toBe(1);
  });
});
