import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { Progress } from '../ui/progress.js';
import { getStateIcon, SEMANTIC_COLORS, BUILD_STATUS_THEME } from '../ui/theme.js';
import fs from 'fs/promises';
import path from 'path';
import { BuildPoller, BuildRef, JobStateChange } from '../services/BuildPoller.js';
import { getGitContext } from '../utils/gitContext.js';
import { parseGitRemoteUrl, generateRepoCandidates } from '../utils/repoUrl.js';
import { minimatch } from 'minimatch';
import { BuildkiteArtifact, DOWNLOADABLE_ARTIFACT_STATES } from '../types/buildkite.js';
import {
  Manifest,
  AnnotationResult,
  ArtifactResult,
  AnnotationsFile,
  BuildChangeResult,
  StepResult,
  StepError,
} from '../types/snapshot.js';
import { isFailedJob, calculateJobStats } from '../utils/jobStats.js';
import { getStepDirName } from '../utils/stepUtils.js';
import { FormatterFactory, FormatterType } from '../formatters/index.js';
import { SnapshotFormatter } from '../formatters/snapshot/index.js';

export interface SnapshotOptions extends BaseCommandOptions {
  buildRef?: string;
  outputDir?: string;
  json?: boolean;
  failed?: boolean;
  all?: boolean;
  force?: boolean;
  // Branch-aware options
  branch?: string;
  org?: string;
  // Watch options
  watch?: boolean;
  timeout?: number;
  pollInterval?: number;
  // Artifact options
  artifacts?: boolean;
  artifactGlob?: string;
}

const TERMINAL_BUILD_STATES = ['PASSED', 'FAILED', 'CANCELED', 'BLOCKED', 'NOT_RUN'];

/**
 * Categorize an error into a known category
 */
export function categorizeError(error: Error): StepError {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return { error: 'rate_limited', message: error.message, retryable: true };
  }
  if (message.includes('not found') || message.includes('404')) {
    return { error: 'not_found', message: error.message, retryable: false };
  }
  if (message.includes('permission') || message.includes('403') || message.includes('401')) {
    return { error: 'permission_denied', message: error.message, retryable: false };
  }
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return { error: 'network_error', message: error.message, retryable: true };
  }
  return { error: 'unknown', message: error.message, retryable: true };
}

export class Snapshot extends BaseCommand {
  static requiresToken = true;

  private displayJobEvent(change: JobStateChange): void {
    const time = change.timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const icon = getStateIcon(change.job.state);
    const name = change.job.name || change.job.label || 'unknown';
    const action = change.previousState === null ? 'started' : change.job.state;

    logger.console(`${time}  ${icon} ${name} ${action}`);
  }

  async execute(options: SnapshotOptions): Promise<number> {
    // Handle watch mode
    if (options.watch) {
      return this.executeWatchMode(options);
    }

    if (options.debug) {
      logger.debug('Starting Snapshot command execution', options);
    }

    // If no build ref provided, try branch-aware inference
    if (!options.buildRef) {
      return this.executeBranchAware(options);
    }

    // --json is a snapshot-specific alias for --format json, kept for
    // existing scripts; --format is the CLI-wide way to select it.
    const format = options.json ? 'json' : (options.format || 'plain');
    const spinner = Progress.spinner('Fetching build data…', { format });

    try {
      await this.ensureInitialized();

      // 1. Parse build reference
      const buildRef = parseBuildRef(options.buildRef);
      if (options.debug) {
        logger.debug('Parsed build reference:', buildRef);
      }

      // 2. Determine output directory
      const outputDir = this.getOutputDir(options, buildRef.org, buildRef.pipeline, buildRef.number);
      if (options.debug) {
        logger.debug('Output directory:', outputDir);
      }

      // 3. Fetch build data via GraphQL
      spinner.update('Fetching build metadata…');
      const buildSlug = `${buildRef.org}/${buildRef.pipeline}/${buildRef.number}`;
      const buildData = await this.client.getBuildSummaryWithAllJobs(buildSlug, {
        fetchAllJobs: true,
        onProgress: (fetched: number, total?: number) => {
          const totalStr = total ? `/${total}` : '';
          spinner.update(`Fetching jobs: ${fetched}${totalStr}…`);
        }
      });

      const build = buildData.build;
      const jobs = build.jobs?.edges || [];

      // 4. Check for existing snapshot and detect changes
      const existingManifest = await this.loadExistingManifest(outputDir);
      const changeResult = this.detectChanges(build, jobs, existingManifest, options.force === true);

      if (!changeResult.hasChanges) {
        spinner.stop();

        const scriptJobs = jobs
          .map((edge: any) => edge.node)
          .filter((job: any) => job.__typename === 'JobTypeCommand' || !job.__typename);

        const annotationResult: AnnotationResult = existingManifest!.annotations
          ? existingManifest!.annotations
          : { fetchStatus: 'none', count: 0 };

        // Build/job-state facts are cheap to recompute from the live GraphQL
        // response we already fetched above, even on this short-circuit path
        // where we don't re-fetch step logs. That keeps `--format json`
        // accurate without rewriting manifest.json on a no-op run.
        const refreshedManifest: Manifest = {
          ...existingManifest!,
          build: this.buildManifestBuildSection(build),
          jobStats: calculateJobStats(scriptJobs),
        };

        const formatter = FormatterFactory.getFormatter(FormatterType.SNAPSHOT, format) as unknown as SnapshotFormatter;
        logger.console(formatter.format({
          outputDir,
          manifest: refreshedManifest,
          build,
          scriptJobs,
          alreadyUpToDate: true,
          capturedCount: existingManifest!.steps.length,
          skippedCount: scriptJobs.length - existingManifest!.steps.length,
          fetchErrorCount: 0,
          annotationResult,
          artifactResult: existingManifest!.artifacts,
          showTips: this.options.tips !== false,
          debug: options.debug,
        }));

        return 0;
      }

      if (options.debug && changeResult.reason) {
        logger.debug(`Change detected: ${changeResult.reason}`);
        if (changeResult.jobsToRefetch) {
          logger.debug(`Jobs to refetch: ${changeResult.jobsToRefetch.length}`);
        }
      }

      // 5. Create directory structure
      spinner.update('Creating directories…');
      await this.createDirectories(outputDir);

      // 6. Save build.json
      spinner.update('Saving build data…');
      await this.saveBuildJson(outputDir, build);

      // 7. Check and fetch annotations if changed
      spinner.update('Checking annotations…');
      let annotationResult: AnnotationResult;

      const annotationsChanged = await this.checkAnnotationsChanged(buildSlug, existingManifest);
      if (annotationsChanged || options.force) {
        spinner.update('Fetching annotations…');
        annotationResult = await this.fetchAndSaveAnnotations(
          outputDir,
          buildSlug,
          options.debug
        );
      } else {
        // Use existing annotation data
        annotationResult = existingManifest?.annotations
          ? { fetchStatus: existingManifest.annotations.fetchStatus, count: existingManifest.annotations.count, items: existingManifest.annotations.items }
          : { fetchStatus: 'none', count: 0 };
        if (options.debug) {
          logger.debug('Annotations unchanged, using cached data');
        }
      }

      // 8. Filter and fetch jobs
      // Filter to script jobs only (JobTypeCommand)
      const scriptJobs = jobs
        .map((edge: any) => edge.node)
        .filter((job: any) => job.__typename === 'JobTypeCommand' || !job.__typename);

      // Determine which jobs to fetch based on options
      // Default is --failed unless --all is specified
      const fetchAll = options.all === true;

      let jobsToFetch: any[];
      if (fetchAll) {
        jobsToFetch = scriptJobs;
      } else {
        // Filter to only failed jobs
        jobsToFetch = scriptJobs.filter((job: any) => isFailedJob(job));
      }

      const totalJobs = jobsToFetch.length;
      const stepResults: StepResult[] = [];

      // Stop the spinner before switching to progress bar
      spinner.stop();

      // Fetch logs for each job (if any) - use progress bar since we know the count
      if (totalJobs > 0) {
        const progressBar = Progress.bar({
          total: totalJobs,
          label: 'Fetching steps',
          format,
        });

        for (let i = 0; i < jobsToFetch.length; i++) {
          const job = jobsToFetch[i];
          const stepName = job.name || job.label || 'step';
          progressBar.update(i, `Fetching ${stepName}`);

          const stepResult = await this.fetchAndSaveStep(
            outputDir,
            buildRef.org,
            buildRef.pipeline,
            buildRef.number,
            job,
            stepResults.length,
            options.debug
          );
          stepResults.push(stepResult);
        }

        progressBar.complete('');  // Silent completion, count shown in summary

        // Force stderr flush to prevent output interleaving
        if (process.stderr.write) {
          process.stderr.write('');
        }
      }

      // 9. Fetch and save artifacts if requested
      let artifactResult: ArtifactResult | undefined;
      if (options.artifacts) {
        logger.console(SEMANTIC_COLORS.muted('Fetching artifacts…'));
        artifactResult = await this.fetchAndSaveArtifacts(
          outputDir,
          buildRef.org,
          buildRef.pipeline,
          buildRef.number,
          options.artifactGlob
        );
      }

      // 10. Write manifest
      const manifest = this.buildManifest(
        buildRef.org,
        buildRef.pipeline,
        buildRef.number,
        build,
        scriptJobs,
        stepResults,
        annotationResult,
        artifactResult
      );
      await this.saveManifest(outputDir, manifest);

      // 10. Output result
      const fetchErrorCount = stepResults.filter(s => s.status === 'failed').length;
      const skippedCount = !fetchAll ? scriptJobs.length - jobsToFetch.length : 0;

      if (artifactResult?.fetchStatus === 'none') {
        logger.debug(`No artifacts matched${artifactResult.filter ? ` '${artifactResult.filter}'` : ''}`);
      }

      const formatter = FormatterFactory.getFormatter(FormatterType.SNAPSHOT, format) as unknown as SnapshotFormatter;
      logger.console(formatter.format({
        outputDir,
        manifest,
        build,
        scriptJobs,
        alreadyUpToDate: false,
        capturedCount: stepResults.length,
        skippedCount,
        fetchErrorCount,
        annotationResult,
        artifactResult,
        showTips: this.options.tips !== false,
        debug: options.debug,
      }));

      return manifest.fetchComplete ? 0 : 1;
    } catch (error) {
      spinner.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create snapshot: ${errorMessage}`);
      if (options.debug && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      return 1;
    }
  }

  private async executeWatchMode(options: SnapshotOptions): Promise<number> {
    if (!options.buildRef) {
      logger.error('Build reference is required');
      return 1;
    }

    await this.ensureInitialized();

    const buildRef = parseBuildRef(options.buildRef);
    const ref: BuildRef = {
      org: buildRef.org,
      pipeline: buildRef.pipeline,
      buildNumber: buildRef.number,
    };

    const timeoutMinutes = parseInt(String(options.timeout || '30'), 10);
    const pollIntervalSeconds = parseInt(String(options.pollInterval || '5'), 10);

    logger.console(`Watching build #${buildRef.number} (timeout: ${timeoutMinutes}m)`);
    logger.console(SEMANTIC_COLORS.muted('Will capture snapshot when build completes'));
    logger.console(SEMANTIC_COLORS.muted('Press Ctrl+C to stop\n'));

    const poller = new BuildPoller(this.restClient, {
      onJobStateChange: (change) => this.displayJobEvent(change),
      onBuildComplete: () => {
        logger.console(SEMANTIC_COLORS.muted('\nBuild complete. Capturing snapshot...\n'));
      },
      onError: (err, willRetry) => {
        if (willRetry) {
          logger.console(SEMANTIC_COLORS.warning(`⚠ ${err.message}, retrying...`));
        } else {
          logger.console(SEMANTIC_COLORS.error(`✗ ${err.message}`));
        }
      },
      onTimeout: () => {
        logger.console(SEMANTIC_COLORS.warning(`⏱ Timeout reached. Build still running.`));
      },
    }, {
      initialInterval: pollIntervalSeconds * 1000,
      timeout: timeoutMinutes * 60 * 1000,
    });

    const build = await poller.watch(ref);

    // Only capture if build completed (not stopped/timed out)
    if (build.state && ['passed', 'failed', 'canceled'].includes(build.state.toLowerCase())) {
      // Run normal snapshot (without watch flag)
      const snapshotOptions = { ...options, watch: false };
      return this.execute(snapshotOptions);
    }

    return 1;
  }

  private async executeBranchAware(options: SnapshotOptions): Promise<number> {
    const format = options.format || 'plain';

    try {
      await this.ensureInitialized();

      // 1. Get git context (branch + remote URL)
      let branch: string;
      let remoteUrl: string;

      if (options.branch) {
        // Branch override provided, still need remote URL
        branch = options.branch;
        try {
          const gitCtx = getGitContext();
          remoteUrl = gitCtx.remoteUrl;
        } catch (error) {
          logger.error('Could not determine git remote URL. Provide a build ref instead.');
          return 1;
        }
      } else {
        try {
          const gitCtx = getGitContext();
          branch = gitCtx.branch;
          remoteUrl = gitCtx.remoteUrl;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(message);
          return 1;
        }
      }

      if (options.debug) {
        logger.debug('Branch-aware snapshot:', { branch, remoteUrl });
      }

      // 2. Parse remote URL and generate candidates
      const parsed = parseGitRemoteUrl(remoteUrl);
      const candidates = generateRepoCandidates(parsed);

      if (options.debug) {
        logger.debug('Repo URL candidates:', candidates);
      }

      // 3. Resolve organization
      let orgSlug: string;
      if (options.org) {
        orgSlug = options.org;
      } else {
        const orgSlugs = await this.client.getViewerOrganizationSlugs();
        if (orgSlugs.length === 0) {
          logger.error('No organizations found. Check your API token permissions.');
          return 1;
        }
        if (orgSlugs.length > 1) {
          logger.error(`Multiple organizations found: ${orgSlugs.join(', ')}. Use --org to specify which one.`);
          return 1;
        }
        orgSlug = orgSlugs[0];
      }

      // 4. Query pipelines with builds for this branch
      const spinner = Progress.spinner(`Searching for ${branch} builds...`, { format });
      const pipelineBuilds = await this.client.getPipelineBuildsForRepo(orgSlug, candidates, branch);
      spinner.stop();

      if (pipelineBuilds.length === 0) {
        logger.error(`No pipelines found matching ${parsed.org}/${parsed.repo}. Check your organization slug.`);
        return 1;
      }

      // 5. Filter to pipelines that have builds on this branch
      const withBuilds = pipelineBuilds.filter(p => p.build !== null);

      if (withBuilds.length === 0) {
        logger.console(`Found ${pipelineBuilds.length} pipeline(s) for ${parsed.org}/${parsed.repo}, but none have builds on branch ${SEMANTIC_COLORS.identifier(branch)}`);
        logger.console('');
        logger.console('Pipelines:');
        for (const p of pipelineBuilds) {
          logger.console(`  ${SEMANTIC_COLORS.muted('-')} ${p.name} ${SEMANTIC_COLORS.muted(`(${p.slug})`)}`);
        }
        return 0;
      }

      // 6. Display summary
      logger.console(`Branch ${SEMANTIC_COLORS.identifier(branch)} in ${parsed.org}/${parsed.repo}`);
      logger.console('');

      for (const p of withBuilds) {
        const build = p.build;
        const state = build.state || 'unknown';
        const icon = getStateIcon(state);
        const theme = BUILD_STATUS_THEME[state.toUpperCase() as keyof typeof BUILD_STATUS_THEME];
        const coloredIcon = theme ? theme.color(icon) : icon;
        const message = build.message?.split('\n')[0] || '';
        const number = build.number;
        const buildRef = `${orgSlug}/${p.slug}/${number}`;

        logger.console(`  ${coloredIcon} ${p.name} #${number} ${SEMANTIC_COLORS.muted(message)}`);
        logger.console(`    ${SEMANTIC_COLORS.muted(buildRef)}`);
      }

      logger.console('');

      // 7. Snapshot all builds (logs are only fetched for failed steps by default)
      logger.console(`Snapshotting ${withBuilds.length} build(s)...`);
      logger.console('');

      let hasFailure = false;
      for (const p of withBuilds) {
        const buildRef = `${orgSlug}/${p.slug}/${p.build.number}`;
        const exitCode = await this.execute({ ...options, buildRef });
        if (exitCode !== 0) hasFailure = true;
        logger.console('');
      }

      return hasFailure ? 1 : 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Branch-aware snapshot failed: ${errorMessage}`);
      if (options.debug && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      return 1;
    }
  }

  private getOutputDir(options: SnapshotOptions, org: string, pipeline: string, buildNumber: number): string {
    const baseDir = options.outputDir || path.join(process.cwd(), 'tmp', 'bktide', 'snapshots');
    return path.join(baseDir, org, pipeline, String(buildNumber));
  }

  private async createDirectories(outputDir: string): Promise<void> {
    const stepsDir = path.join(outputDir, 'steps');
    await fs.mkdir(stepsDir, { recursive: true });
  }

  private async saveBuildJson(outputDir: string, build: any): Promise<void> {
    const buildPath = path.join(outputDir, 'build.json');
    await fs.writeFile(buildPath, JSON.stringify(build, null, 2), 'utf-8');
  }

  private async fetchAndSaveStep(
    outputDir: string,
    org: string,
    pipeline: string,
    buildNumber: number,
    job: any,
    stepIndex: number,
    debug?: boolean
  ): Promise<StepResult> {
    const stepDirName = getStepDirName(stepIndex, job.name || job.label || 'step');
    const stepDir = path.join(outputDir, 'steps', stepDirName);

    // Create step directory
    await fs.mkdir(stepDir, { recursive: true });

    // Save step.json (job metadata)
    const stepPath = path.join(stepDir, 'step.json');
    await fs.writeFile(stepPath, JSON.stringify(job, null, 2), 'utf-8');

    // Try to fetch and save log
    try {
      const logData = await this.restClient.getJobLog(org, pipeline, buildNumber, job.uuid);
      const logPath = path.join(stepDir, 'log.txt');
      await fs.writeFile(logPath, logData.content || '', 'utf-8');

      return {
        id: stepDirName,
        jobId: job.id,
        status: 'success',
        job: job,  // Add full job object
      };
    } catch (error) {
      if (debug) {
        logger.debug(`Failed to fetch log for job ${job.id}:`, error);
      }

      const errorInfo = categorizeError(error instanceof Error ? error : new Error(String(error)));
      return {
        id: stepDirName,
        jobId: job.id,
        status: 'failed',
        job: job,  // Add full job object
        error: errorInfo.error,
        message: errorInfo.message,
        retryable: errorInfo.retryable,
      };
    }
  }

  private async fetchAndSaveAnnotations(
    outputDir: string,
    buildSlug: string,
    debug?: boolean
  ): Promise<AnnotationResult> {
    try {
      const annotations = await this.client.getAnnotationsFull(buildSlug);

      if (debug) {
        logger.debug(`Fetched ${annotations.length} annotation(s)`);
      }

      // Save annotations.json
      const annotationsFile: AnnotationsFile = {
        fetchedAt: new Date().toISOString(),
        count: annotations.length,
        annotations: annotations,
      };

      const annotationsPath = path.join(outputDir, 'annotations.json');
      await fs.writeFile(annotationsPath, JSON.stringify(annotationsFile, null, 2), 'utf-8');

      // Return result with items for change detection
      const items = annotations.map((a: any) => ({ uuid: a.uuid, updatedAt: a.updatedAt || null }));

      if (annotations.length === 0) {
        return { fetchStatus: 'none', count: 0, items: [] };
      }

      return { fetchStatus: 'success', count: annotations.length, items };
    } catch (error) {
      if (debug) {
        logger.debug(`Failed to fetch annotations:`, error);
      }

      const errorInfo = categorizeError(error instanceof Error ? error : new Error(String(error)));
      return {
        fetchStatus: 'failed',
        count: 0,
        error: errorInfo.error,
        message: errorInfo.message,
      };
    }
  }

  private async fetchAndSaveArtifacts(
    outputDir: string,
    org: string,
    pipeline: string,
    buildNumber: number,
    glob?: string
  ): Promise<ArtifactResult> {
    try {
      const allArtifacts = await this.restClient.listBuildArtifacts(org, pipeline, buildNumber);

      const targets = glob
        ? allArtifacts.filter(a => DOWNLOADABLE_ARTIFACT_STATES.has(a.state) && minimatch(a.path, glob, { matchBase: true }))
        : allArtifacts.filter(a => DOWNLOADABLE_ARTIFACT_STATES.has(a.state));

      if (targets.length === 0) {
        return { fetchStatus: 'none', count: 0, filter: glob };
      }

      const artifactsDir = path.join(outputDir, 'artifacts');
      await fs.mkdir(artifactsDir, { recursive: true });

      const downloaded: BuildkiteArtifact[] = [];
      const failed: Array<{ path: string; error: string }> = [];

      for (const artifact of targets) {
        const safePath = path.normalize(artifact.path).replace(/^(\.\.(\/|\\|$))+/, '');
        const destPath = path.join(artifactsDir, safePath);
        try {
          await this.restClient.downloadArtifact(artifact, destPath);
          downloaded.push(artifact);
          logger.debug(`Downloaded artifact: ${artifact.path}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failed.push({ path: artifact.path, error: msg });
          logger.debug(`Failed to download artifact ${artifact.path}: ${msg}`);
        }
      }

      return {
        fetchStatus: failed.length === 0 ? 'success' : (downloaded.length === 0 ? 'failed' : 'success'),
        count: downloaded.length,
        filter: glob,
        items: downloaded.map(a => ({
          id: a.id,
          jobId: a.job_id,
          path: a.path,
          file_size: a.file_size,
          sha1sum: a.sha1sum,
          mime_type: a.mime_type,
        })),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.debug(`Failed to fetch artifacts: ${msg}`);
      return { fetchStatus: 'failed', count: 0, filter: glob, error: msg };
    }
  }

  /**
   * The `build` sub-object shared by a freshly written manifest and a
   * refreshed-in-memory reuse of an existing one. Build-level facts (author,
   * timestamps) come straight off the live GraphQL response either way, so
   * both paths stay accurate without needing a disk write.
   */
  private buildManifestBuildSection(build: any): Manifest['build'] {
    return {
      state: build.state || 'unknown',
      number: build.number,
      message: build.message?.split('\n')[0] || '',
      branch: build.branch || 'unknown',
      commit: build.commit?.substring(0, 7) || 'unknown',
      finishedAt: build.finishedAt || null,
      startedAt: build.startedAt || null,
      createdAt: build.createdAt || null,
      author: build.createdBy
        ? { name: build.createdBy.name ?? null, email: build.createdBy.email ?? null }
        : null,
    };
  }

  private buildManifest(
    org: string,
    pipeline: string,
    buildNumber: number,
    build: any,
    scriptJobs: any[],
    stepResults: StepResult[],
    annotationResult: AnnotationResult,
    artifactResult?: ArtifactResult
  ): Manifest {
    const allFetchesSucceeded = stepResults.every(s => s.status === 'success');
    const fetchErrors = stepResults.filter(s => s.status === 'failed');

    const manifest: Manifest = {
      version: 3,
      buildRef: `${org}/${pipeline}/${buildNumber}`,
      url: `https://buildkite.com/${org}/${pipeline}/builds/${buildNumber}`,
      fetchedAt: new Date().toISOString(),
      fetchComplete: allFetchesSucceeded && annotationResult.fetchStatus !== 'failed',
      build: this.buildManifestBuildSection(build),
      jobStats: calculateJobStats(scriptJobs),
      annotations: {
        fetchStatus: annotationResult.fetchStatus,
        count: annotationResult.count,
        items: annotationResult.items,
      },
      ...(artifactResult && artifactResult.fetchStatus !== 'skipped' && {
        artifacts: {
          fetchStatus: artifactResult.fetchStatus,
          count: artifactResult.count,
          filter: artifactResult.filter,
          items: artifactResult.items,
          error: artifactResult.error,
        },
      }),
      steps: stepResults.map(result => ({
        // Our metadata
        id: result.id,
        fetchStatus: result.status,

        // Buildkite job metadata (flat structure)
        jobId: result.jobId,
        type: result.job.type || 'script',
        name: result.job.name || '',
        label: result.job.label || '',
        state: result.job.state || 'unknown',
        exit_status: result.job.exitStatus ?? null,
        started_at: result.job.startedAt || null,
        finished_at: result.job.finishedAt || null,
      })),
    };

    // Only include fetchErrors if any exist
    if (fetchErrors.length > 0) {
      manifest.fetchErrors = fetchErrors.map(err => ({
        id: err.id,
        jobId: err.jobId,
        fetchStatus: 'failed' as const,
        error: err.error!,
        message: err.message!,
        retryable: err.retryable!,
      }));
    }

    return manifest;
  }

  private async saveManifest(outputDir: string, manifest: Manifest): Promise<void> {
    const manifestPath = path.join(outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Load existing manifest if present
   * Returns null if no manifest exists or parsing fails
   */
  private async loadExistingManifest(outputDir: string): Promise<Manifest | null> {
    const manifestPath = path.join(outputDir, 'manifest.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as Manifest;
      // Accept v2 and v3 manifests (v3 adds optional artifacts section)
      if (manifest.version !== 2 && manifest.version !== 3) {
        return null;
      }
      return manifest;
    } catch {
      return null;
    }
  }

  /**
   * Detect what has changed since last snapshot
   * Compares current build state against stored manifest
   */
  private detectChanges(
    currentBuild: any,
    currentJobs: any[],
    existingManifest: Manifest | null,
    force: boolean
  ): BuildChangeResult {
    // Force refresh requested
    if (force) {
      return { hasChanges: true, reason: 'force_refresh' };
    }

    // No existing manifest - full fetch needed
    if (!existingManifest) {
      return { hasChanges: true, reason: 'no_existing_manifest' };
    }

    const currentState = currentBuild.state?.toUpperCase();

    // Build still running - always re-fetch
    if (!TERMINAL_BUILD_STATES.includes(currentState)) {
      return { hasChanges: true, reason: 'build_running' };
    }

    // Check if build finished at different time (rebuild scenario)
    const currentFinishedAt = currentBuild.finishedAt;
    const storedFinishedAt = existingManifest.build.finishedAt;
    if (currentFinishedAt !== storedFinishedAt) {
      return { hasChanges: true, reason: 'build_finished_changed' };
    }

    // For terminal builds with matching finishedAt, the build can't have changed
    // Skip job-level comparison since we may have only stored a subset (e.g., --failed mode)
    if (existingManifest.fetchComplete) {
      return { hasChanges: false };
    }

    // Compare job states (only for incomplete fetches)
    const jobsToRefetch: string[] = [];
    const storedJobMap = new Map(
      existingManifest.steps.map(s => [s.jobId, s])
    );

    for (const jobEdge of currentJobs) {
      const job = jobEdge.node;
      if (job.__typename !== 'JobTypeCommand' && job.__typename) continue;

      const storedJob = storedJobMap.get(job.id);

      // New job - needs fetch
      if (!storedJob) {
        jobsToRefetch.push(job.id);
        continue;
      }

      // Job state changed
      if (job.state !== storedJob.state) {
        jobsToRefetch.push(job.id);
        continue;
      }

      // Job finished at different time
      if (job.finishedAt !== storedJob.finished_at) {
        jobsToRefetch.push(job.id);
      }
    }

    // If any jobs need re-fetching, there are changes
    if (jobsToRefetch.length > 0) {
      return {
        hasChanges: true,
        reason: 'build_finished_changed',
        jobsToRefetch,
      };
    }

    // No changes detected
    return { hasChanges: false };
  }

  /**
   * Check if annotations have changed
   * Returns true if any annotation is new or has been updated
   */
  private async checkAnnotationsChanged(
    buildSlug: string,
    existingManifest: Manifest | null
  ): Promise<boolean> {
    if (!existingManifest?.annotations?.items) {
      return true;  // No stored annotations, need to fetch
    }

    try {
      const currentTimestamps = await this.client.getAnnotationTimestamps(buildSlug);

      // Create map of stored annotations
      const storedMap = new Map(
        existingManifest.annotations.items.map(a => [a.uuid, a.updatedAt])
      );

      // Check for new or updated annotations
      for (const current of currentTimestamps) {
        const storedUpdatedAt = storedMap.get(current.uuid);
        if (storedUpdatedAt === undefined) {
          return true;  // New annotation
        }
        if (current.updatedAt !== storedUpdatedAt) {
          return true;  // Updated annotation
        }
      }

      // Check count matches
      if (currentTimestamps.length !== existingManifest.annotations.items.length) {
        return true;  // Annotation count changed (deleted)
      }

      return false;
    } catch {
      return true;  // Error checking, re-fetch to be safe
    }
  }

}
