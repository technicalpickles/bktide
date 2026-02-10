// src/services/BuildPoller.ts
import { BuildkiteRestClient } from './BuildkiteRestClient.js';

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

const DEFAULT_OPTIONS: Required<BuildPollerOptions> = {
  initialInterval: 5000,
  maxInterval: 30000,
  timeout: 1800000,  // 30 minutes
  maxConsecutiveErrors: 3,
};

// Terminal states where build is complete
export const TERMINAL_BUILD_STATES = ['passed', 'failed', 'canceled', 'blocked', 'not_run'];

export function isTerminalState(state: string): boolean {
  return TERMINAL_BUILD_STATES.includes(state.toLowerCase());
}

export class BuildPoller {
  private _client: BuildkiteRestClient;
  private _callbacks: BuildPollerCallbacks;
  private _options: Required<BuildPollerOptions>;
  private _stopped = false;
  private _jobStates: Map<string, string> = new Map();

  constructor(
    client: BuildkiteRestClient,
    callbacks: BuildPollerCallbacks,
    options?: BuildPollerOptions
  ) {
    this._client = client;
    this._callbacks = callbacks;
    this._options = { ...DEFAULT_OPTIONS, ...options };
  }

  async watch(buildRef: BuildRef): Promise<any> {
    this._stopped = false;
    this._jobStates.clear();

    // Initial fetch
    const build = await this._client.getBuild(
      buildRef.org,
      buildRef.pipeline,
      buildRef.buildNumber
    );

    // Process initial job states
    this.processJobChanges(build.jobs || []);

    // Check if already complete
    if (isTerminalState(build.state)) {
      this._callbacks.onBuildComplete(build);
      return build;
    }

    // TODO: Implement polling loop in next task
    throw new Error('Polling not yet implemented');
  }

  private processJobChanges(jobs: any[]): void {
    for (const job of jobs) {
      const previousState = this._jobStates.get(job.id);
      const currentState = job.state;

      if (previousState !== currentState) {
        this._jobStates.set(job.id, currentState);
        this._callbacks.onJobStateChange({
          job,
          previousState: previousState ?? null,
          timestamp: new Date(),
        });
      }
    }
  }

  stop(): void {
    this._stopped = true;
  }

  // Expose for testing and internal use
  get client(): BuildkiteRestClient { return this._client; }
  get callbacks(): BuildPollerCallbacks { return this._callbacks; }
  get options(): Required<BuildPollerOptions> { return this._options; }
  get stopped(): boolean { return this._stopped; }
  get jobStates(): Map<string, string> { return this._jobStates; }
}
