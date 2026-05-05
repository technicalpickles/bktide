import { BaseArtifactFormatter, ArtifactFormatterOptions } from './Formatter.js';
import { BuildkiteArtifact } from '../../types/buildkite.js';

export class JsonFormatter extends BaseArtifactFormatter {
  name = 'json';

  formatArtifacts(artifacts: BuildkiteArtifact[], options?: ArtifactFormatterOptions): string {
    if (options?.hasError) {
      return JSON.stringify({ error: options.errorMessage || 'Failed to fetch artifacts' }, null, 2);
    }
    return JSON.stringify({ count: artifacts.length, artifacts }, null, 2);
  }
}
