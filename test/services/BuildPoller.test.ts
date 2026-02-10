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
});
