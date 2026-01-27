// test/utils/jobStats.test.ts
import { describe, it, expect } from 'vitest';
import { calculateJobStats, JobStats } from '../../src/utils/jobStats.js';

describe('calculateJobStats', () => {
  it('counts passed jobs by exit status 0', () => {
    const jobs = [
      { exitStatus: '0', state: 'FINISHED' },
      { exitStatus: '0', state: 'FINISHED' },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.passed).toBe(2);
    expect(stats.total).toBe(2);
  });

  it('counts hard failed jobs (non-zero exit, not soft failed)', () => {
    const jobs = [
      { exitStatus: '1', state: 'FAILED', softFailed: false },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(0);
  });

  it('counts soft failed jobs separately', () => {
    const jobs = [
      { exitStatus: '1', state: 'FAILED', softFailed: true },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.failed).toBe(0);
    expect(stats.softFailed).toBe(1);
  });

  it('counts running jobs', () => {
    const jobs = [
      { state: 'RUNNING' },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.running).toBe(1);
  });

  it('handles mixed job states', () => {
    const jobs = [
      { exitStatus: '0', state: 'FINISHED' },
      { exitStatus: '1', state: 'FAILED', softFailed: false },
      { exitStatus: '1', state: 'FAILED', softFailed: true },
      { state: 'RUNNING' },
      { state: 'SCHEDULED' },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.total).toBe(5);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(1);
    expect(stats.running).toBe(1);
    expect(stats.queued).toBe(1);
  });
});
