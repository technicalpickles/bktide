import { describe, it, expect } from 'vitest';
import { parseJobRef } from '../../src/utils/parseJobRef.js';

const UUID = '0190046e-e199-453b-a302-a21a4d649d31';

describe('parseJobRef', () => {
  it('parses a bare job UUID', () => {
    expect(parseJobRef(UUID)).toEqual({ jobId: UUID });
  });

  it('lowercases the UUID', () => {
    expect(parseJobRef(UUID.toUpperCase()).jobId).toBe(UUID);
  });

  it('parses a build URL with a job fragment', () => {
    expect(parseJobRef(`https://buildkite.com/acme/infra/builds/4242#${UUID}`)).toEqual({
      org: 'acme', pipeline: 'infra', buildNumber: 4242, jobId: UUID,
    });
  });

  it('parses a build URL with extra path and query before the fragment', () => {
    expect(parseJobRef(`https://buildkite.com/acme/infra/builds/4242/steps/canvas?sid=abc#${UUID}`)).toMatchObject({
      buildNumber: 4242, jobId: UUID,
    });
  });

  it('parses org/pipeline/number#uuid and strips a leading @', () => {
    expect(parseJobRef(`@acme/infra/4242#${UUID}`)).toEqual({
      org: 'acme', pipeline: 'infra', buildNumber: 4242, jobId: UUID,
    });
  });

  it('explains when given a build URL without a job', () => {
    expect(() => parseJobRef('https://buildkite.com/acme/infra/builds/4242')).toThrow(/points at a build, not a job/);
  });

  it('rejects junk', () => {
    expect(() => parseJobRef('not-a-job')).toThrow(/Invalid job reference/);
    expect(() => parseJobRef('')).toThrow(/required/);
  });
});
