# Auth Scope UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make missing token scopes visible *before* commands fail, and make the recovery path obvious when they do.

**Architecture:** Switch scope probing from per-org resource checks to a single `GET /v2/access-token` call (returns `{ uuid, scopes }`), thread scopes through `TokenValidationStatus`, surface them in `bktide token --check`, and add a centralized scope-error parser that any command can use.

**Tech Stack:** TypeScript (strict, ES modules), Node.js 20+, Buildkite REST API, Vitest, MSW (for higher-level command tests; REST-client unit tests use `vi.spyOn` on the private `get()` method to match existing convention in `test/services/BuildkiteRestClient.logs.test.ts`).

**Tracking:** [#27](https://github.com/technicalpickles/bktide/issues/27)

---

## Background

PR #26 added artifact commands that need the `read_artifacts` scope. The Buildkite API gives a clean error when the scope is missing, and the artifact commands surface it well, but bktide as a whole has no awareness of scopes:

- `TokenSetupGuide.REQUIRED_PERMISSIONS` lists 4 hardcoded scope names. No `Read Artifacts`, no extensibility.
- `CredentialManager.validateToken` does per-org resource probing (GraphQL viewer, builds, organizations). Scopes never enter the picture.
- `bktide token --check` says "✓ Valid token" while `artifacts list` blows up with a 403. That's the actually-bad UX.
- `ArtifactsList.ts` (lines 31-45) and `ArtifactsDownload.ts` (lines 100-110) catch all errors and append a generic suggestion list including the misleading "Check the build reference format" item.

Buildkite exposes `GET /v2/access-token` which returns the token's UUID and scope list. That's the right primitive: one call, definitive answer, works for any future scope.

### Required Scopes Reference

| Scope                 | Used By                                                            |
|-----------------------|--------------------------------------------------------------------|
| `read_builds`         | `builds`, `build`, `pipeline`, `snapshot`, `logs`                  |
| `read_build_logs`     | `logs`, `snapshot` (failed step logs)                              |
| `read_organizations`  | `orgs`, `pipelines`                                                |
| `read_pipelines`      | `pipelines`, `pipeline`                                            |
| `read_artifacts`      | `artifacts list`, `artifacts download`, `snapshot --artifacts`     |
| `graphql`             | most commands (viewer, listings)                                   |

Map this in code so it's the single source of truth.

---

## File Structure

| Path | Status | Responsibility |
|------|--------|----------------|
| `src/services/BuildkiteRestClient.ts` | modify | Add `getAccessToken()` REST primitive returning `{ uuid, scopes }` |
| `src/types/buildkite.ts` | modify | Export `AccessTokenInfo` type |
| `src/services/RequiredScopes.ts` | new | Single source of truth: `REQUIRED_SCOPES` map (scope → display name + commands) |
| `src/services/TokenSetupGuide.ts` | modify | Derive `REQUIRED_PERMISSIONS` display list from `RequiredScopes.ts` |
| `src/services/CredentialManager.ts` | modify | Call `getAccessToken()` from `validateToken`, attach `scopes` to result |
| `src/types/credentials.ts` | modify | Add optional `scopes: { granted, missing }` to `TokenValidationStatus` |
| `src/formatters/token/PlainTextFormatter.ts` | modify | Show granted + missing scopes in `formatTokenStatus` |
| `src/formatters/token/JsonFormatter.ts` | modify | Surface scope arrays in JSON output |
| `src/utils/scopeError.ts` | new | `parseScopeError(msg)` and `formatScopeError(scope)` helpers |
| `src/commands/ArtifactsList.ts` | modify | Wire scope-error parser into catch block |
| `src/commands/ArtifactsDownload.ts` | modify | Wire scope-error parser into catch block |
| `test/services/BuildkiteRestClient.scopes.test.ts` | new | Unit tests for `getAccessToken()` |
| `test/services/RequiredScopes.test.ts` | new | Map invariants |
| `test/services/TokenSetupGuide.test.ts` | modify | Assert `Read Artifacts` appears (regression guard) |
| `test/services/CredentialManager.test.ts` | new | Scope-fetch path tests |
| `test/formatters/token/PlainTextFormatter.test.ts` | new | Snapshot of granted/missing scope rendering |
| `test/formatters/token/JsonFormatter.test.ts` | new | JSON shape includes scope arrays |
| `test/utils/scopeError.test.ts` | new | Parser + formatter tests |
| `test/commands/Artifacts.test.ts` | modify | Add scope-error path test |

**Boundaries:**
- `RequiredScopes.ts` is *data*, not behavior. It owns the scope ↔ display name ↔ commands mapping. Both `TokenSetupGuide` and `formatScopeError` import from it.
- `BuildkiteRestClient.getAccessToken()` is a thin REST primitive. It does no scope reasoning — that's `CredentialManager`'s job.
- `scopeError.ts` is pure string parsing + formatting. No I/O, no Buildkite client knowledge.
- The existing `TokenValidationStatus` shape is preserved; `scopes` is optional so legacy callers and tests still typecheck.

---

## Task 1: Add `AccessTokenInfo` type and `getAccessToken()` REST primitive

**Files:**
- Modify: `src/types/buildkite.ts`
- Modify: `src/services/BuildkiteRestClient.ts`
- Create: `test/services/BuildkiteRestClient.scopes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/services/BuildkiteRestClient.scopes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildkiteRestClient.getAccessToken', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the token uuid and scopes from /v2/access-token', async () => {
    const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue({
      uuid: '11111111-2222-3333-4444-555555555555',
      scopes: ['read_builds', 'graphql'],
    });

    const result = await client.getAccessToken();

    expect(getSpy).toHaveBeenCalledWith('/access-token');
    expect(result.uuid).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.scopes).toEqual(['read_builds', 'graphql']);
  });

  it('propagates auth errors from the underlying request', async () => {
    vi.spyOn(client as any, 'get').mockRejectedValue(
      new Error('API request failed: Unauthorized')
    );

    await expect(client.getAccessToken()).rejects.toThrow('Unauthorized');
  });
});
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- BuildkiteRestClient.scopes
```

Expected: FAIL with `client.getAccessToken is not a function`.

- [ ] **Step 3: Add `AccessTokenInfo` type**

In `src/types/buildkite.ts`, add to the existing exports:

```typescript
export interface AccessTokenInfo {
  uuid: string;
  scopes: string[];
}
```

- [ ] **Step 4: Add `getAccessToken()` method**

In `src/services/BuildkiteRestClient.ts`, update the import line for `../types/buildkite.js` to include `AccessTokenInfo`:

```typescript
import { JobLog, BuildkiteArtifact, AccessTokenInfo } from '../types/buildkite.js';
```

Add this method to the `BuildkiteRestClient` class (place it after `getRateLimitInfo()` around line 227, before `getBuilds()`):

```typescript
  /**
   * Fetch the current token's UUID and scope list.
   * Uses /v2/access-token, which any valid Buildkite API token can call.
   */
  public async getAccessToken(): Promise<AccessTokenInfo> {
    return this.get<AccessTokenInfo>('/access-token');
  }
```

- [ ] **Step 5: Run test, see it pass**

```bash
npm test -- BuildkiteRestClient.scopes
```

Expected: PASS, 2 tests green.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/buildkite.ts src/services/BuildkiteRestClient.ts test/services/BuildkiteRestClient.scopes.test.ts
git commit -m "feat(rest): add getAccessToken primitive for scope discovery"
```

---

## Task 2: Centralize required-scope map

**Files:**
- Create: `src/services/RequiredScopes.ts`
- Create: `test/services/RequiredScopes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/services/RequiredScopes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  REQUIRED_SCOPES,
  scopeDisplayNames,
  commandsForScope,
} from '../../src/services/RequiredScopes.js';

describe('RequiredScopes', () => {
  it('lists all scopes bktide cares about', () => {
    expect(Object.keys(REQUIRED_SCOPES).sort()).toEqual([
      'graphql',
      'read_artifacts',
      'read_build_logs',
      'read_builds',
      'read_organizations',
      'read_pipelines',
    ]);
  });

  it('maps each scope to a human-readable Buildkite UI label', () => {
    expect(REQUIRED_SCOPES.read_artifacts.displayName).toBe('Read Artifacts');
    expect(REQUIRED_SCOPES.graphql.displayName).toBe('GraphQL API Access');
  });

  it('reports which commands need each scope', () => {
    expect(commandsForScope('read_artifacts')).toContain('artifacts list');
    expect(commandsForScope('read_artifacts')).toContain('artifacts download');
    expect(commandsForScope('read_builds')).toContain('builds');
  });

  it('exposes display names as a flat array for legacy callers', () => {
    const names = scopeDisplayNames();
    expect(names).toContain('Read Builds');
    expect(names).toContain('Read Artifacts');
    expect(names).toContain('GraphQL API Access');
  });
});
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- RequiredScopes
```

Expected: FAIL with module-not-found on `RequiredScopes.js`.

- [ ] **Step 3: Implement the map**

Create `src/services/RequiredScopes.ts`:

```typescript
/**
 * Single source of truth for Buildkite API scopes that bktide uses.
 * Keys match the scope identifiers returned by GET /v2/access-token.
 * Display names match what Buildkite shows in the token UI.
 */
export const REQUIRED_SCOPES = {
  read_builds: {
    displayName: 'Read Builds',
    commands: ['builds', 'build', 'pipeline', 'snapshot', 'logs'],
  },
  read_build_logs: {
    displayName: 'Read Build Logs',
    commands: ['logs', 'snapshot'],
  },
  read_organizations: {
    displayName: 'Read Organizations',
    commands: ['orgs', 'pipelines'],
  },
  read_pipelines: {
    displayName: 'Read Pipelines',
    commands: ['pipelines', 'pipeline'],
  },
  read_artifacts: {
    displayName: 'Read Artifacts',
    commands: ['artifacts list', 'artifacts download', 'snapshot --artifacts'],
  },
  graphql: {
    displayName: 'GraphQL API Access',
    commands: ['most commands (viewer, listings)'],
  },
} as const;

export type ScopeKey = keyof typeof REQUIRED_SCOPES;

export function scopeDisplayNames(): string[] {
  return Object.values(REQUIRED_SCOPES).map(s => s.displayName);
}

export function commandsForScope(scope: ScopeKey): readonly string[] {
  return REQUIRED_SCOPES[scope].commands;
}

export function isKnownScope(scope: string): scope is ScopeKey {
  return scope in REQUIRED_SCOPES;
}
```

- [ ] **Step 4: Run test, see it pass**

```bash
npm test -- RequiredScopes
```

Expected: PASS, 4 tests green.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/RequiredScopes.ts test/services/RequiredScopes.test.ts
git commit -m "feat(scopes): add RequiredScopes map as single source of truth"
```

---

## Task 3: Have `TokenSetupGuide` derive permissions from `RequiredScopes`

**Files:**
- Modify: `src/services/TokenSetupGuide.ts`
- Modify: `test/services/TokenSetupGuide.test.ts`

- [ ] **Step 1: Add a regression test for `Read Artifacts`**

In `test/services/TokenSetupGuide.test.ts`, add this `it` block inside the existing `describe('REQUIRED_PERMISSIONS', ...)`:

```typescript
    it('includes Read Artifacts (regression: was missing for the artifacts commands)', () => {
      expect(TokenSetupGuide.REQUIRED_PERMISSIONS).toContain('Read Artifacts');
    });

    it('includes Read Pipelines', () => {
      expect(TokenSetupGuide.REQUIRED_PERMISSIONS).toContain('Read Pipelines');
    });

    it('includes all six scopes bktide uses today', () => {
      expect(TokenSetupGuide.REQUIRED_PERMISSIONS).toEqual(
        expect.arrayContaining([
          'Read Builds',
          'Read Build Logs',
          'Read Organizations',
          'Read Pipelines',
          'Read Artifacts',
          'GraphQL API Access',
        ])
      );
    });
```

Also extend the existing `'should include permissions in agent output'` test:

```typescript
    it('should include permissions in agent output', () => {
      process.env.CLAUDECODE = '1';
      const guide = new TokenSetupGuide();
      const output = guide.getSetupGuidance();
      expect(output).toContain('Read Builds');
      expect(output).toContain('Read Artifacts');
      expect(output).toContain('GraphQL API Access');
      expect(output).toContain('bktide token --store');
      expect(output).toContain('their terminal');
    });
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- TokenSetupGuide
```

Expected: FAIL — both `should include permissions in agent output` (now expects `Read Artifacts`) and the new regression-guard tests fail because the hardcoded array is missing two scopes.

- [ ] **Step 3: Replace hardcoded array with derived list**

In `src/services/TokenSetupGuide.ts`, replace the top of the class:

```typescript
import { scopeDisplayNames } from './RequiredScopes.js';

export type RuntimeEnvironment = 'agent' | 'interactive' | 'non-interactive';

/**
 * Provides environment-aware guidance for token setup.
 * Single source of truth for required permissions and setup instructions.
 * Scope list is derived from RequiredScopes — do not hardcode here.
 */
export class TokenSetupGuide {
  static readonly REQUIRED_PERMISSIONS: readonly string[] = scopeDisplayNames();

  static readonly TOKEN_URL = 'https://buildkite.com/user/api-access-tokens/new';
```

(Delete the old hardcoded `REQUIRED_PERMISSIONS = [...]` array.)

- [ ] **Step 4: Run test, see it pass**

```bash
npm test -- TokenSetupGuide
```

Expected: PASS, all assertions green including the three new regression guards.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/TokenSetupGuide.ts test/services/TokenSetupGuide.test.ts
git commit -m "fix(token): include Read Artifacts and Read Pipelines in setup guidance"
```

---

## Task 4: Extend `TokenValidationStatus` with optional scopes

**Files:**
- Modify: `src/types/credentials.ts`
- Modify: `src/services/CredentialManager.ts`
- Create: `test/services/CredentialManager.test.ts`

- [ ] **Step 1: Extend the type**

In `src/types/credentials.ts`, replace the `TokenValidationStatus` interface:

```typescript
export interface TokenValidationStatus {
  /** Combined status of all validation checks */
  valid: boolean;
  /** Whether the token can access the GraphQL API to list organizations */
  canListOrganizations: boolean;
  /** Validation status for each organization */
  organizations: Record<string, OrganizationValidationStatus>;
  /**
   * Granted vs. missing scopes from the Buildkite token, when known.
   * Optional so legacy callers and tests continue to typecheck while
   * scope detection rolls out.
   */
  scopes?: {
    granted: string[];
    missing: string[];
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. (Optional field, all existing call sites still compile.)

- [ ] **Step 3: Write the failing CredentialManager test**

Create `test/services/CredentialManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialManager } from '../../src/services/CredentialManager.js';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('CredentialManager.validateToken', () => {
  let manager: CredentialManager;

  beforeEach(() => {
    manager = new CredentialManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns scopes.granted and empty scopes.missing when all required scopes are present', async () => {
    vi.spyOn(BuildkiteClient.prototype, 'getOrganizations').mockResolvedValue([
      { slug: 'gusto', name: 'Gusto', id: 'org-1' } as any,
    ]);
    vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({} as any);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasBuildAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'getAccessToken').mockResolvedValue({
      uuid: 'token-uuid',
      scopes: [
        'read_builds',
        'read_build_logs',
        'read_organizations',
        'read_pipelines',
        'read_artifacts',
        'graphql',
      ],
    });

    const result = await manager.validateToken('test-token', { showProgress: false });

    expect(result.scopes).toBeDefined();
    expect(result.scopes!.missing).toEqual([]);
    expect(result.scopes!.granted).toContain('read_artifacts');
    expect(result.valid).toBe(true);
  });

  it('marks token invalid when read_artifacts is missing', async () => {
    vi.spyOn(BuildkiteClient.prototype, 'getOrganizations').mockResolvedValue([
      { slug: 'gusto', name: 'Gusto', id: 'org-1' } as any,
    ]);
    vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({} as any);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasBuildAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'getAccessToken').mockResolvedValue({
      uuid: 'token-uuid',
      scopes: [
        'read_builds',
        'read_build_logs',
        'read_organizations',
        'read_pipelines',
        'graphql',
        // read_artifacts intentionally absent
      ],
    });

    const result = await manager.validateToken('test-token', { showProgress: false });

    expect(result.scopes!.missing).toEqual(['read_artifacts']);
    expect(result.valid).toBe(false);
  });

  it('falls back gracefully when /access-token errors (e.g. token revoked mid-flight)', async () => {
    vi.spyOn(BuildkiteClient.prototype, 'getOrganizations').mockResolvedValue([
      { slug: 'gusto', name: 'Gusto', id: 'org-1' } as any,
    ]);
    vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({} as any);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasBuildAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'getAccessToken').mockRejectedValue(
      new Error('API request failed: Unauthorized')
    );

    const result = await manager.validateToken('test-token', { showProgress: false });

    // Scope info missing, but per-org checks still ran and passed
    expect(result.scopes).toBeUndefined();
    expect(result.canListOrganizations).toBe(true);
  });
});
```

- [ ] **Step 4: Run test, see it fail**

```bash
npm test -- CredentialManager
```

Expected: FAIL — `result.scopes` is undefined in the first two tests, and `result.valid` is unaffected by missing scopes.

- [ ] **Step 5: Wire scope detection into `validateToken`**

In `src/services/CredentialManager.ts`, add the import:

```typescript
import { REQUIRED_SCOPES } from './RequiredScopes.js';
```

Replace the `validateToken` method body. Insert the scope-fetch block after the existing `orgSlugs` retrieval succeeds, and fold the result into `allValid` at the end:

```typescript
  async validateToken(token?: string, options?: { format?: string; showProgress?: boolean }): Promise<TokenValidationStatus> {
    try {
      const tokenToValidate = token || await this.getToken();
      if (!tokenToValidate) {
        logger.debug('No token provided for validation');
        return {
          valid: false,
          canListOrganizations: false,
          organizations: {}
        };
      }

      const graphqlClient = new BuildkiteClient(tokenToValidate, { debug: false, caching: false });
      const restClient = new BuildkiteRestClient(tokenToValidate, { debug: false });

      let orgSlugs: string[] = [];
      try {
        orgSlugs = await graphqlClient.getOrganizations().then(orgs => orgs.map(org => org.slug));
        logger.debug('Successfully retrieved organization slugs');
      } catch (error) {
        logger.debug('Failed to retrieve organization slugs', {
          error: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error && error.cause ? error.cause : undefined
        });
        return {
          valid: false,
          canListOrganizations: false,
          organizations: {}
        };
      }

      // Fetch scopes once. /access-token works for any valid Buildkite token,
      // so a failure here means the token was revoked between the GraphQL call
      // and now. Treat as unknown rather than fatal.
      let scopes: { granted: string[]; missing: string[] } | undefined;
      try {
        const tokenInfo = await restClient.getAccessToken();
        const required = Object.keys(REQUIRED_SCOPES);
        scopes = {
          granted: tokenInfo.scopes,
          missing: required.filter(s => !tokenInfo.scopes.includes(s)),
        };
      } catch (error) {
        logger.debug('Failed to fetch token scopes via /access-token', error);
      }

      const organizations: Record<string, OrganizationValidationStatus> = {};
      let allValid = !scopes || scopes.missing.length === 0;

      const showProgress = options?.showProgress !== false &&
                          !isRunningInAlfred() &&
                          orgSlugs.length > 0;

      const progress = showProgress ? Progress.bar({
        total: orgSlugs.length * 3,
        label: 'Validating token access',
        format: options?.format
      }) : null;

      let checkCount = 0;

      for (const orgSlug of orgSlugs) {
        const orgStatus: OrganizationValidationStatus = {
          graphql: false,
          builds: false,
          organizations: false
        };

        if (progress) {
          progress.update(checkCount++, `Checking GraphQL access for ${orgSlug}`);
        }
        try {
          await graphqlClient.getViewer();
          orgStatus.graphql = true;
        } catch (error) {
          logger.debug(`GraphQL validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        if (progress) {
          progress.update(checkCount++, `Checking build access for ${orgSlug}`);
        }
        try {
          await restClient.hasBuildAccess(orgSlug);
          orgStatus.builds = true;
        } catch (error) {
          logger.debug(`Build access validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        if (progress) {
          progress.update(checkCount++, `Checking organization access for ${orgSlug}`);
        }
        try {
          await restClient.hasOrganizationAccess(orgSlug);
          orgStatus.organizations = true;
        } catch (error) {
          logger.debug(`Organization access validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        organizations[orgSlug] = orgStatus;
      }

      if (progress) {
        const successCount = Object.values(organizations)
          .filter(org => org.graphql && org.builds && org.organizations)
          .length;
        progress.complete(`✓ Validated ${orgSlugs.length} organizations (${successCount} fully accessible)`);
      }

      return {
        valid: allValid,
        canListOrganizations: true,
        organizations,
        ...(scopes ? { scopes } : {}),
      };
    } catch (error) {
      logger.debug('Token validation failed', error);
      return {
        valid: false,
        canListOrganizations: false,
        organizations: {}
      };
    }
  }
```

- [ ] **Step 6: Run test, see it pass**

```bash
npm test -- CredentialManager
```

Expected: PASS, 3 tests green.

- [ ] **Step 7: Run the full suite to catch regressions**

```bash
npm test
```

Expected: PASS, all suites green. (Existing `validateToken` callers should still compile because `scopes` is optional.)

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/types/credentials.ts src/services/CredentialManager.ts test/services/CredentialManager.test.ts
git commit -m "feat(token): probe scopes during validateToken via /access-token"
```

---

## Task 5: Surface scopes in `bktide token --check` output

**Files:**
- Modify: `src/formatters/token/PlainTextFormatter.ts`
- Modify: `src/formatters/token/JsonFormatter.ts`
- Create: `test/formatters/token/PlainTextFormatter.test.ts`
- Create: `test/formatters/token/JsonFormatter.test.ts`

- [ ] **Step 1: Write the failing plain-text test**

Create `test/formatters/token/PlainTextFormatter.test.ts`:

```typescript
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

    expect(out).toContain('Granted scopes');
    expect(out).toContain('read_builds');
    expect(out).toContain('read_artifacts');
    expect(out).not.toContain('Missing scopes');
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

    expect(out).toContain('Missing scopes');
    expect(out).toContain('read_artifacts');
    expect(out).toContain('Read Artifacts');
    expect(out).toContain('artifacts list');
    expect(out).toContain('bktide token --reset');
    expect(out).toContain('https://buildkite.com/user/api-access-tokens');
  });

  it('omits the scope section entirely when scopes is undefined (legacy/unknown)', () => {
    const out = fmt.formatTokenStatus(tokenStatus());
    expect(out).not.toContain('Granted scopes');
    expect(out).not.toContain('Missing scopes');
  });
});
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- PlainTextFormatter
```

Expected: FAIL — output does not contain "Granted scopes" / "Missing scopes" / "artifacts list".

- [ ] **Step 3: Render scopes in `formatTokenStatus`**

In `src/formatters/token/PlainTextFormatter.ts`, add the import:

```typescript
import { REQUIRED_SCOPES, isKnownScope } from '../../services/RequiredScopes.js';
```

Inside `formatTokenStatus`, after the existing org-listing block (right before the `return lines.join('\n')` at the bottom), insert:

```typescript
    // Scope detail (only present when CredentialManager probed /access-token)
    if (status.validation.scopes) {
      const { granted, missing } = status.validation.scopes;

      if (granted.length > 0) {
        lines.push('');
        lines.push(SEMANTIC_COLORS.label('Granted scopes:'));
        granted.forEach(scope => {
          lines.push(`  ${SEMANTIC_COLORS.success('✓')} ${scope}`);
        });
      }

      if (missing.length > 0) {
        lines.push('');
        lines.push(SEMANTIC_COLORS.warning('Missing scopes:'));
        missing.forEach(scope => {
          if (isKnownScope(scope)) {
            const meta = REQUIRED_SCOPES[scope];
            const cmds = meta.commands.join(', ');
            lines.push(
              `  ${SEMANTIC_COLORS.error('✗')} ${scope} ` +
              SEMANTIC_COLORS.dim(`(${meta.displayName}) — needed for: ${cmds}`)
            );
          } else {
            lines.push(`  ${SEMANTIC_COLORS.error('✗')} ${scope}`);
          }
        });

        lines.push('');
        lines.push(SEMANTIC_COLORS.label('To fix:'));
        lines.push('  1. Open https://buildkite.com/user/api-access-tokens');
        lines.push('  2. Edit your token to add the missing scopes');
        lines.push('  3. Run: bktide token --reset && bktide token --store');
      }
    }
```

- [ ] **Step 4: Run plain-text test, see it pass**

```bash
npm test -- PlainTextFormatter
```

Expected: PASS, 3 tests green.

- [ ] **Step 5: Write the failing JSON test**

Create `test/formatters/token/JsonFormatter.test.ts`:

```typescript
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
```

- [ ] **Step 6: Run JSON test, see it pass with no changes**

```bash
npm test -- JsonFormatter
```

Expected: PASS — `JsonFormatter.formatTokenStatus` already does `{ ...status, message: ... }`, so the optional `scopes` field passes through unchanged. If it fails, the existing spread is broken and that's a real bug to investigate.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual smoke (optional)**

Build and run against the real keychain token:

```bash
npm run build
bin/bktide token --check
```

Expected: if your token has all 6 scopes, output ends with a "Granted scopes:" block listing all six. If any are missing, "Missing scopes:" block appears with the fix instructions.

- [ ] **Step 9: Commit**

```bash
git add src/formatters/token/PlainTextFormatter.ts test/formatters/token/PlainTextFormatter.test.ts test/formatters/token/JsonFormatter.test.ts
git commit -m "feat(token): show granted and missing scopes in token --check"
```

---

## Task 6: Centralized scope-error parser

**Files:**
- Create: `src/utils/scopeError.ts`
- Create: `test/utils/scopeError.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/utils/scopeError.test.ts`:

```typescript
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
    expect(out.suggestions.join('\n')).toContain('https://buildkite.com/user/api-access-tokens');
    expect(out.suggestions.join('\n')).toContain('bktide token --reset');
    expect(out.suggestions.join('\n')).toContain('artifacts list');
  });

  it('falls back gracefully for an unknown scope name', () => {
    const out = formatScopeError('read_some_future_scope');
    expect(out.message).toContain('read_some_future_scope');
    expect(out.suggestions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- scopeError
```

Expected: FAIL with module-not-found on `scopeError.js`.

- [ ] **Step 3: Implement parser and formatter**

Create `src/utils/scopeError.ts`:

```typescript
import { REQUIRED_SCOPES, isKnownScope } from '../services/RequiredScopes.js';

export type ScopeErrorMatch =
  | { matched: false }
  | { matched: true; scope: string };

/**
 * Detects the canonical Buildkite scope error and extracts the scope name.
 * The Buildkite REST API responds with messages like:
 *   "Your access token doesn't have the read_artifacts scope"
 * which may be wrapped by our own client with prefixes like
 *   "API request failed: ..."
 */
export function parseScopeError(message: string): ScopeErrorMatch {
  if (!message) return { matched: false };

  const re = /access token doesn'?t have the (\w+) scope/i;
  const match = message.match(re);
  if (match && match[1]) {
    return { matched: true, scope: match[1] };
  }
  return { matched: false };
}

export interface FormattedScopeError {
  message: string;
  suggestions: string[];
}

/**
 * Build a user-facing message and suggestion list for a known-missing scope.
 * Pulls display name + affected commands from RequiredScopes when available.
 */
export function formatScopeError(scope: string): FormattedScopeError {
  if (isKnownScope(scope)) {
    const meta = REQUIRED_SCOPES[scope];
    const cmds = meta.commands.join(', ');
    return {
      message: `Your Buildkite API token is missing the ${scope} scope (${meta.displayName}), needed for: ${cmds}`,
      suggestions: [
        'Open https://buildkite.com/user/api-access-tokens',
        `Edit your token and enable "${meta.displayName}"`,
        'Then run: bktide token --reset && bktide token --store',
      ],
    };
  }

  return {
    message: `Your Buildkite API token is missing the ${scope} scope`,
    suggestions: [
      'Open https://buildkite.com/user/api-access-tokens',
      `Edit your token to grant the ${scope} scope`,
      'Then run: bktide token --reset && bktide token --store',
    ],
  };
}
```

- [ ] **Step 4: Run test, see it pass**

```bash
npm test -- scopeError
```

Expected: PASS, 6 tests green.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/scopeError.ts test/utils/scopeError.test.ts
git commit -m "feat(errors): add parseScopeError and formatScopeError helpers"
```

---

## Task 7: Wire scope-error parser into artifact commands

**Files:**
- Modify: `src/commands/ArtifactsList.ts`
- Modify: `src/commands/ArtifactsDownload.ts`
- Modify: `test/commands/Artifacts.test.ts`

- [ ] **Step 1: Add a failing scope-error test**

In `test/commands/Artifacts.test.ts`, append a new `describe` block at the bottom of the file (after the existing `describe('ArtifactsDownload Command', ...)`):

```typescript
describe('Artifacts commands — scope-error path', () => {
  let consoleCalls: string[];

  beforeEach(() => {
    consoleCalls = [];
    vi.spyOn(logger, 'console').mockImplementation((msg: any) => {
      consoleCalls.push(String(msg));
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ArtifactsList shows scope-specific suggestions on read_artifacts error', async () => {
    server.use(
      http.get(
        'https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds/:buildNumber/artifacts',
        () => HttpResponse.json(
          { message: "Your access token doesn't have the read_artifacts scope" },
          { status: 403 }
        )
      )
    );

    const cmd = new ArtifactsList({ noCache: true });
    const exitCode = await cmd.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
    });

    expect(exitCode).toBe(1);
    const out = consoleCalls.join('\n');
    expect(out).toContain('read_artifacts');
    expect(out).toContain('Read Artifacts');
    expect(out).toContain('bktide token --reset');
    expect(out).toContain('https://buildkite.com/user/api-access-tokens');
    // Misleading legacy hint must be gone on the scope path
    expect(out).not.toContain('Check the build reference format');
  });

  it('ArtifactsDownload shows scope-specific suggestions on read_artifacts error', async () => {
    server.use(
      http.get(
        'https://api.buildkite.com/v2/organizations/:org/pipelines/:pipeline/builds/:buildNumber/artifacts',
        () => HttpResponse.json(
          { message: "Your access token doesn't have the read_artifacts scope" },
          { status: 403 }
        )
      )
    );

    const cmd = new ArtifactsDownload({ noCache: true });
    const exitCode = await cmd.execute({
      buildRef: 'org/pipeline/123',
      token: 'test-token',
      path: '*.patch',
    });

    expect(exitCode).toBe(1);
    const out = consoleCalls.join('\n');
    expect(out).toContain('read_artifacts');
    expect(out).toContain('bktide token --reset');
    expect(out).not.toContain('Check the build reference format');
  });
});
```

- [ ] **Step 2: Run test, see it fail**

```bash
npm test -- Artifacts
```

Expected: FAIL — current output contains "Check the build reference format" and not the scope-specific text.

- [ ] **Step 3: Update `ArtifactsList`**

In `src/commands/ArtifactsList.ts`, add the import:

```typescript
import { parseScopeError, formatScopeError } from '../utils/scopeError.js';
```

Replace the `catch (error)` block (lines 31-45 in current file):

```typescript
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        const parsed = parseScopeError(error.message);
        if (parsed.matched) {
          const formatted = formatScopeError(parsed.scope);
          logger.console(formatError(formatted.message, { suggestions: formatted.suggestions }));
        } else {
          logger.console(formatError(error.message, {
            suggestions: [
              'Check the build reference format (org/pipeline/number or URL)',
              'Run `bktide token --check` to verify token scopes',
            ],
          }));
        }
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
```

- [ ] **Step 4: Update `ArtifactsDownload`**

In `src/commands/ArtifactsDownload.ts`, add the import:

```typescript
import { parseScopeError, formatScopeError } from '../utils/scopeError.js';
```

Replace the outer `catch (error)` block (around lines 100-110):

```typescript
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        const parsed = parseScopeError(error.message);
        if (parsed.matched) {
          const formatted = formatScopeError(parsed.scope);
          logger.console(formatError(formatted.message, { suggestions: formatted.suggestions }));
        } else {
          logger.console(formatError(error.message, {
            suggestions: [
              'Check the build reference format',
              'Run `bktide token --check` to verify token scopes',
            ],
          }));
        }
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
```

- [ ] **Step 5: Run scope-path tests, see them pass**

```bash
npm test -- Artifacts
```

Expected: PASS, including the two new scope-error tests *and* the existing artifact tests still green.

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: PASS, all suites green.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual end-to-end (optional, requires a token without `read_artifacts`)**

```bash
npm run build
# Use a token that has read_builds but not read_artifacts:
bin/bktide artifacts list gusto/gdev-wishing-well/6028
```

Expected output snippet:

```
✖ Your Buildkite API token is missing the read_artifacts scope (Read Artifacts), needed for: artifacts list, artifacts download, snapshot --artifacts

  → Open https://buildkite.com/user/api-access-tokens
  → Edit your token and enable "Read Artifacts"
  → Then run: bktide token --reset && bktide token --store
```

No "Check the build reference format" line.

- [ ] **Step 9: Commit**

```bash
git add src/commands/ArtifactsList.ts src/commands/ArtifactsDownload.ts test/commands/Artifacts.test.ts
git commit -m "feat(artifacts): show scope-specific guidance when token is missing read_artifacts"
```

---

## Test Plan

- [ ] `npm test` passes (target: all green; ~16 new tests added across tasks 1-7)
- [ ] `npx tsc --noEmit` clean
- [ ] Manual: `bktide token --check` against a full-scope token → "Granted scopes:" lists all six
- [ ] Manual: `bktide token --check` against a token missing `read_artifacts` → "Missing scopes:" block appears with display name, command list, and three-step fix
- [ ] Manual: `bktide artifacts list <ref>` against scope-deficient token → scope-specific guidance, no "Check the build reference format" hint
- [ ] Manual: `bktide artifacts list <ref>` against valid token → still works against a real Buildkite build (e.g. `gusto/gdev-wishing-well/6028`)
- [ ] Manual: `bktide token --check --format json` → JSON includes `validation.scopes.granted` and `validation.scopes.missing` arrays

## Out of Scope

- Auto-fixing scopes (Buildkite API doesn't allow it)
- Caching scope results (scopes change rarely; one extra REST call is fine)
- GraphQL scope detection (the GraphQL endpoint doesn't expose scopes the same way; the REST `/v2/access-token` covers what we need)
- Lifting the parser into the REST client layer / typed `ScopeError` class — possible follow-up if other commands hit the same pattern, but YAGNI for now
- Updating `Snapshot.ts` to surface scope errors when `--artifacts` is set; out of scope because the snapshot command's error path is much larger and warrants its own pass
