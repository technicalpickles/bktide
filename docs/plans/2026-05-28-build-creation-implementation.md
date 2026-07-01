# Build Creation Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `bktide build create` and `bktide build rebuild` subcommands that write to the Buildkite API, with `--watch` support reusing the existing `BuildPoller`.

**Architecture:** Two new commands extending `BaseCommand`. Two new write methods on `BuildkiteRestClient` (built atop a shared `_request` helper that handles auth + rate limits + errors, no cache). One new GraphQL helper for pipeline auto-detection. New formatters for create/rebuild output. The existing `bktide build` command is converted into a command group with `show` as the default subcommand to host the new verbs.

**Tech Stack:** TypeScript (strict mode, ES modules), Node.js 20+, Commander.js, Vitest + MSW, node-fetch, Pino.

**Spec:** `docs/plans/2026-05-28-build-creation-design.md`

---

## File Structure

**Files to create:**
- `src/utils/envParser.ts` — Pure helper to parse `KEY=VAL` strings into a `Record<string, string>`.
- `src/commands/CreateBuild.ts` — New build command.
- `src/commands/RebuildBuild.ts` — Rebuild command.
- `src/formatters/build-create/Formatter.ts` — Interface + abstract base for the new formatter family.
- `src/formatters/build-create/PlainTextFormatter.ts`
- `src/formatters/build-create/JsonFormatter.ts`
- `src/formatters/build-create/AlfredFormatter.ts`
- `src/formatters/build-create/index.ts`
- `test/utils/envParser.test.ts`
- `test/services/BuildkiteRestClient.write.test.ts`
- `test/services/BuildkiteClient.pipelinesForRepo.test.ts`
- `test/commands/CreateBuild.test.ts`
- `test/commands/RebuildBuild.test.ts`
- `test/formatters/build-create.test.ts`

**Files to modify:**
- `src/services/BuildkiteRestClient.ts` — Add `_request`, `post`, `put`, `createBuild`, `rebuildBuild`.
- `src/services/BuildkiteClient.ts` — Add `getPipelinesForRepo` (variant of `getPipelineBuildsForRepo`).
- `src/utils/gitContext.ts` — Add `getHeadCommit()` and `getHeadCommitMessage()`.
- `src/formatters/FormatterFactory.ts` — Register new `BUILD_CREATE` type.
- `src/formatters/index.ts` — Export new formatter family.
- `src/commands/index.ts` — Export `CreateBuild`, `RebuildBuild`.
- `src/index.ts` — Restructure `bktide build` into command group with `show` (default), `create`, `rebuild` subcommands.
- `test/utils/gitContext.test.ts` — Add cases for new helpers.

---

## Task 1: Env parser helper

Pure function with no dependencies; easiest to land first.

**Files:**
- Create: `src/utils/envParser.ts`
- Test: `test/utils/envParser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/utils/envParser.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- envParser`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/envParser.ts
export function parseEnvEntries(entries: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf('=');
    if (eqIndex <= 0) {
      throw new Error(`Invalid --env entry: "${entry}". Use KEY=VAL.`);
    }
    const key = entry.substring(0, eqIndex);
    const value = entry.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- envParser`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/envParser.ts test/utils/envParser.test.ts
git commit -m "feat(utils): add envParser helper for KEY=VAL strings"
```

---

## Task 2: Git context helpers for commit and message

**Files:**
- Modify: `src/utils/gitContext.ts`
- Modify: `test/utils/gitContext.test.ts`

- [ ] **Step 1: Add failing tests for new helpers**

Append to `test/utils/gitContext.test.ts`:

```typescript
import { getHeadCommit, getHeadCommitMessage } from '../../src/utils/gitContext.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- gitContext`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement helpers**

Append to `src/utils/gitContext.ts`:

```typescript
export function getHeadCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Not a git repository or no commits yet. Pass --commit or provide a ref.');
  }
}

export function getHeadCommitMessage(): string {
  try {
    return execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Could not read git commit message. Pass --message or provide a ref.');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- gitContext`
Expected: PASS — all existing + 5 new cases.

- [ ] **Step 5: Commit**

```bash
git add src/utils/gitContext.ts test/utils/gitContext.test.ts
git commit -m "feat(utils): add getHeadCommit and getHeadCommitMessage helpers"
```

---

## Task 3: REST client write capability

Add a shared private `_request<T>` that handles fetch + auth + rate limits + error categorization (no cache). Build `post<T>` and `put<T>` on top.

**Files:**
- Modify: `src/services/BuildkiteRestClient.ts`
- Create: `test/services/BuildkiteRestClient.write.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/services/BuildkiteRestClient.write.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);

function jsonResponse(body: any, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        if (name === 'RateLimit-Remaining') return '99';
        if (name === 'RateLimit-Limit') return '100';
        if (name === 'RateLimit-Reset') return '60';
        return null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('BuildkiteRestClient writes', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  describe('post', () => {
    it('sends POST with JSON body and bearer token', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ number: 42 }));

      const result = await (client as any).post('/test', { foo: 'bar' });

      expect(result).toEqual({ number: 42 });
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('/test');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-token');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.body).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('throws with API error body on non-2xx', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: { get: () => null },
        json: async () => ({ message: 'commit is required', errors: [{ message: 'commit is blank' }] }),
        text: async () => '{"message":"commit is required","errors":[{"message":"commit is blank"}]}',
      } as any);

      await expect((client as any).post('/test', {})).rejects.toThrow(/commit is required/);
    });

    it('updates rate limit info from response headers', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await (client as any).post('/test', {});
      expect(client.getRateLimitInfo()).toEqual({ remaining: 99, limit: 100, reset: 60 });
    });
  });

  describe('put', () => {
    it('sends PUT with optional body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ number: 43 }));

      const result = await (client as any).put('/test/rebuild');

      expect(result).toEqual({ number: 43 });
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe('PUT');
      expect(init.body).toBeUndefined();
    });

    it('serializes body when provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await (client as any).put('/test', { foo: 1 });
      const [, init] = mockFetch.mock.calls[0];
      expect(init.body).toBe(JSON.stringify({ foo: 1 }));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- BuildkiteRestClient.write`
Expected: FAIL — `post` / `put` methods don't exist.

- [ ] **Step 3: Add the private `_request` helper and `post`/`put` wrappers**

Edit `src/services/BuildkiteRestClient.ts`. Insert after the existing `get<T>` method (around line 202) and before `isAuthenticationError`:

```typescript
  /**
   * Send a request to the Buildkite REST API. Used by write methods.
   * Skips cache entirely. Updates rate-limit info on success and surfaces
   * Buildkite's error payload verbatim on failure.
   */
  private async _request<T = any>(
    method: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = process.hrtime.bigint();

    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Starting REST API request: ${method} ${endpoint}`);
      logger.debug(`${getProgressIcon('STARTING')} Request URL: ${url}`);
      if (body !== undefined) {
        logger.debug(`${getProgressIcon('STARTING')} Request body: ${JSON.stringify(body)}`);
      }
    }

    const init: any = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    // Rate limit headers are present on writes too
    this.rateLimitInfo = {
      remaining: parseInt(response.headers.get('RateLimit-Remaining') || '0'),
      limit: parseInt(response.headers.get('RateLimit-Limit') || '0'),
      reset: parseInt(response.headers.get('RateLimit-Reset') || '0'),
    };

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API request failed with status ${response.status}: ${errorText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `API request failed: ${errorJson.message}`;
        }
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          errorMessage += `\nErrors: ${errorJson.errors.map((e: any) => e.message).join(', ')}`;
        }
      } catch {
        // body is not JSON, leave errorMessage as-is
      }

      const isAuthError = this.isAuthenticationError(response.status, errorMessage);
      if (isAuthError && this.debug) {
        logger.debug('Authentication error detected on write request');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json() as T;

    if (this.debug) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      logger.debug(`${getProgressIcon('SUCCESS_LOG')} REST API request completed: ${method} ${endpoint} (${duration.toFixed(2)}ms)`);
    }

    return data;
  }

  /**
   * POST to the Buildkite REST API. Caching is bypassed; writes always hit the network.
   */
  public async post<T = any>(endpoint: string, body: unknown): Promise<T> {
    return this._request<T>('POST', endpoint, body);
  }

  /**
   * PUT to the Buildkite REST API. Body is optional (e.g. rebuild has no body).
   */
  public async put<T = any>(endpoint: string, body?: unknown): Promise<T> {
    return this._request<T>('PUT', endpoint, body);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- BuildkiteRestClient.write`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full test suite to catch regressions**

Run: `npm test`
Expected: PASS for everything.

- [ ] **Step 6: Commit**

```bash
git add src/services/BuildkiteRestClient.ts test/services/BuildkiteRestClient.write.test.ts
git commit -m "feat(rest-client): add post/put for write endpoints"
```

---

## Task 4: REST client `createBuild`

**Files:**
- Modify: `src/services/BuildkiteRestClient.ts`
- Modify: `test/services/BuildkiteRestClient.write.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/services/BuildkiteRestClient.write.test.ts`:

```typescript
describe('createBuild', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  it('POSTs to the correct endpoint with the payload', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      number: 4567,
      state: 'scheduled',
      web_url: 'https://buildkite.com/gusto/zp/builds/4567',
      pipeline: { slug: 'zp' },
    }));

    const result = await client.createBuild('gusto', 'zp', {
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: { DEBUG: '1' },
    });

    expect(result.number).toBe(4567);
    expect(result.web_url).toBe('https://buildkite.com/gusto/zp/builds/4567');

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/organizations/gusto/pipelines/zp/builds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: { DEBUG: '1' },
    });
  });

  it('omits message and env when not provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ number: 1, state: 'scheduled', web_url: '', pipeline: { slug: 'p' } }));
    await client.createBuild('o', 'p', { commit: 'abc', branch: 'main' });
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ commit: 'abc', branch: 'main' });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- BuildkiteRestClient.write`
Expected: FAIL — `createBuild` method missing.

- [ ] **Step 3: Add the types and method**

Add after the existing `getBuilds` method in `src/services/BuildkiteRestClient.ts`:

```typescript
  /**
   * Payload accepted by createBuild. Mirrors the Buildkite REST API shape;
   * we expose only the fields v1 uses.
   */
  // Exported as a named export at the top of the file alongside other types.
  public async createBuild(
    org: string,
    pipeline: string,
    payload: CreateBuildPayload,
  ): Promise<BuildkiteBuildResponse> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds`;
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Creating build in ${org}/${pipeline}`);
    }
    return this.post<BuildkiteBuildResponse>(endpoint, payload);
  }
```

Add the types near the top of the file, next to `BuildkiteRestClientOptions`:

```typescript
export interface CreateBuildPayload {
  commit: string;
  branch: string;
  message?: string;
  env?: Record<string, string>;
}

export interface BuildkiteBuildResponse {
  number: number;
  state: string;
  web_url: string;
  pipeline: { slug: string };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- BuildkiteRestClient.write`
Expected: PASS, 7 tests total in file.

- [ ] **Step 5: Commit**

```bash
git add src/services/BuildkiteRestClient.ts test/services/BuildkiteRestClient.write.test.ts
git commit -m "feat(rest-client): add createBuild method"
```

---

## Task 5: REST client `rebuildBuild`

**Files:**
- Modify: `src/services/BuildkiteRestClient.ts`
- Modify: `test/services/BuildkiteRestClient.write.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/services/BuildkiteRestClient.write.test.ts`:

```typescript
describe('rebuildBuild', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  it('PUTs the rebuild endpoint with no body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      number: 4568,
      state: 'scheduled',
      web_url: 'https://buildkite.com/gusto/zp/builds/4568',
      pipeline: { slug: 'zp' },
    }));

    const result = await client.rebuildBuild('gusto', 'zp', 4567);

    expect(result.number).toBe(4568);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain('/organizations/gusto/pipelines/zp/builds/4567/rebuild');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeUndefined();
  });

  it('throws on 404 with the API message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => '{"message":"Not Found"}',
      json: async () => ({ message: 'Not Found' }),
    } as any);

    await expect(client.rebuildBuild('o', 'p', 999)).rejects.toThrow(/Not Found/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- BuildkiteRestClient.write`
Expected: FAIL — `rebuildBuild` missing.

- [ ] **Step 3: Add the method**

Add to `src/services/BuildkiteRestClient.ts` immediately after `createBuild`:

```typescript
  /**
   * Rebuild an existing build with the same parameters. Returns the new build.
   */
  public async rebuildBuild(
    org: string,
    pipeline: string,
    buildNumber: number,
  ): Promise<BuildkiteBuildResponse> {
    const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/rebuild`;
    if (this.debug) {
      logger.debug(`${getProgressIcon('STARTING')} Rebuilding ${org}/${pipeline}/${buildNumber}`);
    }
    return this.put<BuildkiteBuildResponse>(endpoint);
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- BuildkiteRestClient.write`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/BuildkiteRestClient.ts test/services/BuildkiteRestClient.write.test.ts
git commit -m "feat(rest-client): add rebuildBuild method"
```

---

## Task 6: GraphQL `getPipelinesForRepo`

A variant of `getPipelineBuildsForRepo` that doesn't require an existing build. Returns pipelines matching the repo URL candidates.

**Files:**
- Modify: `src/services/BuildkiteClient.ts`
- Create: `test/services/BuildkiteClient.pipelinesForRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/services/BuildkiteClient.pipelinesForRepo.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';

describe('BuildkiteClient.getPipelinesForRepo', () => {
  let client: BuildkiteClient;

  beforeEach(() => {
    client = new BuildkiteClient('test-token', { caching: false });
  });

  it('returns pipelines matching any candidate URL, deduped', async () => {
    const querySpy = vi.spyOn(client as any, 'query').mockResolvedValue({
      organization: {
        repo0: { edges: [{ node: { id: 'p1', name: 'Main', slug: 'main', repository: { url: 'git@github.com:gusto/zp.git' } } }] },
        repo1: { edges: [{ node: { id: 'p1', name: 'Main', slug: 'main', repository: { url: 'git@github.com:gusto/zp.git' } } }] },
        repo2: { edges: [{ node: { id: 'p2', name: 'Nightly', slug: 'nightly', repository: { url: 'https://github.com/gusto/zp.git' } } }] },
      },
    });

    const result = await client.getPipelinesForRepo('gusto', [
      'git@github.com:gusto/zp.git',
      'git@github.com:gusto/zp',
      'https://github.com/gusto/zp.git',
    ]);

    expect(result).toHaveLength(2);
    expect(result.map(p => p.slug).sort()).toEqual(['main', 'nightly']);
    expect(querySpy).toHaveBeenCalledOnce();
  });

  it('returns empty array when no pipelines match', async () => {
    vi.spyOn(client as any, 'query').mockResolvedValue({
      organization: { repo0: { edges: [] } },
    });
    const result = await client.getPipelinesForRepo('gusto', ['nope']);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- pipelinesForRepo`
Expected: FAIL — method missing.

- [ ] **Step 3: Add the method**

Insert in `src/services/BuildkiteClient.ts` immediately after `getPipelineBuildsForRepo` (after line 988):

```typescript
  /**
   * Find pipelines matching any of the given repo URL candidates.
   * Like getPipelineBuildsForRepo but doesn't require an existing build —
   * used by `bktide build create` to resolve which pipeline to trigger.
   */
  public async getPipelinesForRepo(
    orgSlug: string,
    repoCandidates: string[],
  ): Promise<Array<{ id: string; name: string; slug: string; repository: { url: string } }>> {
    const aliases = repoCandidates.map((url, i) => {
      const alias = `repo${i}`;
      return `${alias}: pipelines(first: 50, repository: { url: ${JSON.stringify(url)} }, archived: false) {
        edges {
          node {
            id
            name
            slug
            repository { url }
          }
        }
      }`;
    });

    const query = `query GetPipelinesForRepo($orgSlug: ID!) {
      organization(slug: $orgSlug) {
        ${aliases.join('\n        ')}
      }
    }`;

    const data = await this.query<any>(query, { orgSlug });

    const seen = new Set<string>();
    const results: Array<{ id: string; name: string; slug: string; repository: { url: string } }> = [];

    for (let i = 0; i < repoCandidates.length; i++) {
      const edges = data.organization?.[`repo${i}`]?.edges || [];
      for (const edge of edges) {
        const node = edge.node;
        if (seen.has(node.id)) continue;
        seen.add(node.id);
        results.push({
          id: node.id,
          name: node.name,
          slug: node.slug,
          repository: node.repository,
        });
      }
    }

    return results;
  }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- pipelinesForRepo`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/BuildkiteClient.ts test/services/BuildkiteClient.pipelinesForRepo.test.ts
git commit -m "feat(graphql): add getPipelinesForRepo for build create"
```

---

## Task 7: build-create formatter family

**Files:**
- Create: `src/formatters/build-create/Formatter.ts`
- Create: `src/formatters/build-create/PlainTextFormatter.ts`
- Create: `src/formatters/build-create/JsonFormatter.ts`
- Create: `src/formatters/build-create/AlfredFormatter.ts`
- Create: `src/formatters/build-create/index.ts`
- Modify: `src/formatters/FormatterFactory.ts`
- Modify: `src/formatters/index.ts`
- Create: `test/formatters/build-create.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/formatters/build-create.test.ts
import { describe, it, expect } from 'vitest';
import { getBuildCreateFormatter } from '../../src/formatters/build-create/index.js';

const build = {
  number: 4567,
  state: 'scheduled',
  web_url: 'https://buildkite.com/gusto/zp/builds/4567',
  pipeline: { slug: 'zp' },
};

describe('build-create formatters', () => {
  it('plain text shows the build number and URL', () => {
    const out = getBuildCreateFormatter('plain').formatBuild(build, { verb: 'created' });
    expect(out).toContain('#4567');
    expect(out).toContain('https://buildkite.com/gusto/zp/builds/4567');
    expect(out.toLowerCase()).toContain('created');
  });

  it('plain text supports the rebuilt verb', () => {
    const out = getBuildCreateFormatter('plain').formatBuild(build, { verb: 'rebuilt' });
    expect(out.toLowerCase()).toContain('rebuilt');
  });

  it('json returns the raw payload', () => {
    const out = getBuildCreateFormatter('json').formatBuild(build, { verb: 'created' });
    expect(JSON.parse(out)).toEqual(build);
  });

  it('alfred returns a single-item Alfred payload', () => {
    const out = getBuildCreateFormatter('alfred').formatBuild(build, { verb: 'created' });
    const parsed = JSON.parse(out);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].arg).toBe(build.web_url);
    expect(parsed.items[0].title).toContain('#4567');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- build-create`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the formatter interface**

```typescript
// src/formatters/build-create/Formatter.ts
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';

export interface BuildCreateFormatterOptions {
  verb: 'created' | 'rebuilt';
}

export interface BuildCreateFormatter {
  formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string;
}

export abstract class BaseBuildCreateFormatter implements BuildCreateFormatter {
  abstract name: string;
  abstract formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string;
}
```

- [ ] **Step 4: Plain formatter**

```typescript
// src/formatters/build-create/PlainTextFormatter.ts
import { BaseBuildCreateFormatter, BuildCreateFormatterOptions } from './Formatter.js';
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';
import { SEMANTIC_COLORS } from '../../ui/theme.js';

export class PlainTextFormatter extends BaseBuildCreateFormatter {
  name = 'plain';

  formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string {
    const lines: string[] = [];
    lines.push(`${options.verb === 'created' ? 'Created' : 'Rebuilt'} build #${build.number}`);
    lines.push(SEMANTIC_COLORS.muted(build.web_url));
    return lines.join('\n');
  }
}
```

- [ ] **Step 5: JSON formatter**

```typescript
// src/formatters/build-create/JsonFormatter.ts
import { BaseBuildCreateFormatter, BuildCreateFormatterOptions } from './Formatter.js';
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';

export class JsonFormatter extends BaseBuildCreateFormatter {
  name = 'json';

  formatBuild(build: BuildkiteBuildResponse, _options: BuildCreateFormatterOptions): string {
    return JSON.stringify(build, null, 2);
  }
}
```

- [ ] **Step 6: Alfred formatter**

```typescript
// src/formatters/build-create/AlfredFormatter.ts
import { BaseBuildCreateFormatter, BuildCreateFormatterOptions } from './Formatter.js';
import { BuildkiteBuildResponse } from '../../services/BuildkiteRestClient.js';

export class AlfredFormatter extends BaseBuildCreateFormatter {
  name = 'alfred';

  formatBuild(build: BuildkiteBuildResponse, options: BuildCreateFormatterOptions): string {
    const verb = options.verb === 'created' ? 'Created' : 'Rebuilt';
    return JSON.stringify({
      items: [
        {
          uid: `build-${build.number}`,
          title: `${verb} build #${build.number}`,
          subtitle: build.web_url,
          arg: build.web_url,
        },
      ],
    });
  }
}
```

- [ ] **Step 7: Index + factory wiring**

```typescript
// src/formatters/build-create/index.ts
import { BuildCreateFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';
import { logger } from '../../services/logger.js';

export function getBuildCreateFormatter(format: string = 'plain'): BuildCreateFormatter {
  const normalizedFormat = format.toLowerCase().trim();
  switch (normalizedFormat) {
    case 'json':
      return new JsonFormatter();
    case 'alfred':
      return new AlfredFormatter();
    case 'plain':
    case 'text':
      return new PlainTextFormatter();
    default:
      logger.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
}

export type { BuildCreateFormatter };
```

- [ ] **Step 8: Register in FormatterFactory**

In `src/formatters/FormatterFactory.ts`:

1. Add import at the top: `import { getBuildCreateFormatter } from './build-create/index.js';`
2. Add enum value: `BUILD_CREATE = 'build-create',`
3. Add switch case:
```typescript
case FormatterType.BUILD_CREATE:
  return getBuildCreateFormatter(normalizedFormat) as any;
```

- [ ] **Step 9: Export from formatters index**

If `src/formatters/index.ts` re-exports family helpers, append: `export { getBuildCreateFormatter } from './build-create/index.js';` (only if existing exports follow this pattern — check first; if it only re-exports the factory, skip this step).

- [ ] **Step 10: Run the tests**

Run: `npm test -- build-create`
Expected: PASS, 4 tests.

- [ ] **Step 11: Run full suite**

Run: `npm test`
Expected: PASS overall.

- [ ] **Step 12: Commit**

```bash
git add src/formatters/build-create test/formatters/build-create.test.ts src/formatters/FormatterFactory.ts src/formatters/index.ts
git commit -m "feat(formatters): add build-create formatter family"
```

---

## Task 8: `CreateBuild` command — explicit pipeline path

Build the command incrementally. This task handles the case where `<org>/<pipeline>` is passed explicitly, no auto-detection, no watch yet.

**Files:**
- Create: `src/commands/CreateBuild.ts`
- Modify: `src/commands/index.ts`
- Create: `test/commands/CreateBuild.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/commands/CreateBuild.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateBuild } from '../../src/commands/CreateBuild.js';
import { logger } from '../../src/services/logger.js';

describe('CreateBuild — explicit pipeline', () => {
  let command: CreateBuild;
  let consoleOutput: string[];

  beforeEach(() => {
    command = new CreateBuild({ token: 'test-token' });
    consoleOutput = [];
    vi.spyOn(logger, 'console').mockImplementation((msg: string) => {
      consoleOutput.push(msg);
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('calls createBuild with provided flags and prints the result', async () => {
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 4567,
        state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4567',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: ['DEBUG=1', 'NODE_ENV=production'],
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.createBuild).toHaveBeenCalledWith('gusto', 'zp', {
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: { DEBUG: '1', NODE_ENV: 'production' },
    });
    expect(consoleOutput.join('\n')).toContain('#4567');
  });

  it('returns 1 when --env is malformed', async () => {
    const mockRest = { createBuild: vi.fn() };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      commit: 'abc',
      branch: 'main',
      env: ['BAD_ENTRY'],
      token: 'test-token',
    });

    expect(exit).toBe(1);
    expect(mockRest.createBuild).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- CreateBuild`
Expected: FAIL — `CreateBuild` module missing.

- [ ] **Step 3: Create the command (explicit path only for now)**

```typescript
// src/commands/CreateBuild.ts
import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { parseEnvEntries } from '../utils/envParser.js';
import { CreateBuildPayload } from '../services/BuildkiteRestClient.js';

export interface CreateBuildOptions extends BaseCommandOptions {
  pipelineRef?: string;       // "org/pipeline" or undefined for auto-detect
  commit?: string;
  branch?: string;
  message?: string;
  env?: string[];
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class CreateBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: CreateBuildOptions): Promise<number> {
    try {
      await this.ensureInitialized();

      // Resolve org/pipeline. Auto-detection comes in Task 9.
      if (!options.pipelineRef) {
        logger.error('Pipeline reference is required. Pass "<org>/<pipeline>".');
        return 1;
      }
      const [org, pipeline] = options.pipelineRef.split('/');
      if (!org || !pipeline) {
        logger.error(`Invalid pipeline reference "${options.pipelineRef}". Use "<org>/<pipeline>".`);
        return 1;
      }

      if (!options.commit || !options.branch) {
        logger.error('--commit and --branch are required.');
        return 1;
      }

      let env: Record<string, string> | undefined;
      if (options.env && options.env.length > 0) {
        try {
          env = parseEnvEntries(options.env);
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
          return 1;
        }
      }

      const payload: CreateBuildPayload = {
        commit: options.commit,
        branch: options.branch,
        ...(options.message ? { message: options.message } : {}),
        ...(env ? { env } : {}),
      };

      const build = await this.restClient.createBuild(org, pipeline, payload);

      const formatter = FormatterFactory.getFormatter(FormatterType.BUILD_CREATE, options.format || 'plain') as any;
      logger.console(formatter.formatBuild(build, { verb: 'created' }));

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(message);
      return 1;
    }
  }
}
```

- [ ] **Step 4: Export from commands/index.ts**

Add to `src/commands/index.ts`:
```typescript
export { CreateBuild } from './CreateBuild.js';
```

- [ ] **Step 5: Run tests**

Run: `npm test -- CreateBuild`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/commands/CreateBuild.ts src/commands/index.ts test/commands/CreateBuild.test.ts
git commit -m "feat(commands): add CreateBuild for explicit pipeline ref"
```

---

## Task 9: `CreateBuild` — git auto-detect path

Extend `CreateBuild` to auto-detect commit / branch / message from git, and auto-detect the pipeline from the git remote URL.

**Files:**
- Modify: `src/commands/CreateBuild.ts`
- Modify: `test/commands/CreateBuild.test.ts`

- [ ] **Step 1: Add failing tests for auto-detect**

Append to `test/commands/CreateBuild.test.ts`:

```typescript
import * as gitContext from '../../src/utils/gitContext.js';
import * as repoUrl from '../../src/utils/repoUrl.js';

describe('CreateBuild — git auto-detect', () => {
  let command: CreateBuild;
  let consoleOutput: string[];

  beforeEach(() => {
    command = new CreateBuild({ token: 'test-token' });
    consoleOutput = [];
    vi.spyOn(logger, 'console').mockImplementation((msg: string) => {
      consoleOutput.push(msg);
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('uses git context when commit/branch/message omitted', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'feature/foo',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });
    vi.spyOn(gitContext, 'getHeadCommit').mockReturnValue('abc123');
    vi.spyOn(gitContext, 'getHeadCommitMessage').mockReturnValue('Fix it');

    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 1, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/1',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.createBuild).toHaveBeenCalledWith('gusto', 'zp', {
      commit: 'abc123',
      branch: 'feature/foo',
      message: 'Fix it',
    });
  });

  it('auto-detects pipeline when ref is omitted and single match', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'main',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });
    vi.spyOn(gitContext, 'getHeadCommit').mockReturnValue('abc');
    vi.spyOn(gitContext, 'getHeadCommitMessage').mockReturnValue('msg');

    const mockGql = {
      getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['gusto']),
      getPipelinesForRepo: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'ZP', slug: 'zp', repository: { url: 'git@github.com:gusto/zp.git' } },
      ]),
    };
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 1, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/1',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._client = mockGql;
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({ token: 'test-token' });

    expect(exit).toBe(0);
    expect(mockRest.createBuild).toHaveBeenCalledWith('gusto', 'zp', expect.any(Object));
  });

  it('bails with the candidate list when multiple pipelines match', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'main',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });

    const mockGql = {
      getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['gusto']),
      getPipelinesForRepo: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Main', slug: 'main', repository: { url: 'x' } },
        { id: 'p2', name: 'Nightly', slug: 'nightly', repository: { url: 'x' } },
      ]),
    };
    const mockRest = { createBuild: vi.fn() };
    (command as any)._client = mockGql;
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({ token: 'test-token' });

    expect(exit).toBe(1);
    expect(mockRest.createBuild).not.toHaveBeenCalled();
  });

  it('bails when no pipelines match the repo', async () => {
    vi.spyOn(gitContext, 'getGitContext').mockReturnValue({
      branch: 'main',
      remoteUrl: 'git@github.com:gusto/zp.git',
    });

    const mockGql = {
      getViewerOrganizationSlugs: vi.fn().mockResolvedValue(['gusto']),
      getPipelinesForRepo: vi.fn().mockResolvedValue([]),
    };
    (command as any)._client = mockGql;
    (command as any)._restClient = { createBuild: vi.fn() };
    (command as any).initialized = true;

    const exit = await command.execute({ token: 'test-token' });
    expect(exit).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, observe failures**

Run: `npm test -- CreateBuild`
Expected: FAIL — auto-detect branch not implemented.

- [ ] **Step 3: Extend `CreateBuild.execute` with auto-detect**

Replace `src/commands/CreateBuild.ts` body of `execute` with this updated version (preserves existing behavior and adds the new branches):

```typescript
import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { parseEnvEntries } from '../utils/envParser.js';
import { CreateBuildPayload } from '../services/BuildkiteRestClient.js';
import { getGitContext, getHeadCommit, getHeadCommitMessage } from '../utils/gitContext.js';
import { parseGitRemoteUrl, generateRepoCandidates } from '../utils/repoUrl.js';
import { SEMANTIC_COLORS } from '../ui/theme.js';

export interface CreateBuildOptions extends BaseCommandOptions {
  pipelineRef?: string;
  commit?: string;
  branch?: string;
  message?: string;
  env?: string[];
  org?: string;
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class CreateBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: CreateBuildOptions): Promise<number> {
    try {
      await this.ensureInitialized();

      // 1. Resolve org / pipeline
      let org: string;
      let pipeline: string;

      if (options.pipelineRef) {
        const parts = options.pipelineRef.split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          logger.error(`Invalid pipeline reference "${options.pipelineRef}". Use "<org>/<pipeline>".`);
          return 1;
        }
        [org, pipeline] = parts;
      } else {
        const resolved = await this.resolvePipelineFromGit(options);
        if (!resolved) return 1;
        org = resolved.org;
        pipeline = resolved.pipeline;
      }

      // 2. Resolve commit / branch / message
      const commit = options.commit ?? this.tryGitFn(getHeadCommit);
      const branch = options.branch ?? this.tryGitFn(() => getGitContext().branch);
      const message = options.message ?? this.tryGitFn(getHeadCommitMessage);

      if (!commit) { logger.error('--commit is required (or run inside a git repo).'); return 1; }
      if (!branch) { logger.error('--branch is required (or run inside a git repo).'); return 1; }

      // 3. Env parsing
      let env: Record<string, string> | undefined;
      if (options.env && options.env.length > 0) {
        try {
          env = parseEnvEntries(options.env);
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
          return 1;
        }
      }

      // 4. Build payload + call API
      const payload: CreateBuildPayload = {
        commit,
        branch,
        ...(message ? { message } : {}),
        ...(env ? { env } : {}),
      };

      const build = await this.restClient.createBuild(org, pipeline, payload);

      const formatter = FormatterFactory.getFormatter(FormatterType.BUILD_CREATE, options.format || 'plain') as any;
      logger.console(formatter.formatBuild(build, { verb: 'created' }));

      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(message);
      return 1;
    }
  }

  private tryGitFn(fn: () => string): string | undefined {
    try { return fn(); } catch { return undefined; }
  }

  private async resolvePipelineFromGit(options: CreateBuildOptions): Promise<{ org: string; pipeline: string } | null> {
    let gitCtx;
    try {
      gitCtx = getGitContext();
    } catch (error) {
      logger.error(`${error instanceof Error ? error.message : error} Pass "<org>/<pipeline>" to 'bktide build create'.`);
      return null;
    }

    const parsed = parseGitRemoteUrl(gitCtx.remoteUrl);
    const candidates = generateRepoCandidates(parsed);

    // Resolve org
    let orgSlug = options.org;
    if (!orgSlug) {
      const orgSlugs = await this.client.getViewerOrganizationSlugs();
      if (orgSlugs.length === 0) {
        logger.error('No organizations found. Check your API token permissions.');
        return null;
      }
      if (orgSlugs.length > 1) {
        logger.error(`Multiple organizations found: ${orgSlugs.join(', ')}. Use --org to specify which one.`);
        return null;
      }
      orgSlug = orgSlugs[0];
    }

    const pipelines = await this.client.getPipelinesForRepo(orgSlug, candidates);

    if (pipelines.length === 0) {
      logger.error(`No Buildkite pipelines match the remote ${gitCtx.remoteUrl}. Pass "<org>/<pipeline>" explicitly.`);
      return null;
    }
    if (pipelines.length > 1) {
      logger.error('Multiple pipelines match this repository. Pass "<org>/<pipeline>" explicitly:');
      for (const p of pipelines) {
        logger.error(`  ${SEMANTIC_COLORS.muted('-')} ${orgSlug}/${p.slug}  ${SEMANTIC_COLORS.muted(`(${p.name})`)}`);
      }
      return null;
    }

    return { org: orgSlug, pipeline: pipelines[0].slug };
  }
}
```

- [ ] **Step 4: Run all CreateBuild tests**

Run: `npm test -- CreateBuild`
Expected: PASS, 6 tests total in file.

- [ ] **Step 5: Commit**

```bash
git add src/commands/CreateBuild.ts test/commands/CreateBuild.test.ts
git commit -m "feat(commands): add git-aware auto-detect to CreateBuild"
```

---

## Task 10: `CreateBuild` — `--watch` handoff to BuildPoller

**Files:**
- Modify: `src/commands/CreateBuild.ts`
- Modify: `test/commands/CreateBuild.test.ts`

- [ ] **Step 1: Add failing test for watch handoff**

Append to `test/commands/CreateBuild.test.ts`:

```typescript
import * as buildPollerModule from '../../src/services/BuildPoller.js';

describe('CreateBuild — --watch', () => {
  let command: CreateBuild;
  beforeEach(() => {
    command = new CreateBuild({ token: 'test-token' });
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('hands the new build off to BuildPoller when --watch is set', async () => {
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 4567,
        state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4567',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const watchMock = vi.fn().mockResolvedValue({ state: 'passed' });
    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(() => ({
      watch: watchMock,
    } as any));

    const exit = await command.execute({
      pipelineRef: 'gusto/zp',
      commit: 'abc', branch: 'main',
      watch: true,
      token: 'test-token',
    });

    expect(watchMock).toHaveBeenCalledWith({ org: 'gusto', pipeline: 'zp', buildNumber: 4567 });
    expect(exit).toBe(0);
  });

  it('returns 1 when the watched build does not pass', async () => {
    const mockRest = {
      createBuild: vi.fn().mockResolvedValue({
        number: 1, state: 'scheduled',
        web_url: 'https://buildkite.com/o/p/builds/1',
        pipeline: { slug: 'p' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(() => ({
      watch: vi.fn().mockResolvedValue({ state: 'failed' }),
    } as any));

    const exit = await command.execute({
      pipelineRef: 'o/p',
      commit: 'abc', branch: 'main',
      watch: true,
      token: 'test-token',
    });

    expect(exit).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, observe failure**

Run: `npm test -- CreateBuild`
Expected: FAIL — `--watch` branch not implemented.

- [ ] **Step 3: Add the watch branch**

In `src/commands/CreateBuild.ts`, add the import:

```typescript
import { BuildPoller } from '../services/BuildPoller.js';
```

After the `logger.console(formatter.formatBuild(...))` line in `execute`, add:

```typescript
      if (options.watch) {
        const pollerOpts = {
          ...(options.timeout ? { timeout: options.timeout * 60 * 1000 } : {}),
          ...(options.pollInterval ? { initialInterval: options.pollInterval * 1000 } : {}),
        };
        const poller = new BuildPoller(this.restClient, {
          onJobStateChange: (_change) => { /* TODO: stream display in follow-up */ },
          onBuildComplete: (_build) => { /* final summary printed by formatter run elsewhere */ },
          onError: (err, willRetry) => {
            if (!willRetry) logger.error(err.message);
          },
          onTimeout: () => logger.error('Timed out waiting for build to complete.'),
        }, pollerOpts);

        try {
          const watched = await poller.watch({ org, pipeline, buildNumber: build.number });
          return watched.state?.toLowerCase() === 'passed' ? 0 : 1;
        } catch (err) {
          logger.error(`Watch failed: ${err instanceof Error ? err.message : err}`);
          logger.error(`The build was created and is still running: ${build.web_url}`);
          return 1;
        }
      }
```

- [ ] **Step 4: Run tests**

Run: `npm test -- CreateBuild`
Expected: PASS — all CreateBuild tests.

- [ ] **Step 5: Commit**

```bash
git add src/commands/CreateBuild.ts test/commands/CreateBuild.test.ts
git commit -m "feat(commands): add --watch handoff in CreateBuild"
```

---

## Task 11: `RebuildBuild` command

**Files:**
- Create: `src/commands/RebuildBuild.ts`
- Modify: `src/commands/index.ts`
- Create: `test/commands/RebuildBuild.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/commands/RebuildBuild.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RebuildBuild } from '../../src/commands/RebuildBuild.js';
import { logger } from '../../src/services/logger.js';
import * as buildPollerModule from '../../src/services/BuildPoller.js';

describe('RebuildBuild', () => {
  let command: RebuildBuild;

  beforeEach(() => {
    command = new RebuildBuild({ token: 'test-token' });
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('parses org/pipeline/number and rebuilds', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockResolvedValue({
        number: 4568, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4568',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      buildArg: 'gusto/zp/4567',
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.rebuildBuild).toHaveBeenCalledWith('gusto', 'zp', 4567);
  });

  it('parses a full Buildkite URL', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockResolvedValue({
        number: 4568, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4568',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      buildArg: 'https://buildkite.com/gusto/zp/builds/4567',
      token: 'test-token',
    });

    expect(exit).toBe(0);
    expect(mockRest.rebuildBuild).toHaveBeenCalledWith('gusto', 'zp', 4567);
  });

  it('returns 1 on API error', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockRejectedValue(new Error('Build not found')),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const exit = await command.execute({
      buildArg: 'o/p/999',
      token: 'test-token',
    });

    expect(exit).toBe(1);
  });

  it('hands off to BuildPoller with --watch', async () => {
    const mockRest = {
      rebuildBuild: vi.fn().mockResolvedValue({
        number: 4568, state: 'scheduled',
        web_url: 'https://buildkite.com/gusto/zp/builds/4568',
        pipeline: { slug: 'zp' },
      }),
    };
    (command as any)._restClient = mockRest;
    (command as any).initialized = true;

    const watchMock = vi.fn().mockResolvedValue({ state: 'passed' });
    vi.spyOn(buildPollerModule, 'BuildPoller').mockImplementation(() => ({
      watch: watchMock,
    } as any));

    const exit = await command.execute({
      buildArg: 'gusto/zp/4567',
      watch: true,
      token: 'test-token',
    });

    expect(watchMock).toHaveBeenCalledWith({ org: 'gusto', pipeline: 'zp', buildNumber: 4568 });
    expect(exit).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, observe failure**

Run: `npm test -- RebuildBuild`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the command**

```typescript
// src/commands/RebuildBuild.ts
import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { BuildPoller } from '../services/BuildPoller.js';

export interface RebuildBuildOptions extends BaseCommandOptions {
  buildArg?: string;
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class RebuildBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: RebuildBuildOptions): Promise<number> {
    try {
      await this.ensureInitialized();

      if (!options.buildArg) {
        logger.error('Build reference is required.');
        return 1;
      }

      const ref = parseBuildRef(options.buildArg);
      const build = await this.restClient.rebuildBuild(ref.org, ref.pipeline, ref.number);

      const formatter = FormatterFactory.getFormatter(FormatterType.BUILD_CREATE, options.format || 'plain') as any;
      logger.console(formatter.formatBuild(build, { verb: 'rebuilt' }));

      if (options.watch) {
        const pollerOpts = {
          ...(options.timeout ? { timeout: options.timeout * 60 * 1000 } : {}),
          ...(options.pollInterval ? { initialInterval: options.pollInterval * 1000 } : {}),
        };
        const poller = new BuildPoller(this.restClient, {
          onJobStateChange: () => {},
          onBuildComplete: () => {},
          onError: (err, willRetry) => { if (!willRetry) logger.error(err.message); },
          onTimeout: () => logger.error('Timed out waiting for build to complete.'),
        }, pollerOpts);

        try {
          const watched = await poller.watch({ org: ref.org, pipeline: ref.pipeline, buildNumber: build.number });
          return watched.state?.toLowerCase() === 'passed' ? 0 : 1;
        } catch (err) {
          logger.error(`Watch failed: ${err instanceof Error ? err.message : err}`);
          logger.error(`The build was created and is still running: ${build.web_url}`);
          return 1;
        }
      }

      return 0;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
}
```

- [ ] **Step 4: Export from commands/index.ts**

Add to `src/commands/index.ts`:
```typescript
export { RebuildBuild } from './RebuildBuild.js';
```

- [ ] **Step 5: Run tests**

Run: `npm test -- RebuildBuild`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/commands/RebuildBuild.ts src/commands/index.ts test/commands/RebuildBuild.test.ts
git commit -m "feat(commands): add RebuildBuild with --watch support"
```

---

## Task 12: Restructure `bktide build` into a command group

Make `build` a subcommand group whose default is `show`, so existing `bktide build <ref>` invocations keep working. This is the riskiest task — verify shorthand behavior carefully.

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read the current `bktide build` registration**

Open `src/index.ts` and locate the block starting `program.command('build')` (around line 427). Note the exact options and the `.action(createCommandHandler(ShowBuild))` line.

- [ ] **Step 2: Replace with command-group structure**

Replace the existing `program.command('build')...` block with:

```typescript
const buildCmd = program
  .command('build')
  .description('Build operations: show, create, rebuild');

buildCmd
  .command('show <build>', { isDefault: true })
  .description('Show details for a specific build')
  .option('--jobs', 'Show job summary and details')
  .option('--failed', 'Show only failed job details (implies --jobs)')
  .option('--all-jobs', 'Show all jobs without grouping limit')
  .option('--annotations', 'Show annotation details with context')
  .option('--annotations-full', 'Show complete annotation content')
  .option('--full', 'Show all available information')
  .option('--summary', 'Single-line summary only (for scripts)')
  .option('-w, --watch', 'Watch build until completion')
  .option('--timeout <minutes>', 'Max wait time in minutes (default: 30)', '30')
  .option('--poll-interval <seconds>', 'Initial poll interval in seconds (default: 5)', '5')
  .action(createCommandHandler(ShowBuild));
```

(The `create` and `rebuild` subcommands are added in Task 13.)

- [ ] **Step 3: Inspect how `ShowBuild` reads its positional argument**

Open `src/commands/ShowBuild.ts`. The current code reads `options.buildArg`. Commander passes the positional argument first to the action; with `createCommandHandler`, the positional needs to land in `options.buildArg`.

Look at how `createCommandHandler` works in `src/index.ts` — it calls `handler.execute(options)` with `options = this.mergedOptions || this.opts()`. The positional `<build>` is NOT automatically added to `this.opts()`. Confirm by checking how `artifacts list <build-ref>` is wired (lines around 543) — that one uses an inline action that destructures the positional. If the existing build registration relies on a similar plumbing for `buildArg`, mirror it here.

Quick fix in the new `show` subcommand: change the `.action` to:

```typescript
  .action(async function(this: ExtendedCommand, buildArg: string) {
    const options = this.mergedOptions || this.opts();
    options.buildArg = buildArg;
    try {
      const token = await BaseCommand.getToken(options);
      const handler = new ShowBuild({
        token,
        debug: options.debug,
        format: options.format,
        quiet: options.quiet,
        tips: options.tips,
      });
      process.exitCode = await handler.execute(options);
    } catch (error) {
      displayCLIError(error, !!options.debug);
      process.exitCode = 1;
    }
  });
```

(This mirrors the pattern used by `bktide pipeline <reference>` at lines 462–492.)

- [ ] **Step 4: Build and smoke-test the shorthand**

```bash
npm run build
bin/bktide build --help                       # should now show show/create/rebuild list (create/rebuild come in Task 13)
bin/bktide build <real-org>/<pipeline>/<n>     # should still show the build like before
bin/bktide build show <real-org>/<pipeline>/<n>  # should produce identical output
```

Expected: both shorthand and explicit `show` produce the same output as the pre-refactor `bktide build <ref>`.

- [ ] **Step 5: Run the existing ShowBuild test**

Run: `npm test -- ShowBuild`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "refactor(cli): convert 'bktide build' to a command group"
```

---

## Task 13: Wire `bktide build create` and `bktide build rebuild`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add the `CreateBuild` and `RebuildBuild` imports**

In `src/index.ts`, find the existing `import { ... } from './commands/index.js'` block and add:

```typescript
  CreateBuild,
  RebuildBuild,
```

- [ ] **Step 2: Add the two subcommands**

Below the `buildCmd.command('show ...')` block from Task 12, add:

```typescript
buildCmd
  .command('create [pipeline-ref]')
  .description('Create a new build (auto-detects pipeline from git when omitted)')
  .option('-c, --commit <sha>', 'Commit SHA (default: git HEAD)')
  .option('-b, --branch <branch>', 'Branch (default: current git branch)')
  .option('-m, --message <msg>', 'Build message (default: HEAD commit subject)')
  .option('-e, --env <KEY=VAL>', 'Environment variable (repeatable)', (val: string, acc: string[]) => { acc.push(val); return acc; }, [])
  .option('-o, --org <org>', 'Organization slug (when multiple orgs available)')
  .option('-w, --watch', 'Watch the new build until completion')
  .option('--timeout <minutes>', 'Max watch time in minutes (default: 30)', '30')
  .option('--poll-interval <seconds>', 'Initial poll interval in seconds (default: 5)', '5')
  .action(async function(this: ExtendedCommand, pipelineRef: string | undefined) {
    const options = this.mergedOptions || this.opts();
    options.pipelineRef = pipelineRef;
    options.timeout = options.timeout ? parseInt(options.timeout) : undefined;
    options.pollInterval = options.pollInterval ? parseInt(options.pollInterval) : undefined;
    try {
      const token = await BaseCommand.getToken(options);
      const handler = new CreateBuild({
        token,
        debug: options.debug,
        format: options.format,
        quiet: options.quiet,
        tips: options.tips,
      });
      process.exitCode = await handler.execute(options);
    } catch (error) {
      displayCLIError(error, !!options.debug);
      process.exitCode = 1;
    }
  });

buildCmd
  .command('rebuild <build-ref>')
  .description('Rebuild an existing build with the same parameters')
  .option('-w, --watch', 'Watch the new build until completion')
  .option('--timeout <minutes>', 'Max watch time in minutes (default: 30)', '30')
  .option('--poll-interval <seconds>', 'Initial poll interval in seconds (default: 5)', '5')
  .action(async function(this: ExtendedCommand, buildArg: string) {
    const options = this.mergedOptions || this.opts();
    options.buildArg = buildArg;
    options.timeout = options.timeout ? parseInt(options.timeout) : undefined;
    options.pollInterval = options.pollInterval ? parseInt(options.pollInterval) : undefined;
    try {
      const token = await BaseCommand.getToken(options);
      const handler = new RebuildBuild({
        token,
        debug: options.debug,
        format: options.format,
        quiet: options.quiet,
        tips: options.tips,
      });
      process.exitCode = await handler.execute(options);
    } catch (error) {
      displayCLIError(error, !!options.debug);
      process.exitCode = 1;
    }
  });
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Help-text smoke checks**

```bash
bin/bktide build --help
bin/bktide build create --help
bin/bktide build rebuild --help
```

Expected: each lists its own flags. `bktide build --help` shows `show` (default), `create`, `rebuild`.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): wire 'bktide build create' and 'bktide build rebuild'"
```

---

## Task 14: End-to-end smoke test + docs

No new tests — this is a real-API exercise plus doc sweep.

**Files:**
- Modify: `README.md` (if it lists commands)
- Modify: `docs/user/` content if a relevant guide exists

- [ ] **Step 1: Smoke test against a real pipeline**

Pick a low-cost pipeline you control. From inside that repo's git checkout:

```bash
bin/bktide build create <org>/<pipeline> --commit HEAD --branch <branch> --message "bktide smoke test"
```

Expected: a new build is created, the new build URL is printed. Verify in the Buildkite UI.

- [ ] **Step 2: Smoke test auto-detect**

From the same checkout:

```bash
bin/bktide build create
```

Expected: either creates a build (if exactly one pipeline matches) or prints the candidate list and exits 1.

- [ ] **Step 3: Smoke test rebuild**

Take the URL of a finished build you own:

```bash
bin/bktide build rebuild https://buildkite.com/<org>/<pipeline>/builds/<n>
```

Expected: a new build is created. Verify in the UI.

- [ ] **Step 4: Smoke test --watch**

```bash
bin/bktide build create <org>/<pipeline> --commit HEAD --branch <branch> --watch
```

Expected: streams build state until terminal; exit 0 on pass, 1 otherwise. Ctrl-C exits without crashing.

- [ ] **Step 5: README / docs sweep**

Search for a command list in `README.md` and `docs/user/`:

```bash
grep -rn "bktide build\|bktide snapshot\|bktide annotations" README.md docs/user
```

Where commands are enumerated, add references to `bktide build create` and `bktide build rebuild`. Keep the additions concise — one-line entries that mirror the style of the surrounding list.

- [ ] **Step 6: Bean update**

```bash
pt beans update gt-bgog -s completed
```

- [ ] **Step 7: Commit doc changes**

```bash
git add README.md docs/user
git commit -m "docs: document 'bktide build create' and 'bktide build rebuild'"
```

---

## Self-Review

**Spec coverage:**
- CLI surface table — covered by Tasks 12 + 13.
- Auto-detect of `<org>/<pipeline>` — Task 9.
- Auto-detect of commit/branch/message — Tasks 2 + 9.
- `--env KEY=VAL` parsing — Tasks 1 + 8.
- `BuildkiteRestClient.createBuild` / `rebuildBuild` — Tasks 4 + 5 atop Task 3.
- `BuildkiteClient.getPipelinesForRepo` — Task 6.
- Formatters — Task 7.
- `--watch` reuse of `BuildPoller` — Tasks 10 + 11.
- Error handling (ambiguous pipeline, missing git, malformed env, 401/403/404/422, post-create watch failure) — Tasks 3, 8, 9, 10, 11.
- Exit code table — covered by the exit-code logic in Tasks 8, 10, 11.
- `bktide build <ref>` shorthand preserved — Task 12.

**Type consistency:**
- `CreateBuildPayload` defined in Task 4, consumed in Task 8 / 9 — same shape.
- `BuildkiteBuildResponse` defined in Task 4, consumed by formatter (Task 7) and commands (Tasks 8–11) — same shape.
- `BuildRef` from `BuildPoller` consumed by `.watch({ org, pipeline, buildNumber })` in Tasks 10 + 11 — matches existing `BuildPoller` interface in `src/services/BuildPoller.ts`.
- Formatter `verb` is `'created' | 'rebuilt'` — both call sites (CreateBuild Task 8, RebuildBuild Task 11) use literals from this union.

**Placeholder scan:** No TBDs / TODOs in implementation. Two intentional inline `/* */` comments in the watch handlers acknowledge that streaming UI is a follow-up — that's design scope from the spec, not a placeholder.
