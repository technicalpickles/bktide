import { BuildkiteArtifact } from '../../types/buildkite.js';

export interface ArtifactFormatterOptions {
  hasError?: boolean;
  errorMessage?: string;
}

export interface ArtifactFormatter {
  formatArtifacts(artifacts: BuildkiteArtifact[], options?: ArtifactFormatterOptions): string;
}

export abstract class BaseArtifactFormatter implements ArtifactFormatter {
  abstract name: string;
  abstract formatArtifacts(artifacts: BuildkiteArtifact[], options?: ArtifactFormatterOptions): string;
}
