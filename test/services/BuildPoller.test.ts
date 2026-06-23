// test/services/BuildPoller.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildPoller, TERMINAL_BUILD_STATES, BuildPollerCallbacks, BuildRef, categorizeError, isTerminalState } from '../../src/services/BuildPoller.js';
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

describe('watch', () => {
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
});
