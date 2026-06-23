import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGitContext, getHeadCommit, getHeadCommitMessage } from '../../src/utils/gitContext.js';

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

describe('getHeadCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the trimmed SHA', () => {
    mockExecSync.mockReturnValueOnce('abc123def456\n');
    expect(getHeadCommit()).toBe('abc123def456');
  });

  it('throws when not in a git repo', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not a git repository');
    });
    expect(() => getHeadCommit()).toThrow('Not a git repository');
  });

  it('throws when there are no commits yet', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error("fatal: ambiguous argument 'HEAD'");
    });
    expect(() => getHeadCommit()).toThrow();
  });
});

describe('getHeadCommitMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the trimmed subject line', () => {
    mockExecSync.mockReturnValueOnce('Fix the thing\n');
    expect(getHeadCommitMessage()).toBe('Fix the thing');
  });

  it('throws when git command fails', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not a git repository');
    });
    expect(() => getHeadCommitMessage()).toThrow();
  });
});
