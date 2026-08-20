import { Manifest, AnnotationResult, ArtifactResult } from '../../types/snapshot.js';

export interface SnapshotFormatterInput {
  outputDir: string;
  manifest: Manifest;
  build: any;
  scriptJobs: any[];
  alreadyUpToDate: boolean;
  capturedCount: number;
  skippedCount: number;
  fetchErrorCount: number;
  annotationResult: AnnotationResult;
  artifactResult?: ArtifactResult;
  showTips: boolean;
  debug?: boolean;
}

export interface SnapshotFormatter {
  format(input: SnapshotFormatterInput): string;
}

export abstract class BaseSnapshotFormatter implements SnapshotFormatter {
  abstract name: string;
  abstract format(input: SnapshotFormatterInput): string;
}
