import { describe, it, expect } from 'vitest';
import { calculateJobStats, isFailedJob } from '../../src/utils/jobStats.js';

describe('calculateJobStats', () => {
  it('counts passed, failed, and soft-failed jobs by exit status', () => {
    const jobs = [
      { exitStatus: '0' },
      { exitStatus: '1', softFailed: false },
      { exitStatus: '1', softFailed: true },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(1);
    expect(stats.completed).toBe(3);
  });

  it('counts running and blocked jobs without an exit status', () => {
    const jobs = [{ state: 'RUNNING' }, { state: 'BLOCKED' }];
    const stats = calculateJobStats(jobs);
    expect(stats.running).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.completed).toBe(0);
  });

  it('falls back to the passed field for FINISHED jobs with no exit status', () => {
    const jobs = [
      { state: 'FINISHED', passed: true },
      { state: 'FINISHED', passed: false, softFailed: true },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.passed).toBe(1);
    expect(stats.softFailed).toBe(1);
  });

  it('returns all-zero stats for an empty list', () => {
    expect(calculateJobStats([])).toEqual({
      total: 0, passed: 0, failed: 0, softFailed: 0, running: 0,
      blocked: 0, skipped: 0, canceled: 0, queued: 0, completed: 0,
    });
  });
});

describe('isFailedJob', () => {
  it('treats a non-zero exit status as failed regardless of soft-failed', () => {
    expect(isFailedJob({ exitStatus: '1' })).toBe(true);
    expect(isFailedJob({ exitStatus: '1', softFailed: true })).toBe(true);
  });

  it('treats a zero exit status as not failed', () => {
    expect(isFailedJob({ exitStatus: '0' })).toBe(false);
  });

  it('falls back to state and passed when there is no exit status', () => {
    expect(isFailedJob({ state: 'FAILED' })).toBe(true);
    expect(isFailedJob({ state: 'TIMED_OUT' })).toBe(true);
    expect(isFailedJob({ passed: false })).toBe(true);
    expect(isFailedJob({ state: 'PASSED', passed: true })).toBe(false);
  });
});
