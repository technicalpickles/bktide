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
  // Optional annotation data for navigation tips
  annotationResult?: {
    fetchStatus: 'success' | 'none' | 'failed';
    count: number;
  };
}

export interface SnapshotFormatterOptions extends FormatterOptions {
  // Snapshot-specific options can be added here
}

export interface SnapshotFormatter {
  name: string;
  formatSnapshot(data: SnapshotData, options?: SnapshotFormatterOptions): string;
}
