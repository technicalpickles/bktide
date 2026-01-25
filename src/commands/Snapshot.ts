import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { Progress } from '../ui/progress.js';
import { getStateIcon, SEMANTIC_COLORS, BUILD_STATUS_THEME, TipStyle } from '../ui/theme.js';
import { Reporter } from '../ui/reporter.js';
import { formatDistanceToNow } from 'date-fns';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface SnapshotOptions extends BaseCommandOptions {
  buildRef?: string;
  outputDir?: string;
  json?: boolean;
  failed?: boolean;
  all?: boolean;
}

interface StepResult {
  id: string;
  jobId: string;
  status: 'success' | 'failed';
  job: any;  // Full job object from Buildkite API
  error?: string;
  message?: string;
  retryable?: boolean;
}

interface Manifest {
  version: number;
  buildRef: string;
  url: string;
  fetchedAt: string;
  fetchComplete: boolean;  // Renamed from 'complete'
  build: {
    state: string;
    number: number;
    message: string;
    branch: string;
    commit: string;
  };
  annotations?: {
    fetchStatus: 'success' | 'none' | 'failed';
    count: number;
  };
  steps: Array<{
    // Our metadata
    id: string;
    fetchStatus: 'success' | 'failed';  // Renamed from 'status'

    // Buildkite job metadata (flat)
    jobId: string;
    type: string;
    name: string;
    label: string;
    state: string;
    exit_status: number | null;
    started_at: string | null;
    finished_at: string | null;
  }>;
  fetchErrors?: Array<{
    id: string;
    jobId: string;
    fetchStatus: 'failed';
    error: string;
    message: string;
    retryable: boolean;
  }>;
}

interface AnnotationResult {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
  error?: string;
  message?: string;
}

interface AnnotationsFile {
  fetchedAt: string;
  count: number;
  annotations: any[];  // Raw annotations from Buildkite API
}

type ErrorCategory = 'rate_limited' | 'not_found' | 'permission_denied' | 'network_error' | 'unknown';

interface StepError {
  error: ErrorCategory;
  message: string;
  retryable: boolean;
}

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


/**
 * Format duration from milliseconds or date range
 */
function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}


/**
 * Generate a sanitized directory name for a step
 */
export function getStepDirName(index: number, label: string): string {
  const num = String(index + 1).padStart(2, '0');
  const sanitized = label
    .replace(/:[^:]+:/g, '')           // Remove emoji shortcodes like :hammer:
    .replace(/[^a-zA-Z0-9-]/g, '-')    // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-')               // Collapse multiple dashes
    .replace(/^-|-$/g, '')             // Trim leading/trailing dashes
    .toLowerCase()
    .slice(0, 50);                     // Limit length
  return `${num}-${sanitized || 'step'}`;
}

export class Snapshot extends BaseCommand {
  static requiresToken = true;
  private reporter: Reporter;

  constructor(options?: Partial<SnapshotOptions>) {
    super(options);
    this.reporter = new Reporter(options?.format || 'plain', options?.quiet, options?.tips);
  }

  async execute(options: SnapshotOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting Snapshot command execution', options);
    }

    if (!options.buildRef) {
      logger.error('Build reference is required');
      return 1;
    }

    const format = options.format || 'plain';
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

      // 4. Create directory structure
      spinner.update('Creating directories…');
      await this.createDirectories(outputDir);

      // 5. Save build.json
      spinner.update('Saving build data…');
      await this.saveBuildJson(outputDir, build);

      // 6. Fetch and save annotations
      spinner.update('Fetching annotations…');
      const annotationResult = await this.fetchAndSaveAnnotations(
        outputDir,
        buildRef.org,
        buildRef.pipeline,
        buildRef.number,
        options.debug
      );

      // 7. Filter and fetch jobs
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
        jobsToFetch = scriptJobs.filter((job: any) => this.isFailedJob(job));
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

        progressBar.complete(`Fetched ${totalJobs} step${totalJobs > 1 ? 's' : ''}`);
      }

      // 8. Write manifest
      const manifest = this.buildManifest(
        buildRef.org,
        buildRef.pipeline,
        buildRef.number,
        build,
        stepResults,
        annotationResult  // Add annotation result
      );
      await this.saveManifest(outputDir, manifest);

      // 9. Output based on options
      if (options.json) {
        logger.console(JSON.stringify(manifest, null, 2));
      } else {
        // Show build summary first
        this.displayBuildSummary(build, scriptJobs);

        // Then show snapshot info
        const fetchErrorCount = stepResults.filter(s => s.status === 'failed').length;

        logger.console(`Snapshot saved to ${outputDir}`);

        if (stepResults.length > 0) {
          logger.console(`  ${stepResults.length} step(s) captured`);
        } else if (!fetchAll) {
          logger.console(`  No failed steps to capture (build metadata saved)`);
        } else {
          logger.console(`  No steps to capture (build metadata saved)`);
        }

        if (annotationResult.count > 0) {
          logger.console(`  ${annotationResult.count} annotation(s) captured`);
        } else if (annotationResult.fetchStatus === 'none') {
          if (options.debug) {
            logger.console(`  No annotations present`);
          }
        } else if (annotationResult.fetchStatus === 'failed') {
          logger.console(`  Warning: Failed to fetch annotations`);
        }

        if (fetchErrorCount > 0) {
          logger.console(`  Warning: ${fetchErrorCount} step(s) had errors fetching logs`);
        }

        // Show tip about --all if we filtered to failed only and there are passing steps
        if (!fetchAll && scriptJobs.length > jobsToFetch.length) {
          const skippedCount = scriptJobs.length - jobsToFetch.length;
          logger.console(`  Tip: ${skippedCount} passing step(s) skipped. Use --all to capture all logs.`);
        }

        logger.console('');

        // Show contextual navigation tips (check if tips are enabled)
        if (this.options.tips !== false) {
          this.displayNavigationTips(outputDir, build, scriptJobs, stepResults.length, annotationResult);
        }
      }

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

  private getOutputDir(options: SnapshotOptions, org: string, pipeline: string, buildNumber: number): string {
    const baseDir = options.outputDir || path.join(os.homedir(), '.bktide', 'snapshots');
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
    org: string,
    pipeline: string,
    buildNumber: number,
    debug?: boolean
  ): Promise<AnnotationResult> {
    try {
      const annotations = await this.restClient.getBuildAnnotations(org, pipeline, buildNumber);

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

      // Return result
      if (annotations.length === 0) {
        return { fetchStatus: 'none', count: 0 };
      }

      return { fetchStatus: 'success', count: annotations.length };
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

  private buildManifest(
    org: string,
    pipeline: string,
    buildNumber: number,
    build: any,
    stepResults: StepResult[],
    annotationResult: AnnotationResult
  ): Manifest {
    const allFetchesSucceeded = stepResults.every(s => s.status === 'success');
    const fetchErrors = stepResults.filter(s => s.status === 'failed');

    const manifest: Manifest = {
      version: 2,
      buildRef: `${org}/${pipeline}/${buildNumber}`,
      url: `https://buildkite.com/${org}/${pipeline}/builds/${buildNumber}`,
      fetchedAt: new Date().toISOString(),
      fetchComplete: allFetchesSucceeded && annotationResult.fetchStatus !== 'failed',
      build: {
        state: build.state || 'unknown',
        number: build.number,
        message: build.message?.split('\n')[0] || '',
        branch: build.branch || 'unknown',
        commit: build.commit?.substring(0, 7) || 'unknown',
      },
      annotations: {
        fetchStatus: annotationResult.fetchStatus,
        count: annotationResult.count,
      },
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
        exit_status: result.job.exit_status ?? null,
        started_at: result.job.started_at || null,
        finished_at: result.job.finished_at || null,
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
   * Check if a job is considered failed
   * Failed states: failed, timed_out, or non-zero exit status
   */
  private isFailedJob(job: any): boolean {
    const state = job.state?.toUpperCase();

    // Check state-based failure
    if (state === 'FAILED' || state === 'TIMED_OUT') {
      return true;
    }

    // Check exit status (non-zero means failure, including soft failures)
    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      const exitCode = parseInt(job.exitStatus, 10);
      return exitCode !== 0;
    }

    // Check passed field
    if (job.passed === false) {
      return true;
    }

    return false;
  }

  /**
   * Get directory name of first failed step for concrete example in tips
   */
  private getFirstFailedStepDir(scriptJobs: any[]): string | null {
    for (let i = 0; i < scriptJobs.length; i++) {
      const job = scriptJobs[i];
      if (this.isFailedJob(job)) {
        return getStepDirName(i, job.name || job.label || 'step');
      }
    }
    return null;
  }

  /**
   * Display contextual navigation tips based on build state
   */
  private displayNavigationTips(
    outputDir: string,
    build: any,
    scriptJobs: any[],
    capturedCount: number,
    annotationResult: AnnotationResult
  ): void {
    const buildState = build.state?.toLowerCase();
    const isFailed = buildState === 'failed' || buildState === 'failing';

    // Relative path for commands
    const relPath = path.relative(process.cwd(), outputDir);
    const manifestPath = path.join(relPath, 'manifest.json');
    const stepsPath = path.join(relPath, 'steps');
    const annotationsPath = path.join(relPath, 'annotations.json');

    logger.console(`  manifest.json has full build metadata and step index`);
    logger.console('');

    const tips: string[] = [];

    if (isFailed) {
      // Tips for failed builds
      tips.push(`List failures:   jq -r '.steps[] | select(.state == "failed") | "\\(.id): \\(.label)"' ${manifestPath}`);

      // Add annotation tip if annotations exist
      if (annotationResult.count > 0) {
        tips.push(`View annotations: jq -r '.annotations[] | {context, style}' ${annotationsPath}`);
      }

      tips.push(`Get exit codes:  jq -r '.steps[] | "\\(.id): exit \\(.exit_status)"' ${manifestPath}`);

      // If we captured steps, show how to view first failed log
      if (capturedCount > 0) {
        const firstFailedDir = this.getFirstFailedStepDir(scriptJobs);
        if (firstFailedDir) {
          tips.push(`View a log:      cat ${path.join(stepsPath, firstFailedDir, 'log.txt')}`);
        }
      }

      tips.push(`Search errors:   grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`);
    } else {
      // Tips for passed builds
      tips.push(`List all steps:  jq -r '.steps[] | "\\(.id): \\(.label) (\\(.state))"' ${manifestPath}`);
      tips.push(`Browse logs:     ls ${stepsPath}/`);

      if (capturedCount > 0) {
        tips.push(`View a log:      cat ${stepsPath}/01-*/log.txt`);
      }
    }

    // Use ACTIONS style for "Next steps:" formatting
    this.reporter.tips(tips, TipStyle.ACTIONS);
  }

  /**
   * Display build summary similar to `build` command
   */
  private displayBuildSummary(build: any, scriptJobs: any[]): void {
    const state = build.state || 'unknown';
    const icon = getStateIcon(state);
    const theme = BUILD_STATUS_THEME[state.toUpperCase() as keyof typeof BUILD_STATUS_THEME];
    const coloredIcon = theme ? theme.color(icon) : icon;
    const message = build.message?.split('\n')[0] || 'No message';
    const duration = formatDuration(build.startedAt, build.finishedAt);
    const durationStr = duration ? ` ${SEMANTIC_COLORS.dim(duration)}` : '';

    // First line: status + message + build number + duration
    const coloredState = theme ? theme.color(state.toUpperCase()) : state.toUpperCase();
    logger.console(`${coloredIcon} ${coloredState} ${message} ${SEMANTIC_COLORS.dim(`#${build.number}`)}${durationStr}`);

    // Second line: author + branch + commit + time
    const author = build.createdBy?.name || build.createdBy?.email || 'Unknown';
    const branch = build.branch || 'unknown';
    const commit = build.commit?.substring(0, 7) || 'unknown';
    const created = build.createdAt ? formatDistanceToNow(new Date(build.createdAt), { addSuffix: true }) : '';
    logger.console(`         ${author} • ${SEMANTIC_COLORS.identifier(branch)} • ${commit} • ${SEMANTIC_COLORS.dim(created)}`);

    // Job statistics
    const passed = scriptJobs.filter(j => {
      if (j.exitStatus !== null && j.exitStatus !== undefined) {
        return parseInt(j.exitStatus, 10) === 0;
      }
      return j.state === 'PASSED' || j.passed === true;
    }).length;

    const hardFailed = scriptJobs.filter(j => {
      if (j.exitStatus !== null && j.exitStatus !== undefined) {
        const exitCode = parseInt(j.exitStatus, 10);
        return exitCode !== 0 && j.softFailed !== true;
      }
      return (j.state === 'FAILED' || j.passed === false) && j.softFailed !== true;
    }).length;

    const softFailed = scriptJobs.filter(j => {
      if (j.exitStatus !== null && j.exitStatus !== undefined) {
        const exitCode = parseInt(j.exitStatus, 10);
        return exitCode !== 0 && j.softFailed === true;
      }
      return (j.state === 'FAILED' || j.passed === false) && j.softFailed === true;
    }).length;

    const running = scriptJobs.filter(j => j.state === 'RUNNING').length;
    const other = scriptJobs.length - passed - hardFailed - softFailed - running;

    let statsStr = `${scriptJobs.length} steps:`;
    const parts: string[] = [];
    if (passed > 0) parts.push(SEMANTIC_COLORS.success(`${passed} passed`));
    if (hardFailed > 0) parts.push(SEMANTIC_COLORS.error(`${hardFailed} failed`));
    if (softFailed > 0) parts.push(SEMANTIC_COLORS.warning(`▲ ${softFailed} soft failure${softFailed > 1 ? 's' : ''}`));
    if (running > 0) parts.push(SEMANTIC_COLORS.info(`${running} running`));
    if (other > 0) parts.push(SEMANTIC_COLORS.muted(`${other} other`));
    statsStr += ' ' + parts.join(', ');

    logger.console('');
    logger.console(statsStr);

    logger.console('');
  }
}
