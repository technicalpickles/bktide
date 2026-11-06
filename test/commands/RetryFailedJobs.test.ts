import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryFailedJobs, selectRetryableJobs } from '../../src/commands/RetryFailedJobs.js';
import { ApiError } from '../../src/errors/ApiError.js';
import { logger } from '../../src/services/logger.js';

const job = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: 'script', name: id, state: 'failed', ...extra });

describe('selectRetryableJobs', () => {
  it('keeps failed and timed-out command jobs that have not been retried', () => {
    const jobs = [
      job('failed'),
      job('timed-out', { state: 'timed_out' }),
      job('passed', { state: 'passed' }),
      job('soft', { soft_failed: true }),
      job('already', { retried: true }),
      job('canceled', { state: 'canceled' }),
      job('wait', { type: 'waiter' }),
    ];
    expect(selectRetryableJobs(jobs as any).map(j => j.id)).toEqual(['failed', 'timed-out']);
  });
});

describe('RetryFailedJobs', () => {
  let command: RetryFailedJobs;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    command = new RetryFailedJobs({ token: 'test-token' });
    consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    (command as any).initialized = true;
  });

  function mockRest(jobs: any[], retryJob = vi.fn().mockImplementation(async (_org: string, id: string) => job(`${id}-new`, { state: 'scheduled' }))) {
    const rest = {
      getBuild: vi.fn().mockResolvedValue({ state: 'failed', web_url: 'https://buildkite.com/o/p/builds/1', jobs }),
      retryJob,
      invalidateCache: vi.fn().mockResolvedValue(undefined),
    };
    (command as any)._restClient = rest;
    return rest;
  }

  it('retries each retryable job', async () => {
    const rest = mockRest([job('a'), job('b'), job('ok', { state: 'passed' })]);
    expect(await command.execute({ buildArg: 'o/p/1', token: 't' })).toBe(0);
    expect(rest.retryJob.mock.calls.map(c => c[1])).toEqual(['a', 'b']);
  });

  it('--dry-run lists jobs without retrying', async () => {
    const rest = mockRest([job('a')]);
    expect(await command.execute({ buildArg: 'o/p/1', dryRun: true, token: 't' })).toBe(0);
    expect(rest.retryJob).not.toHaveBeenCalled();
    expect(String(consoleSpy.mock.calls[0][0])).toContain('Would retry 1 job');
  });

  it('says so when there is nothing to retry', async () => {
    mockRest([job('ok', { state: 'passed' })]);
    expect(await command.execute({ buildArg: 'o/p/1', token: 't' })).toBe(0);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('No failed jobs to retry in o/p#1');
  });

  it('keeps going after one retry fails, and exits 1', async () => {
    const retryJob = vi.fn()
      .mockRejectedValueOnce(new ApiError('API request failed: Jobs from canceled builds cannot be retried', 422))
      .mockResolvedValueOnce(job('b-new', { state: 'scheduled' }));
    mockRest([job('a'), job('b')], retryJob);
    expect(await command.execute({ buildArg: 'o/p/1', token: 't' })).toBe(1);
    expect(retryJob).toHaveBeenCalledTimes(2);
    const output = String(consoleSpy.mock.calls[0][0]);
    expect(output).toContain('Failed to retry a: Jobs from canceled builds cannot be retried');
    expect(output).toContain('Retried b');
  });

  it('stops at the first role denial and reports it as a permission problem', async () => {
    const retryJob = vi.fn().mockRejectedValue(new ApiError('API request failed: You need the required access level', 403));
    mockRest([job('a'), job('b')], retryJob);
    expect(await command.execute({ buildArg: 'o/p/1', token: 't' })).toBe(1);
    expect(retryJob).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain('your Buildkite role does not allow you to retry jobs in o/p');
  });
});
