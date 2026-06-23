import { describe, it, expect } from 'vitest';
import { parseGitRemoteUrl, generateRepoCandidates } from '../../src/utils/repoUrl.js';

describe('parseGitRemoteUrl', () => {
  const cases = [
    { input: 'git@github.com:Gusto/zenpayroll.git', expected: { host: 'github.com', org: 'Gusto', repo: 'zenpayroll' } },
    { input: 'git@github.com:Gusto/zenpayroll', expected: { host: 'github.com', org: 'Gusto', repo: 'zenpayroll' } },
    { input: 'https://github.com/Gusto/zenpayroll.git', expected: { host: 'github.com', org: 'Gusto', repo: 'zenpayroll' } },
    { input: 'https://github.com/Gusto/zenpayroll', expected: { host: 'github.com', org: 'Gusto', repo: 'zenpayroll' } },
    { input: 'ssh://git@github.com/Gusto/zenpayroll.git', expected: { host: 'github.com', org: 'Gusto', repo: 'zenpayroll' } },
    { input: 'ssh://git@github.com:22/Gusto/zenpayroll.git', expected: { host: 'github.com', org: 'Gusto', repo: 'zenpayroll' } },
    { input: 'git@gitlab.com:some-org/some-repo.git', expected: { host: 'gitlab.com', org: 'some-org', repo: 'some-repo' } },
  ];

  cases.forEach(({ input, expected }) => {
    it(`should parse ${input}`, () => {
      expect(parseGitRemoteUrl(input)).toEqual(expected);
    });
  });

  it('should throw for invalid URL', () => {
    expect(() => parseGitRemoteUrl('not-a-url')).toThrow();
  });
});

describe('generateRepoCandidates', () => {
  it('should generate four URL candidates', () => {
    const result = generateRepoCandidates({ host: 'github.com', org: 'Gusto', repo: 'zenpayroll' });
    expect(result).toEqual([
      'git@github.com:Gusto/zenpayroll.git',
      'git@github.com:Gusto/zenpayroll',
      'https://github.com/Gusto/zenpayroll.git',
      'https://github.com/Gusto/zenpayroll',
    ]);
  });
});
