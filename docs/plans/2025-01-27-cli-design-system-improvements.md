# CLI Design System Improvements Implementation Plan

> **Status:** 🚧 **IN PROGRESS** - Tasks 1-10 complete. Tasks 11-14 added to restore lost functionality.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply design system principles to improve CLI output consistency, extracting shared utilities and refactoring the snapshot command to use the formatter pattern.

**Architecture:** Extract duplicated job stats and duration formatting into shared utilities. Create snapshot formatters following the existing entity-formatter pattern. Refactor Snapshot.ts to use formatters instead of direct logger.console() calls.

**Tech Stack:** TypeScript, Vitest for testing, chalk for colors, date-fns for time formatting

## Regressions Identified (Post-Task 10 Review)

During testing, the following regressions were found compared to the pre-refactor version:

1. **Missing ▲ symbol** - Soft failures should show `▲ 2 soft failures` but currently show `2 soft failures`
2. **Lost navigation tips** - The `displayNavigationTips()` method with actionable `jq`/`cat`/`grep` commands was removed during the formatter refactor
3. **Lost helper functions** - `pathWithTilde()` and `getFirstFailedStepDir()` were removed

Tasks 11-14 restore this functionality.

---

## Task 1: Extract Job Stats Utility

**Files:**
- Create: `src/utils/jobStats.ts`
- Create: `test/utils/jobStats.test.ts`

**Step 1: Write the failing test for job stats calculation**

```typescript
// test/utils/jobStats.test.ts
import { describe, it, expect } from 'vitest';
import { calculateJobStats, JobStats } from '../../src/utils/jobStats.js';

describe('calculateJobStats', () => {
  it('counts passed jobs by exit status 0', () => {
    const jobs = [
      { exitStatus: '0', state: 'FINISHED' },
      { exitStatus: '0', state: 'FINISHED' },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.passed).toBe(2);
    expect(stats.total).toBe(2);
  });

  it('counts hard failed jobs (non-zero exit, not soft failed)', () => {
    const jobs = [
      { exitStatus: '1', state: 'FAILED', softFailed: false },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(0);
  });

  it('counts soft failed jobs separately', () => {
    const jobs = [
      { exitStatus: '1', state: 'FAILED', softFailed: true },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.failed).toBe(0);
    expect(stats.softFailed).toBe(1);
  });

  it('counts running jobs', () => {
    const jobs = [
      { state: 'RUNNING' },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.running).toBe(1);
  });

  it('handles mixed job states', () => {
    const jobs = [
      { exitStatus: '0', state: 'FINISHED' },
      { exitStatus: '1', state: 'FAILED', softFailed: false },
      { exitStatus: '1', state: 'FAILED', softFailed: true },
      { state: 'RUNNING' },
      { state: 'SCHEDULED' },
    ];
    const stats = calculateJobStats(jobs);
    expect(stats.total).toBe(5);
    expect(stats.passed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(1);
    expect(stats.running).toBe(1);
    expect(stats.queued).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/jobStats.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/utils/jobStats.ts
export interface JobStats {
  total: number;
  passed: number;
  failed: number;
  softFailed: number;
  running: number;
  blocked: number;
  skipped: number;
  canceled: number;
  queued: number;
}

/**
 * Calculate job statistics from an array of jobs
 * Uses exitStatus as primary source of truth, falls back to state
 */
export function calculateJobStats(jobs: any[]): JobStats {
  const stats: JobStats = {
    total: jobs.length,
    passed: 0,
    failed: 0,
    softFailed: 0,
    running: 0,
    blocked: 0,
    skipped: 0,
    canceled: 0,
    queued: 0,
  };

  for (const job of jobs) {
    const state = job.state?.toUpperCase();

    // Check exitStatus first (most reliable)
    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      const exitCode = parseInt(job.exitStatus, 10);
      if (exitCode === 0) {
        stats.passed++;
        continue;
      } else {
        // Non-zero exit - check if soft failure
        if (job.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        continue;
      }
    }

    // Fall back to state-based classification
    switch (state) {
      case 'PASSED':
      case 'FINISHED':
        stats.passed++;
        break;
      case 'FAILED':
      case 'TIMED_OUT':
        if (job.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        break;
      case 'RUNNING':
        stats.running++;
        break;
      case 'BLOCKED':
      case 'WAITING':
        stats.blocked++;
        break;
      case 'SKIPPED':
      case 'BROKEN':
        stats.skipped++;
        break;
      case 'CANCELED':
      case 'CANCELING':
        stats.canceled++;
        break;
      case 'SCHEDULED':
      case 'ASSIGNED':
      case 'ACCEPTED':
      case 'PENDING':
        stats.queued++;
        break;
      default:
        // Unknown state - count as queued if no exit status
        stats.queued++;
    }
  }

  return stats;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/jobStats.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/jobStats.ts test/utils/jobStats.test.ts
git commit -m "feat: extract job stats calculation to shared utility"
```

---

## Task 2: Add Job Stats Summary Formatter

**Files:**
- Modify: `src/utils/jobStats.ts`
- Modify: `test/utils/jobStats.test.ts`

**Step 1: Write the failing test for summary formatting**

Add to `test/utils/jobStats.test.ts`:

```typescript
import { calculateJobStats, formatJobStatsSummary } from '../../src/utils/jobStats.js';

describe('formatJobStatsSummary', () => {
  it('formats stats as readable summary', () => {
    const stats = {
      total: 5,
      passed: 3,
      failed: 1,
      softFailed: 1,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
    };
    const summary = formatJobStatsSummary(stats);
    expect(summary).toContain('5 steps:');
    expect(summary).toContain('3 passed');
    expect(summary).toContain('1 failed');
    expect(summary).toContain('1 soft failure');
  });

  it('omits zero counts', () => {
    const stats = {
      total: 2,
      passed: 2,
      failed: 0,
      softFailed: 0,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
    };
    const summary = formatJobStatsSummary(stats);
    expect(summary).toContain('2 passed');
    expect(summary).not.toContain('failed');
  });

  it('handles singular/plural correctly', () => {
    const stats = {
      total: 1,
      passed: 1,
      failed: 0,
      softFailed: 0,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
    };
    const summary = formatJobStatsSummary(stats);
    expect(summary).toContain('1 step:');
    expect(summary).not.toContain('steps');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/jobStats.test.ts`
Expected: FAIL with "formatJobStatsSummary is not a function"

**Step 3: Write minimal implementation**

Add to `src/utils/jobStats.ts`:

```typescript
import { SEMANTIC_COLORS } from '../ui/theme.js';

/**
 * Format job stats as a human-readable summary line
 * Example: "5 steps: 3 passed, 1 failed, 1 soft failure"
 */
export function formatJobStatsSummary(stats: JobStats, useColors = true): string {
  const parts: string[] = [];

  const color = useColors ? SEMANTIC_COLORS : {
    success: (s: string) => s,
    error: (s: string) => s,
    warning: (s: string) => s,
    info: (s: string) => s,
    muted: (s: string) => s,
  };

  if (stats.passed > 0) {
    parts.push(color.success(`${stats.passed} passed`));
  }
  if (stats.failed > 0) {
    parts.push(color.error(`${stats.failed} failed`));
  }
  if (stats.softFailed > 0) {
    const label = stats.softFailed === 1 ? 'soft failure' : 'soft failures';
    parts.push(color.warning(`▲ ${stats.softFailed} ${label}`));
  }
  if (stats.running > 0) {
    parts.push(color.info(`${stats.running} running`));
  }
  if (stats.blocked > 0) {
    parts.push(color.muted(`${stats.blocked} blocked`));
  }
  if (stats.queued > 0) {
    parts.push(color.muted(`${stats.queued} queued`));
  }
  if (stats.skipped > 0) {
    parts.push(color.muted(`${stats.skipped} skipped`));
  }
  if (stats.canceled > 0) {
    parts.push(color.muted(`${stats.canceled} canceled`));
  }

  const stepWord = stats.total === 1 ? 'step' : 'steps';
  return `${stats.total} ${stepWord}: ${parts.join(', ')}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/jobStats.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/jobStats.ts test/utils/jobStats.test.ts
git commit -m "feat: add job stats summary formatter"
```

---

## Task 3: Add Duration Helper to formatUtils

**Files:**
- Modify: `src/utils/formatUtils.ts`
- Modify: `test/utils/formatUtils.test.ts`

**Step 1: Write the failing test**

Add to `test/utils/formatUtils.test.ts`:

```typescript
import { formatBuildDuration } from '../../src/utils/formatUtils.js';

describe('formatBuildDuration', () => {
  it('formats duration from startedAt and finishedAt', () => {
    const result = formatBuildDuration({
      startedAt: '2025-01-27T10:00:00Z',
      finishedAt: '2025-01-27T10:02:30Z',
    });
    expect(result).toBe('2m 30s');
  });

  it('returns empty string when not started', () => {
    const result = formatBuildDuration({
      startedAt: null,
      finishedAt: null,
    });
    expect(result).toBe('');
  });

  it('formats hours for long durations', () => {
    const result = formatBuildDuration({
      startedAt: '2025-01-27T10:00:00Z',
      finishedAt: '2025-01-27T11:30:45Z',
    });
    expect(result).toBe('1h 30m');
  });

  it('formats seconds only for short durations', () => {
    const result = formatBuildDuration({
      startedAt: '2025-01-27T10:00:00Z',
      finishedAt: '2025-01-27T10:00:45Z',
    });
    expect(result).toBe('45s');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/formatUtils.test.ts`
Expected: FAIL with "formatBuildDuration is not exported"

**Step 3: Write minimal implementation**

Add to `src/utils/formatUtils.ts`:

```typescript
/**
 * Format duration from a build or job object's timestamps
 * Returns empty string if not started
 */
export function formatBuildDuration(obj: {
  startedAt?: string | null;
  finishedAt?: string | null;
}): string {
  if (!obj.startedAt) return '';

  const start = new Date(obj.startedAt).getTime();
  const end = obj.finishedAt ? new Date(obj.finishedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/formatUtils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/formatUtils.ts test/utils/formatUtils.test.ts
git commit -m "feat: add formatBuildDuration helper"
```

---

## Task 4: Create Snapshot Formatter Interface

**Files:**
- Create: `src/formatters/snapshot/Formatter.ts`

**Step 1: Create the formatter interface and types**

```typescript
// src/formatters/snapshot/Formatter.ts
import { FormatterOptions } from '../BaseFormatter.js';

export interface StepResult {
  id: string;
  jobId: string;
  status: 'success' | 'failed';
  error?: string;
  message?: string;
  retryable?: boolean;
}

export interface Manifest {
  version: number;
  buildRef: string;
  url: string;
  fetchedAt: string;
  complete: boolean;
  build: {
    status: string;
  };
  steps: StepResult[];
}

export interface SnapshotData {
  manifest: Manifest;
  build: any;
  outputDir: string;
  scriptJobs: any[];
  stepResults: StepResult[];
  fetchAll: boolean;
}

export interface SnapshotFormatterOptions extends FormatterOptions {
  // Snapshot-specific options can be added here
}

export interface SnapshotFormatter {
  name: string;
  formatSnapshot(data: SnapshotData, options?: SnapshotFormatterOptions): string;
}
```

**Step 2: Commit**

```bash
git add src/formatters/snapshot/Formatter.ts
git commit -m "feat: add snapshot formatter interface and types"
```

---

## Task 5: Create Snapshot PlainTextFormatter

**Files:**
- Create: `src/formatters/snapshot/PlainTextFormatter.ts`
- Create: `test/formatters/snapshot.test.ts`

**Step 1: Write the failing test**

```typescript
// test/formatters/snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { PlainTextFormatter } from '../../src/formatters/snapshot/PlainTextFormatter.js';

describe('Snapshot PlainTextFormatter', () => {
  const formatter = new PlainTextFormatter();

  const mockData = {
    manifest: {
      version: 1,
      buildRef: 'org/pipeline/123',
      url: 'https://buildkite.com/org/pipeline/builds/123',
      fetchedAt: '2025-01-27T10:00:00Z',
      complete: true,
      build: { status: 'PASSED' },
      steps: [{ id: '01-test', jobId: 'job1', status: 'success' as const }],
    },
    build: {
      state: 'PASSED',
      number: 123,
      message: 'Fix authentication bug',
      branch: 'main',
      commit: 'abc1234567890',
      createdAt: '2025-01-27T09:55:00Z',
      startedAt: '2025-01-27T10:00:00Z',
      finishedAt: '2025-01-27T10:02:30Z',
      createdBy: { name: 'Josh' },
    },
    outputDir: '/home/user/.bktide/snapshots/org/pipeline/123',
    scriptJobs: [{ exitStatus: '0', state: 'FINISHED' }],
    stepResults: [{ id: '01-test', jobId: 'job1', status: 'success' as const }],
    fetchAll: false,
  };

  it('includes build status and message', () => {
    const output = formatter.formatSnapshot(mockData);
    expect(output).toContain('PASSED');
    expect(output).toContain('Fix authentication bug');
  });

  it('includes output directory path', () => {
    const output = formatter.formatSnapshot(mockData);
    expect(output).toContain('/home/user/.bktide/snapshots/org/pipeline/123');
  });

  it('includes step count', () => {
    const output = formatter.formatSnapshot(mockData);
    expect(output).toContain('1 step');
  });

  it('shows tip about --all when not fetching all', () => {
    const data = { ...mockData, fetchAll: false, scriptJobs: [{}, {}] };
    const output = formatter.formatSnapshot(data);
    expect(output).toContain('--all');
  });

  it('hides tips when options.tips is false', () => {
    const data = { ...mockData, fetchAll: false, scriptJobs: [{}, {}] };
    const output = formatter.formatSnapshot(data, { tips: false });
    expect(output).not.toContain('--all');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/formatters/snapshot.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
// src/formatters/snapshot/PlainTextFormatter.ts
import { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions } from './Formatter.js';
import { SEMANTIC_COLORS, getStateIcon, BUILD_STATUS_THEME, formatTips, TipStyle } from '../../ui/theme.js';
import { formatBuildDuration } from '../../utils/formatUtils.js';
import { calculateJobStats, formatJobStatsSummary } from '../../utils/jobStats.js';
import { formatDistanceToNow } from 'date-fns';

export class PlainTextFormatter implements SnapshotFormatter {
  name = 'plain';

  formatSnapshot(data: SnapshotData, options?: SnapshotFormatterOptions): string {
    const lines: string[] = [];
    const { build, outputDir, scriptJobs, stepResults, fetchAll } = data;

    // Build summary header
    lines.push(this.formatBuildHeader(build));
    lines.push(this.formatBuildDetails(build));
    lines.push('');

    // Job stats
    const stats = calculateJobStats(scriptJobs);
    lines.push(formatJobStatsSummary(stats));
    lines.push('');

    // Snapshot info
    lines.push(`Snapshot saved to ${outputDir}`);

    if (stepResults.length > 0) {
      lines.push(`  ${stepResults.length} step(s) captured`);
    } else if (!fetchAll) {
      lines.push(`  No failed steps to capture (build metadata saved)`);
    } else {
      lines.push(`  No steps to capture (build metadata saved)`);
    }

    // Warning for fetch errors
    const fetchErrorCount = stepResults.filter(s => s.status === 'failed').length;
    if (fetchErrorCount > 0) {
      lines.push(`  Warning: ${fetchErrorCount} step(s) had errors fetching logs`);
    }

    // Tips
    if (options?.tips !== false) {
      const tips: string[] = [];

      // Tip about --all if we filtered
      if (!fetchAll && scriptJobs.length > stepResults.length) {
        const skippedCount = scriptJobs.length - stepResults.length;
        tips.push(`${skippedCount} passing step(s) skipped. Use --all to capture all logs.`);
      }

      if (tips.length > 0) {
        lines.push('');
        lines.push(formatTips(tips, TipStyle.INDIVIDUAL, false));
      }
    }

    return lines.join('\n');
  }

  private formatBuildHeader(build: any): string {
    const state = build.state || 'unknown';
    const icon = getStateIcon(state);
    const theme = BUILD_STATUS_THEME[state.toUpperCase() as keyof typeof BUILD_STATUS_THEME];
    const coloredIcon = theme ? theme.color(icon) : icon;
    const coloredState = theme ? theme.color(state.toUpperCase()) : state.toUpperCase();
    const message = build.message?.split('\n')[0] || 'No message';
    const duration = formatBuildDuration(build);
    const durationStr = duration ? ` ${SEMANTIC_COLORS.dim(duration)}` : '';

    return `${coloredIcon} ${coloredState} ${message} ${SEMANTIC_COLORS.dim(`#${build.number}`)}${durationStr}`;
  }

  private formatBuildDetails(build: any): string {
    const author = build.createdBy?.name || build.createdBy?.email || 'Unknown';
    const branch = build.branch || 'unknown';
    const commit = build.commit?.substring(0, 7) || 'unknown';
    const created = build.createdAt
      ? formatDistanceToNow(new Date(build.createdAt), { addSuffix: true })
      : '';

    return `         ${author} • ${SEMANTIC_COLORS.identifier(branch)} • ${commit} • ${SEMANTIC_COLORS.dim(created)}`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/formatters/snapshot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/formatters/snapshot/PlainTextFormatter.ts test/formatters/snapshot.test.ts
git commit -m "feat: add snapshot PlainTextFormatter"
```

---

## Task 6: Create Snapshot JsonFormatter and Index

**Files:**
- Create: `src/formatters/snapshot/JsonFormatter.ts`
- Create: `src/formatters/snapshot/index.ts`

**Step 1: Create JsonFormatter**

```typescript
// src/formatters/snapshot/JsonFormatter.ts
import { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions } from './Formatter.js';

export class JsonFormatter implements SnapshotFormatter {
  name = 'json';

  formatSnapshot(data: SnapshotData, _options?: SnapshotFormatterOptions): string {
    return JSON.stringify(data.manifest, null, 2);
  }
}
```

**Step 2: Create index with factory function**

```typescript
// src/formatters/snapshot/index.ts
export { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions, Manifest, StepResult } from './Formatter.js';
export { PlainTextFormatter } from './PlainTextFormatter.js';
export { JsonFormatter } from './JsonFormatter.js';

import { SnapshotFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';

export function getSnapshotFormatter(format: string = 'plain'): SnapshotFormatter {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonFormatter();
    default:
      return new PlainTextFormatter();
  }
}
```

**Step 3: Commit**

```bash
git add src/formatters/snapshot/JsonFormatter.ts src/formatters/snapshot/index.ts
git commit -m "feat: add snapshot JsonFormatter and factory"
```

---

## Task 7: Add Snapshot to FormatterFactory

**Files:**
- Modify: `src/formatters/FormatterFactory.ts`
- Modify: `src/formatters/index.ts`

**Step 1: Update FormatterFactory**

Add to `src/formatters/FormatterFactory.ts`:

```typescript
// Add to FormatterType enum
SNAPSHOT = 'snapshot',

// Add import at top
import { getSnapshotFormatter } from './snapshot/index.js';

// Add case in getFormatter switch
case FormatterType.SNAPSHOT:
  return getSnapshotFormatter(format) as unknown as BaseFormatter;
```

**Step 2: Update index.ts exports**

Add to `src/formatters/index.ts`:

```typescript
export * from './snapshot/index.js';
```

**Step 3: Commit**

```bash
git add src/formatters/FormatterFactory.ts src/formatters/index.ts
git commit -m "feat: register snapshot formatter in FormatterFactory"
```

---

## Task 8: Refactor Snapshot Command to Use Formatter

**Files:**
- Modify: `src/commands/Snapshot.ts`

**Step 1: Update imports**

Add/modify at top of `src/commands/Snapshot.ts`:

```typescript
import { FormatterFactory, FormatterType, SnapshotData } from '../formatters/index.js';
```

**Step 2: Replace output section (lines 214-242)**

Replace the output section in `execute()` method:

```typescript
// 8. Output using formatter
const snapshotData: SnapshotData = {
  manifest,
  build,
  outputDir,
  scriptJobs,
  stepResults,
  fetchAll,
};

const formatter = FormatterFactory.getFormatter(
  FormatterType.SNAPSHOT,
  options.json ? 'json' : 'plain'
);
const output = (formatter as any).formatSnapshot(snapshotData, {
  tips: options.tips !== false
});
logger.console(output);

return manifest.complete ? 0 : 1;
```

**Step 3: Remove duplicate code**

Remove from `Snapshot.ts`:
- `formatDuration()` function (lines 73-86)
- `displayBuildSummary()` method (lines 374-434)

**Step 4: Run tests to verify nothing broke**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "refactor: use formatter pattern in Snapshot command"
```

---

## Task 9: Add tips Option to Snapshot Command

**Files:**
- Modify: `src/commands/Snapshot.ts`
- Modify: `src/index.ts`

**Step 1: Update SnapshotOptions interface**

In `src/commands/Snapshot.ts`, the `tips` option is already inherited from `BaseCommandOptions`. Verify it's available.

**Step 2: Wire --no-tips in CLI**

In `src/index.ts`, the global `--no-tips` option should already be passed through. Verify in the snapshot command handler.

**Step 3: Run manual test**

Run: `bin/bktide snapshot org/pipeline/123 --no-tips`
Expected: Output without tip hints

**Step 4: Commit if any changes needed**

```bash
git add src/index.ts src/commands/Snapshot.ts
git commit -m "feat: ensure --no-tips works with snapshot command"
```

---

## Task 10: Update Documentation

**Files:**
- Modify: `docs/developer/ui-design-system.md`

**Step 1: Update case study section**

Update the "Case Study: Snapshot Command" section to mark it as resolved:

```markdown
## Case Study: Snapshot Command

The `snapshot` command has been refactored to follow the design system:

### Improvements Made

1. **Formatter pattern**: Now uses `SnapshotPlainFormatter` instead of direct output
2. **Shared utilities**: Uses `calculateJobStats()` and `formatBuildDuration()`
3. **Tip formatting**: Uses `formatTips()` with proper `--no-tips` support
4. **Consistent styling**: Uses `SEMANTIC_COLORS` and `getStateIcon()` throughout

### Files Created

- `src/formatters/snapshot/Formatter.ts` - Types and interface
- `src/formatters/snapshot/PlainTextFormatter.ts` - Plain output
- `src/formatters/snapshot/JsonFormatter.ts` - JSON output
- `src/utils/jobStats.ts` - Shared job statistics utility
```

**Step 2: Commit**

```bash
git add docs/developer/ui-design-system.md
git commit -m "docs: update design system with snapshot refactoring"
```

---

## Verification Checklist

After completing all tasks:

- [x] **Run all tests**: `npm test` - 269 tests passing
- [ ] **Test snapshot command**: `bin/bktide snapshot org/pipeline/123`
- [ ] **Test --no-tips**: `bin/bktide snapshot org/pipeline/123 --no-tips`
- [ ] **Test --json**: `bin/bktide snapshot org/pipeline/123 --json`
- [ ] **Test accessibility**: `NO_COLOR=1 bin/bktide snapshot org/pipeline/123`
- [ ] **Test ASCII mode**: `BKTIDE_ASCII=1 bin/bktide snapshot org/pipeline/123`

---

## Task 11: Fix Missing ▲ Symbol for Soft Failures

**Files:**
- Modify: `src/utils/jobStats.ts`
- Modify: `test/utils/jobStats.test.ts`

**Context:** The plan specified `▲` prefix for soft failures but the implementation omitted it.

**Step 1: Update test to expect ▲ symbol**

In `test/utils/jobStats.test.ts`, update the test:

```typescript
it('formats stats as readable summary', () => {
  const stats = {
    total: 5,
    passed: 3,
    failed: 1,
    softFailed: 1,
    // ... other fields
  };
  const summary = formatJobStatsSummary(stats);
  expect(summary).toContain('▲ 1 soft failure');  // Note the ▲
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/jobStats.test.ts`
Expected: FAIL - missing ▲ symbol

**Step 3: Fix implementation**

In `src/utils/jobStats.ts`, change line ~120:

```typescript
// Before:
parts.push(color.warning(`${stats.softFailed} ${label}`));

// After:
parts.push(color.warning(`▲ ${stats.softFailed} ${label}`));
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/jobStats.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/jobStats.ts test/utils/jobStats.test.ts
git commit -m "fix: restore ▲ symbol for soft failures in job stats"
```

---

## Task 12: Add Path Utilities for Navigation Tips

**Files:**
- Modify: `src/utils/formatUtils.ts`
- Modify: `test/utils/formatUtils.test.ts`

**Step 1: Write failing tests**

Add to `test/utils/formatUtils.test.ts`:

```typescript
import { pathWithTilde, getFirstFailedStepDir } from '../../src/utils/formatUtils.js';
import os from 'os';

describe('pathWithTilde', () => {
  it('replaces home directory with tilde', () => {
    const homePath = `${os.homedir()}/some/path`;
    expect(pathWithTilde(homePath)).toBe('~/some/path');
  });

  it('leaves non-home paths unchanged', () => {
    expect(pathWithTilde('/var/log/test')).toBe('/var/log/test');
  });
});

describe('getFirstFailedStepDir', () => {
  it('returns first failed step directory name', () => {
    const jobs = [
      { name: 'setup', exitStatus: '0', state: 'FINISHED' },
      { name: 'test-unit', exitStatus: '1', state: 'FAILED' },
      { name: 'test-integration', exitStatus: '1', state: 'FAILED' },
    ];
    expect(getFirstFailedStepDir(jobs)).toBe('02-test-unit');
  });

  it('returns null when no failed steps', () => {
    const jobs = [
      { name: 'setup', exitStatus: '0', state: 'FINISHED' },
    ];
    expect(getFirstFailedStepDir(jobs)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/formatUtils.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Add to `src/utils/formatUtils.ts`:

```typescript
import os from 'os';
import { getStepDirName } from '../commands/Snapshot.js';

/**
 * Replace home directory with ~ for readable paths
 */
export function pathWithTilde(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, '~');
  }
  return fullPath;
}

/**
 * Get the directory name of the first failed step
 * Used to show example commands in navigation tips
 */
export function getFirstFailedStepDir(jobs: any[]): string | null {
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const exitCode = job.exitStatus !== null && job.exitStatus !== undefined
      ? parseInt(job.exitStatus, 10)
      : null;

    if (exitCode !== null && exitCode !== 0) {
      return getStepDirName(i, job.name || job.label || 'step');
    }
    if (job.state === 'FAILED' || job.passed === false) {
      return getStepDirName(i, job.name || job.label || 'step');
    }
  }
  return null;
}
```

**Step 4: Export getStepDirName from Snapshot.ts**

Ensure `getStepDirName` is exported (it should already be).

**Step 5: Run test to verify it passes**

Run: `npm test -- test/utils/formatUtils.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/utils/formatUtils.ts test/utils/formatUtils.test.ts
git commit -m "feat: add pathWithTilde and getFirstFailedStepDir helpers"
```

---

## Task 13: Add Navigation Tips to SnapshotData Interface

**Files:**
- Modify: `src/formatters/snapshot/Formatter.ts`

**Step 1: Extend SnapshotData interface**

Add annotation data to support navigation tips:

```typescript
export interface SnapshotData {
  manifest: Manifest;
  build: any;
  outputDir: string;
  scriptJobs: any[];
  stepResults: StepResult[];
  fetchAll: boolean;
  // New fields for navigation tips
  annotationResult?: {
    fetchStatus: 'success' | 'none' | 'failed';
    count: number;
  };
}
```

**Step 2: Update Snapshot.ts to pass annotation data**

In `src/commands/Snapshot.ts`, update the snapshotData construction to include annotation info if available.

**Step 3: Commit**

```bash
git add src/formatters/snapshot/Formatter.ts src/commands/Snapshot.ts
git commit -m "feat: extend SnapshotData with annotation info for tips"
```

---

## Task 14: Restore Navigation Tips in PlainTextFormatter

**Files:**
- Modify: `src/formatters/snapshot/PlainTextFormatter.ts`
- Modify: `test/formatters/snapshot.test.ts`

**Step 1: Write failing tests for navigation tips**

Add to `test/formatters/snapshot.test.ts`:

```typescript
describe('navigation tips', () => {
  const failedBuildData = {
    ...mockData,
    build: { ...mockData.build, state: 'FAILED' },
    scriptJobs: [
      { name: 'test', exitStatus: '1', state: 'FAILED' },
    ],
    stepResults: [{ id: '01-test', jobId: 'job1', status: 'success' as const }],
    annotationResult: { fetchStatus: 'success' as const, count: 2 },
  };

  it('shows jq commands for failed builds', () => {
    const output = formatter.formatSnapshot(failedBuildData);
    expect(output).toContain('Next steps:');
    expect(output).toContain('jq');
    expect(output).toContain('manifest.json');
  });

  it('shows annotation tip when annotations exist', () => {
    const output = formatter.formatSnapshot(failedBuildData);
    expect(output).toContain('annotations.json');
  });

  it('shows grep command for searching errors', () => {
    const output = formatter.formatSnapshot(failedBuildData);
    expect(output).toContain('grep');
    expect(output).toContain('Error');
  });

  it('hides navigation tips when tips option is false', () => {
    const output = formatter.formatSnapshot(failedBuildData, { tips: false });
    expect(output).not.toContain('Next steps:');
  });

  it('shows --no-tips hint', () => {
    const output = formatter.formatSnapshot(failedBuildData);
    expect(output).toContain('--no-tips');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/formatters/snapshot.test.ts`
Expected: FAIL

**Step 3: Implement navigation tips**

Update `src/formatters/snapshot/PlainTextFormatter.ts`:

```typescript
import { pathWithTilde, getFirstFailedStepDir } from '../../utils/formatUtils.js';
import path from 'path';

// In formatSnapshot(), replace the Tips section with:

// Navigation tips (actionable commands)
if (options?.tips !== false) {
  lines.push('');
  lines.push(...this.formatNavigationTips(data));
}

// Add new method:
private formatNavigationTips(data: SnapshotData): string[] {
  const { build, outputDir, scriptJobs, stepResults, fetchAll, annotationResult } = data;
  const lines: string[] = [];

  const buildState = build.state?.toLowerCase();
  const isFailed = buildState === 'failed' || buildState === 'failing';

  // Use tilde paths for readability
  const basePath = pathWithTilde(outputDir);
  const manifestPath = path.join(basePath, 'manifest.json');
  const stepsPath = path.join(basePath, 'steps');
  const annotationsPath = path.join(basePath, 'annotations.json');

  lines.push('Next steps:');

  if (isFailed) {
    // Tips for failed builds
    lines.push(`  → List failures:    jq -r '.steps[] | select(.state == "failed") | "\\(.id): \\(.label)"' ${manifestPath}`);

    // Add annotation tip if annotations exist
    if (annotationResult?.count && annotationResult.count > 0) {
      lines.push(`  → View annotations: jq -r '.annotations[] | {context, style}' ${annotationsPath}`);
    }

    lines.push(`  → Get exit codes:   jq -r '.steps[] | "\\(.id): exit \\(.exit_status)"' ${manifestPath}`);

    // If we captured steps, show how to view first failed log
    if (stepResults.length > 0) {
      const firstFailedDir = getFirstFailedStepDir(scriptJobs);
      if (firstFailedDir) {
        lines.push(`  → View a log:       cat ${path.join(stepsPath, firstFailedDir, 'log.txt')}`);
      }
    }

    lines.push(`  → Search errors:    grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`);

    // Show --all tip if steps were skipped
    if (!fetchAll && scriptJobs.length > stepResults.length) {
      const skippedCount = scriptJobs.length - stepResults.length;
      lines.push(`  → Use --all to include all ${skippedCount} passing steps`);
    }
  } else {
    // Tips for passed builds
    lines.push(`  → List all steps:   jq -r '.steps[] | "\\(.id): \\(.label) (\\(.state))"' ${manifestPath}`);
    lines.push(`  → Browse logs:      ls ${stepsPath}/`);

    if (stepResults.length > 0) {
      lines.push(`  → View a log:       cat ${stepsPath}/01-*/log.txt`);
    }

    // Show --all tip if steps were skipped
    if (!fetchAll && scriptJobs.length > stepResults.length) {
      const skippedCount = scriptJobs.length - stepResults.length;
      lines.push(`  → Use --all to include all ${skippedCount} passing steps`);
    }
  }

  lines.push(`  → Use --no-tips to hide these hints`);
  lines.push(`  manifest.json has full build metadata and step index`);

  return lines;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/formatters/snapshot.test.ts`
Expected: PASS

**Step 5: Manual verification**

```bash
npm run dev -- snapshot org/pipeline/123
# Should show "Next steps:" with jq/cat/grep commands
```

**Step 6: Commit**

```bash
git add src/formatters/snapshot/PlainTextFormatter.ts test/formatters/snapshot.test.ts
git commit -m "feat: restore navigation tips in snapshot formatter"
```

---

## Verification Checklist (Updated)

After completing all tasks:

- [x] **Run all tests**: `npm test` - 269 tests passing
- [ ] **Test snapshot command**: `bin/bktide snapshot org/pipeline/123`
- [ ] **Verify ▲ symbol**: Output shows `▲ X soft failures`
- [ ] **Verify navigation tips**: Output shows `Next steps:` with `jq` commands
- [ ] **Test --no-tips**: `bin/bktide snapshot org/pipeline/123 --no-tips`
- [ ] **Test --json**: `bin/bktide snapshot org/pipeline/123 --json`
- [ ] **Test accessibility**: `NO_COLOR=1 bin/bktide snapshot org/pipeline/123`
- [ ] **Test ASCII mode**: `BKTIDE_ASCII=1 bin/bktide snapshot org/pipeline/123`

---

## Summary

| Task | Description | New Files | Status |
|------|-------------|-----------|--------|
| 1 | Extract job stats utility | `src/utils/jobStats.ts`, `test/utils/jobStats.test.ts` | ✅ |
| 2 | Add job stats summary formatter | (modify existing) | ✅ |
| 3 | Add duration helper | (modify `formatUtils.ts`) | ✅ |
| 4 | Create snapshot formatter interface | `src/formatters/snapshot/Formatter.ts` | ✅ |
| 5 | Create PlainTextFormatter | `src/formatters/snapshot/PlainTextFormatter.ts` | ✅ |
| 6 | Create JsonFormatter and index | `src/formatters/snapshot/JsonFormatter.ts`, `index.ts` | ✅ |
| 7 | Register in FormatterFactory | (modify existing) | ✅ |
| 8 | Refactor Snapshot command | (modify `Snapshot.ts`) | ✅ |
| 9 | Wire --no-tips option | (verify wiring) | ✅ |
| 10 | Update documentation | (modify docs) | ✅ |
| 11 | Fix missing ▲ symbol | (modify `jobStats.ts`) | ⬚ |
| 12 | Add path utilities | (modify `formatUtils.ts`) | ⬚ |
| 13 | Extend SnapshotData interface | (modify `Formatter.ts`) | ⬚ |
| 14 | Restore navigation tips | (modify `PlainTextFormatter.ts`) | ⬚ |
