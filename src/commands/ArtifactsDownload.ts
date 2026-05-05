import path from 'path';
import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { formatError, SEMANTIC_COLORS } from '../ui/theme.js';
import { Progress } from '../ui/progress.js';
import { minimatch } from 'minimatch';
import { BuildkiteArtifact, DOWNLOADABLE_ARTIFACT_STATES } from '../types/buildkite.js';

export interface ArtifactsDownloadOptions extends BaseCommandOptions {
  buildRef: string;
  id?: string;
  path?: string;
  out?: string;
}

export class ArtifactsDownload extends BaseCommand {
  static requiresToken = true;

  async execute(options: ArtifactsDownloadOptions): Promise<number> {
    const outDir = options.out || './';

    if (!options.id && !options.path) {
      logger.console(formatError('Either --id <id> or --path <glob> is required', {
        suggestions: [
          'Use --id to download a specific artifact by its ID',
          'Use --path "*.patch" to download artifacts matching a glob pattern',
          'Run `bktide artifacts list <build-ref>` to see available artifacts',
        ],
      }));
      return 1;
    }

    const spinner = Progress.spinner('Fetching artifact list...', { format: options.format || 'plain' });

    try {
      this.token = await BaseCommand.getToken(options);
      const ref = parseBuildRef(options.buildRef);

      const allArtifacts = await this.restClient.listBuildArtifacts(ref.org, ref.pipeline, ref.number);
      spinner.stop();

      let targets: BuildkiteArtifact[];
      if (options.id) {
        targets = allArtifacts.filter(a => a.id === options.id);
        if (targets.length === 0) {
          logger.console(formatError(`No artifact found with id '${options.id}'`, {
            suggestions: [`Run \`bktide artifacts list ${options.buildRef}\` to see available artifact IDs`],
          }));
          return 1;
        }
      } else {
        targets = allArtifacts.filter(a => minimatch(a.path, options.path!, { matchBase: true }));
        if (targets.length === 0) {
          logger.console(formatError(`No artifacts match glob '${options.path}'`, {
            suggestions: [`Run \`bktide artifacts list ${options.buildRef}\` to see available artifact paths`],
          }));
          return 1;
        }
      }

      const downloadable = targets.filter(a => DOWNLOADABLE_ARTIFACT_STATES.has(a.state));
      const skipped = targets.filter(a => !DOWNLOADABLE_ARTIFACT_STATES.has(a.state));
      for (const a of skipped) {
        logger.console(SEMANTIC_COLORS.warning(`⚠ Skipping ${a.path} (state: ${a.state})`));
      }

      if (downloadable.length === 0) {
        logger.console(formatError('No downloadable artifacts found (all are expired or deleted)'));
        return 1;
      }

      const results: Array<{ path: string; ok: boolean; error?: string }> = [];
      for (const artifact of downloadable) {
        // Sanitize artifact path to prevent traversal outside the output directory
        const safePath = path.normalize(artifact.path).replace(/^(\.\.(\/|\\|$))+/, '');
        const destPath = path.join(outDir, safePath);
        const dlSpinner = Progress.spinner(`Downloading ${artifact.filename}...`, { format: options.format || 'plain' });
        try {
          await this.restClient.downloadArtifact(artifact, destPath);
          dlSpinner.stop();
          logger.console(SEMANTIC_COLORS.success(`✓ ${artifact.path} → ${destPath}`));
          results.push({ path: destPath, ok: true });
        } catch (err) {
          dlSpinner.stop();
          const msg = err instanceof Error ? err.message : String(err);
          logger.console(SEMANTIC_COLORS.error(`✖ ${artifact.path}: ${msg}`));
          results.push({ path: destPath, ok: false, error: msg });
        }
      }

      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        logger.console(SEMANTIC_COLORS.warning(`\n${failed.length} download(s) failed`));
        return 1;
      }

      logger.console(SEMANTIC_COLORS.muted(`\n${results.length} artifact(s) downloaded to ${outDir}`));
      return 0;
    } catch (error) {
      spinner.stop();
      if (error instanceof Error) {
        logger.console(formatError(error.message, {
          suggestions: ['Check the build reference format', 'Verify you have read_artifacts scope'],
        }));
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
  }
}
