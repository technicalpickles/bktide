import { describe, it, expect } from 'vitest';
import { PlainTextFormatter } from '../../../src/formatters/token/PlainTextFormatter.js';
import { TokenStatus } from '../../../src/types/credentials.js';

const orgsAllGood = {
  gusto: { graphql: true, builds: true, organizations: true },
};

function tokenStatus(overrides?: Partial<TokenStatus>): TokenStatus {
  return {
    hasToken: true,
    isValid: true,
    validation: {
      valid: true,
      canListOrganizations: true,
      organizations: orgsAllGood,
    },
    ...overrides,
  };
}

describe('PlainTextFormatter.formatTokenStatus — scopes', () => {
  const fmt = new PlainTextFormatter();

  // SEMANTIC_COLORS.label() uppercases section headings, so we case-insensitively
  // match the section labels but check scope identifiers exact-case.
  const lower = (s: string) => s.toLowerCase();

  it('lists all granted scopes when scopes are present and complete', () => {
    const out = fmt.formatTokenStatus(tokenStatus({
      validation: {
        valid: true,
        canListOrganizations: true,
        organizations: orgsAllGood,
        scopes: {
          granted: [
            'read_builds', 'read_build_logs', 'read_organizations',
            'read_pipelines', 'read_artifacts', 'graphql',
          ],
          missing: [],
        },
      },
    }));

    expect(lower(out)).toContain('granted scopes');
    expect(out).toContain('read_builds');
    expect(out).toContain('read_artifacts');
    expect(lower(out)).not.toContain('missing scopes');
  });

  it('flags missing scopes with display name and the commands that need them', () => {
    const out = fmt.formatTokenStatus(tokenStatus({
      isValid: false,
      validation: {
        valid: false,
        canListOrganizations: true,
        organizations: orgsAllGood,
        scopes: {
          granted: ['read_builds', 'read_build_logs', 'read_organizations', 'read_pipelines', 'graphql'],
          missing: ['read_artifacts'],
        },
      },
    }));

    expect(lower(out)).toContain('missing scopes');
    expect(out).toContain('read_artifacts');
    expect(out).toContain('Read Artifacts');
    expect(out).toContain('artifacts list');
    expect(out).toContain('bktide token --reset');
    expect(out).toContain('https://buildkite.com/user/api-access-tokens');
  });

  it('omits the scope section entirely when scopes is undefined (legacy/unknown)', () => {
    const out = fmt.formatTokenStatus(tokenStatus());
    expect(lower(out)).not.toContain('granted scopes');
    expect(lower(out)).not.toContain('missing scopes');
  });
});
