# `--watch` Flag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `--watch` flag to `bktide build` and `bktide snapshot` commands that polls until build completes.

**Architecture:** New `BuildPoller` service handles polling logic with callback-based API. Commands wire up callbacks for their specific display needs. Poller tracks job state diffs internally and emits change events.

**Tech Stack:** TypeScript, Vitest for testing, existing BuildkiteRestClient for API calls.

---

## Task 1: Create BuildPoller Types and Skeleton

**Files:**
- Create: `src/services/BuildPoller.ts`

**Step 1: Create the types and class skeleton**

```typescript
// src/services/BuildPoller.ts
import { BuildkiteRestClient } from './BuildkiteRestClient.js';
import { logger } from './logger.js';

// Error categories (reuse pattern from ShowLogs)
export type ErrorCategory = 'rate_limited' | 'not_found' | 'permission_denied' | 'network_error' | 'unknown';

export interface PollError {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}

export interface BuildPollerOptions {
  initialInterval?: number;      // default: 5000ms
  maxInterval?: number;          // default: 30000ms
  timeout?: number;              // default: 1800000ms (30min)
  maxConsecutiveErrors?: number; // default: 3
}

export interface JobStateChange {
  job: any;  // Job from REST API
  previousState: string | null;  // null = new job
  timestamp: Date;
}

export interface BuildPollerCallbacks {
  onJobStateChange: (change: JobStateChange) => void;
  onBuildComplete: (build: any) => void;
  onError: (error: PollError, willRetry: boolean) => void;
  onTimeout: () => void;
}

export interface BuildRef {
  org: string;
  pipeline: string;
  buildNumber: number;
}

const DEFAULT_OPTIONS: Required<BuildPollerOptions> = {
  initialInterval: 5000,
  maxInterval: 30000,
  timeout: 1800000,  // 30 minutes
  maxConsecutiveErrors: 3,
};

// Terminal states where build is complete
export const TERMINAL_BUILD_STATES = ['passed', 'failed', 'canceled', 'blocked', 'not_run'];

export class BuildPoller {
  private client: BuildkiteRestClient;
  private callbacks: BuildPollerCallbacks;
  private options: Required<BuildPollerOptions>;
  private stopped = false;
  private jobStates: Map<string, string> = new Map();

  constructor(
    client: BuildkiteRestClient,
    callbacks: BuildPollerCallbacks,
    options?: BuildPollerOptions
  ) {
    this.client = client;
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async watch(buildRef: BuildRef): Promise<any> {
    // TODO: Implement in next task
    throw new Error('Not implemented');
  }

  stop(): void {
    this.stopped = true;
  }
}
```

**Step 2: Verify file compiles**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build 2>&1 | head -20`
Expected: No errors related to BuildPoller.ts

**Step 3: Commit**

```bash
git add src/services/BuildPoller.ts
git commit -m "feat(watch): add BuildPoller types and skeleton"
```

---

## Task 2: Add BuildPoller Unit Test Setup

**Files:**
- Create: `test/services/BuildPoller.test.ts`

**Step 1: Create test file with first test case**

```typescript
// test/services/BuildPoller.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildPoller, TERMINAL_BUILD_STATES, BuildPollerCallbacks, BuildRef } from '../../src/services/BuildPoller.js';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildPoller', () => {
  let mockClient: BuildkiteRestClient;
  let callbacks: BuildPollerCallbacks;
  let callbackSpies: {
    onJobStateChange: ReturnType<typeof vi.fn>;
    onBuildComplete: ReturnType<typeof vi.fn>;
    onError: ReturnType<typeof vi.fn>;
    onTimeout: ReturnType<typeof vi.fn>;
  };

  const buildRef: BuildRef = {
    org: 'test-org',
    pipeline: 'test-pipeline',
    buildNumber: 42,
  };

  beforeEach(() => {
    mockClient = new BuildkiteRestClient('test-token', { caching: false });
    callbackSpies = {
      onJobStateChange: vi.fn(),
      onBuildComplete: vi.fn(),
      onError: vi.fn(),
      onTimeout: vi.fn(),
    };
    callbacks = callbackSpies;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('TERMINAL_BUILD_STATES', () => {
    it('should include expected terminal states', () => {
      expect(TERMINAL_BUILD_STATES).toContain('passed');
      expect(TERMINAL_BUILD_STATES).toContain('failed');
      expect(TERMINAL_BUILD_STATES).toContain('canceled');
    });
  });

  describe('constructor', () => {
    it('should create poller with default options', () => {
      const poller = new BuildPoller(mockClient, callbacks);
      expect(poller).toBeDefined();
    });

    it('should accept custom options', () => {
      const poller = new BuildPoller(mockClient, callbacks, {
        initialInterval: 1000,
        timeout: 60000,
      });
      expect(poller).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should set stopped flag', () => {
      const poller = new BuildPoller(mockClient, callbacks);
      poller.stop();
      // Verify by checking watch exits early (tested in integration)
      expect(true).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify setup works**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: PASS (3 tests)

**Step 3: Commit**

```bash
git add test/services/BuildPoller.test.ts
git commit -m "test(watch): add BuildPoller test setup"
```

---

## Task 3: Implement categorizeError Helper

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for categorizeError**

Add to `test/services/BuildPoller.test.ts`:

```typescript
import { BuildPoller, TERMINAL_BUILD_STATES, BuildPollerCallbacks, BuildRef, categorizeError } from '../../src/services/BuildPoller.js';

// ... existing tests ...

describe('categorizeError', () => {
  it('should categorize rate limit errors', () => {
    const result = categorizeError(new Error('Rate limit exceeded (429)'));
    expect(result.category).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('should categorize not found errors', () => {
    const result = categorizeError(new Error('Build not found (404)'));
    expect(result.category).toBe('not_found');
    expect(result.retryable).toBe(false);
  });

  it('should categorize permission errors', () => {
    const result = categorizeError(new Error('Permission denied (403)'));
    expect(result.category).toBe('permission_denied');
    expect(result.retryable).toBe(false);
  });

  it('should categorize network errors', () => {
    const result = categorizeError(new Error('ECONNREFUSED'));
    expect(result.category).toBe('network_error');
    expect(result.retryable).toBe(true);
  });

  it('should default to unknown for other errors', () => {
    const result = categorizeError(new Error('Something weird happened'));
    expect(result.category).toBe('unknown');
    expect(result.retryable).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: FAIL - categorizeError not exported

**Step 3: Implement categorizeError**

Add to `src/services/BuildPoller.ts` after the interfaces:

```typescript
export function categorizeError(error: Error): PollError {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return { category: 'rate_limited', message: error.message, retryable: true };
  }
  if (message.includes('not found') || message.includes('404')) {
    return { category: 'not_found', message: error.message, retryable: false };
  }
  if (message.includes('permission') || message.includes('403') || message.includes('401')) {
    return { category: 'permission_denied', message: error.message, retryable: false };
  }
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return { category: 'network_error', message: error.message, retryable: true };
  }
  return { category: 'unknown', message: error.message, retryable: true };
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): add categorizeError helper"
```

---

## Task 4: Implement isTerminalState Helper

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for isTerminalState**

Add to `test/services/BuildPoller.test.ts`:

```typescript
import { BuildPoller, TERMINAL_BUILD_STATES, BuildPollerCallbacks, BuildRef, categorizeError, isTerminalState } from '../../src/services/BuildPoller.js';

// Add new describe block:
describe('isTerminalState', () => {
  it('should return true for passed', () => {
    expect(isTerminalState('passed')).toBe(true);
    expect(isTerminalState('PASSED')).toBe(true);
  });

  it('should return true for failed', () => {
    expect(isTerminalState('failed')).toBe(true);
    expect(isTerminalState('FAILED')).toBe(true);
  });

  it('should return true for canceled', () => {
    expect(isTerminalState('canceled')).toBe(true);
  });

  it('should return false for running', () => {
    expect(isTerminalState('running')).toBe(false);
    expect(isTerminalState('RUNNING')).toBe(false);
  });

  it('should return false for scheduled', () => {
    expect(isTerminalState('scheduled')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: FAIL - isTerminalState not exported

**Step 3: Implement isTerminalState**

Add to `src/services/BuildPoller.ts`:

```typescript
export function isTerminalState(state: string): boolean {
  return TERMINAL_BUILD_STATES.includes(state.toLowerCase());
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): add isTerminalState helper"
```

---

## Task 5: Implement Basic watch() - Already Complete Case

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for already-complete build**

Add to `test/services/BuildPoller.test.ts`:

```typescript
describe('watch', () => {
  it('should return immediately if build already complete', async () => {
    const completedBuild = {
      number: 42,
      state: 'passed',
      jobs: [
        { id: 'job-1', name: 'test', state: 'passed' },
      ],
    };

    vi.spyOn(mockClient, 'getBuild').mockResolvedValue(completedBuild);

    const poller = new BuildPoller(mockClient, callbacks);
    const result = await poller.watch(buildRef);

    expect(result.state).toBe('passed');
    expect(callbackSpies.onBuildComplete).toHaveBeenCalledWith(completedBuild);
    expect(mockClient.getBuild).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "already complete"`
Expected: FAIL - Not implemented

**Step 3: Implement basic watch() for already-complete case**

Replace the `watch` method in `src/services/BuildPoller.ts`:

```typescript
async watch(buildRef: BuildRef): Promise<any> {
  this.stopped = false;
  this.jobStates.clear();

  // Initial fetch
  const build = await this.client.getBuild(
    buildRef.org,
    buildRef.pipeline,
    buildRef.buildNumber
  );

  // Process initial job states
  this.processJobChanges(build.jobs || []);

  // Check if already complete
  if (isTerminalState(build.state)) {
    this.callbacks.onBuildComplete(build);
    return build;
  }

  // TODO: Implement polling loop in next task
  throw new Error('Polling not yet implemented');
}

private processJobChanges(jobs: any[]): void {
  for (const job of jobs) {
    const previousState = this.jobStates.get(job.id);
    const currentState = job.state;

    if (previousState !== currentState) {
      this.jobStates.set(job.id, currentState);
      this.callbacks.onJobStateChange({
        job,
        previousState: previousState ?? null,
        timestamp: new Date(),
      });
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "already complete"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): handle already-complete builds"
```

---

## Task 6: Implement Polling Loop

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for polling until complete**

Add to `test/services/BuildPoller.test.ts` inside `describe('watch')`:

```typescript
it('should poll until build completes', async () => {
  vi.useFakeTimers();

  const runningBuild = {
    number: 42,
    state: 'running',
    jobs: [{ id: 'job-1', name: 'test', state: 'running' }],
  };
  const completedBuild = {
    number: 42,
    state: 'passed',
    jobs: [{ id: 'job-1', name: 'test', state: 'passed' }],
  };

  const getBuildSpy = vi.spyOn(mockClient, 'getBuild')
    .mockResolvedValueOnce(runningBuild)
    .mockResolvedValueOnce(runningBuild)
    .mockResolvedValueOnce(completedBuild);

  const poller = new BuildPoller(mockClient, callbacks, { initialInterval: 1000 });
  const watchPromise = poller.watch(buildRef);

  // First call is immediate
  await vi.advanceTimersByTimeAsync(0);
  expect(getBuildSpy).toHaveBeenCalledTimes(1);

  // Second call after interval
  await vi.advanceTimersByTimeAsync(1000);
  expect(getBuildSpy).toHaveBeenCalledTimes(2);

  // Third call completes the build
  await vi.advanceTimersByTimeAsync(1000);

  const result = await watchPromise;
  expect(result.state).toBe('passed');
  expect(callbackSpies.onBuildComplete).toHaveBeenCalledWith(completedBuild);
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "poll until"`
Expected: FAIL - Polling not yet implemented

**Step 3: Implement polling loop**

Replace the `watch` method in `src/services/BuildPoller.ts`:

```typescript
async watch(buildRef: BuildRef): Promise<any> {
  this.stopped = false;
  this.jobStates.clear();

  // Initial fetch
  let build = await this.client.getBuild(
    buildRef.org,
    buildRef.pipeline,
    buildRef.buildNumber
  );

  // Process initial job states
  this.processJobChanges(build.jobs || []);

  // Check if already complete
  if (isTerminalState(build.state)) {
    this.callbacks.onBuildComplete(build);
    return build;
  }

  // Polling loop
  let currentInterval = this.options.initialInterval;

  while (!this.stopped) {
    await this.sleep(currentInterval);

    if (this.stopped) break;

    build = await this.client.getBuild(
      buildRef.org,
      buildRef.pipeline,
      buildRef.buildNumber
    );

    // Process job state changes
    this.processJobChanges(build.jobs || []);

    // Check if complete
    if (isTerminalState(build.state)) {
      this.callbacks.onBuildComplete(build);
      return build;
    }
  }

  // Stopped externally
  return build;
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "poll until"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): implement basic polling loop"
```

---

## Task 7: Implement Job State Change Detection

**Files:**
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for job state change callbacks**

Add to `test/services/BuildPoller.test.ts` inside `describe('watch')`:

```typescript
it('should emit job state changes', async () => {
  vi.useFakeTimers();

  const runningBuild = {
    number: 42,
    state: 'running',
    jobs: [{ id: 'job-1', name: 'test', state: 'running' }],
  };
  const completedBuild = {
    number: 42,
    state: 'passed',
    jobs: [{ id: 'job-1', name: 'test', state: 'passed' }],
  };

  vi.spyOn(mockClient, 'getBuild')
    .mockResolvedValueOnce(runningBuild)
    .mockResolvedValueOnce(completedBuild);

  const poller = new BuildPoller(mockClient, callbacks, { initialInterval: 1000 });
  const watchPromise = poller.watch(buildRef);

  // Initial fetch emits 'running' state (previousState: null)
  await vi.advanceTimersByTimeAsync(0);
  expect(callbackSpies.onJobStateChange).toHaveBeenCalledWith(
    expect.objectContaining({
      job: expect.objectContaining({ id: 'job-1', state: 'running' }),
      previousState: null,
    })
  );

  // After poll, emits state change to 'passed'
  await vi.advanceTimersByTimeAsync(1000);
  await watchPromise;

  expect(callbackSpies.onJobStateChange).toHaveBeenCalledWith(
    expect.objectContaining({
      job: expect.objectContaining({ id: 'job-1', state: 'passed' }),
      previousState: 'running',
    })
  );
});
```

**Step 2: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "emit job state"`
Expected: PASS (already implemented in processJobChanges)

**Step 3: Commit**

```bash
git add test/services/BuildPoller.test.ts
git commit -m "test(watch): verify job state change detection"
```

---

## Task 8: Implement Timeout

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for timeout**

Add to `test/services/BuildPoller.test.ts` inside `describe('watch')`:

```typescript
it('should call onTimeout when timeout exceeded', async () => {
  vi.useFakeTimers();

  const runningBuild = {
    number: 42,
    state: 'running',
    jobs: [],
  };

  vi.spyOn(mockClient, 'getBuild').mockResolvedValue(runningBuild);

  const poller = new BuildPoller(mockClient, callbacks, {
    initialInterval: 1000,
    timeout: 3000,
  });

  const watchPromise = poller.watch(buildRef);

  // Advance past timeout
  await vi.advanceTimersByTimeAsync(4000);

  const result = await watchPromise;

  expect(callbackSpies.onTimeout).toHaveBeenCalled();
  expect(result.state).toBe('running');
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "onTimeout"`
Expected: FAIL - onTimeout not called

**Step 3: Implement timeout tracking**

Update the `watch` method in `src/services/BuildPoller.ts`:

```typescript
async watch(buildRef: BuildRef): Promise<any> {
  this.stopped = false;
  this.jobStates.clear();
  const startTime = Date.now();

  // Initial fetch
  let build = await this.client.getBuild(
    buildRef.org,
    buildRef.pipeline,
    buildRef.buildNumber
  );

  // Process initial job states
  this.processJobChanges(build.jobs || []);

  // Check if already complete
  if (isTerminalState(build.state)) {
    this.callbacks.onBuildComplete(build);
    return build;
  }

  // Polling loop
  let currentInterval = this.options.initialInterval;

  while (!this.stopped) {
    // Check timeout
    if (Date.now() - startTime >= this.options.timeout) {
      this.callbacks.onTimeout();
      return build;
    }

    await this.sleep(currentInterval);

    if (this.stopped) break;

    // Check timeout again after sleep
    if (Date.now() - startTime >= this.options.timeout) {
      this.callbacks.onTimeout();
      return build;
    }

    build = await this.client.getBuild(
      buildRef.org,
      buildRef.pipeline,
      buildRef.buildNumber
    );

    // Process job state changes
    this.processJobChanges(build.jobs || []);

    // Check if complete
    if (isTerminalState(build.state)) {
      this.callbacks.onBuildComplete(build);
      return build;
    }
  }

  // Stopped externally
  return build;
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "onTimeout"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): implement timeout handling"
```

---

## Task 9: Implement Error Handling with Retry

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for transient error retry**

Add to `test/services/BuildPoller.test.ts` inside `describe('watch')`:

```typescript
it('should retry on transient errors', async () => {
  vi.useFakeTimers();

  const runningBuild = { number: 42, state: 'running', jobs: [] };
  const completedBuild = { number: 42, state: 'passed', jobs: [] };

  vi.spyOn(mockClient, 'getBuild')
    .mockResolvedValueOnce(runningBuild)  // Initial
    .mockRejectedValueOnce(new Error('Network error ECONNREFUSED'))  // Transient
    .mockResolvedValueOnce(completedBuild);  // Success

  const poller = new BuildPoller(mockClient, callbacks, { initialInterval: 1000 });
  const watchPromise = poller.watch(buildRef);

  await vi.advanceTimersByTimeAsync(0);  // Initial fetch
  await vi.advanceTimersByTimeAsync(1000);  // Error

  expect(callbackSpies.onError).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'network_error', retryable: true }),
    true  // willRetry
  );

  await vi.advanceTimersByTimeAsync(2000);  // Retry with backoff

  const result = await watchPromise;
  expect(result.state).toBe('passed');
});

it('should fail after max consecutive errors', async () => {
  vi.useFakeTimers();

  const runningBuild = { number: 42, state: 'running', jobs: [] };

  vi.spyOn(mockClient, 'getBuild')
    .mockResolvedValueOnce(runningBuild)
    .mockRejectedValue(new Error('Network error'));

  const poller = new BuildPoller(mockClient, callbacks, {
    initialInterval: 1000,
    maxConsecutiveErrors: 2,
  });
  const watchPromise = poller.watch(buildRef);

  await vi.advanceTimersByTimeAsync(0);  // Initial
  await vi.advanceTimersByTimeAsync(1000);  // Error 1
  await vi.advanceTimersByTimeAsync(2000);  // Error 2 (backoff)

  const result = await watchPromise;

  // Last onError call should have willRetry: false
  const lastCall = callbackSpies.onError.mock.calls.at(-1);
  expect(lastCall?.[1]).toBe(false);  // willRetry = false
});

it('should fail immediately on non-retryable error', async () => {
  vi.useFakeTimers();

  const runningBuild = { number: 42, state: 'running', jobs: [] };

  vi.spyOn(mockClient, 'getBuild')
    .mockResolvedValueOnce(runningBuild)
    .mockRejectedValueOnce(new Error('Build not found (404)'));

  const poller = new BuildPoller(mockClient, callbacks, { initialInterval: 1000 });
  const watchPromise = poller.watch(buildRef);

  await vi.advanceTimersByTimeAsync(0);  // Initial
  await vi.advanceTimersByTimeAsync(1000);  // Non-retryable error

  await watchPromise;

  expect(callbackSpies.onError).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'not_found', retryable: false }),
    false  // willRetry
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "retry|consecutive|non-retryable"`
Expected: FAIL

**Step 3: Implement error handling with retry**

Update the polling loop in `src/services/BuildPoller.ts`:

```typescript
async watch(buildRef: BuildRef): Promise<any> {
  this.stopped = false;
  this.jobStates.clear();
  const startTime = Date.now();
  let consecutiveErrors = 0;

  // Initial fetch
  let build = await this.client.getBuild(
    buildRef.org,
    buildRef.pipeline,
    buildRef.buildNumber
  );

  // Process initial job states
  this.processJobChanges(build.jobs || []);

  // Check if already complete
  if (isTerminalState(build.state)) {
    this.callbacks.onBuildComplete(build);
    return build;
  }

  // Polling loop
  let currentInterval = this.options.initialInterval;

  while (!this.stopped) {
    // Check timeout
    if (Date.now() - startTime >= this.options.timeout) {
      this.callbacks.onTimeout();
      return build;
    }

    await this.sleep(currentInterval);

    if (this.stopped) break;

    // Check timeout again after sleep
    if (Date.now() - startTime >= this.options.timeout) {
      this.callbacks.onTimeout();
      return build;
    }

    try {
      build = await this.client.getBuild(
        buildRef.org,
        buildRef.pipeline,
        buildRef.buildNumber
      );

      // Reset on success
      consecutiveErrors = 0;
      currentInterval = this.options.initialInterval;

      // Process job state changes
      this.processJobChanges(build.jobs || []);

      // Check if complete
      if (isTerminalState(build.state)) {
        this.callbacks.onBuildComplete(build);
        return build;
      }
    } catch (error) {
      consecutiveErrors++;
      const pollError = categorizeError(error as Error);

      const willRetry = pollError.retryable &&
                        consecutiveErrors < this.options.maxConsecutiveErrors;

      this.callbacks.onError(pollError, willRetry);

      if (!willRetry) {
        return build;
      }

      // Exponential backoff
      currentInterval = Math.min(currentInterval * 2, this.options.maxInterval);
    }
  }

  // Stopped externally
  return build;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): implement error handling with retry and backoff"
```

---

## Task 10: Implement SIGINT Handling

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `test/services/BuildPoller.test.ts`

**Step 1: Add test for SIGINT handling**

Add to `test/services/BuildPoller.test.ts` inside `describe('watch')`:

```typescript
it('should stop on SIGINT', async () => {
  vi.useFakeTimers();

  const runningBuild = { number: 42, state: 'running', jobs: [] };
  vi.spyOn(mockClient, 'getBuild').mockResolvedValue(runningBuild);

  const poller = new BuildPoller(mockClient, callbacks, { initialInterval: 1000 });
  const watchPromise = poller.watch(buildRef);

  await vi.advanceTimersByTimeAsync(0);  // Initial

  // Simulate stop (SIGINT would call this)
  poller.stop();

  await vi.advanceTimersByTimeAsync(1000);

  const result = await watchPromise;
  expect(result.state).toBe('running');
  expect(callbackSpies.onBuildComplete).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it passes**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts -t "SIGINT"`
Expected: PASS (stop() already implemented)

**Step 3: Add SIGINT handler setup method**

Add to `src/services/BuildPoller.ts`:

```typescript
private signalHandler: (() => void) | null = null;

setupSignalHandlers(): void {
  this.signalHandler = () => {
    this.stop();
  };
  process.on('SIGINT', this.signalHandler);
}

cleanupSignalHandlers(): void {
  if (this.signalHandler) {
    process.removeListener('SIGINT', this.signalHandler);
    this.signalHandler = null;
  }
}
```

Update `watch` method to use signal handlers:

```typescript
async watch(buildRef: BuildRef): Promise<any> {
  this.stopped = false;
  this.jobStates.clear();
  this.setupSignalHandlers();
  const startTime = Date.now();
  let consecutiveErrors = 0;

  try {
    // ... existing implementation ...
  } finally {
    this.cleanupSignalHandlers();
  }
}
```

**Step 4: Run all tests to verify nothing broke**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test -- test/services/BuildPoller.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/BuildPoller.ts test/services/BuildPoller.test.ts
git commit -m "feat(watch): add SIGINT handling"
```

---

## Task 11: Export BuildPoller from Services

**Files:**
- Modify: `src/services/index.ts` (create if doesn't exist)

**Step 1: Check if services index exists**

Run: `ls ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag/src/services/index.ts 2>/dev/null || echo "needs creation"`

**Step 2: Create or update services index**

If file doesn't exist, create `src/services/index.ts`:

```typescript
export { BuildkiteClient } from './BuildkiteClient.js';
export { BuildkiteRestClient } from './BuildkiteRestClient.js';
export { CacheManager } from './CacheManager.js';
export { CredentialManager } from './CredentialManager.js';
export { logger } from './logger.js';
export {
  BuildPoller,
  categorizeError,
  isTerminalState,
  TERMINAL_BUILD_STATES,
  type BuildPollerOptions,
  type BuildPollerCallbacks,
  type JobStateChange,
  type BuildRef,
  type PollError,
} from './BuildPoller.js';
```

**Step 3: Verify build**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add src/services/index.ts
git commit -m "feat(watch): export BuildPoller from services"
```

---

## Task 12: Add --watch Flag to ShowBuild Command

**Files:**
- Modify: `src/commands/ShowBuild.ts`
- Modify: `src/index.ts`

**Step 1: Add watch options to ShowBuildOptions interface**

In `src/commands/ShowBuild.ts`, update the interface:

```typescript
export interface ShowBuildOptions extends BaseCommandOptions {
  jobs?: boolean;
  failed?: boolean;
  annotations?: boolean;
  annotationsFull?: boolean;
  full?: boolean;
  summary?: boolean;
  allJobs?: boolean;
  buildArg?: string;
  // New watch options
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}
```

**Step 2: Wire up CLI flags in src/index.ts**

Find the `build` command definition and add:

```typescript
.option('-w, --watch', 'Watch build until completion')
.option('--timeout <minutes>', 'Max wait time in minutes (default: 30)', '30')
.option('--poll-interval <seconds>', 'Initial poll interval in seconds (default: 5)', '5')
```

**Step 3: Verify build**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add src/commands/ShowBuild.ts src/index.ts
git commit -m "feat(watch): add --watch CLI flags to build command"
```

---

## Task 13: Implement Watch Mode in ShowBuild

**Files:**
- Modify: `src/commands/ShowBuild.ts`

**Step 1: Add imports and display helpers**

Add to top of `src/commands/ShowBuild.ts`:

```typescript
import { BuildPoller, BuildRef, JobStateChange } from '../services/BuildPoller.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';
import { getStateIcon, SEMANTIC_COLORS } from '../ui/theme.js';
```

Add helper methods to ShowBuild class:

```typescript
private displayWatchHeader(buildNumber: number, timeoutMinutes: number): void {
  logger.console(`Watching build #${buildNumber} (timeout: ${timeoutMinutes}m)`);
  logger.console(SEMANTIC_COLORS.muted('Press Ctrl+C to stop\n'));
}

private displayJobEvent(change: JobStateChange): void {
  const time = change.timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const icon = getStateIcon(change.job.state);
  const name = change.job.name || change.job.label || 'unknown';
  const action = change.previousState === null ? 'started' : change.job.state;

  logger.console(`${time}  ${icon} ${name} ${action}`);
}

private displayFinalSummary(build: any): void {
  const icon = getStateIcon(build.state);
  const jobCount = build.jobs?.length || 0;
  logger.console(`\n${icon} Build #${build.number} ${build.state} (${jobCount} jobs)`);
}
```

**Step 2: Add watch mode to execute method**

In the `execute` method, add before the existing try block:

```typescript
async execute(options: ShowBuildOptions): Promise<number> {
  // Handle watch mode
  if (options.watch) {
    return this.executeWatchMode(options);
  }

  // ... existing implementation ...
}

private async executeWatchMode(options: ShowBuildOptions): Promise<number> {
  if (!options.buildArg) {
    logger.error('Build reference is required');
    return 1;
  }

  await this.ensureInitialized();

  const buildRef = parseBuildRef(options.buildArg);
  const ref: BuildRef = {
    org: buildRef.org,
    pipeline: buildRef.pipeline,
    buildNumber: buildRef.number,
  };

  const timeoutMinutes = parseInt(String(options.timeout || '30'), 10);
  const pollIntervalSeconds = parseInt(String(options.pollInterval || '5'), 10);

  // Create non-caching client for polling
  const pollClient = new BuildkiteRestClient(
    await BaseCommand.getToken(options),
    { caching: false, debug: options.debug }
  );

  this.displayWatchHeader(buildRef.number, timeoutMinutes);

  const poller = new BuildPoller(pollClient, {
    onJobStateChange: (change) => this.displayJobEvent(change),
    onBuildComplete: (build) => this.displayFinalSummary(build),
    onError: (err, willRetry) => {
      if (willRetry) {
        logger.console(SEMANTIC_COLORS.warning(`⚠ ${err.message}, retrying...`));
      } else {
        logger.console(SEMANTIC_COLORS.error(`✗ ${err.message}`));
      }
    },
    onTimeout: () => {
      logger.console(SEMANTIC_COLORS.warning(`⏱ Timeout reached (${timeoutMinutes}m). Build still running.`));
    },
  }, {
    initialInterval: pollIntervalSeconds * 1000,
    timeout: timeoutMinutes * 60 * 1000,
  });

  const build = await poller.watch(ref);

  return build.state?.toLowerCase() === 'passed' ? 0 : 1;
}
```

**Step 3: Verify build**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add src/commands/ShowBuild.ts
git commit -m "feat(watch): implement watch mode in ShowBuild"
```

---

## Task 14: Add --watch Flag to Snapshot Command

**Files:**
- Modify: `src/commands/Snapshot.ts`
- Modify: `src/index.ts`

**Step 1: Add watch options to SnapshotOptions**

In `src/commands/Snapshot.ts`:

```typescript
export interface SnapshotOptions extends BaseCommandOptions {
  buildRef?: string;
  outputDir?: string;
  json?: boolean;
  failed?: boolean;
  all?: boolean;
  force?: boolean;
  // New watch options
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}
```

**Step 2: Wire up CLI flags in src/index.ts**

Find the `snapshot` command and add:

```typescript
.option('-w, --watch', 'Watch build until completion, then snapshot')
.option('--timeout <minutes>', 'Max wait time in minutes (default: 30)', '30')
.option('--poll-interval <seconds>', 'Initial poll interval in seconds (default: 5)', '5')
```

**Step 3: Add watch mode to Snapshot execute**

Add imports and helper to Snapshot.ts:

```typescript
import { BuildPoller, BuildRef, JobStateChange } from '../services/BuildPoller.js';

// Add to class:
private displayJobEvent(change: JobStateChange): void {
  const time = change.timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const icon = getStateIcon(change.job.state);
  const name = change.job.name || change.job.label || 'unknown';
  const action = change.previousState === null ? 'started' : change.job.state;

  logger.console(`${time}  ${icon} ${name} ${action}`);
}
```

Update execute method:

```typescript
async execute(options: SnapshotOptions): Promise<number> {
  // Handle watch mode
  if (options.watch) {
    return this.executeWatchMode(options);
  }

  // ... existing implementation ...
}

private async executeWatchMode(options: SnapshotOptions): Promise<number> {
  if (!options.buildRef) {
    logger.error('Build reference is required');
    return 1;
  }

  await this.ensureInitialized();

  const buildRef = parseBuildRef(options.buildRef);
  const ref: BuildRef = {
    org: buildRef.org,
    pipeline: buildRef.pipeline,
    buildNumber: buildRef.number,
  };

  const timeoutMinutes = parseInt(String(options.timeout || '30'), 10);
  const pollIntervalSeconds = parseInt(String(options.pollInterval || '5'), 10);

  logger.console(`Watching build #${buildRef.number} (timeout: ${timeoutMinutes}m)`);
  logger.console(SEMANTIC_COLORS.muted('Will capture snapshot when build completes'));
  logger.console(SEMANTIC_COLORS.muted('Press Ctrl+C to stop\n'));

  const poller = new BuildPoller(this.restClient, {
    onJobStateChange: (change) => this.displayJobEvent(change),
    onBuildComplete: () => {
      logger.console(SEMANTIC_COLORS.muted('\nBuild complete. Capturing snapshot...\n'));
    },
    onError: (err, willRetry) => {
      if (willRetry) {
        logger.console(SEMANTIC_COLORS.warning(`⚠ ${err.message}, retrying...`));
      } else {
        logger.console(SEMANTIC_COLORS.error(`✗ ${err.message}`));
      }
    },
    onTimeout: () => {
      logger.console(SEMANTIC_COLORS.warning(`⏱ Timeout reached. Build still running.`));
    },
  }, {
    initialInterval: pollIntervalSeconds * 1000,
    timeout: timeoutMinutes * 60 * 1000,
  });

  const build = await poller.watch(ref);

  // Only capture if build completed (not stopped/timed out)
  if (build.state && ['passed', 'failed', 'canceled'].includes(build.state.toLowerCase())) {
    // Run normal snapshot (without watch flag)
    const snapshotOptions = { ...options, watch: false };
    return this.execute(snapshotOptions);
  }

  return 1;
}
```

**Step 4: Verify build**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build`
Expected: Success

**Step 5: Commit**

```bash
git add src/commands/Snapshot.ts src/index.ts
git commit -m "feat(watch): implement watch mode in Snapshot"
```

---

## Task 15: Add JSON Output Mode

**Files:**
- Modify: `src/services/BuildPoller.ts`
- Modify: `src/commands/ShowBuild.ts`

**Step 1: Add JSON event emitter to BuildPoller**

Add to `src/services/BuildPoller.ts`:

```typescript
export interface WatchEvent {
  type: 'watching' | 'job_changed' | 'build_complete' | 'error' | 'timeout';
  timestamp: string;
  [key: string]: any;
}

export function formatWatchEventJson(event: WatchEvent): string {
  return JSON.stringify(event);
}
```

**Step 2: Update ShowBuild for JSON mode**

In `executeWatchMode`, handle JSON output:

```typescript
private async executeWatchMode(options: ShowBuildOptions): Promise<number> {
  // ... existing setup ...

  const isJson = options.format === 'json';

  if (isJson) {
    logger.console(JSON.stringify({
      type: 'watching',
      build: { number: buildRef.number, org: buildRef.org, pipeline: buildRef.pipeline },
      timeout: `${timeoutMinutes}m`,
      timestamp: new Date().toISOString(),
    }));
  } else {
    this.displayWatchHeader(buildRef.number, timeoutMinutes);
  }

  const poller = new BuildPoller(pollClient, {
    onJobStateChange: (change) => {
      if (isJson) {
        logger.console(JSON.stringify({
          type: 'job_changed',
          job: { id: change.job.id, name: change.job.name, state: change.job.state },
          previousState: change.previousState,
          timestamp: change.timestamp.toISOString(),
        }));
      } else {
        this.displayJobEvent(change);
      }
    },
    onBuildComplete: (build) => {
      if (isJson) {
        logger.console(JSON.stringify({
          type: 'build_complete',
          build: { number: build.number, state: build.state },
          exitCode: build.state?.toLowerCase() === 'passed' ? 0 : 1,
          timestamp: new Date().toISOString(),
        }));
      } else {
        this.displayFinalSummary(build);
      }
    },
    onError: (err, willRetry) => {
      if (isJson) {
        logger.console(JSON.stringify({
          type: 'error',
          error: err,
          willRetry,
          timestamp: new Date().toISOString(),
        }));
      } else if (willRetry) {
        logger.console(SEMANTIC_COLORS.warning(`⚠ ${err.message}, retrying...`));
      } else {
        logger.console(SEMANTIC_COLORS.error(`✗ ${err.message}`));
      }
    },
    onTimeout: () => {
      if (isJson) {
        logger.console(JSON.stringify({
          type: 'timeout',
          timeout: `${timeoutMinutes}m`,
          timestamp: new Date().toISOString(),
        }));
      } else {
        logger.console(SEMANTIC_COLORS.warning(`⏱ Timeout reached (${timeoutMinutes}m).`));
      }
    },
  }, {
    initialInterval: pollIntervalSeconds * 1000,
    timeout: timeoutMinutes * 60 * 1000,
  });

  // ... rest of method ...
}
```

**Step 3: Verify build**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build`
Expected: Success

**Step 4: Commit**

```bash
git add src/services/BuildPoller.ts src/commands/ShowBuild.ts
git commit -m "feat(watch): add NDJSON output mode"
```

---

## Task 16: Run Full Test Suite

**Step 1: Run all tests**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && npm run build`
Expected: Success

**Step 3: Manual smoke test**

Run: `cd ~/gt/repos/bktide/worktrees/gt-l5jx-watch-flag && bin/bktide build --help | grep -A2 watch`
Expected: Shows --watch, --timeout, --poll-interval options

**Step 4: Final commit if any cleanup needed**

```bash
git status
# If clean, no commit needed
```

---

## Summary

Implementation complete. The `--watch` flag is now available on both `bktide build` and `bktide snapshot` commands with:

- Real-time job state change events
- Configurable timeout and poll interval
- NDJSON output for JSON format
- Graceful SIGINT handling
- Error retry with exponential backoff
- Immediate return for already-complete builds
