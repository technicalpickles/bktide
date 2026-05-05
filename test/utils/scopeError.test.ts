import { describe, it, expect } from 'vitest';
import { parseScopeError, formatScopeError } from '../../src/utils/scopeError.js';

describe('parseScopeError', () => {
  it('extracts scope from the canonical Buildkite scope error', () => {
    const result = parseScopeError(
      "API request failed: Your access token doesn't have the read_artifacts scope"
    );
    expect(result).toEqual({ matched: true, scope: 'read_artifacts' });
  });

  it('extracts scope when wrapped in additional error text', () => {
    const result = parseScopeError(
      "Failed to download: API request failed: Your access token doesn't have the read_build_logs scope. Try again."
    );
    expect(result).toEqual({ matched: true, scope: 'read_build_logs' });
  });

  it('returns matched: false for unrelated errors', () => {
    expect(parseScopeError('Something else went wrong').matched).toBe(false);
    expect(parseScopeError('').matched).toBe(false);
  });

  it('returns matched: false for ambiguous "scope" mentions', () => {
    expect(parseScopeError('Out of scope for this build').matched).toBe(false);
  });
});

describe('formatScopeError', () => {
  it('produces a message and suggestions for a known scope', () => {
    const out = formatScopeError('read_artifacts');
    expect(out.message).toContain('read_artifacts');
    expect(out.message).toContain('Read Artifacts');
    // Affected commands appear in the message under "needed for: ..."
    expect(out.message).toContain('artifacts list');
    expect(out.suggestions.join('\n')).toContain('https://buildkite.com/user/api-access-tokens');
    expect(out.suggestions.join('\n')).toContain('bktide token --reset');
  });

  it('falls back gracefully for an unknown scope name', () => {
    const out = formatScopeError('read_some_future_scope');
    expect(out.message).toContain('read_some_future_scope');
    expect(out.suggestions.length).toBeGreaterThan(0);
  });
});
