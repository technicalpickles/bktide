# Error Output Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve CLI error messages to be actionable and user-friendly instead of generic Commander.js defaults.

**Architecture:** Custom Commander.js error handler that intercepts default errors and enhances them with context-aware suggestions. Centralized in `src/utils/commander-error-handler.ts`.

**Tech Stack:** Commander.js, TypeScript, Vitest

---

## Background

### Navigation Commands (for testing)

```bash
bktide orgs                              # List available orgs
bktide pipelines --org <org>             # List pipelines for an org
bktide builds --org <org> --pipeline <p> # List builds
bktide build <org>/<pipeline>/<number>   # Show specific build
bktide pipeline <org>/<pipeline>         # Show pipeline details
```

### Error Categories

| Category | Current Output | Target Output |
|----------|----------------|---------------|
| Too many args | "too many arguments for 'builds'" | Detect pattern, suggest flags |
| Missing required arg | "missing required argument 'build'" | Show example usage |
| Unknown option | "unknown option '--badopt'" | Point to --help |
| Invalid enum | API error leaks | Validate upfront, list valid values |
| Null response | JS error leaks | Graceful "not found" message |

---

## Task 1: Fix Null Build Response Bug

**Files:**
- Modify: `src/commands/ShowBuild.ts:66-69`
- Test: `test/commands/ShowBuild.test.ts`

**Step 1: Write the failing test**

Create test that expects graceful error for nonexistent build:

```typescript
// In test/commands/ShowBuild.test.ts
describe('ShowBuild error handling', () => {
  it('handles null build response gracefully', async () => {
    // Mock client to return null for build
    const mockClient = {
      getBuildSummary: vi.fn().mockResolvedValue(null),
    };

    const command = new ShowBuild();
    command['client'] = mockClient as any;

    const result = await command.execute({
      buildArg: 'gesso/fake/999',
    });

    expect(result).toBe(1);
    // Should NOT throw "Cannot read properties of null"
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/commands/ShowBuild.test.ts -t "handles null build response"`
Expected: FAIL with TypeError

**Step 3: Add null check in ShowBuild.ts**

In `fetchBuildData` method, after the API call:

```typescript
// After line 128 in fetchBuildData
const buildData = await this.client.getBuildSummaryWithAllJobs(buildSlug, {
  fetchAllJobs: true,
  onProgress: progressCallback
});

if (!buildData) {
  throw new Error(`Build not found: ${buildSlug}`);
}
```

And in the summary path (line 148):

```typescript
const buildData = await this.client.getBuildSummary(buildSlug);
if (!buildData) {
  throw new Error(`Build not found: ${buildSlug}`);
}
return buildData;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/commands/ShowBuild.test.ts -t "handles null build response"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/ShowBuild.ts test/commands/ShowBuild.test.ts
git commit -m "fix: handle null build response gracefully

Previously, requesting a nonexistent build would leak a JS error:
'Cannot read properties of null'. Now shows 'Build not found: org/pipeline/number'.
"
```

---

## Task 2: Create Commander Error Handler Infrastructure

**Files:**
- Create: `src/utils/commander-error-handler.ts`
- Test: `test/utils/commander-error-handler.test.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing test**

```typescript
// test/utils/commander-error-handler.test.ts
import { describe, it, expect } from 'vitest';
import { enhanceCommanderError } from '../src/utils/commander-error-handler.js';

describe('enhanceCommanderError', () => {
  describe('too many arguments', () => {
    it('suggests --org and --pipeline for builds with org/pipeline pattern', () => {
      const result = enhanceCommanderError(
        "error: too many arguments for 'builds'. Expected 0 arguments but got 1.",
        'builds',
        ['gesso/zenpayroll']
      );

      expect(result).toContain('Did you mean');
      expect(result).toContain('--org gesso --pipeline zenpayroll');
    });

    it('suggests --org for pipelines with single arg', () => {
      const result = enhanceCommanderError(
        "error: too many arguments for 'pipelines'. Expected 0 arguments but got 1.",
        'pipelines',
        ['gesso']
      );

      expect(result).toContain('Did you mean');
      expect(result).toContain('--org gesso');
    });
  });

  describe('missing required argument', () => {
    it('shows example for build command', () => {
      const result = enhanceCommanderError(
        "error: missing required argument 'build'",
        'build',
        []
      );

      expect(result).toContain('Example');
      expect(result).toContain('bktide build myorg/mypipeline/123');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/commander-error-handler.test.ts`
Expected: FAIL - module not found

**Step 3: Implement commander-error-handler.ts**

```typescript
// src/utils/commander-error-handler.ts
/**
 * Enhanced error messages for Commander.js argument errors
 */

interface CommandExample {
  usage: string;
  example: string;
}

const COMMAND_EXAMPLES: Record<string, CommandExample> = {
  build: {
    usage: 'bktide build <org/pipeline/number>',
    example: 'bktide build myorg/mypipeline/123',
  },
  pipeline: {
    usage: 'bktide pipeline <org/pipeline>',
    example: 'bktide pipeline myorg/mypipeline',
  },
  annotations: {
    usage: 'bktide annotations <org/pipeline/number>',
    example: 'bktide annotations myorg/mypipeline/123',
  },
  logs: {
    usage: 'bktide logs <org/pipeline/number>',
    example: 'bktide logs myorg/mypipeline/123',
  },
  snapshot: {
    usage: 'bktide snapshot <org/pipeline/number>',
    example: 'bktide snapshot myorg/mypipeline/123',
  },
};

/**
 * Enhance a Commander.js error message with actionable suggestions
 */
export function enhanceCommanderError(
  originalError: string,
  commandName: string,
  args: string[]
): string {
  // Handle "too many arguments" errors
  if (originalError.includes('too many arguments')) {
    return handleTooManyArgs(commandName, args);
  }

  // Handle "missing required argument" errors
  if (originalError.includes('missing required argument')) {
    return handleMissingArg(commandName);
  }

  // Handle "unknown option" errors
  if (originalError.includes('unknown option')) {
    return handleUnknownOption(originalError, commandName);
  }

  // Return original if no enhancement available
  return originalError;
}

function handleTooManyArgs(commandName: string, args: string[]): string {
  const arg = args[0] || '';

  // Pattern: builds gesso/zenpayroll -> --org gesso --pipeline zenpayroll
  if (commandName === 'builds' && arg.includes('/')) {
    const [org, pipeline] = arg.split('/');
    return `Did you mean: bktide builds --org ${org} --pipeline ${pipeline}

The 'builds' command uses flags instead of positional arguments.
Run 'bktide builds --help' for all options.`;
  }

  // Pattern: pipelines gesso -> --org gesso
  if (commandName === 'pipelines' && arg && !arg.includes('/')) {
    return `Did you mean: bktide pipelines --org ${arg}

The 'pipelines' command uses --org flag instead of positional argument.
Run 'bktide pipelines --help' for all options.`;
  }

  // Pattern: orgs extraarg -> no args needed
  if (commandName === 'orgs' || commandName === 'viewer' || commandName === 'token') {
    return `The '${commandName}' command doesn't accept arguments.

Run 'bktide ${commandName} --help' for available options.`;
  }

  // Generic fallback
  return `Unexpected argument: ${arg}

Run 'bktide ${commandName} --help' for usage information.`;
}

function handleMissingArg(commandName: string): string {
  const example = COMMAND_EXAMPLES[commandName];

  if (example) {
    return `Missing required argument for '${commandName}'

Usage: ${example.usage}
Example: ${example.example}

Run 'bktide ${commandName} --help' for more information.`;
  }

  return `Missing required argument for '${commandName}'

Run 'bktide ${commandName} --help' for usage information.`;
}

function handleUnknownOption(originalError: string, commandName: string): string {
  // Extract the unknown option from the error
  const match = originalError.match(/unknown option '([^']+)'/);
  const option = match ? match[1] : 'unknown';

  return `Unknown option: ${option}

Run 'bktide ${commandName} --help' to see available options.`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/commander-error-handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/commander-error-handler.ts test/utils/commander-error-handler.test.ts
git commit -m "feat: add commander error handler for better error messages

Adds enhanceCommanderError() that transforms generic Commander.js errors
into actionable suggestions:
- 'builds gesso/pipeline' -> suggests --org and --pipeline flags
- 'pipelines gesso' -> suggests --org flag
- missing arg -> shows example usage
"
```

---

## Task 3: Wire Up Commander Error Handler

**Files:**
- Modify: `src/index.ts`
- Test: Manual CLI testing

**Step 1: Write integration test expectations**

Document expected behavior (manual test):

```bash
# Before: "error: too many arguments for 'builds'. Expected 0 arguments but got 1."
# After:
bin/bktide builds gesso/zenpayroll
# Expected output:
# Did you mean: bktide builds --org gesso --pipeline zenpayroll
#
# The 'builds' command uses flags instead of positional arguments.
# Run 'bktide builds --help' for all options.
```

**Step 2: Find Commander's configureOutput in index.ts**

Look for where to hook into Commander's error handling. Need to use `.configureOutput()` or `.exitOverride()`.

**Step 3: Add error handler to program setup**

In `src/index.ts`, after program is created (around line 175):

```typescript
import { enhanceCommanderError } from './utils/commander-error-handler.js';

// After: const program = new Command();
// Add custom error output handling
program.configureOutput({
  writeErr: (str: string) => {
    // Check if this is an argument error we can enhance
    const commandMatch = str.match(/for '(\w+)'/);
    const commandName = commandMatch ? commandMatch[1] : '';

    // Get the extra args from process.argv
    const commandIndex = process.argv.findIndex(arg => arg === commandName);
    const extraArgs = commandIndex >= 0 ? process.argv.slice(commandIndex + 1).filter(a => !a.startsWith('-')) : [];

    const enhanced = enhanceCommanderError(str, commandName, extraArgs);
    process.stderr.write(enhanced + '\n');
  }
});
```

**Step 4: Test manually**

Run: `bin/bktide builds gesso/zenpayroll`
Expected: Enhanced error with suggestion

Run: `bin/bktide pipelines gesso`
Expected: Enhanced error with --org suggestion

Run: `bin/bktide build`
Expected: Missing arg with example

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: integrate commander error handler for CLI-wide better errors

Hooks into Commander.js output to enhance generic errors with:
- Pattern detection for common mistakes
- Examples for missing arguments
- Help pointers for unknown options
"
```

---

## Task 4: Add State Validation for builds Command

**Files:**
- Modify: `src/commands/ListBuilds.ts`
- Test: `test/commands/ListBuilds.test.ts`

**Step 1: Write the failing test**

```typescript
// In test/commands/ListBuilds.test.ts
describe('ListBuilds validation', () => {
  it('rejects invalid state values with helpful message', async () => {
    const command = new ListBuilds();
    const consoleSpy = vi.spyOn(process.stderr, 'write');

    const result = await command.execute({
      state: 'badstate',
      org: 'gesso',
    });

    expect(result).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid state')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('running')
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/commands/ListBuilds.test.ts -t "rejects invalid state"`
Expected: FAIL - currently passes invalid state to API

**Step 3: Add state validation**

In `src/commands/ListBuilds.ts`, add validation at start of execute():

```typescript
const VALID_STATES = [
  'running', 'scheduled', 'passed', 'failing', 'failed',
  'canceled', 'canceling', 'blocked', 'not_run', 'skipped'
];

async execute(options: ViewerBuildsOptions): Promise<number> {
  // Validate state option if provided
  if (options.state && !VALID_STATES.includes(options.state.toLowerCase())) {
    const validList = VALID_STATES.join(', ');
    process.stderr.write(
      `Invalid state '${options.state}'\n` +
      `Valid states: ${validList}\n`
    );
    return 1;
  }

  // ... rest of execute
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/commands/ListBuilds.test.ts -t "rejects invalid state"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/ListBuilds.ts test/commands/ListBuilds.test.ts
git commit -m "feat: validate --state option upfront with valid values list

Previously, invalid state values were passed to API and leaked cryptic errors.
Now validates upfront and shows: 'Invalid state X. Valid states: running, ...'
"
```

---

## Task 5: Standardize Error Format Across Commands

**Files:**
- Modify: `src/utils/commander-error-handler.ts`
- Test: `test/utils/commander-error-handler.test.ts`

**Step 1: Write test for consistent format**

```typescript
describe('error format consistency', () => {
  it('uses standard error format with icon', () => {
    const result = enhanceCommanderError(
      "error: missing required argument 'build'",
      'build',
      []
    );

    expect(result).toMatch(/^✖/); // Starts with error icon
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/commander-error-handler.test.ts -t "standard error format"`
Expected: FAIL - no icon prefix

**Step 3: Update format to match existing good patterns**

Update `commander-error-handler.ts` functions to use consistent format:

```typescript
function handleTooManyArgs(commandName: string, args: string[]): string {
  const arg = args[0] || '';

  if (commandName === 'builds' && arg.includes('/')) {
    const [org, pipeline] = arg.split('/');
    return `✖ Error

Did you mean: bktide builds --org ${org} --pipeline ${pipeline}

** To fix this: **
  1. Use --org and --pipeline flags instead of positional argument
  2. Run 'bktide builds --help' for all options`;
  }

  // ... update other cases similarly
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/commander-error-handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/commander-error-handler.ts test/utils/commander-error-handler.test.ts
git commit -m "style: standardize error format across all enhanced errors

Uses consistent format matching existing good patterns:
- ✖ Error icon prefix
- Clear explanation
- ** To fix this: ** section with numbered suggestions
"
```

---

## Verification Checklist

After all tasks, verify these scenarios manually:

```bash
# Task 1: Null build
bin/bktide build gesso/fake/999
# Expected: "Build not found: gesso/fake/999" (not JS error)

# Task 2-3: Too many args
bin/bktide builds gesso/zenpayroll
# Expected: "Did you mean: bktide builds --org gesso --pipeline zenpayroll"

bin/bktide pipelines gesso
# Expected: "Did you mean: bktide pipelines --org gesso"

# Task 2-3: Missing arg
bin/bktide build
# Expected: "Example: bktide build myorg/mypipeline/123"

# Task 4: Invalid state
bin/bktide builds --state badstate
# Expected: "Invalid state 'badstate'. Valid states: running, ..."
```

---

## Summary

| Task | Issue Fixed | Commands Affected |
|------|-------------|-------------------|
| 1 | JS error leaks for null build | `build` |
| 2-3 | Generic "too many arguments" | `builds`, `pipelines`, `orgs`, `viewer`, `token` |
| 2-3 | Generic "missing required argument" | `build`, `pipeline`, `annotations`, `logs`, `snapshot` |
| 4 | Invalid enum values leak API error | `builds --state` |
| 5 | Inconsistent error formatting | All enhanced errors |
