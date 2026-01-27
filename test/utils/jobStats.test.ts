// test/utils/jobStats.test.ts
import { describe, it, expect } from 'vitest';
import { calculateJobStats, formatJobStatsSummary, JobStats } from '../../src/utils/jobStats.js';

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

describe('formatJobStatsSummary', () => {
  it('formats stats as readable summary', () => {
    const stats = {
      total: 5,
      passed: 3,
      failed: 1,
      softFailed: 1,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
    };
    const summary = formatJobStatsSummary(stats);
    expect(summary).toContain('5 steps:');
    expect(summary).toContain('3 passed');
    expect(summary).toContain('1 failed');
    expect(summary).toContain('1 soft failure');
  });

  it('omits zero counts', () => {
    const stats = {
      total: 2,
      passed: 2,
      failed: 0,
      softFailed: 0,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
    };
    const summary = formatJobStatsSummary(stats);
    expect(summary).toContain('2 passed');
    expect(summary).not.toContain('failed');
  });

  it('handles singular/plural correctly', () => {
    const stats = {
      total: 1,
      passed: 1,
      failed: 0,
      softFailed: 0,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
    };
    const summary = formatJobStatsSummary(stats);
    expect(summary).toContain('1 step:');
    expect(summary).not.toContain('steps');
  });
});
