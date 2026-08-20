// Types for the `snapshot` command's manifest and fetch results.
// Shared between the command (which builds them) and the snapshot
// formatters (which render them).
import { ArtifactManifestItem } from './buildkite.js';
import { JobStats } from '../utils/jobStats.js';

export interface StepResult {
  id: string;
  jobId: string;
  status: 'success' | 'failed';
  job: any;  // Full job object from Buildkite API
  error?: string;
  message?: string;
  retryable?: boolean;
}

export interface Manifest {
  version: number;
  buildRef: string;
  url: string;
  fetchedAt: string;
  fetchComplete: boolean;
  build: {
    state: string;
    number: number;
    message: string;
    branch: string;
    commit: string;
    finishedAt: string | null;
    startedAt: string | null;
    createdAt: string | null;
    author: { name: string | null; email: string | null } | null;
  };
  /** Aggregate counts across every script job in the build, not just the ones in `steps` (which by default only covers failed jobs). */
  jobStats: JobStats;
  annotations?: {
    fetchStatus: 'success' | 'none' | 'failed';
    count: number;
    items?: Array<{
      uuid: string;
      updatedAt: string | null;
    }>;
  };
  artifacts?: {
    fetchStatus: 'success' | 'none' | 'failed' | 'skipped';
    count: number;
    filter?: string;
    items?: ArtifactManifestItem[];
    error?: string;
  };
  steps: Array<{
    id: string;
    fetchStatus: 'success' | 'failed';
    jobId: string;
    type: string;
    name: string;
    label: string;
    state: string;
    exit_status: number | null;
    started_at: string | null;
    finished_at: string | null;
  }>;
  fetchErrors?: Array<{
    id: string;
    jobId: string;
    fetchStatus: 'failed';
    error: string;
    message: string;
    retryable: boolean;
  }>;
}

export interface AnnotationResult {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
  items?: Array<{ uuid: string; updatedAt: string | null }>;
  error?: string;
  message?: string;
}

export interface ArtifactResult {
  fetchStatus: 'success' | 'none' | 'failed' | 'skipped';
  count: number;
  filter?: string;
  items?: ArtifactManifestItem[];
  error?: string;
}

export interface AnnotationsFile {
  fetchedAt: string;
  count: number;
  annotations: any[];  // Raw annotations from Buildkite API
}

export interface BuildChangeResult {
  hasChanges: boolean;
  reason?: 'build_running' | 'build_finished_changed' | 'no_existing_manifest' | 'force_refresh';
  jobsToRefetch?: string[];
  annotationsChanged?: boolean;
}

export type ErrorCategory = 'rate_limited' | 'not_found' | 'permission_denied' | 'network_error' | 'unknown';

export interface StepError {
  error: ErrorCategory;
  message: string;
  retryable: boolean;
}
