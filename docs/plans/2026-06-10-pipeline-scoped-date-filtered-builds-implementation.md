# Pipeline-scoped, date-filtered `builds` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `bktide builds <org>/<pipeline>` list a pipeline's builds from any creator, within an optional date window, using GraphQL.

**Architecture:** Extend the existing GraphQL `GET_BUILDS` query and `BuildkiteClient.getBuilds` with date/state/branch args plus trigger-source fields. In `ListBuilds.execute()`, route pipeline-scoped requests (pipeline given, not `--mine`) to GraphQL (not user-scoped, native date filtering) and map nodes to the formatter's Build shape; keep the REST `getBuilds(creator)` path for the default "my builds" view. Date strings normalize to RFC3339. Single page (`first`); truncation warning driven by `pageInfo.hasNextPage`.

**Tech Stack:** TypeScript (strict, ESM), Commander.js, GraphQL (graphql-request + graphql-code-generator), Vitest.

---

## Background for the implementer

You have zero context, so here are the load-bearing facts:

- **Why it is user-scoped today.** `src/commands/ListBuilds.ts` always calls the
  REST client `this.restClient.getBuilds(org, { creator: userId, ... })`. The
  `creator: userId` hides everyone else's builds. The REST `getBuilds` and the
  GraphQL `getBuilds` are different methods on different clients (`this.restClient`
  vs `this.client`).
- **GraphQL is the target per repo convention** (`CLAUDE.md`). The GraphQL
  `Pipeline.builds` connection is NOT user-scoped and natively accepts
  `createdAtFrom`, `createdAtTo`, `state: [BuildStates!]`, `branch: [String!]`
  (verified in `src/graphql/generated/graphql.ts`, `PipelineBuildsArgs`). It also
  returns `pageInfo.hasNextPage` and per-build `source` (where the build came
  from: schedule/UI/API/etc.) and `createdBy` (the user, if any).
- **The GraphQL pieces already exist, partially.** `src/graphql/queries.ts` has
  `GET_BUILDS` (pipeline-scoped via `pipelines(first: 1, search: $pipelineSlug)`).
  `src/services/BuildkiteClient.ts` has `getBuilds(pipelineSlug, organizationSlug,
  first?)` (line ~587). The GraphQL `getBuilds` has NO command callers, so its
  signature can change freely. The query is just missing the date/state/branch
  vars and the `source`/`createdBy`/`hasNextPage` selections.
- **Options reach the command automatically.** `src/index.ts` builds
  `mergedOptions = { ...globalOpts, ...commandOpts }` in a `preAction` hook
  (line ~238) and calls `handler.execute(mergedOptions)`. Any Commander
  `.option()` you register shows up camelCased: `--created-from` becomes
  `options.createdFrom`, `--mine` becomes `options.mine`. The positional `org/pipeline`
  reference is already parsed into `options.org`/`options.pipeline` before
  `execute` runs (index.ts ~301-315). You do NOT need to touch `cmd.buildOptions`.
- **Formatters read both shapes.** The Build formatters (`src/formatters/builds/`)
  defensively read REST (`web_url`, `created_at`) and GraphQL (`url`, `createdAt`)
  field names. The plain table consumes `pipeline.slug`, `number`, `state`,
  `branch`. The GraphQL nodes have `number`, `state` (uppercase enum, fine:
  `formatBuildStatus` uppercases anyway), `branch`, but no `pipeline.slug`, so the
  mapping injects the known slug from the request.
- **State enum.** CLI `--state` is lowercase (`passed`, `failing`, `not_run`).
  GraphQL `BuildStates` is uppercase (`PASSED`, `FAILING`, `NOT_RUN`). Map with
  `value.toUpperCase()` into a single-element array.
- **Codegen needs network + token.** `npm run codegen` introspects the live
  `https://graphql.buildkite.com/v1` schema using the stored Buildkite token. The
  sandbox does not allowlist that host, so run codegen unsandboxed, and a valid
  token must be configured (`bktide token --check`).
- **Reporter API.** `this` uses a `Reporter` (`src/ui/reporter.ts`) with
  `warn(message)` (stderr) and `tip(message)`. Use `reporter.warn(...)` for the
  truncation warning. `reporter` is already constructed near the top of `execute`.
- **Test seams.** Command tests set `command['token'] = 'test-token'` and spy on
  `BuildkiteClient.prototype.getViewer`, `BuildkiteClient.prototype.getBuilds`,
  `BuildkiteRestClient.prototype.getBuilds`, `BuildkiteRestClient.prototype.hasOrganizationAccess`.

## File Structure

- Modify: `src/graphql/queries.ts` (extend `GET_BUILDS`)
- Regenerate: `src/graphql/generated/*` (via `npm run codegen`, do not hand-edit)
- Modify: `src/services/BuildkiteClient.ts` (`getBuilds` options object)
- Modify: `src/commands/ListBuilds.ts` (options interface, date validation + guard, routing, mapping, warning)
- Modify: `src/index.ts` (register options, update description)
- Modify: `src/formatters/builds/Formatter.ts` (add `pipelineScoped`/`pipelineName`)
- Modify: `src/formatters/builds/PlainTextFormatter.ts` (empty-state message)
- Modify: `src/formatters/builds/JsonFormatter.ts` (surface `created_by`/`source`)
- Test: `test/commands/ListBuilds.test.ts` (extend)

---

## Task 1: Extend the GraphQL query and regenerate types

**Files:**
- Modify: `src/graphql/queries.ts:86-117` (the `GET_BUILDS` template)
- Regenerate: `src/graphql/generated/*`

- [ ] **Step 1: Replace the `GET_BUILDS` query**

In `src/graphql/queries.ts`, replace the whole `GET_BUILDS` template (lines ~86-117) with:

```typescript
export const GET_BUILDS = gql`
  query GetBuilds(
    $pipelineSlug: String!
    $organizationSlug: ID!
    $first: Int
    $createdAtFrom: DateTime
    $createdAtTo: DateTime
    $state: [BuildStates!]
    $branch: [String!]
  ) {
    organization(slug: $organizationSlug) {
      pipelines(first: 1, search: $pipelineSlug) {
        edges {
          node {
            slug
            name
            builds(
              first: $first
              createdAtFrom: $createdAtFrom
              createdAtTo: $createdAtTo
              state: $state
              branch: $branch
            ) {
              edges {
                node {
                  id
                  number
                  url
                  state
                  message
                  commit
                  branch
                  source
                  createdAt
                  startedAt
                  finishedAt
                  createdBy {
                    ... on User { name email }
                    ... on UnregisteredUser { name email }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
    }
  }
`;
```

- [ ] **Step 2: Confirm a token is available**

Run: `bin/bktide token --check`
Expected: reports a stored token. If not, codegen will fail; set one up first.

- [ ] **Step 3: Regenerate GraphQL types (unsandboxed)**

Run: `npm run codegen`
Expected: succeeds, updating `src/graphql/generated/sdk.ts` (and any sibling
generated files). `GetBuildsQueryVariables` now includes `createdAtFrom`,
`createdAtTo`, `state`, `branch`; the `GetBuildsQuery` build node includes
`source` and `createdBy`.

Note: this hits `https://graphql.buildkite.com/v1`, not allowlisted by the
sandbox; run with the sandbox disabled.

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: compiles. (`BuildkiteClient.getBuilds` still passes only
`pipelineSlug/organizationSlug/first`; the new variables are optional, so this
stays valid until Task 2.)

- [ ] **Step 5: Commit**

```bash
git add src/graphql/queries.ts src/graphql/generated
git commit -m "feat(builds): add date/state/branch + source/createdBy to GET_BUILDS query"
```

---

## Task 2: Widen `BuildkiteClient.getBuilds` to accept filters

**Files:**
- Modify: `src/services/BuildkiteClient.ts:587-628`
- Test: `test/services/BuildkiteClient.builds.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `test/services/BuildkiteClient.builds.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';

describe('BuildkiteClient.getBuilds (GraphQL)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards date/state/branch filters as query variables', async () => {
    const client = new BuildkiteClient('test-token', { caching: false });
    const requestSpy = vi
      .spyOn(client as any, 'request')
      .mockResolvedValue({ organization: { pipelines: { edges: [] } } });

    await client.getBuilds('audit-runner', 'gusto', {
      first: 50,
      createdAtFrom: '2025-10-20T00:00:00.000Z',
      createdAtTo: '2025-10-23T00:00:00.000Z',
      state: ['PASSED'],
      branch: ['main'],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        pipelineSlug: 'audit-runner',
        organizationSlug: 'gusto',
        first: 50,
        createdAtFrom: '2025-10-20T00:00:00.000Z',
        createdAtTo: '2025-10-23T00:00:00.000Z',
        state: ['PASSED'],
        branch: ['main'],
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BuildkiteClient.builds`
Expected: FAIL. Current `getBuilds(pipelineSlug, organizationSlug, first?)` does
not accept an options object (compile error and/or variables not forwarded).

- [ ] **Step 3: Change the signature**

In `src/services/BuildkiteClient.ts`, replace the `getBuilds` signature and
`variables` construction (lines ~587-596) with:

```typescript
  public async getBuilds(
    pipelineSlug: string,
    organizationSlug: string,
    options: {
      first?: number;
      createdAtFrom?: string;
      createdAtTo?: string;
      state?: string[];
      branch?: string[];
    } = {}
  ): Promise<GetBuildsQuery> {
    const variables: GetBuildsQueryVariables = {
      pipelineSlug,
      organizationSlug,
      first: options.first,
      createdAtFrom: options.createdAtFrom,
      createdAtTo: options.createdAtTo,
      state: options.state as any,
      branch: options.branch,
    };
```

Leave the rest of the method (cache check, `this.request`, cache set, return)
unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BuildkiteClient.builds`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/BuildkiteClient.ts test/services/BuildkiteClient.builds.test.ts
git commit -m "feat(builds): accept date/state/branch filters in GraphQL getBuilds"
```

---

## Task 3: Register CLI options, validate dates, guard date-without-pipeline

**Files:**
- Modify: `src/index.ts:395-406`
- Modify: `src/commands/ListBuilds.ts:11-19` (interface) and `:31-40` (validation)
- Test: `test/commands/ListBuilds.test.ts` (extend the `validation` describe)

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('validation', ...)` block in
`test/commands/ListBuilds.test.ts`:

```typescript
    it('rejects an unparseable --created-from with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: 'not-a-date',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('Invalid date');
      expect(output).toContain('--created-from');
    });

    it('rejects a date range without a pipeline with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        createdFrom: '2025-10-20',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('--pipeline');
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ListBuilds`
Expected: FAIL (`createdFrom` not on the options type; no date/guard validation).

- [ ] **Step 3: Extend the interface and add validation**

In `src/commands/ListBuilds.ts`, extend the interface (around line 11):

```typescript
export interface ViewerBuildsOptions extends BaseCommandOptions {
  count?: string;
  page?: string;
  org?: string;
  pipeline?: string;
  branch?: string;
  state?: string;
  createdFrom?: string;
  createdTo?: string;
  mine?: boolean;
  tips?: boolean;
}
```

Add a private date-normalizer to the class (above `execute`):

```typescript
  /**
   * Normalize a user-supplied date (YYYY-MM-DD or ISO 8601) to an RFC3339
   * timestamp for the GraphQL DateTime scalar. Returns null if unparseable.
   */
  private normalizeDate(input: string): string | null {
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }
```

In `execute`, immediately after the existing state-validation block (after
line ~40, before `await this.ensureInitialized()`), add:

```typescript
    // A date range only applies to the pipeline-scoped path.
    if ((options.createdFrom || options.createdTo) && !options.pipeline) {
      process.stderr.write(
        'Date filters (--created-from/--created-to) require a pipeline.\n' +
        'Specify one with --pipeline <slug> or as org/pipeline.\n'
      );
      return 1;
    }

    // Validate and normalize date-range options, storing the result back.
    for (const key of ['createdFrom', 'createdTo'] as const) {
      const raw = options[key];
      if (raw) {
        const normalized = this.normalizeDate(raw);
        if (!normalized) {
          const flag = key === 'createdFrom' ? '--created-from' : '--created-to';
          process.stderr.write(
            `Invalid date '${raw}' for ${flag}\n` +
            `Use YYYY-MM-DD or an ISO 8601 timestamp.\n`
          );
          return 1;
        }
        options[key] = normalized;
      }
    }
```

In `src/index.ts`, replace the `builds` command registration (lines ~395-406):

```typescript
program
  .command('builds')
  .description('List builds for the current user, or for a pipeline when one is given')
  .argument('[reference]', 'Pipeline reference (org/pipeline) - shorthand for --org and --pipeline')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-p, --pipeline <pipeline>', 'Filter by pipeline slug')
  .option('-b, --branch <branch>', 'Filter by branch name')
  .option('-s, --state <state>', 'Filter by build state (running, scheduled, passed, failing, failed, canceled, etc.)')
  .option('--created-from <date>', 'Only builds created on/after this date (YYYY-MM-DD or ISO 8601); requires a pipeline')
  .option('--created-to <date>', 'Only builds created on/before this date (YYYY-MM-DD or ISO 8601); requires a pipeline')
  .option('--mine', 'Scope to your own builds even when a pipeline is given')
  .option('-n, --count <count>', 'Number of builds per page', '10')
  .option('--page <page>', 'Page number', '1')
  .option('--filter <filter>', 'Fuzzy filter builds by name or other properties')
  .action(createCommandHandler(ListBuilds));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ListBuilds`
Expected: PASS (state + two new validation tests).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat(builds): add --created-from/--created-to/--mine with validation"
```

---

## Task 4: Route pipeline-scoped to GraphQL, map nodes, warn on truncation

**Files:**
- Modify: `src/commands/ListBuilds.ts:99-147` (the per-org fetch loop) and the
  `formatterOptions` block (`:156-164`) and the slice/finalize area (`:185-186`)
- Test: `test/commands/ListBuilds.test.ts` (new `describe('scoping', ...)`)

This is the core task. Today the per-org loop calls
`this.restClient.getBuilds(org, { creator: userId, ... })`. We add a GraphQL
branch and a mapper. The mapper turns GraphQL build edges into objects the Build
formatters consume.

- [ ] **Step 1: Write the failing tests**

Add these imports to the top of `test/commands/ListBuilds.test.ts`:

```typescript
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';
```

A helper to build a fake GraphQL response with N build nodes and a `hasNextPage`
flag (put it near the top of the test file):

```typescript
function fakeBuildsResponse(count: number, hasNextPage = false) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    node: {
      id: `b${i}`,
      number: i + 1,
      url: `https://buildkite.com/gusto/audit-runner/builds/${i + 1}`,
      state: 'PASSED',
      message: 'msg',
      commit: 'abc',
      branch: 'main',
      source: 'SCHEDULE',
      createdAt: '2025-10-22T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      createdBy: null,
    },
  }));
  return {
    organization: {
      pipelines: {
        edges: [
          {
            node: {
              slug: 'audit-runner',
              name: 'audit-runner',
              builds: { edges: nodes, pageInfo: { hasNextPage, endCursor: null } },
            },
          },
        ],
      },
    },
  };
}
```

Then a new describe block:

```typescript
  describe('scoping', () => {
    beforeEach(() => {
      vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({
        viewer: { user: { uuid: 'u1', name: 'Me', email: 'me@example.com' } },
      } as any);
      vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    });

    it('routes a pipeline reference to GraphQL, not the REST creator path', async () => {
      const gqlSpy = vi
        .spyOn(BuildkiteClient.prototype, 'getBuilds')
        .mockResolvedValue(fakeBuildsResponse(2) as any);
      const restSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getBuilds')
        .mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', token: 'test-token' } as any);

      expect(gqlSpy).toHaveBeenCalledWith('audit-runner', 'gusto', expect.any(Object));
      expect(restSpy).not.toHaveBeenCalled();
    });

    it('passes normalized created_from/created_to into the GraphQL call', async () => {
      const gqlSpy = vi
        .spyOn(BuildkiteClient.prototype, 'getBuilds')
        .mockResolvedValue(fakeBuildsResponse(0) as any);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: '2025-10-20',
        createdTo: '2025-10-23',
        token: 'test-token',
      } as any);

      expect(gqlSpy).toHaveBeenCalledWith(
        'audit-runner',
        'gusto',
        expect.objectContaining({
          createdAtFrom: '2025-10-20T00:00:00.000Z',
          createdAtTo: '2025-10-23T00:00:00.000Z',
        })
      );
    });

    it('falls back to the REST creator path when --mine is set', async () => {
      const gqlSpy = vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(0) as any);
      const restSpy = vi.spyOn(BuildkiteRestClient.prototype, 'getBuilds').mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', mine: true, token: 'test-token' } as any);

      expect(restSpy).toHaveBeenCalledWith('gusto', expect.objectContaining({ creator: 'u1', pipeline: 'audit-runner' }));
      expect(gqlSpy).not.toHaveBeenCalled();
    });

    it('warns about truncation when hasNextPage is true with a date range', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(10, true) as any);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: '2025-10-20',
        count: '10',
        token: 'test-token',
      } as any);

      expect(stderrOutput.join('')).toContain('more builds');
    });

    it('maps GraphQL nodes so the pipeline slug and number render', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(2) as any);
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', token: 'test-token' } as any);

      const out = stdoutSpy.mock.calls.flat().join('');
      expect(out).toContain('audit-runner');
      expect(out).toContain('#1');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ListBuilds`
Expected: FAIL. GraphQL `getBuilds` never called; no mapping; no truncation warning.

- [ ] **Step 3: Implement routing, mapping, and the warning**

In `src/commands/ListBuilds.ts`, add a private mapper to the class (above `execute`):

```typescript
  /**
   * Map a GraphQL GetBuilds response (for a single pipeline) into the Build
   * shape the formatters consume. Injects the known pipeline slug because the
   * build node does not carry it. Returns { builds, hasNextPage }.
   */
  private mapPipelineBuilds(
    result: any,
    pipelineSlug: string
  ): { builds: any[]; hasNextPage: boolean } {
    const pipelineNode = result?.organization?.pipelines?.edges?.[0]?.node;
    const slug = pipelineNode?.slug || pipelineSlug;
    const edges = pipelineNode?.builds?.edges || [];
    const hasNextPage = !!pipelineNode?.builds?.pageInfo?.hasNextPage;

    const builds = edges
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map((n: any) => ({
        number: n.number,
        state: n.state,
        branch: n.branch,
        message: n.message,
        commit: n.commit,
        url: n.url,
        source: n.source,
        createdAt: n.createdAt,
        startedAt: n.startedAt,
        finishedAt: n.finishedAt,
        createdBy: n.createdBy || null,
        pipeline: { slug, name: pipelineNode?.name || slug },
      }));

    return { builds, hasNextPage };
  }
```

Inside the `for` loop over orgs, replace the single REST `getBuilds` call (the
block currently at lines ~122-129) with a routing branch. Keep the surrounding
access-check and try/catch. Replace:

```typescript
          const builds = await this.restClient.getBuilds(org, {
            creator: userId,
            pipeline: options.pipeline,
            branch: options.branch,
            state: options.state,
            per_page: perPage,
            page: page
          });
```

with:

```typescript
          const usePipelineScope = !!options.pipeline && !options.mine;

          let builds: any[];
          if (usePipelineScope) {
            const result = await this.client.getBuilds(options.pipeline!, org, {
              first: parseInt(perPage, 10),
              createdAtFrom: options.createdFrom,
              createdAtTo: options.createdTo,
              state: options.state ? [options.state.toUpperCase()] : undefined,
              branch: options.branch ? [options.branch] : undefined,
            });
            const mapped = this.mapPipelineBuilds(result, options.pipeline!);
            builds = mapped.builds;
            if (mapped.hasNextPage) {
              pipelineHasMore = true;
            }
          } else {
            builds = await this.restClient.getBuilds(org, {
              creator: userId,
              pipeline: options.pipeline,
              branch: options.branch,
              state: options.state,
              per_page: perPage,
              page: page
            });
          }
```

Declare `pipelineHasMore` once before the org loop (near where `allBuilds` and
`accessErrors` are declared, ~85):

```typescript
      let pipelineHasMore = false;
```

After the org loop and the `allBuilds = allBuilds.slice(...)` finalize (~186),
add the truncation warning:

```typescript
      // A pipeline+date-range query returned more than one page. We fetch a
      // single page (consistent with the rest of the CLI); nudge the user.
      const dateRangeActive = !!options.createdFrom || !!options.createdTo;
      if (dateRangeActive && pipelineHasMore) {
        const perPageNum = parseInt(perPage, 10);
        reporter.warn(
          `Showing ${perPageNum} builds; more builds exist in this date range. ` +
          `Use --count ${perPageNum * 2} to see more.`
        );
      }
```

`options.pipeline!` is safe inside the `usePipelineScope` branch (guarded by
`!!options.pipeline`). `reporter` and `perPage` already exist in `execute`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ListBuilds`
Expected: PASS (validation + 5 scoping tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat(builds): list a pipeline's builds via GraphQL with date range"
```

---

## Task 5: Pipeline-aware empty state and JSON provenance

**Files:**
- Modify: `src/formatters/builds/Formatter.ts` (options type)
- Modify: `src/formatters/builds/PlainTextFormatter.ts:33-39` and `:133-136`
- Modify: `src/formatters/builds/JsonFormatter.ts` (build map)
- Modify: `src/commands/ListBuilds.ts` (`formatterOptions`)
- Test: `test/commands/ListBuilds.test.ts` (extend `scoping`)

- [ ] **Step 1: Write the failing tests**

Add to the `scoping` describe block:

```typescript
    it('empty pipeline result names the pipeline, not the user', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(0) as any);
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', token: 'test-token' } as any);

      const out = consoleSpy.mock.calls.flat().join('') + stdoutSpy.mock.calls.flat().join('');
      expect(out).not.toContain('No builds found for Me');
      expect(out).toContain('audit-runner');
    });

    it('JSON output includes source and created_by', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(1) as any);
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', format: 'json', token: 'test-token' } as any);

      const out = consoleSpy.mock.calls.flat().join('');
      expect(out).toContain('"source"');
      expect(out).toContain('"created_by"');
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ListBuilds`
Expected: FAIL. Empty state references the user / omits the pipeline; JSON lacks
`source`/`created_by`.

- [ ] **Step 3: Thread `pipelineScoped` and add fields**

In `src/formatters/builds/Formatter.ts`, add to the `BuildFormatterOptions` type:

```typescript
  pipelineScoped?: boolean;
  pipelineName?: string;
```

In `src/commands/ListBuilds.ts`, in the `formatterOptions` object (around line 156), add:

```typescript
        pipelineScoped: !!options.pipeline && !options.mine,
        pipelineName: options.pipeline,
```

In `src/formatters/builds/PlainTextFormatter.ts`, the empty-state spot at ~33-39:

```typescript
      let message = 'No builds found';
      if (options?.pipelineScoped && options?.pipelineName) {
        message = `No builds found for pipeline ${SEMANTIC_COLORS.label(options.pipelineName)}`;
      } else if (options?.userName) {
        message = `No builds found for ${SEMANTIC_COLORS.label(options.userName)}`;
      }
```

And the second spot at ~133-136 (no `SEMANTIC_COLORS` there; mirror its style):

```typescript
      let message = 'No builds found';
      if (options?.pipelineScoped && options?.pipelineName) {
        message = `No builds found for pipeline ${options.pipelineName}`;
      } else if (options?.userName) {
        message = `No builds found for ${options.userName}`;
      }
```

In `src/formatters/builds/JsonFormatter.ts`, add two fields to the per-build map
object (alongside `finished_at`):

```typescript
        source: (build as any).source || null,
        created_by: (build as any).createdBy || null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ListBuilds`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formatters/builds/Formatter.ts src/formatters/builds/PlainTextFormatter.ts src/formatters/builds/JsonFormatter.ts src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat(builds): pipeline-aware empty state and JSON provenance fields"
```

---

## Task 6: Build, full test pass, docs, manual smoke

**Files:**
- Modify: `docs/user/<builds reference>.md` if present

- [ ] **Step 1: Typecheck + build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass, no regressions.

- [ ] **Step 3: Update user docs if present**

Run: `ls docs/user/ && grep -rl "builds" docs/user/ 2>/dev/null`
If a builds reference exists, document the new flags and an example:

```
# List a pipeline's builds in a date window (any creator)
bktide builds gusto/audit-runner-restore-from-snapshot \
  --created-from 2025-10-20 --created-to 2025-10-23 --count 50

# JSON output includes `source` (schedule/ui/api/...) and `created_by`,
# which reveal whether a build was scheduled or who triggered it.
```

Note that bare `YYYY-MM-DD` dates resolve to UTC midnight; to include a whole end
day, pass the following day as `--created-to`. If no builds doc exists, skip and
note it in the commit body.

- [ ] **Step 4: Manual smoke (real API, requires a token + network, unsandboxed)**

Run:
```bash
bin/bktide builds gusto/audit-runner-restore-from-snapshot \
  --created-from 2025-10-20 --created-to 2025-10-23 --count 50 --no-cache
```
Expected: lists builds for that pipeline regardless of creator (scheduled builds
visible), within the window. Compare with `--mine` (REST path), which should show
only your own (likely empty). Try `--format json` and confirm `source` and
`created_by` appear.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(builds): document pipeline-scoped date-range listing"
```

(If no docs changed, skip the commit.)

---

## Self-review notes

- Spec coverage: GraphQL approach (Tasks 1-2), behavior table + routing (Tasks 3-4),
  date input + RFC3339 + date-without-pipeline guard (Task 3), state enum mapping
  (Task 4), single page + `hasNextPage` truncation warning (Task 4), node mapping
  (Task 4), empty-state message + JSON provenance (Task 5). Covered.
- Type consistency: GraphQL `getBuilds(pipelineSlug, organizationSlug, options)`
  signature matches between Task 2 (definition) and Task 4 (call). `createdFrom`/
  `createdTo`/`mine` consistent between interface (Task 3) and use (Tasks 4-5).
  `pipelineScoped`/`pipelineName` consistent between Formatter type and usage
  (Task 5). The mapper output keys (`url`, `createdAt`, `pipeline.slug`, `source`,
  `createdBy`) match what the plain table and JSON formatter read.
- The GraphQL variables are all optional in the regenerated type, so passing
  `undefined` for unused filters is valid.
- `--page` is accepted by the command but the GraphQL path uses cursor paging and
  ignores it (single page via `first`); this matches the "single page" decision.
  The REST creator path still honors `page` as before.
```
