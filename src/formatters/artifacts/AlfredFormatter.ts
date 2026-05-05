import { BaseArtifactFormatter, ArtifactFormatterOptions } from './Formatter.js';
import { BuildkiteArtifact } from '../../types/buildkite.js';
import { formatSize } from '../../utils/formatUtils.js';

export class AlfredFormatter extends BaseArtifactFormatter {
  name = 'alfred';

  formatArtifacts(artifacts: BuildkiteArtifact[], options?: ArtifactFormatterOptions): string {
    if (options?.hasError) {
      return JSON.stringify({
        items: [{
          uid: 'error',
          title: 'Error',
          subtitle: options.errorMessage || 'Failed to fetch artifacts',
          icon: { path: 'icons/unknown.png' },
        }],
      }, null, 2);
    }

    if (!artifacts || artifacts.length === 0) {
      return JSON.stringify({
        items: [{
          uid: 'empty',
          title: 'No Artifacts Found',
          subtitle: 'This build has no artifacts',
          icon: { path: 'icons/unknown.png' },
        }],
      }, null, 2);
    }

    const items = artifacts.map(artifact => ({
      uid: artifact.id,
      title: artifact.path,
      subtitle: `${formatSize(artifact.file_size)} • ${artifact.state} • ${artifact.mime_type}`,
      arg: artifact.download_url,
      autocomplete: artifact.path,
      icon: { path: 'icons/unknown.png' },
      text: {
        copy: artifact.download_url,
        largetype: `${artifact.path}\n${formatSize(artifact.file_size)} • ${artifact.state}`,
      },
    }));

    return JSON.stringify({ items }, null, 2);
  }
}
