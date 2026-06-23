# Design: `--watch` Flag for Build Monitoring

**Date:** 2026-02-10
**Bean:** gt-l5jx
**Status:** Ready for implementation

## Overview

Add `--watch` flag to `bktide build` and `bktide snapshot` commands. Polls until build reaches terminal state, showing real-time job state changes.

## CLI Interface

```
-w, --watch              Watch build until completion
--timeout <minutes>      Max wait time (default: 30)
--poll-interval <secs>   Initial polling interval (default: 5)
```

## Architecture

### New Service: `src/services/BuildPoller.ts`

A dedicated service that encapsulates build polling logic, separate from command display concerns.

```typescript
interface BuildPollerOptions {
  initialInterval?: number;      // default: 5000ms
  maxInterval?: number;          // default: 30000ms
  timeout?: number;              // default: 1800000ms (30min)
  maxConsecutiveErrors?: number; // default: 3
}

interface JobStateChange {
  job: Job;
  previousState: string | null;  // null = new job
  timestamp: Date;
}

interface BuildPollerCallbacks {
  onJobStateChange: (change: JobStateChange) => void;
  onBuildComplete: (build: Build) => void;
  onError: (error: PollError, willRetry: boolean) => void;
  onTimeout: () => void;
}

class BuildPoller {
  constructor(
    client: BuildkiteRestClient,
    callbacks: BuildPollerCallbacks,
    options?: BuildPollerOptions
  );

  watch(buildRef: BuildRef): Promise<Build>;
  stop(): void;
}
```

### Responsibilities

- Track job states internally, emit diffs as `onJobStateChange` events
- Handle SIGINT internally, call `stop()` on interrupt
- Adaptive polling: speed up when changes detected, slow down when idle
- Exponential backoff on transient errors (rate limit, network)
- Timeout enforcement with callback

Commands wire up callbacks to handle their specific output needs.

## Command Integration

### `bktide build --watch`

Wires BuildPoller callbacks to display event stream:

```typescript
if (options.watch) {
  const poller = new BuildPoller(this.restClient, {
    onJobStateChange: (change) => this.displayJobEvent(change),
    onBuildComplete: (build) => this.displayFinalSummary(build),
    onError: (err, willRetry) => {
      if (willRetry) logger.console(SEMANTIC_COLORS.warning(`Retrying...`));
    },
    onTimeout: () => logger.console(SEMANTIC_COLORS.warning(`Timeout reached`))
  });

  const build = await poller.watch(buildRef);
  return build.state === 'PASSED' ? 0 : 1;
}
```

### `bktide snapshot --watch`

Same poller, but runs normal snapshot capture on completion:

```typescript
if (options.watch) {
  const poller = new BuildPoller(this.restClient, {
    onJobStateChange: (change) => this.displayJobEvent(change),
    onBuildComplete: async () => {
      // Run normal snapshot capture when build completes
      await this.captureSnapshot(buildRef, options);
    },
    // ... other callbacks
  });

  await poller.watch(buildRef);
}
```

## Output Formats

### Plain Text (default)

```
Watching build #84 (timeout: 30m)
Press Ctrl+C to stop

12:34:05  ● lint started
12:34:12  ✓ lint passed (7s)
12:34:15  ● test-unit started
12:35:01  ✗ test-integration failed (43s)
12:35:05  ⚠ test-flaky soft-failed (12s)

⏳ running (8/12 jobs) - 4m elapsed    ← updates in place

✓ Build #84 passed (12/12 jobs) - 6m 23s
```

**Icons:**
- `●` running
- `✓` passed
- `✗` failed
- `⚠` soft-failed
- `○` skipped/canceled

### JSON (`--format json`)

NDJSON stream, one event per line for easy parsing:

```json
{"type":"watching","build":{"number":84,"url":"..."},"timeout":"30m"}
{"type":"job_changed","job":{"id":"...","name":"lint","state":"running"},"previousState":null,"timestamp":"2026-02-10T12:34:05Z"}
{"type":"job_changed","job":{"id":"...","name":"lint","state":"passed","duration":7},"previousState":"running","timestamp":"2026-02-10T12:34:12Z"}
{"type":"build_complete","build":{...},"exitCode":0}
```

## Error Handling

### Transient Errors (rate limit, network)

- Exponential backoff: 5s → 10s → 20s → 30s (capped)
- Show warning: `⚠ Network error, retrying in 10s...`
- Give up after 3 consecutive failures, exit 1

### Non-Recoverable Errors

- `not_found`: Exit immediately with "Build not found"
- `permission_denied`: Exit immediately with token scope suggestion

### Timeout

- Default 30 minutes, configurable via `--timeout`
- On timeout: `⏱ Timeout reached (30m). Build still running.`
- Exit code 1

### Ctrl+C

- Clean exit, no snapshot capture for `snapshot --watch`
- Exit code 0
- User can run `snapshot` separately if desired

## Edge Cases

### Build Already Complete

When `--watch` is used on an already-completed build:
- Display final state immediately as if it just completed
- Exit with appropriate code (0 for pass, 1 for fail)
- For `snapshot --watch`: runs snapshot capture immediately

This makes `--watch` idempotent: you always get the final state.

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/services/BuildPoller.ts` | New - polling service |
| `src/services/index.ts` | Export BuildPoller |
| `src/commands/ShowBuild.ts` | Add `--watch` option and integration |
| `src/commands/Snapshot.ts` | Add `--watch` option and integration |
| `src/index.ts` | Wire up new CLI flags |
| `test/services/BuildPoller.test.ts` | Unit tests for poller |
| `test/commands/ShowBuild.watch.test.ts` | Integration tests |

## Testing Strategy

### Unit Tests for BuildPoller

- Mock REST client responses
- Verify job state diffing logic
- Test adaptive interval behavior
- Test error retry/backoff logic
- Test timeout enforcement
- Test SIGINT handling

### Integration Tests

- End-to-end with MSW mocking API
- Verify output format (plain and JSON)
- Test already-complete build case
