// test/formatters/snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { PlainTextFormatter } from '../../src/formatters/snapshot/PlainTextFormatter.js';

describe('Snapshot PlainTextFormatter', () => {
  const formatter = new PlainTextFormatter();

  const mockData = {
    manifest: {
      version: 1,
      buildRef: 'org/pipeline/123',
      url: 'https://buildkite.com/org/pipeline/builds/123',
      fetchedAt: '2025-01-27T10:00:00Z',
      complete: true,
      build: { status: 'PASSED' },
      steps: [{ id: '01-test', jobId: 'job1', status: 'success' as const }],
    },
    build: {
      state: 'PASSED',
      number: 123,
      message: 'Fix authentication bug',
      branch: 'main',
      commit: 'abc1234567890',
      createdAt: '2025-01-27T09:55:00Z',
      startedAt: '2025-01-27T10:00:00Z',
      finishedAt: '2025-01-27T10:02:30Z',
      createdBy: { name: 'Josh' },
    },
    outputDir: '/home/user/.bktide/snapshots/org/pipeline/123',
    scriptJobs: [{ exitStatus: '0', state: 'FINISHED' }],
    stepResults: [{ id: '01-test', jobId: 'job1', status: 'success' as const }],
    fetchAll: false,
  };

  it('includes build status and message', () => {
    const output = formatter.formatSnapshot(mockData);
    expect(output).toContain('PASSED');
    expect(output).toContain('Fix authentication bug');
  });

  it('includes output directory path', () => {
    const output = formatter.formatSnapshot(mockData);
    expect(output).toContain('/home/user/.bktide/snapshots/org/pipeline/123');
  });

  it('includes step count', () => {
    const output = formatter.formatSnapshot(mockData);
    expect(output).toContain('1 step');
  });

  it('shows tip about --all when not fetching all', () => {
    const data = { ...mockData, fetchAll: false, scriptJobs: [{}, {}] };
    const output = formatter.formatSnapshot(data);
    expect(output).toContain('--all');
  });

  it('hides tips when options.tips is false', () => {
    const data = { ...mockData, fetchAll: false, scriptJobs: [{}, {}] };
    const output = formatter.formatSnapshot(data, { tips: false });
    expect(output).not.toContain('--all');
  });

  describe('navigation tips', () => {
    const failedBuildData = {
      ...mockData,
      build: { ...mockData.build, state: 'FAILED' },
      scriptJobs: [
        { name: 'test', exitStatus: '1', state: 'FAILED' },
      ],
      stepResults: [{ id: '01-test', jobId: 'job1', status: 'success' as const }],
      annotationResult: { fetchStatus: 'success' as const, count: 2 },
    };

    it('shows jq commands for failed builds', () => {
      const output = formatter.formatSnapshot(failedBuildData);
      expect(output).toContain('Next steps:');
      expect(output).toContain('jq');
      expect(output).toContain('manifest.json');
    });

    it('shows annotation tip when annotations exist', () => {
      const output = formatter.formatSnapshot(failedBuildData);
      expect(output).toContain('annotations.json');
    });

    it('shows grep command for searching errors', () => {
      const output = formatter.formatSnapshot(failedBuildData);
      expect(output).toContain('grep');
      expect(output).toContain('Error');
    });

    it('hides navigation tips when tips option is false', () => {
      const output = formatter.formatSnapshot(failedBuildData, { tips: false });
      expect(output).not.toContain('Next steps:');
    });

    it('shows --no-tips hint', () => {
      const output = formatter.formatSnapshot(failedBuildData);
      expect(output).toContain('--no-tips');
    });
  });
});
