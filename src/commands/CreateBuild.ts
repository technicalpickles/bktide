import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { logger } from '../services/logger.js';
import { parseEnvEntries } from '../utils/envParser.js';
import { CreateBuildPayload } from '../services/BuildkiteRestClient.js';
import { getGitContext, getHeadCommit, getHeadCommitMessage } from '../utils/gitContext.js';
import { parseGitRemoteUrl, generateRepoCandidates } from '../utils/repoUrl.js';
import { SEMANTIC_COLORS } from '../ui/theme.js';
import { BuildPoller } from '../services/BuildPoller.js';
import { parseScopeError, formatScopeError } from '../utils/scopeError.js';
import { formatError } from '../ui/theme.js';

export interface CreateBuildOptions extends BaseCommandOptions {
  pipelineRef?: string;
  commit?: string;
  branch?: string;
  message?: string;
  env?: string[];
  org?: string;
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
}

export class CreateBuild extends BaseCommand {
  static requiresToken = true;

  async execute(options: CreateBuildOptions): Promise<number> {
    try {
      await this.ensureInitialized();

      // 1. Resolve org / pipeline
      let org: string;
      let pipeline: string;

      if (options.pipelineRef) {
        const parts = options.pipelineRef.split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          logger.error(`Invalid pipeline reference "${options.pipelineRef}". Use "<org>/<pipeline>".`);
          return 1;
        }
        [org, pipeline] = parts;
      } else {
        const resolved = await this.resolvePipelineFromGit(options);
        if (!resolved) return 1;
        org = resolved.org;
        pipeline = resolved.pipeline;
      }

      // 2. Resolve commit / branch / message
      const commit = options.commit ?? this.tryGitFn(getHeadCommit);
      const branch = options.branch ?? this.tryGitFn(() => getGitContext().branch);
      const message = options.message ?? this.tryGitFn(getHeadCommitMessage);

      if (!commit) { logger.error('--commit is required (or run inside a git repo).'); return 1; }
      if (!branch) { logger.error('--branch is required (or run inside a git repo).'); return 1; }

      // 3. Env parsing
      let env: Record<string, string> | undefined;
      if (options.env && options.env.length > 0) {
        try {
          env = parseEnvEntries(options.env);
        } catch (error) {
          logger.error(error instanceof Error ? error.message : String(error));
          return 1;
        }
      }

      // 4. Build payload + call API
      const payload: CreateBuildPayload = {
        commit,
        branch,
        ...(message ? { message } : {}),
        ...(env ? { env } : {}),
      };

      const build = await this.restClient.createBuild(org, pipeline, payload);

      const formatter = FormatterFactory.getFormatter(FormatterType.BUILD_CREATE, options.format || 'plain') as any;
      logger.console(formatter.formatBuild(build, { verb: 'created' }));

      if (options.watch) {
        const pollerOpts = {
          ...(options.timeout ? { timeout: options.timeout * 60 * 1000 } : {}),
          ...(options.pollInterval ? { initialInterval: options.pollInterval * 1000 } : {}),
        };
        const poller = new BuildPoller(this.restClient, {
          onJobStateChange: (_change) => { /* TODO: stream display in follow-up */ },
          onBuildComplete: (_build) => { /* final summary printed by formatter run elsewhere */ },
          onError: (err, willRetry) => {
            if (!willRetry) logger.error(err.message);
          },
          onTimeout: () => logger.error('Timed out waiting for build to complete.'),
        }, pollerOpts);

        try {
          const watched = await poller.watch({ org, pipeline, buildNumber: build.number });
          return watched.state?.toLowerCase() === 'passed' ? 0 : 1;
        } catch (err) {
          logger.error(`Watch failed: ${err instanceof Error ? err.message : err}`);
          logger.error(`The build was created and is still running: ${build.web_url}`);
          return 1;
        }
      }

      return 0;
    } catch (error) {
      if (error instanceof Error) {
        const parsed = parseScopeError(error.message);
        if (parsed.matched) {
          const formatted = formatScopeError(parsed.scope);
          logger.console(formatError(formatted.message, { suggestions: formatted.suggestions }));
        } else {
          logger.error(error.message);
        }
      } else {
        logger.error(String(error));
      }
      return 1;
    }
  }

  private tryGitFn(fn: () => string): string | undefined {
    try { return fn(); } catch { return undefined; }
  }

  private async resolvePipelineFromGit(options: CreateBuildOptions): Promise<{ org: string; pipeline: string } | null> {
    let gitCtx;
    try {
      gitCtx = getGitContext();
    } catch (error) {
      logger.error(`${error instanceof Error ? error.message : error} Pass "<org>/<pipeline>" to 'bktide build create'.`);
      return null;
    }

    const parsed = parseGitRemoteUrl(gitCtx.remoteUrl);
    const candidates = generateRepoCandidates(parsed);

    // Resolve org
    let orgSlug = options.org;
    if (!orgSlug) {
      const orgSlugs = await this.client.getViewerOrganizationSlugs();
      if (orgSlugs.length === 0) {
        logger.error('No organizations found. Check your API token permissions.');
        return null;
      }
      if (orgSlugs.length > 1) {
        logger.error(`Multiple organizations found: ${orgSlugs.join(', ')}. Use --org to specify which one.`);
        return null;
      }
      orgSlug = orgSlugs[0];
    }

    const pipelines = await this.client.getPipelinesForRepo(orgSlug, candidates);

    if (pipelines.length === 0) {
      logger.error(`No Buildkite pipelines match the remote ${gitCtx.remoteUrl}. Pass "<org>/<pipeline>" explicitly.`);
      return null;
    }
    if (pipelines.length > 1) {
      logger.error('Multiple pipelines match this repository. Pass "<org>/<pipeline>" explicitly:');
      for (const p of pipelines) {
        logger.error(`  ${SEMANTIC_COLORS.muted('-')} ${orgSlug}/${p.slug}  ${SEMANTIC_COLORS.muted(`(${p.name})`)}`);
      }
      return null;
    }

    return { org: orgSlug, pipeline: pipelines[0].slug };
  }
}
