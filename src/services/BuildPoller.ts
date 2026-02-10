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

const DEFAULT_OPTIONS: Required<BuildPollerOptions> = {
  initialInterval: 5000,
  maxInterval: 30000,
  timeout: 1800000,  // 30 minutes
  maxConsecutiveErrors: 3,
};

// Terminal states where build is complete
export const TERMINAL_BUILD_STATES = ['passed', 'failed', 'canceled', 'blocked', 'not_run'];

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

  async watch(_buildRef: BuildRef): Promise<any> {
    // TODO: Implement in next task
    throw new Error('Not implemented');
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
