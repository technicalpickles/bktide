import { describe, it, expect } from 'vitest';
import { getSnapshotFormatter } from '../../src/formatters/snapshot/index.js';
import { SnapshotFormatterInput } from '../../src/formatters/snapshot/Formatter.js';

const build = {
  state: 'FAILED',
  number: 42,
  message: 'Fix the thing',
  branch: 'main',
  commit: 'abcdef1234',
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: '2026-01-01T00:05:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: { name: 'Josh' },
};

const scriptJobs = [
  { id: 'job-1', name: 'build', state: 'PASSED', exitStatus: '0' },
  { id: 'job-2', name: 'test', state: 'FAILED', exitStatus: '1' },
];

const manifest: SnapshotFormatterInput['manifest'] = {
  version: 3,
  buildRef: 'org/pipeline/42',
  url: 'https://buildkite.com/org/pipeline/builds/42',
  fetchedAt: '2026-01-01T00:06:00.000Z',
  fetchComplete: true,
  build: {
    state: 'FAILED',
    number: 42,
    message: 'Fix the thing',
    branch: 'main',
    commit: 'abcdef1',
    finishedAt: '2026-01-01T00:05:00.000Z',
  },
  steps: [],
};

function baseInput(overrides: Partial<SnapshotFormatterInput> = {}): SnapshotFormatterInput {
  return {
    outputDir: '/tmp/bktide/snapshots/org/pipeline/42',
    manifest,
    build,
    scriptJobs,
    alreadyUpToDate: false,
    capturedCount: 1,
    skippedCount: 0,
    fetchErrorCount: 0,
    annotationResult: { fetchStatus: 'none', count: 0 },
    showTips: true,
    ...overrides,
  };
}

describe('snapshot formatters', () => {
  it('plain text shows build summary, save summary, and tips', () => {
    const out = getSnapshotFormatter('plain').format(baseInput());
    expect(out).toContain('FAILED');
    expect(out).toContain('#42');
    expect(out).toContain('1 step(s) captured');
    expect(out).toContain('Next steps:');
    expect(out).toContain('List failures');
  });

  it('plain text shows an "already up to date" message and skips the build summary', () => {
    const out = getSnapshotFormatter('plain').format(baseInput({ alreadyUpToDate: true }));
    expect(out).toContain('Snapshot already up to date');
    expect(out).not.toContain(`${scriptJobs.length} steps:`);
  });

  it('plain text omits tips when showTips is false', () => {
    const out = getSnapshotFormatter('plain').format(baseInput({ showTips: false }));
    expect(out).not.toContain('Next steps:');
  });

  it('json returns the manifest verbatim', () => {
    const out = getSnapshotFormatter('json').format(baseInput());
    expect(JSON.parse(out)).toEqual(manifest);
  });

  it('json returns the manifest even when already up to date', () => {
    const out = getSnapshotFormatter('json').format(baseInput({ alreadyUpToDate: true }));
    expect(JSON.parse(out)).toEqual(manifest);
  });

  it('alfred returns a single-item payload pointing at the output directory', () => {
    const out = getSnapshotFormatter('alfred').format(baseInput());
    const parsed = JSON.parse(out);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].arg).toBe('/tmp/bktide/snapshots/org/pipeline/42');
    expect(parsed.items[0].title).toContain('org/pipeline/42');
  });
});
