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

export interface SnapshotPaths {
  outputDir: string;
  manifest: string;
  steps: string;
  annotations: string;
  artifacts?: string;
}

/**
 * Where a snapshot's files live on disk, relative to a given base dir. Used
 * both for the plain-text tips (base = the human-display path) and the JSON
 * output (base = the raw outputDir) so both formats point at the same
 * layout without duplicating the join logic.
 */
export function computeSnapshotPaths(baseDir: string, includeArtifacts: boolean): SnapshotPaths {
  return {
    outputDir: baseDir,
    manifest: `${baseDir}/manifest.json`,
    steps: `${baseDir}/steps`,
    annotations: `${baseDir}/annotations.json`,
    ...(includeArtifacts ? { artifacts: `${baseDir}/artifacts` } : {}),
  };
}

export interface SnapshotFormatter {
  format(input: SnapshotFormatterInput): string;
}

export abstract class BaseSnapshotFormatter implements SnapshotFormatter {
  abstract name: string;
  abstract format(input: SnapshotFormatterInput): string;
}
