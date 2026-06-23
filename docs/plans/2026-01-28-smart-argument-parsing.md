# Smart Argument Parsing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow `bktide builds gesso/zenpayroll` and `bktide pipelines gesso` to work by interpreting positional arguments as flag equivalents.

**Architecture:** Add optional positional arguments to Commander.js command definitions, then parse them in the preAction hook to populate options. Reuse existing `parseBuildkiteReference` utility for org/pipeline extraction.

**Tech Stack:** Commander.js, TypeScript, Vitest

---

## Background

### Current vs Desired Behavior

| Command | Current | Desired |
|---------|---------|---------|
| `builds gesso/zenpayroll` | Error: too many arguments | Works as `--org gesso --pipeline zenpayroll` |
| `pipelines gesso` | Error: too many arguments | Works as `--org gesso` |

### Key Files

- `src/index.ts` - Command registration and preAction hook
- `src/utils/parseBuildkiteReference.ts` - Already parses `org/pipeline` format
- `src/utils/commander-error-handler.ts` - Error suggestions to update

---

## Task 1: Add Positional Argument to `pipelines` Command

**Files:**
- Modify: `src/index.ts:353-368` (pipelines command)
- Modify: `src/index.ts:280-291` (preAction hook pipelines block)
- Test: Manual CLI testing

**Step 1: Add argument to command definition**

In `src/index.ts`, find the pipelines command and add `.argument()`:

```typescript
program
  .command('pipelines')
  .description('List pipelines for an organization')
  .argument('[org]', 'Organization slug (shorthand for --org)')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-n, --count <count>', 'Limit to specified number of pipelines per organization')
  .option('--filter <name>', 'Filter pipelines by name (case insensitive)')
  .action(createCommandHandler(ListPipelines));
```

**Step 2: Update preAction hook for pipelines**

Find the `if (commandName === 'pipelines')` block in the preAction hook and update:

```typescript
if (commandName === 'pipelines') {
  // Parse positional arg if provided and --org not specified
  const positionalOrg = cmd.args?.[0];
  if (positionalOrg && !mergedOptions.org) {
    mergedOptions.org = positionalOrg;
  }

  cmd.pipelineOptions = {
    organization: mergedOptions.org,
    count: mergedOptions.count ? parseInt(mergedOptions.count) : undefined,
    filter: mergedOptions.filter
  };

  if (mergedOptions.debug) {
    logger.debug('Pipeline options:', cmd.pipelineOptions);
  }
}
```

**Step 3: Build and test manually**

Run: `npm run build`

Run: `bin/bktide pipelines gesso`
Expected: Lists pipelines for gesso org

Run: `bin/bktide pipelines --org gesso`
Expected: Same result (backward compatible)

Run: `bin/bktide pipelines gesso --count 5`
Expected: Lists 5 pipelines for gesso

Run: `bin/bktide pipelines --help`
Expected: Shows `[org]` in usage

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(pipelines): accept org as positional argument

Allows 'bktide pipelines gesso' as shorthand for 'bktide pipelines --org gesso'.
Flag takes precedence if both provided.
"
```

---

## Task 2: Add Positional Argument to `builds` Command

**Files:**
- Modify: `src/index.ts:22-27` (imports)
- Modify: `src/index.ts:370-381` (builds command)
- Modify: `src/index.ts:292-310` (preAction hook builds block)
- Test: Manual CLI testing

**Step 1: Import parseBuildkiteReference at module level**

At the top of `src/index.ts`, add to the imports:

```typescript
import { parseBuildkiteReference } from './utils/parseBuildkiteReference.js';
```

**Step 2: Add argument to command definition**

Find the builds command and add `.argument()`:

```typescript
program
  .command('builds')
  .description('List builds for the current user')
  .argument('[reference]', 'Pipeline reference (org/pipeline) - shorthand for --org and --pipeline')
  .option('-o, --org <org>', 'Organization slug (optional - will search all your orgs if not specified)')
  .option('-p, --pipeline <pipeline>', 'Filter by pipeline slug')
  .option('-b, --branch <branch>', 'Filter by branch name')
  .option('-s, --state <state>', 'Filter by build state (running, scheduled, passed, failing, failed, canceled, etc.)')
  .option('-n, --count <count>', 'Number of builds per page', '10')
  .option('--page <page>', 'Page number', '1')
  .option('--filter <filter>', 'Fuzzy filter builds by name or other properties')
  .action(createCommandHandler(ListBuilds));
```

**Step 3: Update preAction hook for builds**

Find the `else if (commandName === 'builds')` block and update:

```typescript
else if (commandName === 'builds') {
  // Parse positional reference if provided
  const positionalRef = cmd.args?.[0];
  if (positionalRef && !mergedOptions.org && !mergedOptions.pipeline) {
    try {
      const ref = parseBuildkiteReference(positionalRef);
      mergedOptions.org = ref.org;
      mergedOptions.pipeline = ref.pipeline;
    } catch {
      // Invalid format - will be handled by existing validation or API
      if (mergedOptions.debug) {
        logger.debug(`Could not parse reference: ${positionalRef}`);
      }
    }
  }

  cmd.buildOptions = {
    organization: mergedOptions.org,
    pipeline: mergedOptions.pipeline,
    branch: mergedOptions.branch,
    state: mergedOptions.state,
    count: mergedOptions.count ? parseInt(mergedOptions.count) : 10,
    page: mergedOptions.page ? parseInt(mergedOptions.page) : 1,
    filter: mergedOptions.filter
  };

  if (mergedOptions.debug) {
    logger.debug('Build options:', cmd.buildOptions);
  }
}
```

**Step 4: Build and test manually**

Run: `npm run build`

Run: `bin/bktide builds gesso/zenpayroll`
Expected: Lists builds for gesso/zenpayroll

Run: `bin/bktide builds gesso/zenpayroll --state failed`
Expected: Lists failed builds for gesso/zenpayroll

Run: `bin/bktide builds --org gesso --pipeline zenpayroll`
Expected: Same result (backward compatible)

Run: `bin/bktide builds --help`
Expected: Shows `[reference]` in usage

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(builds): accept org/pipeline as positional argument

Allows 'bktide builds gesso/zenpayroll' as shorthand for
'bktide builds --org gesso --pipeline zenpayroll'.
Flags take precedence if both provided. Also accepts URL format.
"
```

---

## Task 3: Update Error Handler Messages

**Files:**
- Modify: `src/utils/commander-error-handler.ts:60-103`
- Test: `test/utils/commander-error-handler.test.ts`

**Step 1: Update the too-many-args handler for builds**

In `handleTooManyArgs`, update the builds case - the "too many arguments" error shouldn't happen anymore for valid references, so update to handle edge cases:

```typescript
function handleTooManyArgs(commandName: string, args: string[]): string {
  const arg = args[0] || '';

  // Pattern: builds with invalid reference format
  if (commandName === 'builds') {
    if (arg.includes('/')) {
      return `✖ Error

Could not parse '${arg}' as a pipeline reference.

Expected format: org/pipeline
Example: bktide builds myorg/mypipeline

Run 'bktide builds --help' for all options.`;
    }
    return `✖ Error

Unexpected argument: ${arg}

Usage: bktide builds [org/pipeline] [options]
Example: bktide builds myorg/mypipeline --state failed

Run 'bktide builds --help' for all options.`;
  }

  // Pattern: pipelines with extra args
  if (commandName === 'pipelines') {
    if (arg.includes('/')) {
      return `✖ Error

The 'pipelines' command expects just an org, not org/pipeline.

Did you mean: bktide pipelines ${arg.split('/')[0]}

Run 'bktide pipelines --help' for all options.`;
    }
    return `✖ Error

Unexpected argument: ${arg}

Usage: bktide pipelines [org] [options]
Example: bktide pipelines myorg --count 10

Run 'bktide pipelines --help' for all options.`;
  }

  // Pattern: orgs extraarg -> no args needed
  if (commandName === 'orgs' || commandName === 'viewer' || commandName === 'token') {
    return `✖ Error

The '${commandName}' command doesn't accept arguments.

To fix this:
  1. Remove the extra argument
  2. Run 'bktide ${commandName} --help' for available options`;
  }

  // Generic fallback
  return `✖ Error

Unexpected argument: ${arg}

Run 'bktide ${commandName} --help' for usage information.`;
}
```

**Step 2: Update tests**

In `test/utils/commander-error-handler.test.ts`, update the test expectations:

```typescript
describe('too many arguments', () => {
  it('shows usage for builds with invalid reference', () => {
    const result = enhanceCommanderError(
      "error: too many arguments for 'builds'. Expected 0 arguments but got 1.",
      'builds',
      ['invalid']
    );

    expect(result).toContain('Unexpected argument');
    expect(result).toContain('bktide builds [org/pipeline]');
  });

  it('suggests org-only for pipelines with org/pipeline', () => {
    const result = enhanceCommanderError(
      "error: too many arguments for 'pipelines'. Expected 0 arguments but got 1.",
      'pipelines',
      ['gesso/zenpayroll']
    );

    expect(result).toContain('expects just an org');
    expect(result).toContain('bktide pipelines gesso');
  });
});
```

**Step 3: Run tests**

Run: `npm test -- test/utils/commander-error-handler.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/commander-error-handler.ts test/utils/commander-error-handler.test.ts
git commit -m "refactor: update error handler for smart arg support

Updates error messages now that builds/pipelines accept positional args.
Provides helpful guidance for edge cases like wrong format.
"
```

---

## Verification Checklist

After all tasks, verify these scenarios:

```bash
# Task 1: pipelines smart args
bin/bktide pipelines gesso
bin/bktide pipelines gesso --count 5
bin/bktide pipelines --help

# Task 2: builds smart args
bin/bktide builds gesso/zenpayroll
bin/bktide builds gesso/zenpayroll --state failed
bin/bktide builds https://buildkite.com/gesso/zenpayroll
bin/bktide builds --help

# Backward compatibility
bin/bktide builds --org gesso --pipeline zenpayroll
bin/bktide pipelines --org gesso

# All tests pass
npm test
```

---

## Summary

| Task | Change | Commands Affected |
|------|--------|-------------------|
| 1 | Add `[org]` positional arg | `pipelines` |
| 2 | Add `[reference]` positional arg | `builds` |
| 3 | Update error messages for edge cases | Error handler |

---

## Follow-up: Pipeline Lookup Exact Match Bug

**Status:** Not started - document for future session

### Problem

When using `bktide gusto/zenpayroll` (SmartShow → ShowPipeline), the pipeline lookup doesn't prefer exact matches:

```bash
# This shows wrong pipeline (e.g., zenpayroll-mcp-evals instead of zenpayroll)
bktide gusto/zenpayroll

# This correctly filters to exact pipeline
bktide builds gusto/zenpayroll
```

### Root Cause

- **ShowPipeline** uses GraphQL `GetPipeline` query which does fuzzy/prefix matching
- **ListBuilds** uses REST API with exact `pipeline` filter parameter

### Expected Behavior

`bktide gusto/zenpayroll` should show the pipeline named exactly `zenpayroll`, not a partial match like `zenpayroll-mcp-evals`.

### Investigation Areas

1. `src/commands/ShowPipeline.ts` - How it calls the GraphQL client
2. `src/services/BuildkiteClient.ts` - The `getPipeline` method and GraphQL query
3. `src/graphql/queries.ts` - The `GetPipeline` query definition

### Potential Fix

Either:
1. Modify GraphQL query to filter for exact slug match
2. Post-filter results to prefer exact match over partial
3. Use REST API for pipeline lookup (like builds does)
