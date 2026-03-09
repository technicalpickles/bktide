import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGitContext } from '../../src/utils/gitContext.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
const mockExecSync = vi.mocked(execSync);

describe('getGitContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return branch and remote URL', () => {
    mockExecSync
      .mockReturnValueOnce('my-feature-branch\n')
      .mockReturnValueOnce('git@github.com:Gusto/zenpayroll.git\n');

    const result = getGitContext();
    expect(result).toEqual({
      branch: 'my-feature-branch',
      remoteUrl: 'git@github.com:Gusto/zenpayroll.git',
    });
  });

  it('should throw for detached HEAD', () => {
    mockExecSync.mockReturnValueOnce('HEAD\n');
    expect(() => getGitContext()).toThrow('Detached HEAD');
  });

  it('should throw when not in a git repo', () => {
    mockExecSync.mockImplementationOnce(() => { throw new Error('not a git repository'); });
    expect(() => getGitContext()).toThrow('Not a git repository');
  });

  it('should throw when no remote found', () => {
    mockExecSync
      .mockReturnValueOnce('main\n')
      .mockImplementationOnce(() => { throw new Error('No such remote'); });
    expect(() => getGitContext()).toThrow('No git remote');
  });
});
