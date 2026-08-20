import { BaseSnapshotFormatter, SnapshotFormatterInput, computeSnapshotPaths } from './Formatter.js';

export class JsonFormatter extends BaseSnapshotFormatter {
  name = 'json';

  format(input: SnapshotFormatterInput): string {
    const hasArtifacts = !!input.artifactResult && input.artifactResult.fetchStatus !== 'skipped';
    const paths = computeSnapshotPaths(input.outputDir, hasArtifacts);

    return JSON.stringify({ ...input.manifest, paths }, null, 2);
  }
}
