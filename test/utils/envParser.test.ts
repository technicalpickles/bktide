import { describe, it, expect } from 'vitest';
import { parseEnvEntries } from '../../src/utils/envParser.js';

describe('parseEnvEntries', () => {
  it('parses simple KEY=VAL pairs', () => {
    expect(parseEnvEntries(['FOO=bar', 'BAZ=qux'])).toEqual({
      FOO: 'bar',
      BAZ: 'qux',
    });
  });

  it('allows empty values', () => {
    expect(parseEnvEntries(['FOO='])).toEqual({ FOO: '' });
  });

  it('splits on first = only', () => {
    expect(parseEnvEntries(['CMD=echo a=b=c'])).toEqual({
      CMD: 'echo a=b=c',
    });
  });

  it('throws on entry without =', () => {
    expect(() => parseEnvEntries(['NO_EQUALS'])).toThrow(
      'Invalid --env entry: "NO_EQUALS". Use KEY=VAL.'
    );
  });

  it('throws on entry with empty key', () => {
    expect(() => parseEnvEntries(['=value'])).toThrow(
      'Invalid --env entry: "=value". Use KEY=VAL.'
    );
  });

  it('returns empty object for empty input', () => {
    expect(parseEnvEntries([])).toEqual({});
  });
});
