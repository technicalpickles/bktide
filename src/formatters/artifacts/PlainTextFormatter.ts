import { BaseArtifactFormatter, ArtifactFormatterOptions } from './Formatter.js';
import { BuildkiteArtifact } from '../../types/buildkite.js';
import { formatEmptyState, formatError, SEMANTIC_COLORS } from '../../ui/theme.js';

export class PlainTextFormatter extends BaseArtifactFormatter {
  name = 'plain';

  formatArtifacts(artifacts: BuildkiteArtifact[], options?: ArtifactFormatterOptions): string {
    if (options?.hasError) {
      return formatError(options.errorMessage || 'Failed to fetch artifacts', {
        showHelp: true,
        helpCommand: 'bktide artifacts list --help',
      });
    }

    if (!artifacts || artifacts.length === 0) {
      return formatEmptyState('No artifacts found for this build', [
        'Artifacts are uploaded by build steps using the buildkite-agent artifact upload command',
        'Check that the build has completed and has steps that upload artifacts',
      ]);
    }

    const lines: string[] = [];
    lines.push(SEMANTIC_COLORS.muted(`${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'}`));
    lines.push('');

    // Calculate column widths
    const pathWidth = Math.min(60, Math.max(20, ...artifacts.map(a => a.path.length)));
    const sizeWidth = 10;

    const header = `${'PATH'.padEnd(pathWidth)}  ${'SIZE'.padEnd(sizeWidth)}  STATE     MIME TYPE`;
    lines.push(SEMANTIC_COLORS.muted(header));
    lines.push(SEMANTIC_COLORS.muted('-'.repeat(header.length)));

    for (const artifact of artifacts) {
      const path = artifact.path.length > pathWidth
        ? '…' + artifact.path.slice(-(pathWidth - 1))
        : artifact.path.padEnd(pathWidth);
      const size = this.formatBytes(artifact.file_size).padEnd(sizeWidth);
      const state = artifact.state.padEnd(9);
      lines.push(`${path}  ${size}  ${state} ${artifact.mime_type}`);
    }

    return lines.join('\n') + '\n';
  }
}
