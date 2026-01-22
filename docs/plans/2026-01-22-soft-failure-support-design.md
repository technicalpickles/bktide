# Soft Failure Support Design

**Date:** 2026-01-22
**Status:** Approved

## Problem Statement

When a Buildkite build passes but contains jobs with non-zero exit codes (soft failures), the CLI display is confusing. The build shows `✓ PASSED` but also reports "3 failed" steps, creating ambiguity about the actual build state.

**Example of current confusing output:**
```
✓ PASSED ... #1404486
✓ 467 steps: 3 failed, 401 passed
```

This happens because Buildkite supports soft failures - jobs configured to not fail the build even when they exit non-zero. Our CLI counts these as "failed" based on exit status, but doesn't distinguish them from hard failures.

## Solution

Explicitly detect and display soft failures using visual distinction (yellow ▲ triangle symbol) and clear terminology ("soft failures"), making it immediately obvious these are non-blocking failures.

## Design Decisions

### Terminology
- Use "soft failures" (not "allowed failures", "warnings", or "non-blocking failures")
- Matches Buildkite's API terminology

### Visual Design
- Symbol: ▲ (triangle, U+25B2) - matches style of existing Unicode symbols
- Color: Yellow (warning semantic color)
- ASCII fallback: `^` when `--ascii` flag is used

### Detection Strategy
- Use `softFailed` field from Buildkite GraphQL API
- Source of truth: Buildkite's classification (not inferred from build state)

### Display Locations
- **Summary line:** Always show count when soft failures exist
- **Auto-display list:** Automatically show soft failed jobs on all builds (like we show failed jobs on FAILED builds)
- **Detailed view (--jobs):** Separate section for soft failures

## Data Layer Changes

### GraphQL API

Add `softFailed` field to job fragments in `src/graphql/fragments/jobs.ts`:

**JOB_SUMMARY_FIELDS fragment:**
```graphql
fragment JobSummaryFields on JobInterface {
  ... on JobTypeCommand {
    id
    uuid
    label
    state
    exitStatus
    startedAt
    finishedAt
    passed
    softFailed  # ← ADD THIS
    parallelGroupIndex
    parallelGroupTotal
  }
  # ... other job types
}
```

**JOB_DETAIL_FIELDS fragment:**
```graphql
fragment JobDetailFields on JobInterface {
  ... on JobTypeCommand {
    id
    uuid
    label
    command
    state
    exitStatus
    startedAt
    finishedAt
    passed
    softFailed  # ← ADD THIS
    retried
    # ... rest of fields
  }
  # ... other job types
}
```

After updating fragments, regenerate GraphQL types with codegen.

### REST API

The `snapshot` command will be migrated to use GraphQL for build metadata (consistency with `build` command), but will continue using REST API for logs (no GraphQL alternative exists).

## Classification Logic

### Job Classification

```typescript
private classifyJob(job: any): 'passed' | 'hard_failed' | 'soft_failed' | 'running' | 'blocked' | 'skipped' {
  const state = job.node.state?.toUpperCase();

  // Handle non-failure states first
  if (state === 'RUNNING') return 'running';
  if (state === 'BLOCKED') return 'blocked';
  if (state === 'SKIPPED' || state === 'BROKEN' || state === 'CANCELED') return 'skipped';

  // For completed jobs, check exit status and softFailed
  if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
    const exitCode = parseInt(job.node.exitStatus, 10);

    if (exitCode === 0) return 'passed';

    // Non-zero exit: check if soft failure
    if (job.node.softFailed === true) return 'soft_failed';

    return 'hard_failed';
  }

  // Fall back to state-based detection
  if (state === 'PASSED' || job.node.passed === true) return 'passed';
  if (state === 'FAILED' || job.node.passed === false) return 'hard_failed';

  return 'passed'; // default
}
```

### Statistics

Update `getJobStats()` to track soft failures separately:

```typescript
const stats = {
  total: jobs?.length || 0,
  passed: 0,
  hardFailed: 0,    // renamed from 'failed'
  softFailed: 0,    // new
  running: 0,
  blocked: 0,
  skipped: 0
};
```

## Visual Presentation

### Theme Updates

Add to `src/ui/theme.ts`:

```typescript
export function getStateIcon(state: string): string {
  const upperState = state.toUpperCase();
  switch (upperState) {
    case 'PASSED': return useAscii() ? 'OK' : '✓';
    case 'FAILED': return useAscii() ? 'X' : '✗';
    case 'SOFT_FAILED': return useAscii() ? '^' : '▲';  // ← ADD THIS
    case 'RUNNING': return useAscii() ? '~' : '⟳';
    case 'BLOCKED': return useAscii() ? '#' : '◼';
    // ... rest
  }
}
```

### Summary Line Format

**PASSED build with soft failures:**
```
✓ PASSED Merge branch 'main' into feature #1404486 30m 26s
         Author • branch • commit • Created 2 days ago

✓ 467 steps: 401 passed, ▲ 3 soft failures

   ▲ bin/pact-can-i-merge - ran 30s
   ▲ bin/experimental-check - ran 1m 15s
   ▲ bin/optional-lint - ran 22s
```

**FAILED build with both hard and soft failures:**
```
✗ FAILED Merge branch 'main' into feature #1404486 30m 26s
         Author • branch • commit • Created 2 days ago

✗ 467 steps: 2 failed, ▲ 3 soft failures, 401 passed

   ✗ bin/test-suite - ran 5m 32s
   ✗ bin/integration-tests - ran 12m 8s

   ▲ bin/pact-can-i-merge - ran 30s
   ▲ bin/experimental-check - ran 1m 15s
   ▲ bin/optional-lint - ran 22s
```

### Detailed Job View (--jobs flag)

**Section ordering by severity:**
1. Hard Failed
2. Soft Failed
3. Passed
4. Running
5. Blocked

```
Steps: ✗ 2 failed  ▲ 3 soft failed  ✓ 401 passed

✗ Failed (2):
  bin/test-suite (5m 32s)
  bin/integration-tests (12m 8s)

▲ Soft Failed (3):
  bin/pact-can-i-merge (30s)
  bin/experimental-check (1m 15s)
  bin/optional-lint (22s)

✓ Passed (401):
  ...
```

### --failed Flag Behavior

Shows both hard and soft failures (all non-passing jobs):

```typescript
if (options?.failed) {
  filteredJobs = jobs.filter(job => {
    const classification = this.classifyJob(job);
    return classification === 'hard_failed' || classification === 'soft_failed';
  });
}
```

## JSON Output Format

### Job-level fields

Add `softFailed` to each job in JSON output:

```json
{
  "id": "...",
  "label": ":pact: bin/pact-can-i-merge",
  "state": "FINISHED",
  "exitStatus": "1",
  "passed": false,
  "softFailed": true
}
```

### Summary statistics

Include separate counts in build summary:

```json
{
  "build": {
    "state": "PASSED",
    "number": 1404486,
    "jobs": [...],
    "jobStats": {
      "total": 467,
      "passed": 401,
      "failed": 0,
      "softFailed": 3,
      "running": 0,
      "blocked": 0
    }
  }
}
```

## Snapshot Command Changes

### Migration to GraphQL

The `snapshot` command currently uses REST API for all data. Migrate build metadata to GraphQL while keeping REST for logs.

**Changes to `src/commands/Snapshot.ts`:**

```typescript
import { BuildkiteGraphQLClient } from '../services/BuildkiteGraphQLClient.js';

export class Snapshot extends BaseCommand {
  private restClient!: BuildkiteRestClient;  // For logs only
  private graphqlClient!: BuildkiteGraphQLClient;  // For build metadata

  async execute(options: SnapshotOptions): Promise<number> {
    await this.ensureInitialized();

    // Fetch build metadata via GraphQL (gets softFailed field)
    const buildData = await this.graphqlClient.getBuildSummaryWithAllJobs(buildSlug);

    // Fetch logs via REST API
    for (const job of jobs) {
      const log = await this.restClient.getJobLog(org, pipeline, buildNumber, jobId);
      // ... save log
    }
  }
}
```

### Display updates

Update `displayBuildSummary()` to use same logic as `build` command for consistency.

## Implementation Files

### GraphQL Layer
- `src/graphql/fragments/jobs.ts` - Add `softFailed` to both fragments
- Run codegen to regenerate types

### Formatters
- `src/formatters/build-detail/PlainTextFormatter.ts` - Main display logic changes
- `src/formatters/build-detail/JsonFormatter.ts` - Add softFailed to JSON output
- `src/formatters/build-detail/AlfredFormatter.ts` - Update for Alfred format

### UI/Theme
- `src/ui/theme.ts` - Add SOFT_FAILED icon and color handling

### Commands
- `src/commands/Snapshot.ts` - Migrate to GraphQL for build metadata, update display logic

### Types
- Update TypeScript interfaces for job stats to include `softFailed` count

## Edge Cases

1. **Null/undefined softFailed field** - Treat as false (hard failure) for backwards compatibility
2. **Mixed failure states** - Build with both hard and soft failures shows both sections
3. **No failures** - Don't show soft failure sections when count is 0
4. **ASCII mode** - Use `^` for soft failure triangle when `--ascii` flag is used
5. **Parallel jobs** - Soft failures collapse/group like other parallel jobs

## Testing Strategy

### Unit Tests

```typescript
// test/formatters/build-detail-display.test.ts
describe('soft failure handling', () => {
  it('should classify job with exitStatus=1 and softFailed=true as soft failure', () => {
    const job = {
      node: {
        state: 'FINISHED',
        exitStatus: '1',
        passed: false,
        softFailed: true
      }
    };
    expect(classifyJob(job)).toBe('soft_failed');
  });

  it('should classify job with exitStatus=1 and softFailed=false as hard failure', () => {
    const job = {
      node: {
        state: 'FINISHED',
        exitStatus: '1',
        passed: false,
        softFailed: false
      }
    };
    expect(classifyJob(job)).toBe('hard_failed');
  });

  it('should count soft failures separately in stats', () => {
    const jobs = [
      { node: { exitStatus: '0', passed: true, softFailed: false } },
      { node: { exitStatus: '1', passed: false, softFailed: true } },
      { node: { exitStatus: '1', passed: false, softFailed: false } }
    ];
    const stats = getJobStats(jobs);
    expect(stats.passed).toBe(1);
    expect(stats.softFailed).toBe(1);
    expect(stats.hardFailed).toBe(1);
  });
});
```

### Integration Tests

Use `PatternMockGenerator` to create test builds with soft failures:

```typescript
// test/commands/ShowBuild.test.ts
it('should display soft failures on PASSED build', async () => {
  const build = mockGenerator.generateBuild({
    state: 'PASSED',
    jobs: [
      { state: 'FINISHED', exitStatus: '0', softFailed: false },  // passed
      { state: 'FINISHED', exitStatus: '1', softFailed: true }     // soft failed
    ]
  });

  const output = await executeCommand(['build', 'org/pipeline/123']);
  expect(output).toContain('▲ 1 soft failure');
});
```

### Manual Validation

Test against real Buildkite builds (like gusto/zenpayroll/1404486) to verify:
1. `softFailed` field is populated correctly
2. Visual display matches design
3. JSON output includes correct fields

## Performance Considerations

- No additional API calls needed (just adding field to existing queries)
- Statistics calculation adds minimal overhead (one extra counter)
- Display logic slightly more complex but negligible impact

## Benefits

1. **Clarity** - Users immediately understand build state without confusion
2. **Consistency** - Soft failures display identically in `build` and `snapshot` commands
3. **Actionability** - Users can see which failures are configured as non-blocking
4. **Parseable** - JSON output includes structured soft failure data for scripts
5. **Backwards compatible** - Treats missing `softFailed` field as hard failure
