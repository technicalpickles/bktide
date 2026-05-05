import { describe, it, expect } from 'vitest';
import { JsonFormatter } from '../../../src/formatters/token/JsonFormatter.js';
import { TokenStatus } from '../../../src/types/credentials.js';

describe('JsonFormatter.formatTokenStatus — scopes', () => {
  const fmt = new JsonFormatter();

  it('includes scopes.granted and scopes.missing in JSON output when present', () => {
    const status: TokenStatus = {
      hasToken: true,
      isValid: false,
      validation: {
        valid: false,
        canListOrganizations: true,
        organizations: { gusto: { graphql: true, builds: true, organizations: true } },
        scopes: {
          granted: ['read_builds', 'graphql'],
          missing: ['read_artifacts'],
        },
      },
    };

    const parsed = JSON.parse(fmt.formatTokenStatus(status));

    expect(parsed.validation.scopes.granted).toEqual(['read_builds', 'graphql']);
    expect(parsed.validation.scopes.missing).toEqual(['read_artifacts']);
  });

  it('omits scopes from JSON when CredentialManager could not probe', () => {
    const status: TokenStatus = {
      hasToken: true,
      isValid: true,
      validation: {
        valid: true,
        canListOrganizations: true,
        organizations: { gusto: { graphql: true, builds: true, organizations: true } },
      },
    };

    const parsed = JSON.parse(fmt.formatTokenStatus(status));
    expect(parsed.validation.scopes).toBeUndefined();
  });
});
