# Pipeline-scoped, date-filtered `builds` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `bktide builds <org>/<pipeline>` list a pipeline's builds from any creator, within an optional date window, without changing the existing "my builds" default.

**Architecture:** Add `--created-from`, `--created-to`, `--mine` options to the `builds` command. In `ListBuilds.execute()`, branch on whether a pipeline is resolved: pipeline + not `--mine` routes to the existing `getPipelineBuilds()` REST endpoint (no `creator` param); otherwise keep today's creator-scoped `getBuilds()`. Date strings are normalized to RFC3339 and passed through as `created_from`/`created_to` query params. Single-page paging is unchanged, with a truncation warning when a date window is active and the page is full.

**Tech Stack:** TypeScript (strict, ESM), Commander.js, Vitest. REST via `BuildkiteRestClient`.

---

## Background for the implementer

You have zero context, so here are the load-bearing facts:

- **Options reach the command automatically.** `src/index.ts` builds `mergedOptions = { ...globalOpts, ...commandOpts }` in a `preAction` hook (line ~238) and calls `handler.execute(mergedOptions)`. Any Commander `.option()` you register on the `builds` command shows up on the options object passed to `execute`, camelCased: `--created-from` becomes `options.createdFrom`, `--mine` becomes `options.mine`. You do NOT need to touch the `cmd.buildOptions` block (it is only used for debug logging).
- **The positional reference is already parsed.** For `builds`, `src/index.ts` (lines ~301-315) parses `org/pipeline` into `mergedOptions.org` and `mergedOptions.pipeline` before `execute` runs. So inside `execute`, `options.pipeline` is populated whether the user passed `--pipeline foo` or `gusto/foo`.
- **Why it is user-scoped today.** `src/commands/ListBuilds.ts` always calls `this.restClient.getBuilds(org, { creator: userId, pipeline, ... })`. The `creator: userId` is what hides everyone else's builds.
- **The right endpoint already exists, unused by this command.** `BuildkiteRestClient.getPipelineBuilds(org, pipeline, params)` (line ~276) hits `/organizations/{org}/pipelines/{pipeline}/builds` with no `creator`.
- **REST params pass through.** The private `get()` forwards every key of its `params` object as a query-string param, so adding `created_from`/`created_to` to a call is just a matter of widening the param type and passing them.
- **Reporter API.** `this` uses a `Reporter` (`src/ui/reporter.ts`). It has `warn(message)` (writes to stderr) and `tip(message)`. Use `reporter.warn(...)` for the truncation warning.
- **Test seams.** REST tests mock the private fetch with `vi.spyOn(client as any, 'get')`. Command tests set `command['token'] = 'test-token'` and spy on `BuildkiteClient.prototype.getViewer` and `BuildkiteRestClient.prototype.*`.

## File Structure

- Modify: `src/services/BuildkiteRestClient.ts` (widen `getBuilds` / `getPipelineBuilds` param types)
- Modify: `src/commands/ListBuilds.ts` (options interface, date normalization, routing, warning)
- Modify: `src/index.ts` (register the three new options, update description)
- Modify: `src/formatters/builds/PlainTextFormatter.ts` (empty-state message in pipeline mode)
- Modify: `src/formatters/builds/Formatter.ts` (add `pipelineScoped` to options type)
- Test: `test/services/BuildkiteRestClient.builds.test.ts` (new)
- Test: `test/commands/ListBuilds.test.ts` (extend)
- Docs: `docs/user/` builds reference (if a builds doc exists; otherwise skip)

---

## Task 1: REST client accepts date-range params

**Files:**
- Modify: `src/services/BuildkiteRestClient.ts:243-251` (getBuilds param type) and `:276-285` (getPipelineBuilds param type)
- Test: `test/services/BuildkiteRestClient.builds.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `test/services/BuildkiteRestClient.builds.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildkiteRestClient - builds date filtering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getPipelineBuilds forwards created_from/created_to and hits the pipeline endpoint', async () => {
    const client = new BuildkiteRestClient('test-token', { caching: false });
    const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue([]);

    await client.getPipelineBuilds('gusto', 'audit-runner', {
      created_from: '2025-10-20T00:00:00.000Z',
      created_to: '2025-10-23T00:00:00.000Z',
      per_page: '10',
      page: '1',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/organizations/gusto/pipelines/audit-runner/builds',
      expect.objectContaining({
        created_from: '2025-10-20T00:00:00.000Z',
        created_to: '2025-10-23T00:00:00.000Z',
      })
    );
  });

  it('getBuilds forwards created_from/created_to', async () => {
    const client = new BuildkiteRestClient('test-token', { caching: false });
    const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue([]);

    await client.getBuilds('gusto', {
      creator: 'u1',
      created_from: '2025-10-20T00:00:00.000Z',
      per_page: '10',
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/organizations/gusto/builds',
      expect.objectContaining({ created_from: '2025-10-20T00:00:00.000Z' })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BuildkiteRestClient.builds`
Expected: FAIL. TypeScript rejects `created_from`/`created_to` (not in the param type), reported as a type/compile error in the test run.

- [ ] **Step 3: Widen the param types**

In `src/services/BuildkiteRestClient.ts`, the `getBuilds` param object (around line 243):

```typescript
  public async getBuilds(org: string, params?: {
    creator?: string; // Creator's user ID, email or API access token
    pipeline?: string;
    branch?: string;
    commit?: string;
    state?: string;
    created_from?: string; // RFC3339 timestamp, inclusive lower bound
    created_to?: string;   // RFC3339 timestamp, inclusive upper bound
    per_page?: string;
    page?: string;
  }): Promise<any[]> {
```

And the `getPipelineBuilds` param object (around line 279):

```typescript
    params?: {
      branch?: string;
      state?: string;
      created_from?: string; // RFC3339 timestamp, inclusive lower bound
      created_to?: string;   // RFC3339 timestamp, inclusive upper bound
      per_page?: string;
      page?: string;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BuildkiteRestClient.builds`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/BuildkiteRestClient.ts test/services/BuildkiteRestClient.builds.test.ts
git commit -m "feat(builds): accept created_from/created_to in REST client"
```

---

## Task 2: Register CLI options and validate dates

**Files:**
- Modify: `src/index.ts:395-406` (the `builds` command registration)
- Modify: `src/commands/ListBuilds.ts:11-19` (the `ViewerBuildsOptions` interface) and `:31-40` (validation block)
- Test: `test/commands/ListBuilds.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `test/commands/ListBuilds.test.ts` inside the existing `describe('validation', ...)` block:

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ListBuilds`
Expected: FAIL. `createdFrom` is not on the options type (compile error) and/or no "Invalid date" message is produced.

- [ ] **Step 3: Add the options to the interface and a date normalizer + validation**

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

Add a private helper method to the `ListBuilds` class (place it above `execute`):

```typescript
  /**
   * Normalize a user-supplied date (YYYY-MM-DD or ISO 8601) to an RFC3339
   * timestamp. Returns null if the input cannot be parsed.
   */
  private normalizeDate(input: string): string | null {
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }
```

In `execute`, immediately after the existing state-validation block (after line 40, before `await this.ensureInitialized()`), add date validation that also stores the normalized values back onto `options`:

```typescript
    // Validate and normalize date-range options if provided
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

In `src/index.ts`, update the `builds` command registration (lines ~395-406):

```typescript
program
  .command('builds')
  .description('List builds for the current user, or for a pipeline when one is given')
  .argument('[reference]', 'Pipeline reference (org/pipeline) - shorthand for --org and --pipeline')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-p, --pipeline <pipeline>', 'Filter by pipeline slug')
  .option('-b, --branch <branch>', 'Filter by branch name')
  .option('-s, --state <state>', 'Filter by build state (running, scheduled, passed, failing, failed, canceled, etc.)')
  .option('--created-from <date>', 'Only builds created on/after this date (YYYY-MM-DD or ISO 8601)')
  .option('--created-to <date>', 'Only builds created on/before this date (YYYY-MM-DD or ISO 8601)')
  .option('--mine', 'Scope to your own builds even when a pipeline is given')
  .option('-n, --count <count>', 'Number of builds per page', '10')
  .option('--page <page>', 'Page number', '1')
  .option('--filter <filter>', 'Fuzzy filter builds by name or other properties')
  .action(createCommandHandler(ListBuilds));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ListBuilds`
Expected: PASS (existing state test + new date test).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat(builds): add --created-from/--created-to/--mine options with date validation"
```

---

## Task 3: Route pipeline-scoped vs creator-scoped, thread dates, warn on truncation

**Files:**
- Modify: `src/commands/ListBuilds.ts:99-147` (the per-org fetch loop) and the tips block (`:222-242`)
- Test: `test/commands/ListBuilds.test.ts` (extend with routing tests)

This is the core task. Read the current fetch loop first: today it always calls `this.restClient.getBuilds(org, { creator: userId, pipeline, branch, state, per_page, page })` inside the `for (const org of orgs)` loop.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `test/commands/ListBuilds.test.ts`. Add these imports at the top of the file:

```typescript
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';
```

Then:

```typescript
  describe('scoping', () => {
    beforeEach(() => {
      vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({
        viewer: { user: { uuid: 'u1', name: 'Me', email: 'me@example.com' } },
      } as any);
      vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    });

    it('routes to getPipelineBuilds (no creator) when a pipeline is given', async () => {
      const pipelineSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getPipelineBuilds')
        .mockResolvedValue([]);
      const buildsSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getBuilds')
        .mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        token: 'test-token',
      } as any);

      expect(pipelineSpy).toHaveBeenCalledWith(
        'gusto',
        'audit-runner',
        expect.not.objectContaining({ creator: expect.anything() })
      );
      expect(buildsSpy).not.toHaveBeenCalled();
    });

    it('passes created_from/created_to through to getPipelineBuilds', async () => {
      const pipelineSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getPipelineBuilds')
        .mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: '2025-10-20',
        createdTo: '2025-10-23',
        token: 'test-token',
      } as any);

      expect(pipelineSpy).toHaveBeenCalledWith(
        'gusto',
        'audit-runner',
        expect.objectContaining({
          created_from: '2025-10-20T00:00:00.000Z',
          created_to: '2025-10-23T00:00:00.000Z',
        })
      );
    });

    it('falls back to creator-scoped getBuilds when --mine is set with a pipeline', async () => {
      const pipelineSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getPipelineBuilds')
        .mockResolvedValue([]);
      const buildsSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getBuilds')
        .mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        mine: true,
        token: 'test-token',
      } as any);

      expect(buildsSpy).toHaveBeenCalledWith(
        'gusto',
        expect.objectContaining({ creator: 'u1', pipeline: 'audit-runner' })
      );
      expect(pipelineSpy).not.toHaveBeenCalled();
    });

    it('warns about possible truncation when a full page is returned with a date range', async () => {
      const fullPage = Array.from({ length: 10 }, (_, i) => ({
        number: i + 1,
        state: 'passed',
        pipeline: { name: 'audit-runner' },
      }));
      vi.spyOn(BuildkiteRestClient.prototype, 'getPipelineBuilds').mockResolvedValue(
        fullPage as any
      );
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: '2025-10-20',
        count: '10',
        token: 'test-token',
      } as any);

      const output = stderrOutput.join('');
      expect(output).toContain('more builds may exist');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ListBuilds`
Expected: FAIL. `getPipelineBuilds` is never called (routing not implemented), `--mine` path missing, no truncation warning.

- [ ] **Step 3: Implement routing, date threading, and the warning**

In `src/commands/ListBuilds.ts`, inside the `for` loop over orgs, replace the single `getBuilds` call (the block currently at lines ~122-129) with a routing branch. The surrounding access-check and try/catch stay as they are. Replace:

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

          let builds;
          if (usePipelineScope) {
            builds = await this.restClient.getPipelineBuilds(org, options.pipeline!, {
              branch: options.branch,
              state: options.state,
              created_from: options.createdFrom,
              created_to: options.createdTo,
              per_page: perPage,
              page: page
            });
          } else {
            builds = await this.restClient.getBuilds(org, {
              creator: userId,
              pipeline: options.pipeline,
              branch: options.branch,
              state: options.state,
              created_from: options.createdFrom,
              created_to: options.createdTo,
              per_page: perPage,
              page: page
            });
          }
```

Then add the truncation warning. After the org loop completes and `allBuilds` is finalized but before the formatter output (a good spot is right after the `allBuilds = allBuilds.slice(...)` line, ~186), add:

```typescript
      // Warn when a date range is active and we returned a full page: more
      // builds may exist beyond this page. We do not auto-paginate (matches
      // the rest of the CLI); nudge the user to widen --count.
      const dateRangeActive = !!options.createdFrom || !!options.createdTo;
      const perPageNum = parseInt(perPage, 10);
      if (dateRangeActive && allBuilds.length >= perPageNum) {
        reporter.warn(
          `Showing ${perPageNum} builds; more builds may exist in this date range. ` +
          `Use --count ${perPageNum * 2} to see more.`
        );
      }
```

Note: `reporter` is already constructed near the top of `execute` (`const reporter = new Reporter(...)`). `perPage` and the slice already exist. `options.pipeline!` is safe because `usePipelineScope` guards on `!!options.pipeline`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ListBuilds`
Expected: PASS (validation + scoping, 5+ tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat(builds): list a pipeline's builds (any creator) with date range"
```

---

## Task 4: Pipeline-mode empty-state message

**Files:**
- Modify: `src/formatters/builds/Formatter.ts` (add `pipelineScoped?: boolean` to the options type)
- Modify: `src/formatters/builds/PlainTextFormatter.ts:33-39` and `:133-136` (empty-state messages)
- Modify: `src/commands/ListBuilds.ts` (set `pipelineScoped` on `formatterOptions`)
- Test: `test/commands/ListBuilds.test.ts` (extend)

Today the empty-state reads "No builds found for &lt;userName&gt;", which is wrong when listing a pipeline you do not own. In pipeline mode it should read in terms of the pipeline, not the user.

- [ ] **Step 1: Write the failing test**

Add to the `scoping` describe block in `test/commands/ListBuilds.test.ts`:

```typescript
    it('empty pipeline result does not blame the current user', async () => {
      vi.spyOn(BuildkiteRestClient.prototype, 'getPipelineBuilds').mockResolvedValue([]);
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        token: 'test-token',
      } as any);

      const out = consoleSpy.mock.calls.flat().join('') + stdoutSpy.mock.calls.flat().join('');
      expect(out).not.toContain('No builds found for Me');
      expect(out).toContain('audit-runner');
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ListBuilds`
Expected: FAIL. Current empty-state message either references the user or omits the pipeline name.

- [ ] **Step 3: Thread `pipelineScoped` and adjust the messages**

In `src/formatters/builds/Formatter.ts`, add to the `BuildFormatterOptions` type (alongside the existing `userName`, `orgSpecified`, etc.):

```typescript
  pipelineScoped?: boolean;
  pipelineName?: string;
```

In `src/commands/ListBuilds.ts`, where `formatterOptions` is built (around line 156), add:

```typescript
        pipelineScoped: !!options.pipeline && !options.mine,
        pipelineName: options.pipeline,
```

In `src/formatters/builds/PlainTextFormatter.ts`, both empty-state spots (around line 33-39 and 133-136) currently do:

```typescript
      let message = 'No builds found';
      if (options?.userName) {
        message = `No builds found for ${SEMANTIC_COLORS.label(options.userName)}`;
      }
```

Change each to prefer the pipeline framing when pipeline-scoped:

```typescript
      let message = 'No builds found';
      if (options?.pipelineScoped && options?.pipelineName) {
        message = `No builds found for pipeline ${SEMANTIC_COLORS.label(options.pipelineName)}`;
      } else if (options?.userName) {
        message = `No builds found for ${SEMANTIC_COLORS.label(options.userName)}`;
      }
```

(The second occurrence at ~133 does not use `SEMANTIC_COLORS`; mirror its existing style: `message = \`No builds found for pipeline ${options.pipelineName}\`;`.)

Also, in `ListBuilds.ts` the error/empty path around lines 167-183 builds an `errorMessage` that names the user when there were access errors. Leave that path as-is (it is specifically about org access failures), but ensure the non-error empty result (builds length 0, no access errors) flows to the formatter with `pipelineScoped` set, which the steps above already do.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ListBuilds`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/formatters/builds/Formatter.ts src/formatters/builds/PlainTextFormatter.ts src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat(builds): pipeline-aware empty-state message"
```

---

## Task 5: Build, full test pass, docs, manual smoke

**Files:**
- Modify: `docs/user/<builds reference>.md` if one exists (otherwise skip and note it)

- [ ] **Step 1: Typecheck + build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass (no regressions in the existing suite).

- [ ] **Step 3: Update user docs if present**

Run: `ls docs/user/ && grep -rl "builds" docs/user/ 2>/dev/null`
If a builds reference doc exists, add the new flags and a pipeline-by-date example:

```
# List a pipeline's builds in a date window (any creator)
bktide builds gusto/audit-runner-restore-from-snapshot \
  --created-from 2025-10-20 --created-to 2025-10-23 --count 50
```

Note that bare `YYYY-MM-DD` dates resolve to UTC midnight, so to include a whole end day, pass the following day as `--created-to`.

If no builds doc exists, skip this step and note it in the commit body.

- [ ] **Step 4: Manual smoke (real API, requires BK_TOKEN)**

Run:
```bash
bin/bktide builds gusto/audit-runner-restore-from-snapshot --created-from 2025-10-20 --created-to 2025-10-23 --count 50 --no-cache
```
Expected: lists builds for that pipeline regardless of creator (scheduled/bot builds visible), only within the window. Compare against `bin/bktide builds gusto/audit-runner-restore-from-snapshot --mine` which should show only your own (likely empty).

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(builds): document pipeline-scoped date-range listing"
```

(If no docs changed, skip the commit.)

---

## Self-review notes

- Spec coverage: behavior table (Task 2/3), routing rule (Task 3), date input + RFC3339 (Task 1/2), single-page + truncation warning (Task 3), empty-state message (Task 4), all four file changes (Tasks 1-4), test cases (each task). Covered.
- The REST `get()` forwards `undefined` params safely (it skips null/undefined when appending), so passing `created_from: undefined` in creator-scoped mode is a no-op. No conditional needed at the call site.
- Type consistency: `getPipelineBuilds(org, pipeline, params)` signature matches Task 1 and Task 3. `createdFrom`/`createdTo`/`mine` names consistent between the interface (Task 2) and usage (Task 3/4). `pipelineScoped`/`pipelineName` consistent between Formatter type and formatter usage (Task 4).
