import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError } from '../../src/errors/ApiError.js';
import { isRoleDenied, reportWriteError } from '../../src/utils/writeError.js';
import { logger } from '../../src/services/logger.js';

describe('isRoleDenied', () => {
  it('is true for a 403 that is not a scope error', () => {
    expect(isRoleDenied(new ApiError('API request failed: You need the required access level', 403))).toBe(true);
  });

  it('is false for a 403 missing-scope error', () => {
    expect(isRoleDenied(new ApiError("API request failed: Your access token doesn't have the write_builds scope", 403))).toBe(false);
  });

  it('is false for a 401 and for plain errors', () => {
    expect(isRoleDenied(new ApiError('Unauthorized', 401))).toBe(false);
    expect(isRoleDenied(new Error('403 forbidden'))).toBe(false);
  });
});

describe('reportWriteError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('reports a role denial as a permission problem, not an auth problem', () => {
    reportWriteError(new ApiError('API request failed: You need the required access level', 403), 'retry jobs in acme');
    const output = String(consoleSpy.mock.calls[0][0]);
    expect(output).toContain('Permission denied: your Buildkite role does not allow you to retry jobs in acme');
    expect(output).toContain('Buildkite responded: You need the required access level');
    expect(output).toContain('refreshing or re-storing it will not help');
  });

  it('reports a missing scope with token guidance', () => {
    reportWriteError(new ApiError("API request failed: Your access token doesn't have the write_builds scope", 403), 'retry jobs');
    expect(String(consoleSpy.mock.calls[0][0])).toContain('missing the write_builds scope');
  });

  it('passes other errors through', () => {
    reportWriteError(new ApiError('API request failed: Only failed, timed out or canceled jobs can be retried', 400), 'retry jobs');
    expect(errorSpy).toHaveBeenCalledWith('API request failed: Only failed, timed out or canceled jobs can be retried');
  });
});
